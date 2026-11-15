// Startar Workern lokalt (wrangler dev med lokal D1) och går igenom flödet:
// hälsa, konfig, CORS, konto skapas, /api/mig, radera konto.
// Kör: npm test   (kräver .dev.vars med TESTLAGE=1, se README)
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execSync } from "node:child_process";

const PORT = 8799;
const B = `http://localhost:${PORT}`;
const ORIGIN = "http://localhost:8081";
let proc;

before(async () => {
  execSync("npx wrangler d1 migrations apply skade --local", { stdio: "ignore" });
  proc = spawn("npx", ["wrangler", "dev", "--port", String(PORT)], { stdio: "ignore", detached: true });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${B}/api/halsa`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Servern startade inte");
});

after(() => {
  try {
    process.kill(-proc.pid);
  } catch {}
});

test("hälsa och konfig", async () => {
  assert.deepEqual(await (await fetch(`${B}/api/halsa`)).json(), { ok: true, tjanst: "skade-api" });
  const konfig = await (await fetch(`${B}/api/konfig`)).json();
  assert.equal(konfig.apple.app, true);
});

test("CORS bara för tillåtna adresser", async () => {
  const ok = await fetch(`${B}/api/mig`, { method: "OPTIONS", headers: { Origin: ORIGIN } });
  assert.equal(ok.headers.get("access-control-allow-origin"), ORIGIN);
  const nej = await fetch(`${B}/api/mig`, { method: "OPTIONS", headers: { Origin: "https://ond.example" } });
  assert.equal(nej.headers.get("access-control-allow-origin"), null);
});

test("okänd adress ger 404, allt under /api kräver inloggning", async () => {
  assert.equal((await fetch(`${B}/finns-inte`)).status, 404);
  assert.equal((await fetch(`${B}/api/finns-inte`)).status, 401);
  assert.equal((await fetch(`${B}/api/mig`)).status, 401);
});

test("falsk Apple-token avvisas", async () => {
  const svar = await fetch(`${B}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ provider: "apple", idToken: { token: "a.b.c" } }),
  });
  assert.equal(svar.status, 401);
});

test("konto: skapa, läsa, radera", async () => {
  const epost = `test-${Date.now()}@example.com`;
  const skapa = await fetch(`${B}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email: epost, password: "ett-langt-losenord-1", name: "Test Jägare" }),
  });
  assert.equal(skapa.status, 200);
  const cookie = skapa.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  const mig = await fetch(`${B}/api/mig`, { headers: { Cookie: cookie } });
  assert.equal(mig.status, 200);
  assert.equal((await mig.json()).namn, "Test Jägare");

  const radera = await fetch(`${B}/api/auth/delete-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, Cookie: cookie },
    body: "{}",
  });
  assert.equal(radera.status, 200);
  assert.equal((await fetch(`${B}/api/mig`, { headers: { Cookie: cookie } })).status, 401);
});

// ── Jaktlag, planer, eftersök och chatt ────────────────────────────────

