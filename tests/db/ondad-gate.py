#!/usr/bin/env python3
"""Gate de banco da ONDA D — kits, estoque derivado, consumo, estorno e RBAC.

Executa os cenários contra o banco real usando a API (RPC) com tokens de
usuários de teste (Admin Master e vendedor). Todo dado criado é removido no
final: produtos, variações, composição, pedidos, reservas e movimentações.
"""
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANON = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
TAG = uuid.uuid4().hex[:6]

results: list[tuple[str, bool, str]] = []


def req(method: str, path: str, payload=None, token: str = SERVICE, prefer: str | None = None):
    headers = {"apikey": SERVICE if token == SERVICE else ANON,
               "Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    r = urllib.request.Request(f"{URL}{path}", method=method,
                               data=json.dumps(payload).encode() if payload is not None else None,
                               headers=headers)
    with urllib.request.urlopen(r, timeout=40) as resp:
        body = resp.read().decode()
    return json.loads(body) if body else None


def rpc(fn: str, args: dict, token: str = SERVICE):
    return req("POST", f"/rest/v1/rpc/{fn}", args, token)


def rest(method: str, path: str, payload=None, prefer="return=representation"):
    return req(method, f"/rest/v1{path}", payload, SERVICE, prefer)


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, bool(ok), detail))


def expect_error(name: str, fn) -> None:
    try:
        fn()
        check(name, False, "não lançou erro")
    except urllib.error.HTTPError as exc:
        check(name, True, exc.read().decode()[:160])


def create_user(tag: str, role: str | None) -> tuple[str, str]:
    email = f"gate-d-{tag}-{TAG}@ondad.test"
    password = uuid.uuid4().hex + "Aa1!"
    user = req("POST", "/auth/v1/admin/users",
               {"email": email, "password": password, "email_confirm": True})
    uid = user["id"]
    rest("POST", "/profiles?on_conflict=user_id",
         [{"user_id": uid, "nome": f"Gate D {tag}", "telefone": "31999990000", "status": "ativo"}],
         prefer="resolution=merge-duplicates")
    if role:
        rest("POST", "/user_roles?on_conflict=user_id,role", [{"user_id": uid, "role": role}],
             prefer="resolution=merge-duplicates")
    token = req("POST", "/auth/v1/token?grant_type=password",
                {"email": email, "password": password}, token=ANON)["access_token"]
    return uid, token


def novo_produto(slug: str, modelo: str, tamanho: str, qtd: int) -> str:
    prod = rest("POST", "/produtos", [{
        "sku": slug.upper(), "slug": slug, "nome": slug.replace("-", " ").title(),
        "marca": "7D", "categoria": "Testes", "descricao": "gate onda d",
        "imagens": ["/gate.jpg"], "preco": 500, "ativo": True, "destaque": False,
        "modelo_estoque": modelo, "preco_status": "confirmado",
        "status_publicacao": "publicado", "quantidade_conferida": True,
    }])[0]
    rest("POST", "/produto_variacoes", [{
        "produto_id": prod["id"], "tamanho": tamanho, "quantidade": qtd,
        "origem_tamanho": "confirmado_etiqueta", "origem_tamanho_evidencia": "gate onda d",
        "origem_tamanho_confirmado_em": "now()",
    }])
    return prod["id"]


def variacao(produto_id: str, tamanho: str) -> dict:
    return rest("GET", f"/produto_variacoes?produto_id=eq.{produto_id}&tamanho=eq.{tamanho}"
                       "&select=quantidade,quantidade_reservada,disponivel")[0]


def pedido_args(slug: str, size: str, qty: int, phone: str) -> dict:
    from datetime import date, timedelta
    return {
        "p_itens": [{"slug": slug, "size": size, "quantity": qty}],
        "p_cliente": {"nome": "Cliente OndaD", "telefone": phone, "cpf": "390.533.447-05"},
        "p_entrega": {"metodo": "retirada",
                      "retirada": {"date": str(date.today() + timedelta(days=1)), "time": "10:00"}},
        "p_pagamento": {"metodo": "pix"},
        "p_observacoes": None, "p_canal": "site",
        "p_idempotency_key": f"gate-d-{uuid.uuid4().hex}",
    }


