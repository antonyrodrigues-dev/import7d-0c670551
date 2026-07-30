"""
7D IMPORTS — Gate do bug "Checkout stuck after WhatsApp order is created".

Valida a UI do pendingOrder de ponta a ponta (Playwright) SEM gravar pedidos
reais: as RPCs protegidas (`criar_pedido`, `confirmar_whatsapp_checkout`,
`cancelar_pedido_checkout`) são interceptadas na camada de rede, o que também
permite contar chamadas e simular falhas determinísticas.

O comportamento server-side dessas RPCs é coberto por tests/db/checkout-rpc.gate.sql.

Uso: python tests/e2e/checkout-pending.spec.py
"""

from __future__ import annotations

import asyncio
import json
from datetime import date, timedelta
from pathlib import Path

from playwright.async_api import async_playwright, BrowserContext, Page

BASE_URL = "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

SLUG = "polo-piquet-marfim"
SIZE = "M"
OFFICIAL_NAME = "Polo Piquet Marfim"
OFFICIAL_PRICE = 690
ORDER_ID = "11111111-2222-3333-4444-555555555555"
ORDER_NUMERO = "7D-000123"

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


def next_pickup() -> tuple[str, str]:
    """Próximo dia seg–sáb, slot 15:00 (folga de antecedência garantida)."""
    d = date.today() + timedelta(days=1)
    while d.weekday() == 6:  # domingo fechado
        d += timedelta(days=1)
    return d.isoformat(), "15:00"


PICKUP_DATE, PICKUP_TIME = next_pickup()

# Carrinho com dados MANIPULADOS de propósito (preço/nome falsos).
RESERVA_STATE = {
    "state": {
        "items": [
            {
                "slug": SLUG,
                "name": "HACK — nome falso",
                "price": 1,
                "image": "",
                "size": SIZE,
                "quantity": 2,
            }
        ],
        "open": False,
        "searchOpen": False,
    },
    "version": 0,
}

CHECKOUT_STATE = {
    "state": {
        "step": 4,
        "delivery": "retirada",
        "address": {
            "cep": "",
            "rua": "",
            "numero": "",
            "complemento": "",
            "bairro": "",
            "cidade": "",
        },
        "customer": {
            "nome": "Cliente Gate",
            "telefone": "(54) 99999-8888",
            "cpf": "",
            "observacoes": "",
        },
        "payment": "pix",
        "installments": 1,
        "pickup": {"date": PICKUP_DATE, "time": PICKUP_TIME},
        "idempotencyKey": None,
        "pendingOrder": None,
    },
    "version": 0,
}


def criar_pedido_row(qty: int = 2) -> list[dict]:
    subtotal = OFFICIAL_PRICE * qty
    return [
        {
            "id": ORDER_ID,
            "numero_pedido": ORDER_NUMERO,
            "valor_total": subtotal,
            "frete_status": "a_combinar",
            "snapshot": {
                "produtos": [
                    {
                        "slug": SLUG,
                        "name": OFFICIAL_NAME,
                        "size": SIZE,
                        "quantity": qty,
                        "price": OFFICIAL_PRICE,
                        "image": "",
                    }
                ],
                "subtotal": subtotal,
                "entrega": {
                    "metodo": "retirada",
                    "endereco": None,
                    "retirada": {"date": PICKUP_DATE, "time": PICKUP_TIME},
                },
                "pagamento": {"metodo": "pix", "parcelas": 1},
            },
        }
    ]


class Harness:
    """Contexto isolado, com RPCs interceptadas e window.open instrumentado."""

    def __init__(self, ctx: BrowserContext, page: Page) -> None:
        self.ctx = ctx
        self.page = page
        self.calls: dict[str, list[dict]] = {}

    def count(self, rpc: str) -> int:
        return len(self.calls.get(rpc, []))

    def keys(self, rpc: str) -> list[str]:
        return [c.get("p_idempotency_key", "") for c in self.calls.get(rpc, [])]


