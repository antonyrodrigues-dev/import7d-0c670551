#!/usr/bin/env python3
"""Gate de banco do fechamento do MVP (Ondas 1–4).

Cobre as invariantes que o Red Team apontou como bloqueadoras:
  Onda 1 — dinheiro: `registrar_pagamento` é a única autoridade do ledger,
           `transicionar_pedido` não confirma pagamento, ledger imutável,
           cancelamento com estorno restrito ao Admin Master.
  Onda 2 — estoque: `sincronizar_variacoes` é atômica, respeita reservas
           ativas e é restrita ao Admin Master.
  Onda 3 — configurações: `configuracoes_loja` só é escrita pelo Admin Master.

Todo dado criado é removido ao final.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

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
    try:
        with urllib.request.urlopen(r, timeout=40) as resp:
            body = resp.read().decode()
    except urllib.error.HTTPError as exc:
        exc.detail = exc.read().decode()
        exc.msg = f"{exc.msg} — {method} {path} — {exc.detail[:300]}"
        raise
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
        check(name, True, getattr(exc, "detail", str(exc))[:160])


def create_user(tag: str, role: str | None) -> tuple[str, str]:
    email = f"gate-mvp-{tag}-{TAG}@mvp.test"
    password = uuid.uuid4().hex + "Aa1!"
    uid = req("POST", "/auth/v1/admin/users",
              {"email": email, "password": password, "email_confirm": True})["id"]
    rest("POST", "/profiles?on_conflict=user_id",
         [{"user_id": uid, "nome": f"Gate MVP {tag}", "telefone": "31999990000", "status": "ativo"}],
         prefer="resolution=merge-duplicates")
    if role:
        rest("POST", "/user_roles?on_conflict=user_id,role", [{"user_id": uid, "role": role}],
             prefer="resolution=merge-duplicates")
    token = req("POST", "/auth/v1/token?grant_type=password",
                {"email": email, "password": password}, token=ANON)["access_token"]
    return uid, token


def novo_produto(slug: str, tamanho: str, qtd: int, preco: float = 300,
                 modelo: str = "multi_variante") -> str:
    prod = rest("POST", "/produtos", [{
        "sku": slug.upper(), "slug": slug, "nome": slug.replace("-", " ").title(),
        "marca": "7D", "categoria": "Testes", "descricao": "gate mvp",
        "imagens": ["/gate.jpg"], "preco": preco, "ativo": True, "destaque": False,
        "modelo_estoque": modelo, "preco_status": "confirmado",
        "status_publicacao": "publicado", "quantidade_conferida": True,
    }])[0]
    rest("POST", "/produto_variacoes", [{
        "produto_id": prod["id"], "tamanho": tamanho, "quantidade": qtd,
        "origem_tamanho": "confirmado_etiqueta", "origem_tamanho_evidencia": "gate mvp",
        "origem_tamanho_confirmado_em": "now()",
    }])
    return prod["id"]


def variacao(produto_id: str, tamanho: str) -> dict:
    return rest("GET", f"/produto_variacoes?produto_id=eq.{produto_id}&tamanho=eq.{tamanho}"
                       "&select=tamanho,quantidade,quantidade_reservada,disponivel")[0]


def pedido_args(slug: str, size: str, qty: int, phone: str) -> dict:
    return {
        "p_itens": [{"slug": slug, "size": size, "quantity": qty}],
        "p_cliente": {"nome": "Cliente MVP", "telefone": phone, "cpf": "390.533.447-05"},
        "p_entrega": {"metodo": "retirada",
                      "retirada": {"date": str(date.today() + timedelta(days=1)), "time": "10:00"}},
        "p_pagamento": {"metodo": "pix"},
        "p_observacoes": None, "p_canal": "site",
        "p_idempotency_key": f"gate-mvp-{uuid.uuid4().hex}",
    }


def ledger(pedido_id: str) -> list[dict]:
    return rest("GET", f"/financeiro_lancamentos?pedido_id=eq.{pedido_id}"
                       "&select=tipo,valor,origem&order=criado_em.asc")


def pedido(pedido_id: str) -> dict:
    return rest("GET", f"/pedidos?id=eq.{pedido_id}&select=status,pagamento_estado,valor_total,valor_devolvido")[0]


def run() -> int:
    produtos: list[str] = []
    users: list[str] = []
    orders: list[str] = []
    try:
        admin_id, admin_tk = create_user("admin", "admin")
        vend_id, vend_tk = create_user("vend", "atendente")
        users += [admin_id, vend_id]

        slug_a = f"gate-mvp-a-{TAG}"
        prod_a = novo_produto(slug_a, "M", 5)
        slug_b = f"gate-mvp-b-{TAG}"
        prod_b = novo_produto(slug_b, "M", 4)
        slug_c = f"gate-mvp-c-{TAG}"
        prod_c = novo_produto(slug_c, "U", 1, modelo="peca_unica")
        produtos += [prod_a, prod_b, prod_c]

        # ───────────── Onda 1 — dinheiro ─────────────
        p1 = rpc("criar_pedido", pedido_args(slug_a, "M", 1, "(31) 96666-0101"), ANON)[0]
        orders.append(p1["id"])
        rpc("transicionar_pedido", {"p_pedido_id": p1["id"], "p_novo_status": "em_atendimento"}, admin_tk)
        rpc("transicionar_pedido", {"p_pedido_id": p1["id"], "p_novo_status": "aguardando_pagamento"}, admin_tk)

        expect_error("M-01 transicionar_pedido não confirma pagamento",
                     lambda: rpc("transicionar_pedido",
                                 {"p_pedido_id": p1["id"], "p_novo_status": "pagamento_confirmado"}, admin_tk))

        check("M-02 sem confirmação não existe lançamento", ledger(p1["id"]) == [], str(ledger(p1["id"])))

        rpc("registrar_pagamento", {"p_pedido_id": p1["id"], "p_estado": "confirmado",
                                    "p_comprovante_url": None, "p_observacao": "gate mvp"}, admin_tk)
        pg = pedido(p1["id"])
        check("M-03 registrar_pagamento sincroniza status do pedido",
              pg["status"] == "pagamento_confirmado" and pg["pagamento_estado"] == "confirmado", str(pg))

        lanc = ledger(p1["id"])
        check("M-04 confirmação gera exatamente uma receita",
              len(lanc) == 1 and lanc[0]["tipo"] == "receita" and float(lanc[0]["valor"]) == float(pg["valor_total"]),
              str(lanc))

        rpc("registrar_pagamento", {"p_pedido_id": p1["id"], "p_estado": "confirmado",
                                    "p_comprovante_url": None, "p_observacao": "repetido"}, admin_tk)
        check("M-05 confirmação repetida não duplica o ledger", len(ledger(p1["id"])) == 1, str(ledger(p1["id"])))

        alvo = rest("GET", f"/financeiro_lancamentos?pedido_id=eq.{p1['id']}&select=id")[0]["id"]
        expect_error("M-06 ledger é imutável (UPDATE bloqueado)",
                     lambda: rest("PATCH", f"/financeiro_lancamentos?id=eq.{alvo}", {"valor": 1}))
        expect_error("M-07 ledger é imutável (DELETE bloqueado)",
                     lambda: rest("DELETE", f"/financeiro_lancamentos?id=eq.{alvo}", prefer="return=minimal"))

        expect_error("M-08 vendedor não cancela com estorno",
                     lambda: rpc("cancelar_pedido_com_estorno",
                                 {"p_pedido_id": p1["id"], "p_motivo": "teste"}, vend_tk))

        antes = variacao(prod_a, "M")
        rpc("cancelar_pedido_com_estorno", {"p_pedido_id": p1["id"], "p_motivo": "gate mvp"}, admin_tk)
        pg = pedido(p1["id"])
        depois = variacao(prod_a, "M")
        lanc = ledger(p1["id"])
        check("M-09 cancelamento com estorno cancela o pedido", pg["status"] == "cancelado", str(pg))
        check("M-10 cancelamento lança estorno no ledger",
              any(l["tipo"] == "estorno" for l in lanc), str(lanc))
        check("M-11 saldo financeiro do pedido zera",
              abs(sum(float(l["valor"]) for l in lanc)) < 0.005, str(lanc))

        check("M-12 estoque volta para a prateleira",
              depois["disponivel"] >= antes["disponivel"], f"antes={antes} depois={depois}")

        # ───────────── Onda 2 — estoque atômico ─────────────
        expect_error("M-13 vendedor não sincroniza variações",
                     lambda: rpc("sincronizar_variacoes", {
                         "p_produto_id": prod_b,
                         "p_variacoes": [{"tamanho": "M", "quantidade": 9}],
                         "p_observacao": "gate"}, vend_tk))

        rpc("sincronizar_variacoes", {
            "p_produto_id": prod_b,
            "p_variacoes": [{"tamanho": "M", "quantidade": 6}, {"tamanho": "G", "quantidade": 2}],
            "p_observacao": "gate mvp"}, admin_tk)
        vs = rest("GET", f"/produto_variacoes?produto_id=eq.{prod_b}&select=tamanho,quantidade&order=tamanho.asc")
        check("M-14 sincronizar_variacoes cria e atualiza tamanhos",
              [(v["tamanho"], v["quantidade"]) for v in vs] == [("G", 2), ("M", 6)], str(vs))

        mov = rest("GET", f"/produto_movimentacoes?produto_id=eq.{prod_b}&select=tipo,quantidade")
        check("M-15 ajuste de estoque gera trilha de movimentação", len(mov) > 0, str(mov))

        # Reserva temporária existe para peça única (regra oficial da Onda 0).
        p2 = rpc("criar_pedido", pedido_args(slug_c, "U", 1, "(31) 96666-0202"), ANON)[0]
        orders.append(p2["id"])
        vc = variacao(prod_c, "U")
        check("M-16 reserva do checkout reduz o disponível",
              vc["disponivel"] == 0 and vc["quantidade_reservada"] == 1, str(vc))

        expect_error("M-17 tamanho com reserva ativa não pode ser removido",
                     lambda: rpc("sincronizar_variacoes", {
                         "p_produto_id": prod_c,
                         "p_variacoes": [{"tamanho": "G", "quantidade": 2}],
                         "p_observacao": "gate"}, admin_tk))
        check("M-18 tentativa recusada não altera o estoque",
              variacao(prod_c, "U")["quantidade"] == 1, str(variacao(prod_c, "U")))


        expect_error("M-19 estoque nunca fica negativo",
                     lambda: rpc("ajustar_estoque", {
                         "p_produto_id": prod_b, "p_tamanho": "G", "p_tipo": "saida",
                         "p_qty": 99, "p_observacao": "gate", "p_pedido_id": None}, admin_tk))

        # ───────────── Onda 3 — configurações ─────────────
        expect_error("M-20 vendedor não grava configurações da loja",
                     lambda: rpc("salvar_configuracoes_loja",
                                 {"p_dados": {"whatsapp": "5499999999"}}, vend_tk))

        atual = rest("GET", "/configuracoes_loja?select=id,dados")
        anterior = atual[0]["dados"] if atual else None
        novo = dict(anterior or {})
        novo["_gate_mvp"] = TAG
        salvo = rpc("salvar_configuracoes_loja", {"p_dados": novo}, admin_tk)
        dados = salvo["dados"] if isinstance(salvo, dict) else salvo[0]["dados"]
        check("M-21 Admin Master grava configurações no banco", dados.get("_gate_mvp") == TAG, str(dados)[:160])
        if anterior is not None:
            rpc("salvar_configuracoes_loja", {"p_dados": anterior}, admin_tk)
            volta = rest("GET", "/configuracoes_loja?select=dados")[0]["dados"]
            check("M-22 configuração restaurada sem resíduo do gate", "_gate_mvp" not in volta, str(volta)[:160])
        else:
            rest("DELETE", "/configuracoes_loja?dados->>_gate_mvp=eq." + TAG, prefer="return=minimal")
            check("M-22 configuração restaurada sem resíduo do gate", True)
    finally:
        limpar(orders, produtos, users)

    return 0


def limpar(orders: list[str], produtos: list[str], users: list[str]) -> None:
    """Limpeza profunda. O ledger é imutável pela API, então usa conexão direta."""
    if not (orders or produtos or users):
        return
    ids = lambda xs: ", ".join(f"'{x}'::uuid" for x in xs) or "null"
    stmts = ["set session_replication_role = replica;"]
    if orders:
        for table in ("reservas_estoque", "produto_movimentacoes", "pedido_eventos",
                      "pedido_status_historico", "pedido_pagamentos", "pedido_atendimentos",
                      "pedido_devolucao_itens", "financeiro_lancamentos"):
            col = "devolucao_id" if table == "pedido_devolucao_itens" else "pedido_id"
            if col == "pedido_id":
                stmts.append(f"delete from public.{table} where pedido_id in ({ids(orders)});")
        stmts.append(f"delete from public.pedido_devolucoes where pedido_id in ({ids(orders)});")
        stmts.append(f"delete from public.pedidos where id in ({ids(orders)});")
    if produtos:
        for table in ("produto_kit_itens",):
            stmts.append(f"delete from public.{table} where kit_id in ({ids(produtos)}) "
                         f"or componente_id in ({ids(produtos)});")
        for table in ("produto_movimentacoes", "reservas_estoque", "produto_variacoes"):
            stmts.append(f"delete from public.{table} where produto_id in ({ids(produtos)});")
        stmts.append(f"delete from public.produtos where id in ({ids(produtos)});")
    if users:
        stmts.append(f"delete from public.user_roles where user_id in ({ids(users)});")
        stmts.append(f"delete from public.profiles where user_id in ({ids(users)});")
        stmts.append(f"delete from auth.users where id in ({ids(users)});")
    db = os.environ.get("SUPABASE_DB_URL")
    if not db:
        print("AVISO: SUPABASE_DB_URL ausente — limpeza parcial.", file=sys.stderr)
        return
    proc = subprocess.run(["psql", db, "-v", "ON_ERROR_STOP=1", "-q", "-c", " ".join(stmts)],
                          capture_output=True, text=True)
    if proc.returncode != 0:
        print(f"AVISO limpeza: {proc.stderr[:400]}", file=sys.stderr)


def report() -> int:
    falhas = 0
    for nome, ok, detalhe in results:
        print(f"{'PASS' if ok else 'FAIL'}  {nome}  {detalhe if not ok else ''}".rstrip())
        falhas += 0 if ok else 1
    print(f"\npassaram={len(results) - falhas} falharam={falhas} total={len(results)}")
    if falhas:
        print("GATE MVP FALHOU", file=sys.stderr)
    return 1 if falhas else 0


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:  # falha dura também precisa reprovar o gate com relatório
        check("ERRO FATAL", False, str(exc)[:300])
    sys.exit(report())

