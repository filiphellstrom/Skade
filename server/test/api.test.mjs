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

test("okänd adress ger 404, /api/mig utan inloggning ger 401", async () => {
  assert.equal((await fetch(`${B}/api/finns-inte`)).status, 404);
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
