import tempfile
TMP = tempfile.gettempdir()
import asyncio, sys, zlib, struct, re
from playwright.async_api import async_playwright
B = "http://localhost:8081"; API = "http://localhost:8787"
import os
GPX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "vind", "__tests__", "fixtures", "exempel-wehunt.gpx")
def png(w=256,h=256):
    data = b"".join((b"\x00"+bytes([150,170,150])*w) if y==0 else (b"\x00"+bytes([150,170,150])+bytes([225,232,225])*(w-1)) for y in range(h))
    def ch(t,d): return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    return b"\x89PNG\r\n\x1a\n"+ch(b"IHDR",struct.pack(">IIBBBBB",w,h,8,2,0,0,0))+ch(b"IDAT",zlib.compress(data))+ch(b"IEND",b"")
BILD = png()
fel = []
async def ny(br, namn, w=1280, h=850):
    ctx = await br.new_context(viewport={"width": w, "height": h}, geolocation={"latitude": 61.2005, "longitude": 14.5040, "accuracy": 12}, permissions=["geolocation"])
    pg = await ctx.new_page()
    pg.on("console", lambda m: fel.append(f"{namn}: {m.text}") if m.type == "error" and "401" not in m.text and "404" not in m.text and "409" not in m.text else None)
    pg.on("pageerror", lambda e: fel.append(f"{namn} PAGEERROR {e}"))
    async def kartbild(route): await route.fulfill(status=200, content_type="image/png", body=BILD, headers={"Access-Control-Allow-Origin": "*"})
    await pg.route("**/tile.openstreetmap.org/**", kartbild); await pg.route("**/*.tile.opentopomap.org/**", kartbild)
    await pg.goto(B); await pg.wait_for_timeout(3500)
    f = pg.locator("input"); await f.nth(0).fill(namn); await f.nth(1).fill("Aston" if namn == "Bo" else "Molly")
    await pg.get_by_text("Kom igång", exact=False).first.click(); await pg.wait_for_timeout(2000)
    r = await pg.evaluate("""async ([api, namn]) => { const r = await fetch(api + '/api/auth/sign-up/email', {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email: namn.toLowerCase()+'-'+Date.now()+'@example.com', password:'ett-langt-losenord-1', name: namn})}); return r.status; }""", [API, namn])
    assert r == 200, r
    return pg
