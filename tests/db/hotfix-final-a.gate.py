#!/usr/bin/env python3
"""Gate do HOTFIX FINAL-A.

Prova, contra o banco real, os dois bugs conhecidos do sold-out:

  H-01  saldo físico 0 + tamanho pendente  → `catalogo_publico.reservavel = false`
  H-02  saldo físico 0 + tamanho pendente  → `criar_pedido` rejeita a tentativa direta
  H-03  peça única (saldo 1) + tamanho pendente → primeiro cliente cria hold físico
  H-04  concorrência: apenas UM pedido vence; o segundo é rejeitado
  H-05  nenhuma quantidade negativa nem reserva dupla após a disputa

Todo dado criado é removido ao final.
"""
import json
import os
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
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
        raise
    return json.loads(body) if body else None


def rpc(fn: str, args: dict, token: str = SERVICE):
    return req("POST", f"/rest/v1/rpc/{fn}", args, token)


def rest(method: str, path: str, payload=None, prefer="return=representation"):
    return req(method, f"/rest/v1{path}", payload, SERVICE, prefer)


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, bool(ok), detail))


def fone(n: int) -> str:
    base = int(TAG, 16) % 10000
    return f"(31) 9{base:04d}-{n:04d}"


def produto_pendente(slug: str, qtd: int, modelo: str) -> str:
    """Produto publicado cujo tamanho NÃO é confirmado (peça sob consulta)."""
    prod = rest("POST", "/produtos", [{
        "sku": slug.upper(), "slug": slug, "nome": slug.replace("-", " ").title(),
        "marca": "7D", "categoria": "Testes", "descricao": "gate hotfix",
        "imagens": ["/gate.jpg"], "preco": 300, "ativo": True, "destaque": False,
        "modelo_estoque": modelo, "preco_status": "confirmado",
        "status_publicacao": "publicado", "quantidade_conferida": True,
    }])[0]
    rest("POST", "/produto_variacoes", [{
        "produto_id": prod["id"], "tamanho": "U", "quantidade": qtd,
        "origem_tamanho": "a_confirmar",
    }])
    return prod["id"]


def pedido_args(slug: str, phone: str) -> dict:
    return {
        "p_itens": [{"slug": slug, "size": "", "quantity": 1}],
        "p_cliente": {"nome": "Cliente Hotfix", "telefone": phone, "cpf": "390.533.447-05"},
        "p_entrega": {"metodo": "retirada",
                      "retirada": {"date": str(date.today() + timedelta(days=1)), "time": "10:00"}},
        "p_pagamento": {"metodo": "pix"},
        "p_observacoes": None, "p_canal": "site",
        "p_idempotency_key": f"gate-hotfix-{uuid.uuid4().hex}",
    }


def variacao(produto_id: str) -> dict:
    return rest("GET", f"/produto_variacoes?produto_id=eq.{produto_id}&tamanho=eq.U"
                       "&select=quantidade,quantidade_reservada,disponivel")[0]


def run() -> int:
    produtos: list[str] = []
    orders: list[str] = []
    try:
        # ── A) sold-out real com tamanho pendente ──
        slug_zero = f"gate-hotfix-zero-{TAG}"
        prod_zero = produto_pendente(slug_zero, 0, "peca_unica")
        produtos.append(prod_zero)

        pub = rest("GET", f"/catalogo_publico?slug=eq.{slug_zero}&select=reservavel,saldo_fisico")
        check("H-01 sold-out + tamanho pendente não é reservável na vitrine",
              bool(pub) and pub[0]["reservavel"] is False and pub[0]["saldo_fisico"] == 0, str(pub))

        try:
            r = rpc("criar_pedido", pedido_args(slug_zero, fone(1)), ANON)
            if r:
                orders.append(r[0]["id"])
            check("H-02 criar_pedido rejeita peça esgotada com tamanho pendente", False, "aceitou")
        except urllib.error.HTTPError as exc:
            detail = getattr(exc, "detail", "")
            check("H-02 criar_pedido rejeita peça esgotada com tamanho pendente",
                  "esgotada" in detail, detail[:160])

        # ── B) peça única, saldo 1, tamanho pendente, dois clientes ──
        slug_uni = f"gate-hotfix-uni-{TAG}"
        prod_uni = produto_pendente(slug_uni, 1, "peca_unica")
        produtos.append(prod_uni)

        def tentar(n: int):
            try:
                return ("ok", rpc("criar_pedido", pedido_args(slug_uni, fone(n)), ANON)[0])
            except urllib.error.HTTPError as exc:
                return ("erro", getattr(exc, "detail", str(exc)))

        with ThreadPoolExecutor(max_workers=2) as pool:
            r1, r2 = list(pool.map(tentar, (2, 3)))

        ganhos = [r for r in (r1, r2) if r[0] == "ok"]
        perdas = [r for r in (r1, r2) if r[0] == "erro"]
        for g in ganhos:
            orders.append(g[1]["id"])

        check("H-03 peça única com tamanho pendente cria hold físico",
              len(ganhos) >= 1, str(ganhos)[:200])
        check("H-04 cliente concorrente é rejeitado (somente um hold)",
              len(ganhos) == 1 and len(perdas) == 1, f"ok={len(ganhos)} erro={len(perdas)}")

        v = variacao(prod_uni)
        reservas = rest("GET", f"/reservas_estoque?produto_id=eq.{prod_uni}"
                               "&estado=eq.reservada_temporariamente&select=quantidade")
        total_reservado = sum(r["quantidade"] for r in reservas)
        check("H-05 sem quantidade negativa nem reserva dupla",
              v["quantidade"] == 1 and v["quantidade_reservada"] == 1
              and v["disponivel"] == 0 and total_reservado == 1,
              f"{v} reservas={reservas}")
    finally:
        limpar(orders, produtos)
    return 0


def limpar(orders: list[str], produtos: list[str]) -> None:
    def apagar(path: str) -> None:
        try:
            rest("DELETE", path, prefer="return=minimal")
        except urllib.error.HTTPError:
            pass

    for oid in orders:
        for tabela in ("reservas_estoque", "pedido_eventos", "pedido_status_historico",
                       "pedido_atendimentos"):
            apagar(f"/{tabela}?pedido_id=eq.{oid}")
        apagar(f"/pedidos?id=eq.{oid}")
    for pid in produtos:
        apagar(f"/reservas_estoque?produto_id=eq.{pid}")
        apagar(f"/produto_movimentacoes?produto_id=eq.{pid}")
        apagar(f"/produto_variacoes?produto_id=eq.{pid}")
        apagar(f"/produtos?id=eq.{pid}")


if __name__ == "__main__":
    code = run()
    for nome, ok, detalhe in results:
        print(("PASS  " if ok else "FAIL  ") + nome + ("" if ok else f" :: {detalhe}"))
    falhas = sum(1 for _, ok, _ in results if not ok)
    print(f"\npassaram={len(results) - falhas} falharam={falhas} total={len(results)}")
    raise SystemExit(1 if falhas else code)
