"""Gate do carrossel de destaques: prova movimento real de conteudo."""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
SHOTS = Path("/tmp/browser/carousel"); SHOTS.mkdir(parents=True, exist_ok=True)
fails = []

def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (" " + str(extra) if extra else ""))
    if not cond: fails.append(name)

async def visible_slugs(page):
    return await page.evaluate("""() => {
      const vp = document.querySelector('[data-testid="featured-viewport"]');
      const r = vp.getBoundingClientRect();
      return [...vp.querySelectorAll('[data-testid^="product-card-"]')]
        .filter(el => { const b = el.getBoundingClientRect();
          return b.left >= r.left - 4 && b.right <= r.right + 4; })
        .map(el => el.dataset.testid);
    }""")

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="featured-carousel"]')
        await page.wait_for_function(
            "document.querySelectorAll('[data-testid=\\"featured-viewport\\"] [data-testid^=\\"product-card-\\"]').length >= 6")
        car = page.locator('[data-testid="featured-carousel"]')
        total = await page.locator('[data-testid="featured-viewport"] [data-testid^="product-card-"]').count()
        first_view = await visible_slugs(page)
        check("mais produtos que visiveis", total > len(first_view), f"{total} > {len(first_view)}")
        check("overflow detectado", await car.get_attribute("data-overflow") == "true")
        prev = page.get_by_test_id("carousel-prev"); nxt = page.get_by_test_id("carousel-next")
        check("prev desabilitado no inicio", await prev.is_disabled())
        check("next habilitado no inicio", await nxt.is_enabled())
        idx0 = await car.get_attribute("data-index")
        await page.screenshot(path=str(SHOTS / "1_desktop_inicio.png"))
        await nxt.click(); await page.wait_for_timeout(800)
        idx1 = await car.get_attribute("data-index")
        check("indice mudou ao avancar", idx0 != idx1, f"{idx0} -> {idx1}")
        second_view = await visible_slugs(page)
        check("conteudo visivel mudou", set(second_view) != set(first_view), second_view)
        check("prev habilitado apos avancar", await prev.is_enabled())
        active = await page.locator('[role="tab"][aria-selected="true"]').get_attribute("data-testid")
        check("indicador sincronizado", active == f"carousel-dot-{idx1}", active)
        await page.screenshot(path=str(SHOTS / "2_desktop_avancado.png"))
        await prev.click(); await page.wait_for_timeout(800)
        check("voltou ao inicio", await car.get_attribute("data-index") == idx0)
        check("conteudo retornou", set(await visible_slugs(page)) == set(first_view))
        # resize recalcula
        await page.set_viewport_size({"width": 900, "height": 1400})
        await page.wait_for_timeout(600)
        check("resize recalcula", await car.get_attribute("data-overflow") == "true")

        # mobile + swipe
        m = await b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        mp = await m.new_page()
        await mp.goto(BASE, wait_until="domcontentloaded")
        await mp.wait_for_selector('[data-testid="featured-carousel"]')
        await mp.wait_for_function(
            "document.querySelectorAll('[data-testid=\\"featured-viewport\\"] [data-testid^=\\"product-card-\\"]').length >= 6")
        mcar = mp.locator('[data-testid="featured-carousel"]')
        await mcar.scroll_into_view_if_needed(); await mp.wait_for_timeout(400)
        i0 = await mcar.get_attribute("data-index")
        box = await mp.locator('[data-testid="featured-viewport"]').bounding_box()
        y = box["y"] + box["height"] / 2
        await mp.touchscreen.tap(box["x"] + box["width"] / 2, y)
        await mp.mouse.move(box["x"] + box["width"] - 30, y)
        await mp.mouse.down()
        for x in range(int(box["x"] + box["width"] - 30), int(box["x"] + 40), -25):
            await mp.mouse.move(x, y); await mp.wait_for_timeout(12)
        await mp.mouse.up(); await mp.wait_for_timeout(900)
        i1 = await mcar.get_attribute("data-index")
        check("swipe mobile avanca", i0 != i1, f"{i0} -> {i1}")
        await mp.screenshot(path=str(SHOTS / "3_mobile.png"))
        await b.close()
    print(f"\n{'ALL PASS' if not fails else 'FAILURES: ' + ', '.join(fails)}")
    sys.exit(1 if fails else 0)

asyncio.run(main())
