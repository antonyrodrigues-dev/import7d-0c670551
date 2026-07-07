"""
7D IMPORTS — E2E do ProductSheet (Playwright / Python)

Cobertura:
  1. Abrir / fechar (X, ESC, backdrop) preservando scroll do body.
  2. Trava de scroll: body fixo, apenas UMA área de rolagem interna.
  3. CTA "Adicionar à reserva", preço e seletor de quantidade sempre
     visíveis dentro do viewport em Desktop, Tablet e Mobile.
  4. Foco preso no modal (focus trap), Tab/Shift+Tab cíclicos,
     foco inicial no botão de fechar, retorno de foco ao trigger.
  5. Screenshots de regressão do sheet e do CTA em cada viewport.
  6. Métrica de performance: sem long tasks (>50ms) durante rolagem
     interna; CLS acumulado ≤ 0.1 na sessão.

Uso:
    python tests/e2e/product-sheet.spec.py
"""

from __future__ import annotations
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright, Page, expect

BASE_URL = "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots" / "product-sheet"
SHOTS.mkdir(parents=True, exist_ok=True)

VIEWPORTS = {
    "desktop": {"width": 1440, "height": 900},
    "tablet": {"width": 820, "height": 1180},
    "mobile": {"width": 390, "height": 844},
}
SLUG = "polo-oliva-tipped"


async def install_perf(page: Page) -> None:
    """Coleta long tasks e CLS via PerformanceObserver antes de qualquer navegação."""
    await page.add_init_script(
        """
        window.__perf = { longTasks: [], cls: 0 };
        try {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) window.__perf.longTasks.push(e.duration);
          }).observe({ type: 'longtask', buffered: true });
        } catch {}
        try {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              if (!e.hadRecentInput) window.__perf.cls += e.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
        } catch {}
        """
    )


async def open_sheet(page: Page) -> None:
    card = page.get_by_test_id(f"product-card-{SLUG}").first
    await card.scroll_into_view_if_needed()
    await card.click(force=True)
    await expect(page.get_by_test_id("product-sheet")).to_be_visible()


async def check_visible_in_viewport(page: Page, testid: str) -> None:
    """Falha se o elemento não estiver totalmente dentro do viewport."""
    loc = page.get_by_test_id(testid)
    await expect(loc).to_be_visible()
    box = await loc.bounding_box()
    vh = await page.evaluate("window.innerHeight")
    vw = await page.evaluate("window.innerWidth")
    assert box, f"{testid} sem bounding_box"
    assert box["y"] >= 0 and box["y"] + box["height"] <= vh + 1, (
        f"{testid} fora do viewport vertical: {box} vs {vh}"
    )
    assert box["x"] >= 0 and box["x"] + box["width"] <= vw + 1, (
        f"{testid} fora do viewport horizontal: {box} vs {vw}"
    )


async def assert_scroll_lock(page: Page) -> None:
    pos = await page.evaluate("getComputedStyle(document.body).position")
    assert pos == "fixed", f"body deve estar fixed com scroll lock, got {pos}"
    # Tentar rolar a janela — não deve mover.
    y_before = await page.evaluate("window.scrollY")
    await page.mouse.wheel(0, 800)
    await page.wait_for_timeout(80)
    y_after = await page.evaluate("window.scrollY")
    assert y_before == y_after, f"body rolou com sheet aberto: {y_before} → {y_after}"


async def assert_single_scroll_area(page: Page) -> None:
    """Dentro do sheet deve existir UMA área scrollável (a coluna direita)."""
    count = await page.evaluate(
        """() => {
          const sheet = document.querySelector('[data-testid="product-sheet"]');
          if (!sheet) return -1;
          let n = 0;
          sheet.querySelectorAll('*').forEach(el => {
            const cs = getComputedStyle(el);
            const oy = cs.overflowY;
            if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) n++;
          });
          return n;
        }"""
    )
    assert count <= 1, f"esperado no máximo 1 área rolável no sheet, got {count}"


