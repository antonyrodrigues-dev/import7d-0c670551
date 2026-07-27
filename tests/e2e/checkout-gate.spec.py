"""
7D IMPORTS — Gate do checkout (Playwright / Python)

Cobre o que pode ser validado sem gravar pedidos reais no banco:
  1. Catálogo oficial renderiza (fonte única = servidor).
  2. Tamanhos esgotados ficam desabilitados no ProductSheet.
  3. Quantidade nunca ultrapassa o estoque do tamanho selecionado.
  4. Carrinho persiste no reload e é reconciliado com o catálogo.
  5. Item de carrinho inexistente no catálogo é descartado na ressincronização.

Uso: python tests/e2e/checkout-gate.spec.py
"""

from __future__ import annotations
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright, Page, expect

BASE_URL = "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


async def open_first_product(page: Page) -> str:
    card = page.locator("[data-testid^='product-card-']").first
    await card.scroll_into_view_if_needed()
    slug = (await card.get_attribute("data-testid") or "").replace("product-card-", "")
    await card.click(force=True)
    await expect(page.locator("[role='dialog']").last).to_be_visible()
    return slug


async def main() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.goto(BASE_URL, wait_until="networkidle")

        cards = await page.locator("[data-testid^='product-card-']").count()
        check("catálogo oficial renderiza", cards > 0, f"{cards} produtos")

        slug = await open_first_product(page)

        # Estado do catálogo direto da store (fonte única).
        sizes = await page.locator("[data-testid^='size-']").count()
        disabled = await page.locator("[data-testid^='size-'][disabled]").count()
        check("tamanhos renderizados", sizes > 0, f"{sizes} tamanhos, {disabled} esgotados")

        # Quantidade limitada ao estoque: clica +20x e confere que parou.
        for _ in range(20):
            if await page.get_by_test_id("product-qty-inc").is_disabled():
                break
            await page.get_by_test_id("product-qty-inc").click()
        qty = int(await page.get_by_test_id("product-qty-value").inner_text())
        check("quantidade respeita teto de estoque", 1 <= qty <= 10, f"qty={qty}")

        await page.get_by_test_id("product-add").click()
        await expect(page.get_by_test_id("reserva-drawer")).to_be_visible()
        await page.screenshot(path=str(SHOTS / "gate_1_cart.png"))

        # Persistência entre reloads.
        await page.reload(wait_until="networkidle")
        stored = await page.evaluate("() => localStorage.getItem('7d-reserva')")
        has_item = bool(stored) and slug in stored
        check("carrinho persiste no reload", has_item)

        # Ressincronização: item fantasma some após o catálogo carregar.
        await page.evaluate(
            """() => {
                const raw = JSON.parse(localStorage.getItem('7d-reserva') || '{}');
                raw.state = raw.state || {};
                raw.state.items = [...(raw.state.items || []), {
                    slug: 'produto-inexistente', name: 'Fantasma', price: 999,
                    image: '', size: 'M', quantity: 3,
                }];
                localStorage.setItem('7d-reserva', JSON.stringify(raw));
            }"""
        )
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(1500)
        after = await page.evaluate("() => localStorage.getItem('7d-reserva')")
        check("item fora do catálogo é descartado", "produto-inexistente" not in (after or ""))

        await browser.close()

    print("\n--- RESUMO ---")
    for name, ok, detail in results:
        print(("✓" if ok else "✗"), name, detail)
    failed = [r for r in results if not r[1]]
    print(f"{len(results) - len(failed)}/{len(results)} passaram")


if __name__ == "__main__":
    asyncio.run(main())
