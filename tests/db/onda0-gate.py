#!/usr/bin/env python3
"""Runner do gate de banco da ONDA 0.

Cria usuários de teste reais na autenticação (Admin Master, dois vendedores,
um funcionário inativo e um usuário sem cargo), executa
`tests/db/onda0.gate.sql` dentro de uma transação com ROLLBACK e remove os
usuários ao final — o banco volta exatamente ao estado anterior.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DB_URL = os.environ["SUPABASE_DB_URL"]
SQL = os.path.join(os.path.dirname(__file__), "onda0.gate.sql")

ROLES = ["adminid", "vendedorid", "vendedor2id", "inativoid", "semcargoid"]


def admin_api(method: str, path: str, payload: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1{path}",
        method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode()
    return json.loads(body) if body else {}


def rest(method: str, path: str, payload=None, prefer: str | None = None) -> None:
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1{path}",
        method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers=headers,
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()


def create_user(tag: str) -> str:
    email = f"gate-{tag}-{uuid.uuid4().hex[:8]}@onda0.test"
    data = admin_api(
        "POST",
        "/admin/users",
        {"email": email, "password": uuid.uuid4().hex + "Aa1!", "email_confirm": True},
    )
    return data["id"]


def main() -> int:
    created: dict[str, str] = {}
    try:
        for tag in ROLES:
            created[tag] = create_user(tag)
            print(f"usuário de teste criado: {tag} -> {created[tag]}")

        rest(
            "POST",
            "/profiles?on_conflict=user_id",
            [
                {"user_id": created["adminid"], "nome": "Gate Admin", "telefone": "31999990001", "status": "ativo"},
                {"user_id": created["vendedorid"], "nome": "Gate Vendedor", "telefone": "31999990002", "status": "ativo"},
                {"user_id": created["vendedor2id"], "nome": "Gate Vendedor 2", "telefone": "31999990003", "status": "ativo"},
                {"user_id": created["inativoid"], "nome": "Gate Inativo", "telefone": "31999990004", "status": "inativo"},
                {"user_id": created["semcargoid"], "nome": "Gate Sem Cargo", "telefone": "31999990005", "status": "ativo"},
            ],
            prefer="resolution=merge-duplicates",
        )
        rest(
            "POST",
            "/user_roles?on_conflict=user_id,role",
            [
                {"user_id": created["adminid"], "role": "admin"},
                {"user_id": created["vendedorid"], "role": "atendente"},
                {"user_id": created["vendedor2id"], "role": "atendente"},
                {"user_id": created["inativoid"], "role": "atendente"},
            ],
            prefer="resolution=merge-duplicates",
        )
        print("perfis e papéis de teste provisionados")

        args = ["psql", DB_URL, "-X", "-v", "ON_ERROR_STOP=1"]
        for tag, uid in created.items():
            args += ["-v", f"{tag}={uid}"]
        args += ["-f", SQL]
        return subprocess.call(args)
    finally:
        for tag, uid in created.items():
            try:
                admin_api("DELETE", f"/admin/users/{uid}")
                print(f"usuário de teste removido: {tag}")
            except urllib.error.HTTPError as exc:  # pragma: no cover
                print(f"AVISO: falha ao remover {tag}: {exc}", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
