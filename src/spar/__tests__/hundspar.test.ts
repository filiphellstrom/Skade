/**
 * Tester för hundspår från Garmin. Körs med `npm test`.
 * Filerna är påhittade (samma format som Alpha 100:s export). Riktiga
 * exporter kan läggas i fixtures/privat/ (gitignorerad - repot är publikt).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  avstandMeter,
  dagensDel,
  fordelaPaDrev,
  glesa,
  maxAvstandFranForare,
  packa,
  packaUpp,
  positionVid,
  stracka,
  tolkaGarminGpx,
} from "../hundspar";
import type { DrevFonster, GarminSpar } from "../hundspar";

const T0 = Date.parse("2026-10-31T07:00:00Z") / 1000;

/** Bygger en GPX som Alpha 100: ett trk, punkter med tid, valfri höjd. */
function gpx(namn: string, punkter: [number, number, number][], medHojd = false, segment = 1): string {
  const per = Math.ceil(punkter.length / segment);
  let seg = "";
  for (let s = 0; s < segment; s++) {
    seg += "<trkseg>";
    for (const [lat, lon, t] of punkter.slice(s * per, (s + 1) * per)) {
      seg += `<trkpt lat="${lat.toFixed(10)}" lon="${lon.toFixed(10)}">${medHojd ? "<ele>41.95</ele>" : ""}<time>${new Date(t * 1000).toISOString().replace(".000", "")}</time></trkpt>`;
    }
    seg += "</trkseg>";
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?><gpx xmlns="http://www.topografix.com/GPX/1/1" creator="Alpha 100 EMEA/APAC" version="1.1"><metadata><time>2026-11-06T22:56:33Z</time></metadata><trk><name>${namn}</name><extensions><gpxx:TrackExtension><gpxx:DisplayColor>DarkGreen</gpxx:DisplayColor></gpxx:TrackExtension></extensions>${seg}</trk></gpx>`;
}

/** En hund som rör sig österut ~10 m var 3:e sekund från t till t+sek. */
function linje(t: number, sek: number, lat = 59.52, lon = 18.21, steg = 3): [number, number, number][] {
  const ut: [number, number, number][] = [];
  for (let s = 0; s <= sek; s += steg) ut.push([lat, lon + (s / steg) * 0.00018, t + s]);
  return ut;
}

const sparMed = (namn: string, punkter: [number, number, number][], forare = false): GarminSpar => ({
  namn,
  forare,
  punkter: punkter.map(([lat, lon, t]) => ({ lat, lon, t })),
});

test("tolkar halsbandsfil: namn, enhet, punkter med tid", () => {
  const fil = tolkaGarminGpx(gpx("Aston", linje(T0, 300)));
  assert.equal(fil.enhet, "Alpha 100 EMEA/APAC");
  assert.equal(fil.spar.length, 1);
  assert.equal(fil.spar[0].namn, "Aston");
  assert.equal(fil.spar[0].forare, false);
  assert.equal(fil.spar[0].punkter.length, 101);
  assert.equal(fil.spar[0].punkter[0].t, T0);
  assert.equal(fil.spar[0].punkter[0].lat, 59.52);
});

test("känner igen förarens spår och slår ihop segment", () => {
  const fil = tolkaGarminGpx(gpx("Aktuellt spår: 06 DEC 2025 08:57", linje(T0, 600, 59.5, 18.2, 13), true, 3));
  assert.equal(fil.spar[0].forare, true);
  assert.equal(fil.spar[0].punkter.length, Math.floor(600 / 13) + 1);
  assert.ok(tolkaGarminGpx(gpx("Current Track: 06 DEC", linje(T0, 30))).spar[0].forare);
});

test("punkter utan tid hoppas över, icke-GPX ger fel", () => {
  const xml = `<gpx><trk><name>X</name><trkseg><trkpt lat="59" lon="18"></trkpt><trkpt lat="59" lon="18"><time>2026-10-31T07:00:00Z</time></trkpt></trkseg></trk></gpx>`;
  assert.equal(tolkaGarminGpx(xml).spar[0].punkter.length, 1);
  assert.throws(() => tolkaGarminGpx("<kml></kml>"), /ingen GPX/);
});

test("samma halsband på två hundar: dreven bestämmer hunden", () => {
  // Halsbandet heter Aston, men Astrid bar det på eftermiddagen.
  const fm = linje(T0, 1200);
  const em = linje(T0 + 4 * 3600, 1200, 59.53);
  const halsband = [sparMed("Aston", [...fm, ...em])];
  const drev: DrevFonster[] = [
    { id: "d1", hundId: "aston", hundNamn: "Aston", fran: T0, till: T0 + 1200 },
    { id: "d2", hundId: "astrid", hundNamn: "Astrid", fran: T0 + 4 * 3600, till: T0 + 4 * 3600 + 1200 },
  ];
  const r = fordelaPaDrev(halsband, drev);
  assert.equal(r.drevSpar.length, 2);
  assert.equal(r.drevSpar[0].hundId, "aston");
  assert.equal(r.drevSpar[1].hundId, "astrid");
  assert.equal(r.drevSpar[1].halsband, "Aston");
  assert.ok(r.drevSpar[1].punkter.every((p) => p.lat === 59.53));
});

test("bara punkter inom drevets fönster (släpp till drevslut)", () => {
  const halsband = [sparMed("Aston", linje(T0, 3600))];
  const r = fordelaPaDrev(halsband, [{ id: "d", hundId: "h", hundNamn: "Aston", fran: T0 + 600, till: T0 + 1200 }]);
  const p = r.drevSpar[0].punkter;
  assert.equal(p[0].t, T0 + 600);
  assert.equal(p[p.length - 1].t, T0 + 1200);
});

test("två halsband under samma drev: namnet avgör, annars oklart", () => {
  const halsband = [sparMed("Aston", linje(T0, 600)), sparMed("Astrid", linje(T0, 600, 59.6))];
  const drev = (hundNamn: string): DrevFonster[] => [{ id: "d", hundId: "h", hundNamn, fran: T0, till: T0 + 600 }];
  const astrid = fordelaPaDrev(halsband, drev("astrid"));
  assert.equal(astrid.drevSpar[0].halsband, "Astrid");
  const okand = fordelaPaDrev(halsband, drev("Bamse"));
  assert.equal(okand.drevSpar.length, 0);
  assert.deepEqual(okand.oklara, [{ drevId: "d", halsband: ["Aston", "Astrid"] }]);
});

test("förarens spår och enstaka punkter blir inga hundspår", () => {
  const halsband = [sparMed("Aktuellt spår", linje(T0, 600), true), sparMed("Aston", linje(T0, 6))];
  const r = fordelaPaDrev(halsband, [{ id: "d", hundId: "h", hundNamn: "Aston", fran: T0, till: T0 + 600 }]);
  assert.deepEqual(r.utanSpar, ["d"]);
});

test("dagens del: rätt datum och drevfönster med marginal", () => {
  const igar = linje(T0 - 86400, 600, 59.5, 18.2, 13);
  const idag = linje(T0 - 3 * 3600, 8 * 3600, 59.5, 18.2, 13);
  const p = sparMed("F", [...igar, ...idag], true).punkter;
  const dagStart = Date.parse("2026-10-30T23:00:00Z") / 1000;
  const dagSlut = dagStart + 86400 - 1;
  const del = dagensDel(p, dagStart, dagSlut, [{ fran: T0, till: T0 + 3600 }]);
  assert.ok(del[0].t >= T0 - 3600 && del[0].t < T0 - 3600 + 13);
  assert.ok(del[del.length - 1].t <= T0 + 7200);
  assert.ok(dagensDel(p, dagStart, dagSlut, []).every((q) => q.t >= dagStart));
});

test("sträcka filtrerar GPS-brus när hunden står still", () => {
  const still = Array.from({ length: 200 }, (_, i) => ({
    lat: 59.52 + (i % 2 ? 0.00002 : -0.00002),
    lon: 18.21,
    t: T0 + i * 3,
  }));
  assert.equal(stracka(still), 0);
  const gang = sparMed("A", linje(T0, 300)).punkter; // 100 steg à ~10 m
  const m = stracka(gang);
  assert.ok(m > 950 && m < 1100, `${m}`);
});

test("avstånd till föraren och position vid en tid", () => {
  const forare = sparMed("F", [[59.52, 18.21, T0], [59.52, 18.21, T0 + 13]], true).punkter;
  assert.equal(positionVid(forare, T0 + 10)?.t, T0 + 13);
  assert.equal(positionVid(forare, T0 + 1000), null);
  const hund = [{ lat: 59.529, lon: 18.21, t: T0 + 5 }];
  const max = maxAvstandFranForare(hund, forare);
  assert.ok(max !== null && Math.abs(max - 1000) < 5, `${max}`);
  assert.equal(maxAvstandFranForare(hund, []), null);
  assert.ok(Math.abs(avstandMeter({ lat: 59, lon: 18 }, { lat: 59.001, lon: 18 }) - 111.2) < 0.5);
});

test("packa och packa upp, glesa ut", () => {
  const p = [{ lat: 59.5192694664, lon: 18.2098603249, t: T0 }];
  assert.deepEqual(packaUpp(packa(p)), [{ lat: 59.519269, lon: 18.20986, t: T0 }]);
  assert.deepEqual(packaUpp("trasig"), []);
  const lang = Array.from({ length: 5000 }, (_, i) => i);
  const g = glesa(lang, 100);
  assert.equal(g.length, 100);
  assert.equal(g[0], 0);
  assert.equal(g[99], 4999);
});

// Riktiga exporter från Filips Alpha 100 (31 okt), bara lokalt.
const privat = (namn: string) => join(process.cwd(), "src/spar/__tests__/fixtures/privat", namn);
test("riktig export från Alpha 100 (om den finns lokalt)", { skip: !existsSync(privat("Aston.gpx")) }, () => {
  const aston = tolkaGarminGpx(readFileSync(privat("Aston.gpx"), "utf8"));
  assert.equal(aston.spar.length, 1);
  assert.equal(aston.spar[0].namn, "Aston");
  assert.equal(aston.spar[0].punkter.length, 5775);
  const km = stracka(aston.spar[0].punkter) / 1000;
  assert.ok(km > 23 && km < 24.5, `${km}`);
  if (existsSync(privat("Current.gpx"))) {
    const forare = tolkaGarminGpx(readFileSync(privat("Current.gpx"), "utf8"));
    assert.equal(forare.spar[0].forare, true);
    const max = maxAvstandFranForare(aston.spar[0].punkter, forare.spar[0].punkter);
    assert.ok(max !== null && max > 900 && max < 1100, `${max}`);
  }
});