async def make_harness(
    browser,
    *,
    popup_blocked: bool = False,
    criar_fail: bool = False,
    cancelar_fail: bool = False,
    criar_delay_ms: int = 0,
) -> Harness:
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
    page = await ctx.new_page()
    h = Harness(ctx, page)

    async def handler(route, request):
        rpc = request.url.split("/rpc/")[1].split("?")[0]
        try:
            payload = json.loads(request.post_data or "{}")
        except Exception:
            payload = {}
        h.calls.setdefault(rpc, []).append(payload)

        if rpc == "criar_pedido":
            if criar_delay_ms:
                await asyncio.sleep(criar_delay_ms / 1000)
            if criar_fail:
                await route.fulfill(
                    status=400,
                    content_type="application/json",
                    body=json.dumps({"message": "estoque insuficiente"}),
                )
                return
            qty = len((payload.get("p_itens") or [])) and payload["p_itens"][0].get("quantity", 2)
            await route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(criar_pedido_row(int(qty or 2))),
            )
            return

        if rpc == "confirmar_whatsapp_checkout":
            await route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps([{"whatsapp_declarado_enviado_em": "2026-07-30T21:00:00Z"}]),
            )
            return

        if rpc == "cancelar_pedido_checkout":
            if cancelar_fail:
                await route.fulfill(
                    status=400,
                    content_type="application/json",
                    body=json.dumps(
                        {"message": "O atendimento deste pedido já começou. Fale com a equipe."}
                    ),
                )
                return
            await route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps([{"id": ORDER_ID, "status": "cancelado"}]),
            )
            return

        await route.continue_()

    await ctx.route("**/rest/v1/rpc/**", handler)
    await ctx.add_init_script(
        """
        window.__opened = [];
        const blocked = %s;
        window.open = (url) => { window.__opened.push(url); return blocked ? null : { closed: false, focus(){}, close(){} }; };
        """
        % ("true" if popup_blocked else "false")
    )

    # Semeia carrinho + checkout já na etapa final (estado persistido legítimo).
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.evaluate(
        "([r, c]) => { localStorage.setItem('7d-reserva', r); localStorage.setItem('7d-checkout', c); }",
        [json.dumps(RESERVA_STATE), json.dumps(CHECKOUT_STATE)],
    )
    await page.goto(BASE_URL, wait_until="networkidle")
    return h


async def open_drawer(page: Page) -> None:
    await page.get_by_test_id("header-reserve").click()
    await page.get_by_test_id("reserva-drawer").wait_for(state="visible")
    await page.wait_for_timeout(400)


async def goto_final(page: Page) -> None:
    """Avança as etapas com os dados já persistidos até o botão Finalizar."""
    for _ in range(6):
        if await page.get_by_test_id("checkout-finalizar").count() > 0:
            return
        btn = page.get_by_role("button", name="Continuar")
        if await btn.count() == 0:
            break
        await btn.click()
        await page.wait_for_timeout(250)
    await page.get_by_test_id("checkout-finalizar").wait_for(state="visible")


async def cart_len(page: Page) -> int:
    return await page.evaluate(
        "() => (JSON.parse(localStorage.getItem('7d-reserva')||'{}').state?.items||[]).length"
    )


async def pending_state(page: Page):
    return await page.evaluate(
        "() => JSON.parse(localStorage.getItem('7d-checkout')||'{}').state?.pendingOrder ?? null"
    )


async def scenario_happy(browser) -> None:
    h = await make_harness(browser)
    page = h.page
    await open_drawer(page)
    await goto_final(page)
    await page.get_by_test_id("checkout-finalizar").click()
    await page.get_by_test_id("pending-order-panel").wait_for(state="visible")

    check("pendingOrder aparece após sucesso", await page.get_by_test_id("pending-order-panel").is_visible())
    check("botão Finalizar desaparece", await page.get_by_test_id("checkout-finalizar").count() == 0)
    check("criar_pedido chamado exatamente 1x", h.count("criar_pedido") == 1, str(h.count("criar_pedido")))
    body = await page.get_by_test_id("pending-order-panel").inner_text()
    check(
        "payload manipulado não altera dados oficiais",
        OFFICIAL_NAME in body and "HACK" not in body and "1.380" in body,
        body.replace("\n", " | ")[:160],
    )
    check("WhatsApp aberto com número oficial", ORDER_NUMERO in (await page.evaluate("() => (window.__opened[0]||'')")))
    await page.screenshot(path=str(SHOTS / "pending_1_created.png"))

    # Reload preserva o estado.
    await page.reload(wait_until="networkidle")
    st = await pending_state(page)
    check("reload preserva pendingOrder", bool(st) and st.get("numero") == ORDER_NUMERO)
    await open_drawer(page)
    check("reabrir drawer preserva pendingOrder", await page.get_by_test_id("pending-order-panel").is_visible())
    check("criar_pedido não é rechamado no reload", h.count("criar_pedido") == 1, str(h.count("criar_pedido")))

    # Reenviar reutiliza o mesmo pedido/URL.
    before = await page.evaluate("() => window.__opened.length")
    await page.get_by_test_id("pending-reenviar").click()
    await page.wait_for_timeout(400)
    after_urls = await page.evaluate("() => window.__opened")
    check("reenvio não cria outro pedido", h.count("criar_pedido") == 1, str(h.count("criar_pedido")))
    check(
        "reenvio reutiliza a mesma URL oficial",
        len(after_urls) == before + 1 and after_urls[-1] == after_urls[0],
    )

    # Revisar mantém o pedido e explica a regra.
    await page.get_by_test_id("pending-revisar").click()
    await page.wait_for_timeout(200)
    txt = await page.get_by_test_id("pending-order-panel").inner_text()
    check("Revisar mantém pedido e orienta o cliente", ORDER_NUMERO in txt and await page.get_by_test_id("pending-order-panel").is_visible())

    # "Já enviei" persiste no backend antes de limpar tudo.
    await page.get_by_test_id("pending-ja-enviei").click()
    await page.get_by_test_id("checkout-completed-panel").wait_for(state="visible")
    check("Já enviei persiste no backend", h.count("confirmar_whatsapp_checkout") == 1)
    check(
        "Já enviei usa a idempotencyKey do pedido",
        h.calls["confirmar_whatsapp_checkout"][0].get("p_idempotency_key") == h.keys("criar_pedido")[0],
    )
    check("Já enviei limpa carrinho", await cart_len(page) == 0)
    check("Já enviei limpa pendingOrder", await pending_state(page) is None)
    await page.screenshot(path=str(SHOTS / "pending_2_confirmed.png"))
    await h.ctx.close()