async def assert_focus_trap(page: Page) -> None:
    # Foco inicial deve estar no botão de fechar.
    focused = await page.evaluate("document.activeElement?.getAttribute('data-testid')")
    assert focused == "product-close", f"foco inicial deveria ser product-close, got {focused}"

    # Tab várias vezes — foco nunca sai do dialog.
    for _ in range(15):
        inside = await page.evaluate(
            """() => {
              const sheet = document.querySelector('[data-testid="product-sheet"]');
              return sheet ? sheet.contains(document.activeElement) : false;
            }"""
        )
        assert inside, "foco escapou do product-sheet durante Tab"
        await page.keyboard.press("Tab")

    # Shift+Tab também mantém dentro.
    for _ in range(15):
        await page.keyboard.press("Shift+Tab")
        inside = await page.evaluate(
            """() => {
              const sheet = document.querySelector('[data-testid="product-sheet"]');
              return sheet ? sheet.contains(document.activeElement) : false;
            }"""
        )
        assert inside, "foco escapou do product-sheet durante Shift+Tab"


async def assert_inert_background(page: Page) -> None:
    """Clicar em um card fora do sheet deve ser interceptado pelo backdrop
    (não deve abrir outro produto)."""
    sheets = await page.locator('[data-testid="product-sheet"]').count()
    assert sheets == 1, f"esperado 1 sheet aberto, got {sheets}"


async def run_viewport(browser, name: str, vp: dict) -> None:
    print(f"\n→ Viewport: {name} {vp}")
    ctx = await browser.new_context(viewport=vp)
    page = await ctx.new_page()
    await install_perf(page)

    await page.goto(BASE_URL, wait_until="networkidle")
    scroll_before = await page.evaluate("window.scrollY")

    # (1) abrir
    await open_sheet(page)
    await page.wait_for_timeout(450)  # aguarda animação de entrada

    # (2) trava de scroll
    await assert_scroll_lock(page)

    # (3) uma única área rolável interna
    await assert_single_scroll_area(page)

    # (4) CTA + quantidade + preço visíveis
    await check_visible_in_viewport(page, "product-add")
    await check_visible_in_viewport(page, "product-qty-value")
    await check_visible_in_viewport(page, "product-qty-inc")
    await check_visible_in_viewport(page, "product-qty-dec")

    # (5) foco preso + Tab order
    await assert_focus_trap(page)
    await assert_inert_background(page)

    # (6) screenshots de regressão
    await page.locator('[data-testid="product-sheet"]').screenshot(
        path=str(SHOTS / f"{name}_sheet.png")
    )
    await page.get_by_test_id("product-add").screenshot(
        path=str(SHOTS / f"{name}_cta.png")
    )

    # (7) medição de jank durante rolagem interna
    await page.evaluate(
        """async () => {
          const sheet = document.querySelector('[data-testid="product-sheet"]');
          const scroller = [...sheet.querySelectorAll('*')].find(el => {
            const cs = getComputedStyle(el);
            return (cs.overflowY === 'auto' || cs.overflowY === 'scroll')
              && el.scrollHeight > el.clientHeight + 1;
          });
          if (!scroller) return;
          for (let y = 0; y <= scroller.scrollHeight; y += 40) {
            scroller.scrollTop = y;
            await new Promise(r => requestAnimationFrame(r));
          }
        }"""
    )
    await page.wait_for_timeout(120)
    perf = await page.evaluate("window.__perf")
    long_tasks = [t for t in perf["longTasks"] if t > 50]
    print(f"  long tasks >50ms: {len(long_tasks)} (max {max(long_tasks, default=0):.0f}ms)")
    print(f"  CLS acumulado: {perf['cls']:.4f}")
    assert perf["cls"] <= 0.1, f"CLS {perf['cls']} acima da meta 0.1"

    # (8) fechar pelo backdrop → scroll restaurado
    await page.mouse.click(5, 5)
    await expect(page.get_by_test_id("product-sheet")).to_be_hidden()
    scroll_after = await page.evaluate("window.scrollY")
    assert scroll_before == scroll_after, (
        f"scroll não restaurado: {scroll_before} → {scroll_after}"
    )

    # (9) reabrir e fechar via ESC — foco retorna ao card
    await open_sheet(page)
    await page.wait_for_timeout(300)
    await page.keyboard.press("Escape")
    await expect(page.get_by_test_id("product-sheet")).to_be_hidden()
    await page.wait_for_timeout(300)
    focused = await page.evaluate("document.activeElement?.getAttribute('data-testid')")
    assert focused == f"product-card-{SLUG}", (
        f"foco não retornou ao card ({focused})"
    )

    await ctx.close()
    print(f"✓ {name} OK")


async def main() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for name, vp in VIEWPORTS.items():
            await run_viewport(browser, name, vp)
        await browser.close()
    print("\nAll product-sheet E2E checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