def run() -> int:
    created_products: list[str] = []
    users: list[str] = []
    orders: list[str] = []
    try:
        admin_id, admin_tk = create_user("admin", "admin")
        vend_id, vend_tk = create_user("vend", "atendente")
        users += [admin_id, vend_id]

        a = novo_produto(f"gate-d-comp-a-{TAG}", "multi_variante", "M", 5)
        b = novo_produto(f"gate-d-comp-b-{TAG}", "multi_variante", "M", 4)
        unica = novo_produto(f"gate-d-unica-{TAG}", "peca_unica", "U", 1)
        normal = novo_produto(f"gate-d-normal-{TAG}", "multi_variante", "M", 3)
        kit = novo_produto(f"gate-d-kit-{TAG}", "kit", "M", 0)
        kit2 = novo_produto(f"gate-d-kit2-{TAG}", "kit", "M", 0)
        created_products += [a, b, unica, normal, kit, kit2]

        # D-01 kit sem composição não publica
        av = rpc("avaliar_publicacao", {"p_produto_id": kit}, admin_tk)
        check("D-01 kit sem composição não publica",
              av["canPublish"] is False and "Kit sem composição cadastrada" in av["blockingReasons"],
              json.dumps(av, ensure_ascii=False))

        # D-02 kit não contém outro kit
        expect_error("D-02 kit não contém outro kit", lambda: rest("POST", "/produto_kit_itens", [{
            "kit_id": kit, "kit_tamanho": "M", "componente_id": kit2,
            "componente_tamanho": "M", "quantidade": 1}]))

        # D-03 componente exige tamanho existente
        expect_error("D-03 componente exige tamanho existente", lambda: rest("POST", "/produto_kit_itens", [{
            "kit_id": kit, "kit_tamanho": "M", "componente_id": a,
            "componente_tamanho": "GG", "quantidade": 1}]))

        rest("POST", "/produto_kit_itens", [
            {"kit_id": kit, "kit_tamanho": "M", "componente_id": a, "componente_tamanho": "M", "quantidade": 1},
            {"kit_id": kit, "kit_tamanho": "M", "componente_id": b, "componente_tamanho": "M", "quantidade": 2},
        ])

        # D-04 disponibilidade do kit = elo mais fraco  min(5/1, 4/2) = 2
        disp = rpc("kit_disponivel", {"p_kit_id": kit, "p_tamanho": "M"}, admin_tk)
        check("D-04 kit_disponivel usa o elo mais fraco", disp == 2, f"disponivel={disp}")

        # D-05 kit publicável após composição
        av = rpc("avaliar_publicacao", {"p_produto_id": kit}, admin_tk)
        check("D-05 kit publicável após composição", av["canPublish"] is True,
              json.dumps(av, ensure_ascii=False))

        # D-06/07 explosão do item de kit
        linhas = rpc("explodir_item_pedido", {"p_slug": f"gate-d-kit-{TAG}", "p_size": "M", "p_qty": 2}, admin_tk)
        check("D-06 explodir kit devolve as peças", len(linhas) == 2, str(linhas))
        qtd_b = next((l["quantidade"] for l in linhas if l["produto_id"] == b), None)
        check("D-07 explodir multiplica a quantidade do componente", qtd_b == 4, f"qtd={qtd_b}")

        # D-08 produto normal explode em si mesmo
        linhas = rpc("explodir_item_pedido", {"p_slug": f"gate-d-normal-{TAG}", "p_size": "M", "p_qty": 3}, admin_tk)
        check("D-08 produto normal explode em si mesmo",
              len(linhas) == 1 and linhas[0]["produto_id"] == normal and linhas[0]["quantidade"] == 3,
              str(linhas))

        # D-09 kit recusa movimentação direta de estoque
        expect_error("D-09 kit recusa movimentação direta", lambda: rpc("ajustar_estoque", {
            "p_produto_id": kit, "p_tamanho": "M", "p_tipo": "entrada", "p_qty": 3,
            "p_observacao": "gate", "p_pedido_id": None}, admin_tk))

        # D-10 vendedor não movimenta estoque
        expect_error("D-10 vendedor não movimenta estoque", lambda: rpc("ajustar_estoque", {
            "p_produto_id": a, "p_tamanho": "M", "p_tipo": "entrada", "p_qty": 1,
            "p_observacao": "gate", "p_pedido_id": None}, vend_tk))

        # D-11 checkout de kit reserva as peças componentes
        pedido = rpc("criar_pedido", pedido_args(f"gate-d-kit-{TAG}", "M", 1, "(31) 97777-6601"), ANON)[0]
        orders.append(pedido["id"])
        reservas = rest("GET", f"/reservas_estoque?pedido_id=eq.{pedido['id']}&select=produto_id,quantidade,estado")
        comps = sorted(r["produto_id"] for r in reservas)
        check("D-11 checkout de kit reserva as peças", comps == sorted([a, b]), str(reservas))
        check("D-12 kit não gera reserva própria", all(r["produto_id"] != kit for r in reservas))
        check("D-13 reserva do kit reduz disponível da peça",
              variacao(b, "M")["disponivel"] == 2, str(variacao(b, "M")))

        # D-14..17 consumo do pedido baixa as peças, não o kit
        for status in ["em_atendimento", "aguardando_pagamento", "pagamento_confirmado", "separado"]:
            rpc("transicionar_pedido", {"p_pedido_id": pedido["id"], "p_novo_status": status}, admin_tk)
        check("D-14 consumo baixa 1x peça A", variacao(a, "M")["quantidade"] == 4, str(variacao(a, "M")))
        check("D-15 consumo baixa 2x peça B", variacao(b, "M")["quantidade"] == 2, str(variacao(b, "M")))
        check("D-16 kit permanece sem saldo próprio", variacao(kit, "M")["quantidade"] == 0)
        reservas = rest("GET", f"/reservas_estoque?pedido_id=eq.{pedido['id']}&select=estado")
        check("D-17 reservas do kit viram venda", all(r["estado"] == "vendida" for r in reservas), str(reservas))

        # D-18..20 cancelamento estorna as peças
        rpc("transicionar_pedido", {"p_pedido_id": pedido["id"], "p_novo_status": "cancelado"}, admin_tk)
        check("D-18 cancelamento estorna peça A", variacao(a, "M")["quantidade"] == 5, str(variacao(a, "M")))
        check("D-19 cancelamento estorna peça B", variacao(b, "M")["quantidade"] == 4, str(variacao(b, "M")))
        movs = rest("GET", f"/produto_movimentacoes?pedido_id=eq.{pedido['id']}&select=produto_id")
        check("D-20 movimentações registram o kit explodido",
              movs and all(m["produto_id"] != kit for m in movs), str(movs))

        # D-21 peça sem saldo bloqueia o kit
        rest("PATCH", f"/produto_variacoes?produto_id=eq.{b}&tamanho=eq.M", {"quantidade": 1})
        expect_error("D-21 peça sem saldo bloqueia o kit",
                     lambda: rpc("criar_pedido", pedido_args(f"gate-d-kit-{TAG}", "M", 1, "(31) 97777-6602"), ANON))
        rest("PATCH", f"/produto_variacoes?produto_id=eq.{b}&tamanho=eq.M", {"quantidade": 4})

        # D-22 peça única não é vendida duas vezes
        p2 = rpc("criar_pedido", pedido_args(f"gate-d-unica-{TAG}", "U", 1, "(31) 97777-6603"), ANON)[0]
        orders.append(p2["id"])
        expect_error("D-22 peça única não vende duas vezes",
                     lambda: rpc("criar_pedido", pedido_args(f"gate-d-unica-{TAG}", "U", 1, "(31) 97777-6604"), ANON))

        # D-23 kit cuja peça única está reservada fica indisponível
        rest("PATCH", f"/produto_variacoes?produto_id=eq.{kit2}&tamanho=eq.M", {"tamanho": "U"})
        rest("POST", "/produto_kit_itens", [{"kit_id": kit2, "kit_tamanho": "U",
                                             "componente_id": unica, "componente_tamanho": "U",
                                             "quantidade": 1}])
        disp = rpc("kit_disponivel", {"p_kit_id": kit2, "p_tamanho": "U"}, admin_tk)
        check("D-23 kit com peça única reservada fica sem saldo", disp == 0, f"disp={disp}")

        # D-24 peça única acima de 1 unidade é recusada
        expect_error("D-24 peça única aceita apenas 1 unidade",
                     lambda: rpc("criar_pedido", pedido_args(f"gate-d-unica-{TAG}", "U", 2, "(31) 97777-6605"), ANON))
    finally:
        for oid in orders:
            for table in ("reservas_estoque", "produto_movimentacoes", "pedido_eventos",
                          "pedido_status_historico", "pedido_pagamentos", "financeiro_lancamentos"):
                try:
                    rest("DELETE", f"/{table}?pedido_id=eq.{oid}", prefer="return=minimal")
                except urllib.error.HTTPError as exc:
                    print(f"AVISO limpeza {table}: {exc}", file=sys.stderr)
            try:
                rest("DELETE", f"/pedidos?id=eq.{oid}", prefer="return=minimal")
            except urllib.error.HTTPError as exc:
                print(f"AVISO limpeza pedidos: {exc}", file=sys.stderr)
        for pid in created_products:
            for table, col in (("produto_kit_itens", "kit_id"), ("produto_kit_itens", "componente_id"),
                               ("produto_movimentacoes", "produto_id"), ("reservas_estoque", "produto_id"),
                               ("produto_variacoes", "produto_id")):
                try:
                    rest("DELETE", f"/{table}?{col}=eq.{pid}", prefer="return=minimal")
                except urllib.error.HTTPError as exc:
                    print(f"AVISO limpeza {table}: {exc}", file=sys.stderr)
            try:
                rest("DELETE", f"/produtos?id=eq.{pid}", prefer="return=minimal")
            except urllib.error.HTTPError as exc:
                print(f"AVISO limpeza produtos: {exc}", file=sys.stderr)
        for uid in users:
            try:
                req("DELETE", f"/auth/v1/admin/users/{uid}")
            except urllib.error.HTTPError as exc:
                print(f"AVISO limpeza usuário: {exc}", file=sys.stderr)

    falhas = 0
    for nome, ok, detalhe in results:
        print(f"{'PASS' if ok else 'FAIL'}  {nome}  {detalhe if not ok else ''}".rstrip())
        falhas += 0 if ok else 1
    print(f"\npassaram={len(results) - falhas} falharam={falhas} total={len(results)}")
    if falhas:
        print("GATE ONDA D FALHOU", file=sys.stderr)
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(run())
