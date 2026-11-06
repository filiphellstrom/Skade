/**
 * Tester för Vind och vittring. Körs med `npm test` (kompileras med tsc
 * till .test-build/ och körs med nodes inbyggda testlöpare - inget nytt
 * beroende). Bara ren beräkningskod testas här: riktning, koordinater,
 * pilar, vittringszon, GPX och SMHI-tolkning.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  blaserMot,
  kompassStreck,
  medelriktning,
  normalisera,
  riktningsText,
  vinkelskillnad,
} from "../riktning";
import {
  avstand,
  baring,
  forflytta,
  omradeFor,
  rutnat,
  tillLatLon,
  tillMeter,
  vrid,
} from "../geo";
import type { LatLon } from "../geo";
import { byggPil, narmaste, pilplatser, provpunkter } from "../pilar";
import {
  autoLangd,
  beraknaVittringszon,
  riktningsspridning,
} from "../vittring";
import type { VindLage } from "../vittring";
import { arPass, hittaGrans, kategoriNamn, tolkaGpx } from "../gpx";
import {
  aktualitet,
  narmasteTid,
  riktningsskifte,
  stegVid,
  tolkaSmhi,
  valbaraTider,
} from "../prognos";

/** En påhittad punkt på samma breddgrad som Stockholmstrakten. */
const K05: LatLon = { latitude: 59.5, longitude: 18.2 };
const nara = (a: number, b: number, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (tol ${tol})`);

// --- Riktning --------------------------------------------------------

test("västlig vind (270°) blåser mot öster (90°)", () => {
  assert.equal(blaserMot(270), 90);
  assert.equal(blaserMot(0), 180);
  assert.equal(blaserMot(90), 270);
  assert.equal(blaserMot(180), 0);
  assert.equal(blaserMot(225), 45);
  assert.equal(blaserMot(360), 180);
});

test("normalisering och vinkelskillnad", () => {
  assert.equal(normalisera(-90), 270);
  assert.equal(normalisera(720), 0);
  assert.equal(vinkelskillnad(350, 10), 20);
  assert.equal(vinkelskillnad(90, 270), 180);
});

test("kompasstreck och text", () => {
  assert.equal(kompassStreck(270), "V");
  assert.equal(kompassStreck(0), "N");
  assert.equal(kompassStreck(225), "SV");
  assert.equal(kompassStreck(359), "N");
  assert.equal(kompassStreck(247.5), "VSV");
  assert.equal(riktningsText(270), "Vind från väster – blåser mot öster");
});

test("cirkulärt medelvärde runt norr", () => {
  nara(medelriktning([350, 10]) ?? -1, 0, 1e-9);
  nara(medelriktning([260, 280]) ?? -1, 270, 1e-9);
});

// --- Koordinater -----------------------------------------------------

test("meter ↔ lat/lon tur och retur", () => {
  const p = { x: 512.3, y: -287.9 };
  const ll = tillLatLon(K05, p);
  const tillbaka = tillMeter(K05, ll);
  nara(tillbaka.x, p.x, 1e-6);
  nara(tillbaka.y, p.y, 1e-6);
});

test("1000 m norrut ≈ 0,008993° latitud", () => {
  const p = forflytta(K05, 0, 1000);
  nara(p.latitude - K05.latitude, 1000 / 111195, 1e-6);
  nara(p.longitude, K05.longitude, 1e-12);
});

test("1000 m österut på Stava ger längre steg i longitud än latitud", () => {
  const p = forflytta(K05, 90, 1000);
  nara(p.latitude, K05.latitude, 1e-12);
  // cos(59,5°) ≈ 0,5075 → 1000 m ≈ 0,01772°
  nara(p.longitude - K05.longitude, 0.01772, 2e-5);
  nara(avstand(K05, p), 1000, 1e-6);
  nara(baring(K05, p), 90, 1e-9);
});

test("vrid: framåt pekar i angiven kurs, höger är medurs", () => {
  const ost = vrid({ x: 0, y: 1 }, 90);
  nara(ost.x, 1, 1e-12);
  nara(ost.y, 0, 1e-12);
  const hogerOmOst = vrid({ x: 1, y: 0 }, 90);
  nara(hogerOmOst.x, 0, 1e-12);
  nara(hogerOmOst.y, -1, 1e-12);
});

test("rutnät täcker området jämnt", () => {
  const o = { latitude: 59.51, longitude: 18.22, latitudeDelta: 0.04, longitudeDelta: 0.06 };
  const r = rutnat(o, 4, 6);
  assert.equal(r.length, 24);
  for (const p of r) {
    assert.ok(Math.abs(p.latitude - o.latitude) < o.latitudeDelta / 2);
    assert.ok(Math.abs(p.longitude - o.longitude) < o.longitudeDelta / 2);
  }
});

// --- Pilar -----------------------------------------------------------

test("västlig vind ger pilar som pekar österut", () => {
  const pil = byggPil(K05, 270, 5, 400);
  assert.ok(pil);
  const [bak, spets] = pil.skaft;
  assert.ok(spets.longitude > bak.longitude, "spetsen ska ligga öster om bakänden");
  nara(spets.latitude, bak.latitude, 1e-9);
  nara(baring(bak, spets), 90, 1e-6);
  // Pilhuvudets flikar ligger bakom spetsen (västerut).
  assert.ok(pil.huvud[0].longitude < spets.longitude);
  assert.ok(pil.huvud[2].longitude < spets.longitude);
});

test("nordlig vind ger pilar mot söder, sydvästlig mot nordost", () => {
  const n = byggPil(K05, 0, 5, 400);
  assert.ok(n);
  nara(baring(n.skaft[0], n.skaft[1]), 180, 1e-6);
  const sv = byggPil(K05, 225, 5, 400);
  assert.ok(sv);
  // Lokal platt approximation: avvikelse långt under 0,01°.
  nara(baring(sv.skaft[0], sv.skaft[1]), 45, 0.01);
});

test("starkare vind ger längre och tjockare pil, lugnt ger ingen", () => {
  const svag = byggPil(K05, 270, 2, 400);
  const stark = byggPil(K05, 270, 10, 400);
  assert.ok(svag && stark);
  assert.ok(avstand(...stark.skaft) > avstand(...svag.skaft));
  assert.ok(stark.tjocklek > svag.tjocklek);
  assert.equal(byggPil(K05, 270, 0.2, 400), null);
  assert.equal(byggPil(K05, Number.NaN, 5, 400), null);
});

test("pilen ryms i sin ruta", () => {
  const { punkter, ruta } = pilplatser({
    latitude: 59.51,
    longitude: 18.22,
    latitudeDelta: 0.04,
    longitudeDelta: 0.06,
  });
  assert.equal(punkter.length, 24);
  const pil = byggPil(punkter[0], 270, 30, ruta);
  assert.ok(pil);
  assert.ok(avstand(...pil.skaft) <= ruta * 0.76);
});

// --- Vittringszon ----------------------------------------------------

const vast: VindLage = { franGrader: 270, medelvind: 4, byvind: 7 };
const lugn = { prognosTimmar: 1, riktningsskifte: 0 };
const auto = { langd: "auto" as const, bredd: 1 };

/** Tyngdpunkt (medel av hörnen) för ett lager. */
function tyngdpunkt(p: LatLon[]): LatLon {
  return {
    latitude: p.reduce((s, q) => s + q.latitude, 0) / p.length,
    longitude: p.reduce((s, q) => s + q.longitude, 0) / p.length,
  };
}

test("vittringszonen ligger nedströms: västlig vind → zon österut", () => {
  const zon = beraknaVittringszon(K05, vast, lugn, auto);
  assert.ok(zon);
  assert.equal(zon.riktning, 90);
  for (const l of zon.lager) {
    const t = tyngdpunkt(l.punkter);
    assert.ok(t.longitude > K05.longitude, "tyngdpunkten ska ligga öster om passet");
    nara(t.latitude, K05.latitude, 2e-4);
  }
  const slut = zon.mittlinje[1];
  nara(baring(K05, slut), 90, 1e-6);
  nara(avstand(K05, slut), zon.langdMeter, 1e-6);
});

test("zonen vänder när vinden vänder", () => {
  for (const fran of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const zon = beraknaVittringszon(K05, { ...vast, franGrader: fran }, lugn, auto);
    assert.ok(zon);
    const t = tyngdpunkt(zon.lager[0].punkter);
    const kurs = baring(K05, t);
    assert.ok(
      vinkelskillnad(kurs, blaserMot(fran)) < 1,
      `vind från ${fran}: zonen pekar ${kurs.toFixed(1)}, väntat ${blaserMot(fran)}`,
    );
  }
});

test("ingen punkt i zonen ligger mer än startradien uppströms", () => {
  const zon = beraknaVittringszon(K05, vast, lugn, auto);
  assert.ok(zon);
  for (const l of zon.lager) {
    for (const p of l.punkter) {
      assert.ok(tillMeter(K05, p).x >= -12.001);
    }
  }
});

test("byigare, svagare och osäkrare vind ger bredare zon", () => {
  const bas = riktningsspridning({ franGrader: 270, medelvind: 6, byvind: 7 }, lugn);
  const byig = riktningsspridning({ franGrader: 270, medelvind: 6, byvind: 12 }, lugn);
  const svag = riktningsspridning({ franGrader: 270, medelvind: 1.2, byvind: 2 }, lugn);
  const osaker = riktningsspridning(
    { franGrader: 270, medelvind: 6, byvind: 7 },
    { prognosTimmar: 30, riktningsskifte: 40 },
  );
  assert.ok(byig > bas);
  assert.ok(svag > bas);
  assert.ok(osaker > bas);
});

test("längd och bredd går att ändra", () => {
  const kort = beraknaVittringszon(K05, vast, lugn, { langd: 200, bredd: 1 });
  const lang = beraknaVittringszon(K05, vast, lugn, { langd: 800, bredd: 1 });
  const bred = beraknaVittringszon(K05, vast, lugn, { langd: 400, bredd: 1.6 });
  const smal = beraknaVittringszon(K05, vast, lugn, { langd: 400, bredd: 0.6 });
  assert.ok(kort && lang && bred && smal);
  assert.equal(kort.langdMeter, 200);
  assert.equal(lang.langdMeter, 800);
  assert.ok(bred.spridningGrader > smal.spridningGrader);
  const nordligast = (z: typeof bred) =>
    Math.max(...z.lager[0].punkter.map((p) => p.latitude));
  assert.ok(nordligast(bred) > nordligast(smal));
});

test("auto-längd växer med vinden inom gränserna", () => {
  assert.equal(autoLangd(0), 150);
  assert.equal(autoLangd(4), 430);
  assert.equal(autoLangd(30), 900);
});

test("vinddata saknas → ingen zon", () => {
  assert.equal(beraknaVittringszon(K05, null, lugn, auto), null);
  assert.equal(
    beraknaVittringszon(K05, { franGrader: Number.NaN, medelvind: 3, byvind: null }, lugn, auto),
    null,
  );
});

test("svag vind flaggas och blir bred", () => {
  const zon = beraknaVittringszon(K05, { franGrader: 270, medelvind: 0.6, byvind: null }, lugn, auto);
  assert.ok(zon);
  assert.equal(zon.svagVind, true);
  assert.equal(zon.niva, "hog");
});

// --- GPX --------------------------------------------------------------
// Repot är publikt: den incheckade filen är påhittad (samma format som
// WeHunts kartexport). En riktig export kan läggas i fixtures/privat/
// (gitignorerad) - då körs även testerna mot den.

const fixtur = (namn: string) => join(process.cwd(), "src/vind/__tests__/fixtures", namn);
const exempel = readFileSync(fixtur("exempel-wehunt.gpx"), "utf8");

test("GPX: alla markeringar och gränsen läses in", () => {
  const g = tolkaGpx(exempel);
  assert.equal(g.punkter.length, 8);
  assert.equal(g.dubbletterIFilen, 0);
  const grans = hittaGrans(g.spar);
  assert.ok(grans);
  assert.equal(grans.namn, "Exempelmarken");
  assert.equal(grans.punkter.length, 5);
});

test("GPX: koordinater och kategorier bevaras exakt", () => {
  const g = tolkaGpx(exempel);
  assert.deepEqual(
    g.punkter.find((p) => p.namn === "A01"),
    { namn: "A01", typ: "stand", lat: 61.20015, lon: 14.50123 },
  );
  assert.deepEqual(
    g.punkter.find((p) => p.namn === "A02"),
    { namn: "A02", typ: "tower", lat: 61.20341, lon: 14.50678 },
  );
  // Två saltstenar med samma namn på olika platser är inte dubbletter.
  assert.equal(g.punkter.filter((p) => p.namn === "Saltsten").length, 2);
  assert.ok(g.punkter.find((p) => p.namn === "Åtel" && p.typ === "bait"));
  assert.equal(kategoriNamn("salt_stone"), "Saltsten");
  assert.equal(kategoriNamn("okand_typ"), "Övrigt");
  assert.ok(arPass("stand") && arPass("tower") && !arPass("parking"));
  assert.equal(g.punkter.filter((p) => arPass(p.typ)).length, 3);
});

test("GPX: alla markeringar ligger innanför gränsens omslutande rektangel", () => {
  const g = tolkaGpx(exempel);
  const grans = hittaGrans(g.spar);
  assert.ok(grans);
  const o = omradeFor(grans.punkter, 0.05);
  assert.ok(o);
  for (const p of g.punkter) {
    assert.ok(Math.abs(p.lat - o.latitude) <= o.latitudeDelta / 2, p.namn);
    assert.ok(Math.abs(p.lon - o.longitude) <= o.longitudeDelta / 2, p.namn);
  }
});

const privat = fixtur("privat/map-export.gpx");
test(
  "GPX (lokal, riktig WeHunt-export): Stava-Lidberga",
  { skip: !existsSync(privat) && "ingen privat fil" },
  () => {
    const text = readFileSync(privat, "utf8");
    const g = tolkaGpx(text);
    assert.equal(g.punkter.length, 113);
    assert.equal(g.dubbletterIFilen, 0);
    const grans = hittaGrans(g.spar);
    assert.equal(grans?.namn, "Stava-Lidberga");
    assert.equal(grans?.punkter.length, 43);
    // Varje punkts koordinater ska vara exakt filens (inga koordinater
    // skrivs här - repot är publikt).
    const attr = [...text.matchAll(/<wpt lat="([^"]+)" lon="([^"]+)">/g)];
    assert.equal(attr.length, g.punkter.length);
    attr.forEach((m, i) => {
      assert.equal(g.punkter[i].lat, Number(m[1]));
      assert.equal(g.punkter[i].lon, Number(m[2]));
    });
    assert.equal(g.punkter.filter((p) => arPass(p.typ)).length, 73);
    const o = omradeFor(grans?.punkter ?? [], 0.05);
    assert.ok(o);
    for (const p of g.punkter) {
      assert.ok(Math.abs(p.lat - o.latitude) <= o.latitudeDelta / 2, p.namn);
      assert.ok(Math.abs(p.lon - o.longitude) <= o.longitudeDelta / 2, p.namn);
    }
  },
);

test("GPX: dubbletter i samma fil, entiteter och självstängande punkter", () => {
  const xml = `<?xml version="1.0"?><gpx version="1.1">
    <wpt lat="59.5" lon="18.2"><name>A &amp; B</name><type>stand</type></wpt>
    <wpt lon='18.2' lat='59.5'><name>A &amp; B</name><type>stand</type></wpt>
    <wpt lat="59.6" lon="18.3"/>
    <wpt lat="999" lon="18.3"><name>Fel</name></wpt>
    <trk><name><![CDATA[Gräns]]></name><trkseg>
      <trkpt lat="59.0" lon="18.0"/><trkpt lat="59.1" lon="18.0"/>
      <trkpt lat="59.1" lon="18.1"/><trkpt lat="59.0" lon="18.0"/>
    </trkseg></trk></gpx>`;
  const g = tolkaGpx(xml);
  assert.equal(g.punkter.length, 2);
  assert.equal(g.dubbletterIFilen, 1);
  assert.equal(g.punkter[0].namn, "A & B");
  assert.equal(g.punkter[1].namn, "");
  assert.equal(hittaGrans(g.spar)?.namn, "Gräns");
  assert.throws(() => tolkaGpx("<html></html>"));
});

// --- SMHI och prognosval --------------------------------------------

const smhiSvar = {
  createdTime: "2026-11-06T05:41:00Z",
  referenceTime: "2026-11-06T03:00:00Z",
  approvedTime: "2026-11-06T05:40:00Z",
  geometry: { type: "Point", coordinates: [18.2182, 59.5094] },
  timeSeries: [
    { time: "2026-11-06T06:00:00Z", data: { wind_from_direction: 265, wind_speed: 3.9, wind_speed_of_gust: 7.4 } },
    { time: "2026-11-06T07:00:00Z", data: { wind_from_direction: 270, wind_speed: 4.2, wind_speed_of_gust: 8.1 } },
    { time: "2026-11-06T08:00:00Z", data: { wind_from_direction: 300, wind_speed: 5.0, wind_speed_of_gust: 9999 } },
    { time: "2026-11-06T09:00:00Z", data: { wind_from_direction: 9999, wind_speed: 5.1 } },
  ],
};
const t = (iso: string) => Date.parse(iso) / 1000;

test("SMHI: värden, tider och saknade värden tolkas utan att hittas på", () => {
  const p = tolkaSmhi(smhiSvar, 59.51, 18.22, t("2026-11-06T06:10:00Z"));
  assert.equal(p.kallaNamn, "SMHI");
  assert.equal(p.rutLat, 59.5094);
  assert.equal(p.rutLon, 18.2182);
  assert.equal(p.referensTid, t("2026-11-06T03:00:00Z"));
  assert.equal(p.publiceradTid, t("2026-11-06T05:40:00Z"));
  assert.equal(p.steg.length, 4);
  assert.deepEqual(p.steg[1], { tid: t("2026-11-06T07:00:00Z"), franGrader: 270, medelvind: 4.2, byvind: 8.1 });
  assert.equal(p.steg[2].byvind, null);
  assert.equal(p.steg[3].franGrader, null);
});

test("SMHI: tomt eller trasigt svar ger tom prognos", () => {
  const p = tolkaSmhi({}, 59.51, 18.22, 0);
  assert.equal(p.steg.length, 0);
  assert.equal(aktualitet(p, 0), "saknas");
  assert.equal(tolkaSmhi(null, 1, 2, 0).steg.length, 0);
});

test("vindriktningen uppdateras när tiden ändras", () => {
  const p = tolkaSmhi(smhiSvar, 59.51, 18.22, t("2026-11-06T06:10:00Z"));
  assert.equal(stegVid(p, t("2026-11-06T07:00:00Z"))?.franGrader, 270);
  assert.equal(stegVid(p, t("2026-11-06T08:00:00Z"))?.franGrader, 300);
  // Utanför prognosen → inget steg, inget påhittat värde.
  assert.equal(stegVid(p, t("2026-11-07T08:00:00Z")), null);
  assert.equal(riktningsskifte(p, t("2026-11-06T07:00:00Z")), 30);
});

test("tidsreglaget: hela timmar, närmast nu", () => {
  const p = tolkaSmhi(smhiSvar, 59.51, 18.22, t("2026-11-06T06:10:00Z"));
  const tider = valbaraTider(p, t("2026-11-06T07:20:00Z"));
  assert.equal(tider.length, 4);
  assert.equal(narmasteTid(tider, t("2026-11-06T07:20:00Z")), t("2026-11-06T07:00:00Z"));
});

test("prognos äldre än 3 timmar flaggas som gammal", () => {
  const p = tolkaSmhi(smhiSvar, 59.51, 18.22, t("2026-11-06T06:10:00Z"));
  assert.equal(aktualitet(p, t("2026-11-06T08:00:00Z")), "farsk");
  assert.equal(aktualitet(p, t("2026-11-06T09:30:00Z")), "gammal");
});

test("provpunkter: få punkter över jaktmarken, högst 9 utzoomat", () => {
  const stava = provpunkter({ latitude: 59.51, longitude: 18.22, latitudeDelta: 0.04, longitudeDelta: 0.05 });
  assert.ok(stava.length >= 1 && stava.length <= 4, String(stava.length));
  const sverige = provpunkter({ latitude: 62.5, longitude: 16.5, latitudeDelta: 14, longitudeDelta: 14 });
  assert.ok(sverige.length <= 9 && sverige.length >= 1);
  for (const p of [...stava, ...sverige]) {
    assert.equal(Math.round(p.lat * 100) / 100, p.lat);
    assert.equal(Math.round(p.lon * 100) / 100, p.lon);
  }
  assert.equal(narmaste(K05, [{ lat: 59.4, lon: 18.2 }, { lat: 59.52, lon: 18.21 }]), 1);
});
