import asyncio, json
from playwright.async_api import async_playwright
B = "http://localhost:8081"; API = "http://localhost:8787"
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        ctx = await br.new_context(viewport={"width": 390, "height": 844})
        pg = await ctx.new_page()
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
        await pg.goto(B); await pg.wait_for_timeout(4000)
        fields = pg.locator("input")
        n = await fields.count(); print("onboarding inputs:", n)
        if n >= 2:
            await fields.nth(0).fill("Test Jägare"); await fields.nth(1).fill("Aston")
            await pg.get_by_text("Kom igång", exact=False).first.click()
            await pg.wait_for_timeout(2500)
        await pg.goto(B + "/profil"); await pg.wait_for_timeout(4000)
        body = await pg.inner_text("body")
        print("UTLOGGAD:", "KONTO" in body, "| inte påslagen:", "inte påslagen" in body, "| jaktlag-text:", "jaktlag" in body)
        await pg.screenshot(path="/tmp/konto-utloggad.png", full_page=True)
        # Skapa ett testkonto direkt mot servern (testläge), som om inloggningen lyckats.
        r = await pg.evaluate("""async (api) => { const r = await fetch(api + '/api/auth/sign-up/email', {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'webb-'+Date.now()+'@example.com', password:'ett-langt-losenord-1', name:''})}); return r.status + ' ' + (await r.text()).slice(0,80); }""", API)
        print("signup:", r)
        await pg.reload(); await pg.wait_for_timeout(5000)
        body = await pg.inner_text("body")
        print("INLOGGAD:", "Inloggad." in body, "| Logga ut:", "Logga ut" in body, "| Radera konto:", "Radera konto" in body)
        mig = await pg.evaluate("async (api) => (await (await fetch(api + '/api/mig', {credentials:'include'})).text())", API)
        print("mig (namn ska vara ifyllt från profilen):", mig)
        await pg.screenshot(path="/tmp/konto-inloggad.png", full_page=True)
        await pg.get_by_text("Radera konto", exact=True).click(); await pg.wait_for_timeout(500)
        await pg.screenshot(path="/tmp/konto-radera.png", full_page=True)
        await pg.get_by_text("Ja, radera kontot", exact=True).click(); await pg.wait_for_timeout(3000)
        body = await pg.inner_text("body")
        print("EFTER RADERING:", "Kontot är raderat" in body, "| utloggad:", "Logga ut" not in body)
        mig = await pg.evaluate("async (api) => (await fetch(api + '/api/mig', {credentials:'include'})).status", API)
        print("mig efter radering:", mig)
        print("konsolfel:", [e for e in errs if "401" not in e][:6])
        await br.close()
asyncio.run(main())
