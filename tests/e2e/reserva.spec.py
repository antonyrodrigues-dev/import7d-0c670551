"""
7D IMPORTS — E2E de Reserva (Playwright / Python)

Cobre: adicionar à reserva, atualizar quantidade, remover item, abrir/fechar
drawer nos viewports Desktop, Tablet e Mobile.

Uso:
    # dev server rodando em http://localhost:8080
    python -m pytest tests/e2e/reserva.spec.py
    # ou execução direta:
    python tests/e2e/reserva.spec.py
"""

from __future__ import annotations
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright, Page, expect

BASE_URL = "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

VIEWPORTS = {
    "desktop": {"width": 1440, "height": 900},
    "tablet": {"width": 820, "height": 1180},
    "mobile": {"width": 390, "height": 844},
}

SLUG = "polo-piquet-marfim"
SIZE = "M"


async def add_first_product(page: Page) -> None:
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    card = page.get_by_test_id(f"product-card-{SLUG}")
    await card.first.scroll_into_view_if_needed()
    await card.first.click()
    # Selecionar tamanho e adicionar
    await page.get_by_test_id(f"size-{SIZE}").click()
    await page.get_by_test_id("product-add").click()
    await expect(page.get_by_test_id("reserva-drawer")).to_be_visible()


async def run_flow(page: Page, name: str) -> None:
    await add_first_product(page)
    await page.screenshot(path=str(SHOTS / f"{name}_1_added.png"))

    qty = page.get_by_test_id(f"qty-{SLUG}-{SIZE}")
    await expect(qty).to_have_text("1")

    await page.get_by_test_id(f"qty-inc-{SLUG}-{SIZE}").click()
    await expect(qty).to_have_text("2")

    await page.get_by_test_id(f"qty-dec-{SLUG}-{SIZE}").click()
    await expect(qty).to_have_text("1")

    # Remover item
    await page.get_by_test_id(f"qty-remove-{SLUG}-{SIZE}").click()
    await expect(page.get_by_text("Sua reserva aguarda")).to_be_visible()

    # Fechar (ESC) e reabrir pelo header
    await page.keyboard.press("Escape")
    await expect(page.get_by_test_id("reserva-drawer")).to_be_hidden()
    await page.get_by_test_id("header-reserve").click()
    await expect(page.get_by_test_id("reserva-drawer")).to_be_visible()
    await page.screenshot(path=str(SHOTS / f"{name}_2_empty.png"))


async def main() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for name, vp in VIEWPORTS.items():
            ctx = await browser.new_context(viewport=vp)
            page = await ctx.new_page()
            print(f"→ Viewport: {name} {vp}")
            await run_flow(page, name)
            await ctx.close()
            print(f"✓ {name} OK")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())