async function nyAnvandare(namn) {
  const svar = await fetch(`${B}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({
      email: `${namn.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      password: "ett-langt-losenord-1",
      name: namn,
    }),
  });
  assert.equal(svar.status, 200);
  const cookie = svar.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const id = (await svar.json()).user.id;
  const anropa = async (metod, vag, data) => {
    const r = await fetch(`${B}/api${vag}`, {
      method: metod,
      headers: { "Content-Type": "application/json", Origin: ORIGIN, Cookie: cookie },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    let json = null;
    try {
      json = await r.json();
    } catch {}
    return { status: r.status, json };
  };
  return { id, namn, anropa };
}

test("jaktlag: skapa, gå med, roller och behörighet", async () => {
  const anna = await nyAnvandare("Anna");
  const bo = await nyAnvandare("Bo");
  const cia = await nyAnvandare("Cia");

  assert.equal((await fetch(`${B}/api/jaktlag`)).status, 401);

  const skapat = await anna.anropa("POST", "/jaktlag", { namn: "Testlaget" });
  assert.equal(skapat.status, 201);
  const lag = skapat.json.lag;
  assert.equal(lag.minRoll, "ansvarig");
  assert.match(lag.kod, /^[A-Z2-9]{8}$/);

  assert.equal((await bo.anropa("POST", "/jaktlag/ga-med", { kod: "FELAKTIG" })).status, 404);
  // Koden tål gemener och bindestreck.
  const kodMedStreck = `${lag.kod.slice(0, 4)}-${lag.kod.slice(4)}`.toLowerCase();
  const gickMed = await bo.anropa("POST", "/jaktlag/ga-med", { kod: kodMedStreck });
  assert.equal(gickMed.status, 200);
  assert.equal(gickMed.json.lag.minRoll, "hundforare");
  assert.equal(gickMed.json.lag.kod, null, "hundförare ska inte se koden");
  assert.equal(gickMed.json.medlemmar.length, 2);
  // Att gå med två gånger ger ingen dubblett.
  assert.equal((await bo.anropa("POST", "/jaktlag/ga-med", { kod: lag.kod })).json.medlemmar.length, 2);

  // Utomstående ser ingenting.
  assert.equal((await cia.anropa("GET", `/jaktlag/${lag.id}`)).status, 404);
  assert.equal((await cia.anropa("GET", `/jaktlag/${lag.id}/nytt`)).status, 404);
  assert.equal((await cia.anropa("POST", `/jaktlag/${lag.id}/meddelande`, { text: "hej" })).status, 404);

  // Hundförare får inte ändra laget.
  assert.equal((await bo.anropa("PATCH", `/jaktlag/${lag.id}`, { namn: "Nytt" })).status, 403);
  assert.equal((await bo.anropa("POST", `/jaktlag/${lag.id}/kod`)).status, 403);
  assert.equal((await bo.anropa("POST", `/jaktlag/${lag.id}/plan`, { namn: "P", datum: "2026-11-20" })).status, 403);

  const nyKod = await anna.anropa("POST", `/jaktlag/${lag.id}/kod`);
  assert.notEqual(nyKod.json.lag.kod, lag.kod);
  assert.equal((await cia.anropa("POST", "/jaktlag/ga-med", { kod: lag.kod })).status, 404, "gammal kod gäller inte");

  // Enda ansvarig kan inte göra sig själv till hundförare.
  assert.equal((await anna.anropa("PATCH", `/jaktlag/${lag.id}/medlem/${anna.id}`, { roll: "hundforare" })).status, 400);
  const befordrad = await anna.anropa("PATCH", `/jaktlag/${lag.id}/medlem/${bo.id}`, { roll: "ansvarig" });
  assert.equal(befordrad.json.medlemmar.find((m) => m.userId === bo.id).roll, "ansvarig");

  assert.equal((await anna.anropa("GET", "/jaktlag")).json.jaktlag.length, 1);
  // Anna lämnar; Bo är kvar som ansvarig. Bo lämnar sist och laget försvinner.
  assert.equal((await anna.anropa("DELETE", `/jaktlag/${lag.id}/medlem/${anna.id}`)).json.lagBorttaget, false);
  assert.equal((await anna.anropa("GET", "/jaktlag")).json.jaktlag.length, 0);
  assert.equal((await bo.anropa("DELETE", `/jaktlag/${lag.id}/medlem/${bo.id}`)).json.lagBorttaget, true);
  assert.equal((await bo.anropa("GET", `/jaktlag/${lag.id}`)).status, 404);
});

test("plan: utkast syns bara för ansvarig, publicering, versionskrock, tillbakadragen", async () => {
  const anna = await nyAnvandare("Anna");
  const bo = await nyAnvandare("Bo");
  const lag = (await anna.anropa("POST", "/jaktlag", { namn: "Planlaget" })).json.lag;
  await bo.anropa("POST", "/jaktlag/ga-med", { kod: lag.kod });

  const innehall = { uppdrag: [{ id: "u1", forare: "Bo", hund: "Aston", farg: "#e4572e", rutt: [] }] };
  const plan = (await anna.anropa("POST", `/jaktlag/${lag.id}/plan`, { namn: "Lördag", datum: "2026-11-21", innehall })).json;
  assert.equal(plan.version, 1);
  assert.equal((await anna.anropa("POST", `/jaktlag/${lag.id}/plan`, { namn: "X", datum: "i morgon" })).status, 400);

  assert.equal((await bo.anropa("GET", `/jaktlag/${lag.id}/nytt`)).json.planer.length, 0, "utkast syns inte för hundförare");
  assert.equal((await anna.anropa("GET", `/jaktlag/${lag.id}/nytt`)).json.planer.length, 1);

  const pub = await anna.anropa("PUT", `/plan/${plan.id}`, { namn: "Lördag", datum: "2026-11-21", status: "publicerad", innehall, version: 1 });
  assert.equal(pub.json.version, 2);
  assert.equal((await bo.anropa("PUT", `/plan/${plan.id}`, { namn: "Hack", datum: "2026-11-21", status: "publicerad", innehall })).status, 403);
  const krock = await anna.anropa("PUT", `/plan/${plan.id}`, { namn: "Lördag", datum: "2026-11-21", status: "publicerad", innehall, version: 1 });
  assert.equal(krock.status, 409);

  const hosBo = (await bo.anropa("GET", `/jaktlag/${lag.id}/nytt`)).json;
  assert.equal(hosBo.planer.length, 1);
  assert.equal(hosBo.planer[0].innehall.uppdrag[0].hund, "Aston");

  // Planen dras tillbaka till utkast: Bo får veta att den är borta.
  await anna.anropa("PUT", `/plan/${plan.id}`, { namn: "Lördag", datum: "2026-11-21", status: "utkast", innehall, version: 2 });
  const efter = (await bo.anropa("GET", `/jaktlag/${lag.id}/nytt?sedan=${hosBo.nu - 1}`)).json;
  assert.deepEqual(efter.planer.map((p) => p.status), ["borttagen"]);

  assert.equal((await anna.anropa("DELETE", `/plan/${plan.id}`)).status, 200);
  assert.equal((await anna.anropa("GET", `/jaktlag/${lag.id}/nytt`)).json.planer.length, 0);
});

test("eftersök: markera, bara en kan ta det, lämna, avsluta", async () => {
  const anna = await nyAnvandare("Anna");
  const bo = await nyAnvandare("Bo");
  const lag = (await anna.anropa("POST", "/jaktlag", { namn: "Eftersökslaget" })).json.lag;
  await bo.anropa("POST", "/jaktlag/ga-med", { kod: lag.kod });

  const id = "11111111-2222-4333-8444-" + String(Date.now()).padStart(12, "0").slice(-12);
  const nytt = await bo.anropa("POST", `/jaktlag/${lag.id}/eftersok`, { id, lat: 61.2, lon: 14.5, viltart: "Älg", text: "Gick mot nordväst" });
  assert.equal(nytt.status, 201);
  assert.equal(nytt.json.eftersok.skapadNamn, "Bo");
  // Samma id igen (omskick efter dålig täckning) ger ingen dubblett.
  await bo.anropa("POST", `/jaktlag/${lag.id}/eftersok`, { id, lat: 61.2, lon: 14.5, viltart: "Älg" });
  assert.equal((await anna.anropa("GET", `/jaktlag/${lag.id}/nytt`)).json.eftersok.length, 1);
  assert.equal((await bo.anropa("POST", `/jaktlag/${lag.id}/eftersok`, { lat: 999, lon: 14.5 })).status, 400);

  const tar = await anna.anropa("POST", `/eftersok/${id}/ta`, { hund: "Molly" });
  assert.equal(tar.json.eftersok.status, "taget");
  assert.equal(tar.json.eftersok.tagetNamn, "Anna");
  const forSent = await bo.anropa("POST", `/eftersok/${id}/ta`, { hund: "Aston" });
  assert.equal(forSent.status, 409);
  assert.match(forSent.json.fel, /Redan taget av Anna/);

  assert.equal((await bo.anropa("POST", `/eftersok/${id}/lamna`)).status, 400);
  assert.equal((await anna.anropa("POST", `/eftersok/${id}/lamna`)).json.eftersok.status, "oppet");
  assert.equal((await bo.anropa("POST", `/eftersok/${id}/ta`, { hund: "Aston" })).json.eftersok.tagetHund, "Aston");

  assert.equal((await bo.anropa("POST", `/eftersok/${id}/avsluta`, { resultat: "kanske" })).status, 400);
  const klart = await bo.anropa("POST", `/eftersok/${id}/avsluta`, { resultat: "hittat", text: "Låg 300 m bort" });
  assert.equal(klart.json.eftersok.status, "avslutat");
  assert.equal(klart.json.eftersok.resultat, "hittat");
});

test("chatt: skicka, ta bort, rapportera, blockera", async () => {
  const anna = await nyAnvandare("Anna");
  const bo = await nyAnvandare("Bo");
  const lag = (await anna.anropa("POST", "/jaktlag", { namn: "Chattlaget" })).json.lag;
  await bo.anropa("POST", "/jaktlag/ga-med", { kod: lag.kod });

  const m1 = (await anna.anropa("POST", `/jaktlag/${lag.id}/meddelande`, { text: "Släpper om tio minuter" })).json;
  const m2 = (await bo.anropa("POST", `/jaktlag/${lag.id}/meddelande`, { text: "Uppfattat" })).json;
  assert.equal((await bo.anropa("POST", `/jaktlag/${lag.id}/meddelande`, { text: "   " })).status, 400);

  const hosBo = (await bo.anropa("GET", `/jaktlag/${lag.id}/nytt`)).json;
  assert.deepEqual(hosBo.meddelanden.map((d) => d.text), ["Släpper om tio minuter", "Uppfattat"]);
  assert.equal(hosBo.meddelanden[0].namn, "Anna");

  assert.equal((await bo.anropa("POST", `/meddelande/${m1.id}/rapportera`, { orsak: "Test" })).status, 200);
  assert.equal((await bo.anropa("DELETE", `/meddelande/${m1.id}`)).status, 403, "hundförare tar inte bort andras");
  assert.equal((await bo.anropa("DELETE", `/meddelande/${m2.id}`)).status, 200);
  const efter = (await anna.anropa("GET", `/jaktlag/${lag.id}/nytt?sedan=${hosBo.nu - 1}`)).json;
  assert.deepEqual(efter.meddelanden.map((d) => [d.id, d.borttaget, d.text]), [[m2.id, 1, ""]]);

  assert.equal((await bo.anropa("POST", "/blockering", { userId: bo.id })).status, 400);
  assert.equal((await bo.anropa("POST", "/blockering", { userId: anna.id })).status, 200);
  const blockad = (await bo.anropa("GET", `/jaktlag/${lag.id}/nytt`)).json;
  assert.equal(blockad.meddelanden.some((d) => d.userId === anna.id), false);
  assert.deepEqual(blockad.blockerade, [anna.id]);
  await bo.anropa("DELETE", `/blockering/${anna.id}`);
  assert.equal((await bo.anropa("GET", `/jaktlag/${lag.id}/nytt`)).json.meddelanden.some((d) => d.userId === anna.id), true);
});

test("radera konto: laget får en ny ansvarig, eller tas bort om ingen är kvar", async () => {
  const anna = await nyAnvandare("Anna");
  const bo = await nyAnvandare("Bo");
  const lag = (await anna.anropa("POST", "/jaktlag", { namn: "Arvslaget" })).json.lag;
  await bo.anropa("POST", "/jaktlag/ga-med", { kod: lag.kod });
  await anna.anropa("POST", `/jaktlag/${lag.id}/meddelande`, { text: "Hej då" });

  assert.equal((await anna.anropa("POST", "/auth/delete-user", {})).status, 200);
  const kvar = (await bo.anropa("GET", `/jaktlag/${lag.id}/nytt`)).json;
  assert.equal(kvar.lag.minRoll, "ansvarig");
  assert.equal(kvar.medlemmar.length, 1);
  assert.equal(kvar.meddelanden.length, 0, "den raderades meddelanden är borta");

  assert.equal((await bo.anropa("POST", "/auth/delete-user", {})).status, 200);
});