async def text(pg): return await pg.inner_text("body")
def visa(rubrik, ok, extra=""): print(("OK  " if ok else "FEL ") + rubrik + (" | " + extra if extra else "")); 
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        anna = await ny(br, "Anna"); bo = await ny(br, "Bo", 390, 844)
        # Hem visar Jaktlag
        await anna.goto(B); await anna.wait_for_timeout(2500)
        visa("Hem har Jaktlag-rad", "JAKTLAG" in await text(anna))
        # Anna skapar lag
        await anna.goto(B + "/jaktlag"); await anna.wait_for_timeout(2500)
        await anna.get_by_placeholder("T.ex. Stava-Lidberga").fill("Testlaget")
        await anna.get_by_text("Skapa jaktlag", exact=True).last.click(); await anna.wait_for_timeout(2500)
        lag_url = anna.url; visa("Lag skapat, lagsidan visas", "/jaktlag/" in lag_url and "Testlaget" in await text(anna), lag_url.replace(B, ""))
        await anna.get_by_text("Medlemmar", exact=True).first.click(); await anna.wait_for_timeout(2000)
        t = await text(anna); m = re.search(r"\b([A-Z2-9]{4}-[A-Z2-9]{4})\b", t); kod = m.group(1) if m else None
        visa("Inbjudningskod och QR visas", kod is not None and await anna.locator("svg path").count() > 0, str(kod))
        await anna.screenshot(path=os.path.join(TMP, "lag-medlemmar.png"), full_page=True)
        # Bo går med via länk med kod
        await bo.goto(B + "/jaktlag?kod=" + kod.replace("-", "")); await bo.wait_for_timeout(2500)
        await bo.get_by_text("Gå med", exact=True).last.click(); await bo.wait_for_timeout(2500)
        visa("Bo gick med via länk", "Testlaget" in await text(bo) and "/jaktlag/" in bo.url)
        # Anna importerar jaktmark och skapar plan
        await anna.goto(B + "/jaktmarker"); await anna.wait_for_timeout(2000)
        await anna.get_by_text("Lägg till", exact=True).first.click(); await anna.wait_for_timeout(1200)
        await anna.locator("input").first.fill("Testmarken"); await anna.get_by_text("Spara", exact=False).first.click(); await anna.wait_for_timeout(1500)
        await anna.get_by_text("Testmarken", exact=False).first.click(); await anna.wait_for_timeout(1500)
        async with anna.expect_file_chooser() as fc: await anna.get_by_text("Importera GPX-fil", exact=True).click()
        await (await fc.value).set_files(GPX); await anna.wait_for_timeout(2500)
        await anna.goto(lag_url); await anna.wait_for_timeout(2500)
        await anna.get_by_text("Ny plan", exact=True).click(); await anna.wait_for_timeout(2000)
        await anna.get_by_placeholder("ÅÅÅÅ-MM-DD").fill("2026-11-21")
        visa("Ny plan: jaktmark förvald", "Testmarken" in await text(anna))
        await anna.get_by_text("Skapa plan", exact=True).click(); await anna.wait_for_timeout(4000)
        visa("Planeraren öppnas", "/redigera" in anna.url and "Planera jakten" in await text(anna), anna.url.replace(B, ""))
        # Lägg till uppdrag för Bo
        await anna.get_by_text("Lägg till uppdrag", exact=True).click(); await anna.wait_for_timeout(600)
        await anna.get_by_text("Bo", exact=True).first.click(); await anna.wait_for_timeout(300)
        await anna.get_by_role("textbox").nth(4).click()
        hundfalt = anna.locator("input").filter(has=anna.locator("xpath=.")).nth(0)
        # Fält i ordning i det öppna uppdraget: förare, hund, släpptid, anteckning
        falt = anna.locator("input, textarea")
        n = await falt.count(); varden = [await falt.nth(i).input_value() for i in range(n)]
        i_forare = varden.index("Bo")
        await falt.nth(i_forare + 1).fill("Aston"); await falt.nth(i_forare + 2).fill("08:00"); await falt.nth(i_forare + 3).fill("Släpp mot vinden")
        kartan = anna.locator(".skade-karta"); box = await kartan.bounding_box()
        cx, cy = box["x"] + box["width"]/2, box["y"] + box["height"]/2
        await anna.get_by_text("Sätt släpplats", exact=True).click(); await anna.wait_for_timeout(300)
        visa("Hjälptext för släpplats", "där hunden ska släppas" in await text(anna))
        await anna.mouse.click(cx - 120, cy + 60); await anna.wait_for_timeout(500)
        await anna.get_by_text("Rita rutt", exact=True).click(); await anna.wait_for_timeout(300)
        for dx, dy in [(-120, 60), (-20, -40), (90, -10), (160, 80)]:
            await anna.mouse.click(cx + dx, cy + dy); await anna.wait_for_timeout(350)
        await anna.get_by_text("Klar med rutten", exact=True).click(); await anna.wait_for_timeout(400)
        t = await text(anna)
        visa("Rutt med 4 punkter och längd", "A · Start" in t and "B · Mål" in t and re.search(r"rutt \d", t) is not None)
        await anna.get_by_text("Viktig", exact=True).nth(1).click(); await anna.wait_for_timeout(300)
        await anna.get_by_placeholder("T.ex. gå igenom granplanteringen").first.fill("Gå igenom granplanteringen"); await anna.wait_for_timeout(300)
        # Ett andra uppdrag (Anna själv), bara släpplats
        await anna.get_by_text("Lägg till uppdrag", exact=True).click(); await anna.wait_for_timeout(500)
        await anna.get_by_text("Anna", exact=True).first.click(); await anna.wait_for_timeout(300)
        await anna.get_by_text("Sätt släpplats", exact=True).click(); await anna.mouse.click(cx + 200, cy - 120); await anna.wait_for_timeout(500)
        await anna.screenshot(path=os.path.join(TMP, "lag-planerare.png"))
        await anna.get_by_text("Publicera", exact=True).click(); await anna.wait_for_timeout(2500)
        visa("Planen publicerad", "Planen är publicerad" in await text(anna))
        # Dra en markör: flytta släpplatsen (S) för valt uppdrag
        s = anna.locator(".leaflet-marker-icon", has_text="S").first
        if await s.count():
            b2 = await s.bounding_box(); await anna.mouse.move(b2["x"]+10, b2["y"]+10); await anna.mouse.down(); await anna.mouse.move(b2["x"]+60, b2["y"]+40, steps=6); await anna.mouse.up(); await anna.wait_for_timeout(400)
            visa("Dra markör ger osparad ändring", "osparade ändringar" in await text(anna))
            await anna.get_by_text("Spara", exact=True).click(); await anna.wait_for_timeout(2000)
        # Bo ser planen
        await bo.goto(bo.url); await bo.wait_for_timeout(3500)
        t = await text(bo); visa("Bo ser planen på lagsidan", "Du släpper Aston 08:00" in t, "")
        await bo.get_by_text("Du släpper Aston", exact=False).click(); await bo.wait_for_timeout(2500)
        t = await text(bo)
        visa("Bo: Mitt uppdrag", "MITT UPPDRAG" in t and "Släpp Aston kl 08:00" in t and "Släpp mot vinden" in t)
        visa("Bo: viktig punkt och andras uppdrag", "Gå igenom granplanteringen" in t and "DE ANDRAS UPPDRAG" in t and "Anna" in t)
        await bo.get_by_text("Gå igenom granplanteringen", exact=True).click(); await bo.wait_for_timeout(300)
        await bo.screenshot(path=os.path.join(TMP, "lag-plan-bo.png"), full_page=True)
        await bo.get_by_text("Visa på kartan", exact=True).click(); await bo.wait_for_timeout(4000)
        info = await bo.evaluate("() => ({markorer: document.querySelectorAll('.leaflet-marker-icon').length, linjer: document.querySelectorAll('.skade-karta svg path').length})")
        visa("Bo: planen på kartan", info["markorer"] >= 5 and "/karta" in bo.url, str(info))
        await bo.screenshot(path=os.path.join(TMP, "lag-karta-bo.png"))
        # Eftersök
        await bo.go_back(); await bo.wait_for_timeout(800); await bo.go_back(); await bo.wait_for_timeout(1500)
        await bo.get_by_text("Markera eftersök", exact=True).click(); await bo.wait_for_timeout(3000)
        t = await text(bo); visa("Eftersök: position och passval", "Där du står nu" in t and "Vid ett pass" in t)
        await bo.get_by_text("Älg", exact=True).click(); await bo.get_by_placeholder("T.ex. skott 08:15, gick mot nordväst").fill("Gick mot nordväst")
        await bo.get_by_text("Markera eftersök", exact=True).last.click(); await bo.wait_for_timeout(2500)
        visa("Eftersök markerat", "Eftersök: älg" in await text(bo) and "/eftersok/" in bo.url)
        ef_url = bo.url
        await anna.goto(lag_url); await anna.wait_for_timeout(3000)
        visa("Anna ser öppet eftersök", "Öppet – ingen har tagit det" in await text(anna))
        await anna.get_by_text("Älg ·", exact=False).click(); await anna.wait_for_timeout(2000)
        await anna.get_by_text("Jag tar det", exact=True).click(); await anna.wait_for_timeout(500)
        await anna.get_by_text("Jag tar det", exact=True).last.click(); await anna.wait_for_timeout(2000)
        visa("Anna tog det med Molly", "Du har tagit det med Molly" in await text(anna))
        await bo.wait_for_timeout(9000)
        visa("Bo ser vem som tog det", "Taget av Anna med Molly" in await text(bo))
        visa("Bo kan inte ta det", await bo.get_by_text("Jag tar det", exact=True).count() == 0)
        await anna.get_by_text("Avsluta eftersöket", exact=True).click(); await anna.wait_for_timeout(300)
        await anna.get_by_text("Hittat", exact=True).click(); await anna.get_by_text("Avsluta eftersöket", exact=True).last.click(); await anna.wait_for_timeout(2000)
        visa("Avslutat: Hittat", "AVSLUTAT" in await text(anna))
        await anna.screenshot(path=os.path.join(TMP, "lag-eftersok.png"), full_page=True)
        # Chatt
        await anna.goto(lag_url + "/chatt"); await anna.wait_for_timeout(2500)
        await anna.get_by_placeholder("Skriv till hundförarna").fill("Släpper om tio minuter"); await anna.get_by_text("Skicka", exact=True).click(); await anna.wait_for_timeout(1500)
        await bo.goto(lag_url + "/chatt"); await bo.wait_for_timeout(3500)
        visa("Bo ser Annas meddelande", "Släpper om tio minuter" in await text(bo))
        await bo.get_by_placeholder("Skriv till hundförarna").fill("Uppfattat"); await bo.get_by_text("Skicka", exact=True).click()
        await anna.wait_for_timeout(7000)
        visa("Anna ser Bos svar", "Uppfattat" in await text(anna))
        await bo.screenshot(path=os.path.join(TMP, "lag-chatt-bo.png"))
        await bo.get_by_text("Släpper om tio minuter", exact=True).click(); await bo.wait_for_timeout(400)
        t = await text(bo); visa("Rapportera och blockera visas", "Rapportera" in t and "Blockera Anna" in t)
        await bo.get_by_text("Rapportera", exact=True).click(); await bo.wait_for_timeout(1200)
        visa("Rapporterat", "Meddelandet är rapporterat" in await text(bo))
        await bo.get_by_text("Släpper om tio minuter", exact=True).click(); await bo.wait_for_timeout(300)
        await bo.get_by_text("Blockera Anna", exact=True).click(); await bo.wait_for_timeout(1500)
        t = await text(bo); visa("Blockerad: meddelandet dolt", "Släpper om tio minuter" not in t and "Blockerade (1)" in t)
        # Bo lämnar laget
        await bo.goto(lag_url + "/medlemmar"); await bo.wait_for_timeout(2500)
        t = await text(bo); visa("Hundförare ser inte koden", "BJUD IN" not in t and "Hundförare" in t)
        await bo.get_by_text("Lämna jaktlaget", exact=True).click(); await bo.get_by_text("Ja, lämna jaktlaget", exact=True).click(); await bo.wait_for_timeout(2500)
        visa("Bo lämnade", "inte med i något jaktlag" in await text(bo))
        print("konsolfel:", fel[:8])
        await br.close()
asyncio.run(main())