async def scenario_double_click(browser) -> None:
    h = await make_harness(browser, criar_delay_ms=700)
    page = h.page
    await open_drawer(page)
    await goto_final(page)
    btn = page.get_by_test_id("checkout-finalizar")
    await btn.click()
    for _ in range(3):
        if await btn.count() == 0:
            break
        try:
            await btn.click(timeout=300, force=True)
        except Exception:
            pass
    await page.get_by_test_id("pending-order-panel").wait_for(state="visible")
    check("clique duplo não duplica pedido", h.count("criar_pedido") == 1, f"{h.count('criar_pedido')} chamadas")
    keys = h.keys("criar_pedido")
    check("mesma idempotencyKey em todas as tentativas", len(set(keys)) == 1, str(keys))
    await h.ctx.close()


async def scenario_popup_blocked(browser) -> None:
    h = await make_harness(browser, popup_blocked=True)
    page = h.page
    await open_drawer(page)
    await goto_final(page)
    await page.get_by_test_id("checkout-finalizar").click()
    await page.get_by_test_id("pending-order-panel").wait_for(state="visible")
    st = await pending_state(page)
    check("popup bloqueado preserva pendingOrder", bool(st) and st.get("numero") == ORDER_NUMERO)
    check("popup bloqueado mantém CTA de reenvio", await page.get_by_test_id("pending-reenviar").is_visible())
    await h.ctx.close()


async def scenario_create_failure(browser) -> None:
    h = await make_harness(browser, criar_fail=True)
    page = h.page
    await open_drawer(page)
    await goto_final(page)
    await page.get_by_test_id("checkout-finalizar").click()
    await page.wait_for_timeout(1200)
    check("falha da criação preserva carrinho", await cart_len(page) == 1, str(await cart_len(page)))
    check("falha da criação não cria pendingOrder", await pending_state(page) is None)
    check("falha da criação mantém botão Finalizar", await page.get_by_test_id("checkout-finalizar").count() == 1)
    key1 = await page.evaluate(
        "() => JSON.parse(localStorage.getItem('7d-checkout')||'{}').state?.idempotencyKey ?? null"
    )
    check("falha preserva a idempotencyKey para retentativa", bool(key1))
    await h.ctx.close()


async def scenario_cancel_allowed(browser) -> None:
    h = await make_harness(browser)
    page = h.page
    await open_drawer(page)
    await goto_final(page)
    await page.get_by_test_id("checkout-finalizar").click()
    await page.get_by_test_id("pending-order-panel").wait_for(state="visible")
    await page.get_by_test_id("pending-cancelar").click()
    await page.get_by_test_id("pending-cancel-confirm").click()
    await page.get_by_test_id("checkout-completed-panel").wait_for(state="visible")
    check("cancelamento permitido funciona", h.count("cancelar_pedido_checkout") == 1)
    check("cancelamento limpa carrinho e pendingOrder", await cart_len(page) == 0 and await pending_state(page) is None)
    await h.ctx.close()


async def scenario_cancel_blocked(browser) -> None:
    h = await make_harness(browser, cancelar_fail=True)
    page = h.page
    await open_drawer(page)
    await goto_final(page)
    await page.get_by_test_id("checkout-finalizar").click()
    await page.get_by_test_id("pending-order-panel").wait_for(state="visible")
    await page.get_by_test_id("pending-cancelar").click()
    await page.get_by_test_id("pending-cancel-confirm").click()
    await page.wait_for_timeout(1200)
    st = await pending_state(page)
    check("cancelamento proibido é bloqueado", bool(st) and st.get("numero") == ORDER_NUMERO)
    panel = await page.get_by_test_id("pending-order-panel").inner_text()
    check("cancelamento proibido explica o motivo", "atendimento" in panel.lower(), panel.replace("\n", " | ")[:160])
    await page.screenshot(path=str(SHOTS / "pending_3_cancel_blocked.png"))
    await h.ctx.close()


async def main() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        await scenario_happy(browser)
        await scenario_double_click(browser)
        await scenario_popup_blocked(browser)
        await scenario_create_failure(browser)
        await scenario_cancel_allowed(browser)
        await scenario_cancel_blocked(browser)
        await browser.close()

    print("\n--- RESUMO pendingOrder ---")
    failed = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print(("✓" if ok else "✗"), name, detail)
    print(f"{len(results) - len(failed)}/{len(results)} passaram")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
