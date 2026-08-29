#!/usr/bin/env python3
"""Gate de banco do FINAL-B — hardening e menor privilégio.

B-01 anon perdeu EXECUTE nas RPCs administrativas/internas.
B-02 anon mantém EXECUTE apenas no funil público de checkout.
B-03 `salvar_configuracoes_loja` recusa chave fora da allowlist.
B-04 invariante do último Admin Master ativo está armado no banco.
B-05 `metricas_financeiras` não usa `max(jsonb)`.
B-06 toda função SECURITY DEFINER tem search_path fixo.
B-07 anon não consegue chamar `salvar_configuracoes_loja` via API.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))


def q(sql: str) -> str:
    out = subprocess.run(["psql", "-Atc", sql], capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip())
    return out.stdout.strip()


ADMIN_ONLY = [
    "salvar_configuracoes_loja",
    "resolver_pendencias_pedido",
    "diagnostico_catalogo",
    "qualidade_catalogo",
    "avaliar_publicacao",
    "explodir_item_pedido",
    "expirar_reservas_variacao",
    "parametro_int",
]
PUBLIC_CHECKOUT = [
    "criar_pedido",
    "confirmar_whatsapp_checkout",
    "cancelar_pedido_checkout",
    # a vitrine pública calcula saldo de kits pela view `catalogo_publico`
    "kit_disponivel",
]


def grantees(fn: str) -> set[str]:
    raw = q(
        "select coalesce(string_agg(distinct coalesce(r.rolname,'PUBLIC'),','),'-') "
        "from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
        "left join lateral aclexplode(p.proacl) a on a.privilege_type='EXECUTE' "
        "left join pg_roles r on r.oid=a.grantee "
        f"where n.nspname='public' and p.proname='{fn}'"
    )
    return set(raw.split(",")) if raw and raw != "-" else set()


leaks = [f for f in ADMIN_ONLY if {"anon", "PUBLIC"} & grantees(f)]
check("B-01 anon sem EXECUTE em RPC administrativa", not leaks, ",".join(leaks))

missing = [f for f in PUBLIC_CHECKOUT if "anon" not in grantees(f)]
check("B-02 funil público de checkout preservado", not missing, ",".join(missing))

src = q(
    "select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
    "where n.nspname='public' and p.proname='salvar_configuracoes_loja'"
)
check(
    "B-03 allowlist de configurações",
    "nao permitido" in src and "parcelaMinima" in src,
    "allowlist ausente" if "nao permitido" not in src else "",
)

trg = q(
    "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid "
    "where not t.tgisinternal and t.tgfoid=(select oid from pg_proc where proname='guard_ultimo_admin')"
)
check("B-04 invariante do último Admin Master", trg == "2", f"triggers={trg}")

fin = q(
    "select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
    "where n.nspname='public' and p.proname='metricas_financeiras'"
)
check("B-05 financeiro sem max(jsonb)", "max(" not in fin.lower())

sem_path = q(
    "select coalesce(string_agg(p.proname,','),'') from pg_proc p "
    "join pg_namespace n on n.oid=p.pronamespace "
    "where n.nspname='public' and p.prosecdef and p.proconfig is null"
)
check("B-06 SECURITY DEFINER com search_path", sem_path == "", sem_path)

req = urllib.request.Request(
    f"{URL}/rest/v1/rpc/salvar_configuracoes_loja",
    method="POST",
    data=json.dumps({"p_dados": {"whatsapp": "5599999999999"}}).encode(),
    headers={"apikey": ANON, "Authorization": f"Bearer {ANON}", "Content-Type": "application/json"},
)
try:
    urllib.request.urlopen(req, timeout=30)
    check("B-07 anon não grava configurações", False, "chamada anon foi aceita")
except urllib.error.HTTPError as exc:
    check("B-07 anon não grava configurações", exc.code in (401, 403, 404), f"HTTP {exc.code}")

failed = 0
for name, ok, detail in results:
    print(f"{'PASS' if ok else 'FAIL'} {name}{(' — ' + detail) if detail and not ok else ''}")
    failed += 0 if ok else 1
print(f"\n{len(results) - failed}/{len(results)} checks OK")
sys.exit(1 if failed else 0)
