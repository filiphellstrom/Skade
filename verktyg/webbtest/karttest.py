import tempfile
TMP = tempfile.gettempdir()
import asyncio, base64, sys
from playwright.async_api import async_playwright
B = "http://localhost:8081"
import os
GPX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "vind", "__tests__", "fixtures", "exempel-wehunt.gpx")
# 256x256 ljusgrå ruta som låtsaskartbild (miljön når inte kartservrarna).
import zlib, struct
def png(w=256,h=256):
    rad = b"\x00" + bytes([225,232,225])*w
    kant = b"\x00" + bytes([150,170,150])*w
    data = b"".join(kant if y==0 else (b"\x00"+bytes([150,170,150])+bytes([225,232,225])*(w-1)) for y in range(h))
    def ch(t,d): return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    return b"\x89PNG\r\n\x1a\n"+ch(b"IHDR",struct.pack(">IIBBBBB",w,h,8,2,0,0,0))+ch(b"IDAT",zlib.compress(data))+ch(b"IEND",b"")
BILD = png()
async def main(bredd, hojd, namn):
    async with async_playwright() as p:
        br = await p.chromium.launch()
        ctx = await br.new_context(viewport={"width": bredd, "height": hojd}, geolocation={"latitude": 61.2005, "longitude": 14.5040, "accuracy": 12}, permissions=["geolocation"])
        pg = await ctx.new_page()
        errs = []; tiles = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
        async def kartbild(route):
            tiles.append(route.request.url)
            await route.fulfill(status=200, content_type="image/png", body=BILD, headers={"Access-Control-Allow-Origin": "*"})
        await pg.route("**/tile.openstreetmap.org/**", kartbild)
        await pg.route("**/*.tile.opentopomap.org/**", kartbild)
        await pg.goto(B); await pg.wait_for_timeout(4000)
        f = pg.locator("input")
        await f.nth(0).fill("Test Jägare"); await f.nth(1).fill("Aston")
        await pg.get_by_text("Kom igång", exact=False).first.click(); await pg.wait_for_timeout(2500)
        # Karta utan kartdata
        await pg.goto(B + "/karta"); await pg.wait_for_timeout(4000)
        body = await pg.inner_text("body")
        print("TOM KARTA: position:", "Din position" in body, "| tips:", "Importera jaktmarkens" in body, "| kartbilder:", len(tiles))
        await pg.screenshot(path=os.path.join(TMP, f"karta-{namn}-tom.png"))
        # Skapa jaktmark och importera GPX
        await pg.goto(B + "/jaktmarker"); await pg.wait_for_timeout(2500)
        print("JAKTMARKER:", (await pg.inner_text("body"))[:300].replace("\n"," | "))
        if len(sys.argv) > 1 and sys.argv[1] == "utforska":
            await br.close(); return
        await pg.get_by_text("Lägg till", exact=True).first.click(); await pg.wait_for_timeout(1500)
        await pg.locator("input").first.fill("Testmarken")
        await pg.get_by_text("Spara", exact=False).first.click(); await pg.wait_for_timeout(2000)
        await pg.get_by_text("Testmarken", exact=False).first.click(); await pg.wait_for_timeout(2000)
        async with pg.expect_file_chooser() as fc:
            await pg.get_by_text("Importera GPX-fil", exact=True).click()
        await (await fc.value).set_files(GPX); await pg.wait_for_timeout(3000)
        body = await pg.inner_text("body")
        i = body.find("importerade"); print("IMPORT:", body[max(0,i-30):i+80].replace("\n"," "))
        await pg.get_by_text("Visa på kartan", exact=True).click(); await pg.wait_for_timeout(4000)
        info = await pg.evaluate("""() => ({ markorer: document.querySelectorAll('.skade-karta path.leaflet-interactive').length, alla: document.querySelectorAll('.skade-karta svg path').length, etiketter: document.querySelectorAll('.skade-etikett').length, visaNamn: document.querySelector('.skade-karta').classList.contains('visa-namn'), storlek: [document.querySelector('.skade-karta').clientWidth, document.querySelector('.skade-karta').clientHeight], laddade: document.querySelectorAll('.leaflet-tile-loaded').length })""")
        print("KARTA MED DATA:", info, "| url:", pg.url.replace(B,""))
        await pg.screenshot(path=os.path.join(TMP, f"karta-{namn}-data.png"))
        await pg.get_by_text("Terräng", exact=True).click(); await pg.wait_for_timeout(1500)
        print("TERRÄNG: opentopo-anrop:", sum("opentopomap" in t for t in tiles), "| knapp nu:", "Karta" if await pg.get_by_text("Karta", exact=True).count() else "?")
        await pg.get_by_text("Min position", exact=True).click(); await pg.wait_for_timeout(1500)
        info = await pg.evaluate("() => ({visaNamn: document.querySelector('.skade-karta').classList.contains('visa-namn')})")
        print("MIN POSITION (zoom 15):", info)
        await pg.locator(".skade-karta path.leaflet-interactive").first.click(force=True); await pg.wait_for_timeout(800)
        print("POPUP:", (await pg.locator(".leaflet-popup-content").inner_text()).replace("\n", " / ") if await pg.locator(".leaflet-popup-content").count() else "ingen")
        await pg.screenshot(path=os.path.join(TMP, f"karta-{namn}-nara.png"))
        print("konsolfel:", errs[:5])
        await br.close()
asyncio.run(main(int(sys.argv[2]) if len(sys.argv)>2 else 1280, int(sys.argv[3]) if len(sys.argv)>3 else 800, sys.argv[4] if len(sys.argv)>4 else "bred"))
