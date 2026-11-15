import type { Miljo } from "./miljo.ts";

/**
 * Skades egna API: jaktlag, jaktplaner, eftersök och chatt.
 *
 * Allt kräver inloggning och att man är medlem i jaktlaget. Bara ansvariga
 * ändrar laget och planerna. Telefonerna hämtar ändringar med
 * GET /api/jaktlag/:id/nytt?sedan=<tid>, som svarar med allt som ändrats
 * sedan dess – det är så planen, eftersöken och chatten hålls uppdaterade
 * utan push-notiser.
 */

export interface Anvandare {
  id: string;
  name: string;
}

type Roll = "ansvarig" | "hundforare";

class ApiFel extends Error {
  constructor(
    readonly status: number,
    text: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(text);
  }
}

const MAX_LAG_PER_ANVANDARE = 20;
const MAX_MEDLEMMAR = 60;
const MAX_PLAN_TECKEN = 300_000;
const MAX_MEDDELANDE = 1000;
const DAG = 24 * 60 * 60 * 1000;
/** Utan förväxlingsbara tecken (0/O, 1/I/L). */
const KODTECKEN = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function nyKod(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => KODTECKEN[b % KODTECKEN.length]).join("");
}

function text(v: unknown, max: number, falt: string, kravs = false): string {
  if (v === undefined || v === null) {
    if (kravs) throw new ApiFel(400, `${falt} saknas.`);
    return "";
  }
  if (typeof v !== "string") throw new ApiFel(400, `${falt} måste vara text.`);
  const t = v.trim();
  if (kravs && t === "") throw new ApiFel(400, `${falt} saknas.`);
  if (t.length > max) throw new ApiFel(400, `${falt} är för lång (högst ${max} tecken).`);
  return t;
}

function koordinat(v: unknown, min: number, max: number, falt: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
    throw new ApiFel(400, `${falt} är inte en giltig koordinat.`);
  }
  return v;
}

function ettId(v: unknown): string {
  // Telefonen får välja id själv (UUID), så att ett anrop som skickas om
  // efter dålig täckning inte skapar en dubblett.
  if (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)) return v.toLowerCase();
  return crypto.randomUUID();
}

async function kropp(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > MAX_PLAN_TECKEN + 5000) throw new ApiFel(413, "För mycket data.");
  if (raw === "") return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new ApiFel(400, "Ogiltig JSON.");
  }
}

async function minRoll(db: D1Database, lagId: string, userId: string): Promise<Roll> {
  const rad = await db
    .prepare("SELECT roll FROM medlem WHERE jaktlagId = ? AND userId = ?")
    .bind(lagId, userId)
    .first<{ roll: Roll }>();
  // Samma svar oavsett om laget saknas eller man inte är med, så att ingen kan gissa sig till lag.
  if (!rad) throw new ApiFel(404, "Jaktlaget finns inte, eller så är du inte med i det.");
  return rad.roll;
}

async function kravAnsvarig(db: D1Database, lagId: string, userId: string): Promise<void> {
  if ((await minRoll(db, lagId, userId)) !== "ansvarig") {
    throw new ApiFel(403, "Bara ansvariga i jaktlaget kan göra det här.");
  }
}

async function ror(db: D1Database, lagId: string, nu: number): Promise<void> {
  await db.prepare("UPDATE jaktlag SET uppdaterad = ? WHERE id = ?").bind(nu, lagId).run();
}

interface EftersokRad {
  id: string;
  jaktlagId: string;
  lat: number;
  lon: number;
  viltart: string;
  text: string;
  skapadAv: string | null;
  skapadNamn: string | null;
  skapad: number;
  status: string;
  tagetAv: string | null;
  tagetNamn: string | null;
  tagetHund: string;
  tagetTid: number | null;
  resultat: string | null;
  avslutText: string;
  avslutad: number | null;
  uppdaterad: number;
}

const EFTERSOK_SQL = `
  SELECT e.*, s.name AS skapadNamn, t.name AS tagetNamn
  FROM eftersok e
  LEFT JOIN user s ON s.id = e.skapadAv
  LEFT JOIN user t ON t.id = e.tagetAv`;

async function ettEftersok(db: D1Database, id: string): Promise<EftersokRad> {
  const rad = await db.prepare(`${EFTERSOK_SQL} WHERE e.id = ?`).bind(id).first<EftersokRad>();
  if (!rad) throw new ApiFel(404, "Eftersöket finns inte.");
  return rad;
}

/** Tolkar och begränsar planens innehåll. Formen bestäms av klienten (src/jaktlag/typer.ts). */
function planInnehall(v: unknown): string {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new ApiFel(400, "Planens innehåll saknas.");
  }
  const uppdrag = (v as { uppdrag?: unknown }).uppdrag;
  if (!Array.isArray(uppdrag) || uppdrag.length > 60) {
    throw new ApiFel(400, "Planen måste ha en lista med högst 60 uppdrag.");
  }
  const s = JSON.stringify(v);
  if (s.length > MAX_PLAN_TECKEN) throw new ApiFel(413, "Planen är för stor.");
  return s;
}

function datum(v: unknown): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new ApiFel(400, "Datum måste anges som ÅÅÅÅ-MM-DD.");
  }
  return v;
}

/**
 * Körs innan ett konto raderas: ett jaktlag ska inte bli utan ansvarig.
 * Finns andra medlemmar blir den som varit med längst ansvarig, annars
 * tas laget bort. Medlemskap, meddelanden och blockeringar försvinner med
 * kontot (ON DELETE CASCADE).
 */
export async function stadaForeRadering(db: D1Database, userId: string): Promise<void> {
  const lag = await db
    .prepare("SELECT jaktlagId FROM medlem WHERE userId = ? AND roll = 'ansvarig'")
    .bind(userId)
    .all<{ jaktlagId: string }>();
  for (const { jaktlagId } of lag.results) {
    await lamnaSomAnsvarig(db, jaktlagId, userId);
  }
}

/** Ser till att laget har en annan ansvarig, eller tar bort det om ingen annan finns. Sant = laget togs bort. */
async function lamnaSomAnsvarig(db: D1Database, lagId: string, userId: string): Promise<boolean> {
  const andra = await db
    .prepare("SELECT userId, roll FROM medlem WHERE jaktlagId = ? AND userId != ? ORDER BY gickMed")
    .bind(lagId, userId)
    .all<{ userId: string; roll: Roll }>();
  if (andra.results.length === 0) {
    await db.prepare("DELETE FROM jaktlag WHERE id = ?").bind(lagId).run();
    return true;
  }
  if (!andra.results.some((m) => m.roll === "ansvarig")) {
    await db
      .prepare("UPDATE medlem SET roll = 'ansvarig' WHERE jaktlagId = ? AND userId = ?")
      .bind(lagId, andra.results[0].userId)
      .run();
  }
  return false;
}

async function lagSvar(db: D1Database, lagId: string, userId: string) {
  const roll = await minRoll(db, lagId, userId);
  const lag = await db
    .prepare("SELECT id, namn, kod, skapad, uppdaterad FROM jaktlag WHERE id = ?")
    .bind(lagId)
    .first<{ id: string; namn: string; kod: string; skapad: number; uppdaterad: number }>();
  if (!lag) throw new ApiFel(404, "Jaktlaget finns inte.");
  const medlemmar = await db
    .prepare(
      `SELECT m.userId, u.name AS namn, m.roll, m.gickMed
       FROM medlem m JOIN user u ON u.id = m.userId
       WHERE m.jaktlagId = ? ORDER BY m.gickMed`,
    )
    .bind(lagId)
    .all<{ userId: string; namn: string; roll: Roll; gickMed: number }>();
  return {
    // Inbjudningskoden visas bara för ansvariga.
    lag: { id: lag.id, namn: lag.namn, skapad: lag.skapad, minRoll: roll, kod: roll === "ansvarig" ? lag.kod : null },
    medlemmar: medlemmar.results,
  };
}

export async function hanteraApi(
  request: Request,
  m: Miljo,
  anvandare: Anvandare,
  sokvag: string,
): Promise<Response> {
  try {
    return await rutt(request, m.DB, anvandare, sokvag);
  } catch (fel) {
    if (fel instanceof ApiFel) return json({ fel: fel.message, ...fel.extra }, fel.status);
    throw fel;
  }
}

async function rutt(request: Request, db: D1Database, jag: Anvandare, sokvag: string): Promise<Response> {
  const metod = request.method;
  const delar = sokvag.split("/").filter(Boolean); // t.ex. ["jaktlag", id, "nytt"]
  const nu = Date.now();
  const [a, b, c, d] = delar;

  // ── Jaktlag ──────────────────────────────────────────────────────────
  if (a === "jaktlag" && delar.length === 1) {
    if (metod === "GET") {
      const rader = await db
        .prepare(
          `SELECT l.id, l.namn, m.roll AS minRoll, l.uppdaterad,
                  (SELECT COUNT(*) FROM medlem x WHERE x.jaktlagId = l.id) AS antalMedlemmar
           FROM medlem m JOIN jaktlag l ON l.id = m.jaktlagId
           WHERE m.userId = ? ORDER BY l.uppdaterad DESC`,
        )
        .bind(jag.id)
        .all();
      return json({ jaktlag: rader.results });
    }
    if (metod === "POST") {
      const data = await kropp(request);
      const namn = text(data.namn, 60, "Namnet", true);
      const antal = await db
        .prepare("SELECT COUNT(*) AS n FROM medlem WHERE userId = ?")
        .bind(jag.id)
        .first<{ n: number }>();
      if ((antal?.n ?? 0) >= MAX_LAG_PER_ANVANDARE) {
        throw new ApiFel(400, `Du kan vara med i högst ${MAX_LAG_PER_ANVANDARE} jaktlag.`);
      }
      const id = crypto.randomUUID();
      await db.batch([
        db
          .prepare("INSERT INTO jaktlag (id, namn, kod, skapadAv, skapad, uppdaterad) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(id, namn, nyKod(), jag.id, nu, nu),
        db
          .prepare("INSERT INTO medlem (id, jaktlagId, userId, roll, gickMed) VALUES (?, ?, ?, 'ansvarig', ?)")
          .bind(crypto.randomUUID(), id, jag.id, nu),
      ]);
      return json(await lagSvar(db, id, jag.id), 201);
    }
  }

  if (a === "jaktlag" && b === "ga-med" && delar.length === 2 && metod === "POST") {
    const data = await kropp(request);
    const kod = text(data.kod, 20, "Koden", true).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const lag = await db.prepare("SELECT id FROM jaktlag WHERE kod = ?").bind(kod).first<{ id: string }>();
    if (!lag) throw new ApiFel(404, "Koden stämmer inte. Kontrollera den med den som bjöd in dig.");
    const antal = await db
      .prepare("SELECT COUNT(*) AS n FROM medlem WHERE jaktlagId = ?")
      .bind(lag.id)
      .first<{ n: number }>();
    if ((antal?.n ?? 0) >= MAX_MEDLEMMAR) throw new ApiFel(400, "Jaktlaget är fullt.");
    await db
      .prepare(
        "INSERT OR IGNORE INTO medlem (id, jaktlagId, userId, roll, gickMed) VALUES (?, ?, ?, 'hundforare', ?)",
      )
      .bind(crypto.randomUUID(), lag.id, jag.id, nu)
      .run();
    await ror(db, lag.id, nu);
    return json(await lagSvar(db, lag.id, jag.id));
  }

  if (a === "jaktlag" && b && delar.length === 2) {
    if (metod === "GET") return json(await lagSvar(db, b, jag.id));
    if (metod === "PATCH") {
      await kravAnsvarig(db, b, jag.id);
      const data = await kropp(request);
      const namn = text(data.namn, 60, "Namnet", true);
      await db.prepare("UPDATE jaktlag SET namn = ?, uppdaterad = ? WHERE id = ?").bind(namn, nu, b).run();
      return json(await lagSvar(db, b, jag.id));
    }
    if (metod === "DELETE") {
      await kravAnsvarig(db, b, jag.id);
      await db.prepare("DELETE FROM jaktlag WHERE id = ?").bind(b).run();
      return json({ ok: true });
    }
  }

  if (a === "jaktlag" && b && c === "kod" && delar.length === 3 && metod === "POST") {
    await kravAnsvarig(db, b, jag.id);
    await db.prepare("UPDATE jaktlag SET kod = ?, uppdaterad = ? WHERE id = ?").bind(nyKod(), nu, b).run();
    return json(await lagSvar(db, b, jag.id));
  }

  if (a === "jaktlag" && b && c === "medlem" && d && delar.length === 4) {
    const roll = await minRoll(db, b, jag.id);
    const malRad = await db
      .prepare("SELECT roll FROM medlem WHERE jaktlagId = ? AND userId = ?")
      .bind(b, d)
      .first<{ roll: Roll }>();
    if (!malRad) throw new ApiFel(404, "Medlemmen finns inte i jaktlaget.");
    if (metod === "PATCH") {
      if (roll !== "ansvarig") throw new ApiFel(403, "Bara ansvariga kan ändra roller.");
      const data = await kropp(request);
      if (data.roll !== "ansvarig" && data.roll !== "hundforare") throw new ApiFel(400, "Okänd roll.");
      if (d === jag.id && data.roll === "hundforare") {
        const andra = await db
          .prepare("SELECT COUNT(*) AS n FROM medlem WHERE jaktlagId = ? AND roll = 'ansvarig' AND userId != ?")
          .bind(b, jag.id)
          .first<{ n: number }>();
        if ((andra?.n ?? 0) === 0) {
          throw new ApiFel(400, "Jaktlaget måste ha minst en ansvarig. Gör någon annan ansvarig först.");
        }
      }
      await db.prepare("UPDATE medlem SET roll = ? WHERE jaktlagId = ? AND userId = ?").bind(data.roll, b, d).run();
      await ror(db, b, nu);
      return json(await lagSvar(db, b, jag.id));
    }
    if (metod === "DELETE") {
      if (d !== jag.id && roll !== "ansvarig") throw new ApiFel(403, "Bara ansvariga kan ta bort andra.");
      if (d === jag.id && roll === "ansvarig" && (await lamnaSomAnsvarig(db, b, jag.id))) {
        return json({ ok: true, lagBorttaget: true });
      }
      await db.prepare("DELETE FROM medlem WHERE jaktlagId = ? AND userId = ?").bind(b, d).run();
      await ror(db, b, nu);
      return json({ ok: true, lagBorttaget: false });
    }
  }

  // ── Allt nytt i laget sedan en tidpunkt ─────────────────────────────
  if (a === "jaktlag" && b && c === "nytt" && delar.length === 3 && metod === "GET") {
    const grund = await lagSvar(db, b, jag.id);
    const ansvarig = grund.lag.minRoll === "ansvarig";
    const sedanRa = Number(new URL(request.url).searchParams.get("sedan") ?? "0");
    const sedan = Number.isFinite(sedanRa) && sedanRa > 0 ? sedanRa : 0;

    const planRader = await db
      .prepare(
        `SELECT id, namn, datum, status, version, innehall, uppdaterad
         FROM jaktplan WHERE jaktlagId = ? AND uppdaterad > ? ORDER BY datum DESC`,
      )
      .bind(b, sedan)
      .all<{ id: string; namn: string; datum: string; status: string; version: number; innehall: string; uppdaterad: number }>();
    const planer = planRader.results
      // Vid första hämtningen behövs inte det som redan är borta.
      .filter((p) => sedan > 0 || (p.status !== "borttagen" && (ansvarig || p.status !== "utkast")))
      .map((p) => {
        // Utkast syns bara för ansvariga. För övriga räknas ett utkast som borttaget,
        // så att en plan som dragits tillbaka försvinner ur telefonen.
        if (p.status === "borttagen" || (!ansvarig && p.status === "utkast")) {
          return { id: p.id, status: "borttagen", uppdaterad: p.uppdaterad };
        }
        return { ...p, innehall: JSON.parse(p.innehall) as unknown };
      });

    const eftersok = await db
      .prepare(`${EFTERSOK_SQL} WHERE e.jaktlagId = ? AND e.uppdaterad > ? ORDER BY e.skapad DESC LIMIT 300`)
      .bind(b, sedan > 0 ? sedan : nu - 30 * DAG)
      .all<EftersokRad>();

    const blockerade = await db
      .prepare("SELECT blockeradUserId FROM blockering WHERE userId = ?")
      .bind(jag.id)
      .all<{ blockeradUserId: string }>();
    const blockSet = new Set(blockerade.results.map((r) => r.blockeradUserId));

    const meddelanden = await db
      .prepare(
        `SELECT * FROM (
           SELECT d.id, d.userId, u.name AS namn, d.text, d.skapad, d.borttaget, d.uppdaterad
           FROM meddelande d JOIN user u ON u.id = d.userId
           WHERE d.jaktlagId = ? AND d.uppdaterad > ? ORDER BY d.skapad DESC LIMIT 200
         ) ORDER BY skapad`,
      )
      .bind(b, sedan)
      .all<{ id: string; userId: string; namn: string; text: string; skapad: number; borttaget: number; uppdaterad: number }>();

    return json({
      nu,
      ...grund,
      planer,
      eftersok: eftersok.results,
      meddelanden: meddelanden.results
        .filter((d) => !blockSet.has(d.userId))
        .map((d) => (d.borttaget ? { ...d, text: "" } : d)),
      blockerade: [...blockSet],
    });
  }

  // ── Planer ───────────────────────────────────────────────────────────
  if (a === "jaktlag" && b && c === "plan" && delar.length === 3 && metod === "POST") {
    await kravAnsvarig(db, b, jag.id);
    const data = await kropp(request);
    const id = ettId(data.id);
    const namn = text(data.namn, 80, "Namnet", true);
    const innehall = planInnehall(data.innehall ?? { uppdrag: [] });
    await db
      .prepare(
        `INSERT INTO jaktplan (id, jaktlagId, namn, datum, status, version, innehall, skapadAv, skapad, uppdaterad)
         VALUES (?, ?, ?, ?, 'utkast', 1, ?, ?, ?, ?)`,
      )
      .bind(id, b, namn, datum(data.datum), innehall, jag.id, nu, nu)
      .run();
    return json({ id, version: 1, status: "utkast", uppdaterad: nu }, 201);
  }

  if (a === "plan" && b && delar.length === 2) {
    const plan = await db
      .prepare("SELECT jaktlagId, version, status FROM jaktplan WHERE id = ?")
      .bind(b)
      .first<{ jaktlagId: string; version: number; status: string }>();
    if (!plan || plan.status === "borttagen") throw new ApiFel(404, "Planen finns inte.");
    await kravAnsvarig(db, plan.jaktlagId, jag.id);
    if (metod === "PUT") {
      const data = await kropp(request);
      // Skydd mot att två ansvariga skriver över varandra.
      if (typeof data.version === "number" && data.version !== plan.version) {
        throw new ApiFel(409, "Planen har ändrats av någon annan. Ladda om den och gör ändringen igen.", {
          version: plan.version,
        });
      }
      const status = data.status;
      if (status !== "utkast" && status !== "publicerad" && status !== "stangd") {
        throw new ApiFel(400, "Okänd status.");
      }
      const namn = text(data.namn, 80, "Namnet", true);
      await db
        .prepare(
          "UPDATE jaktplan SET namn = ?, datum = ?, status = ?, innehall = ?, version = version + 1, uppdaterad = ? WHERE id = ?",
        )
        .bind(namn, datum(data.datum), status, planInnehall(data.innehall), nu, b)
        .run();
      return json({ id: b, version: plan.version + 1, status, uppdaterad: nu });
    }
    if (metod === "DELETE") {
      await db
        .prepare("UPDATE jaktplan SET status = 'borttagen', innehall = '{\"uppdrag\":[]}', uppdaterad = ? WHERE id = ?")
        .bind(nu, b)
        .run();
      return json({ ok: true });
    }
  }

  // ── Eftersök ─────────────────────────────────────────────────────────
  if (a === "jaktlag" && b && c === "eftersok" && delar.length === 3 && metod === "POST") {
    await minRoll(db, b, jag.id);
    const data = await kropp(request);
    const id = ettId(data.id);
    const skapad = typeof data.skapad === "number" && data.skapad > nu - 7 * DAG && data.skapad <= nu ? data.skapad : nu;
    await db
      .prepare(
        `INSERT OR IGNORE INTO eftersok (id, jaktlagId, lat, lon, viltart, text, skapadAv, skapad, status, uppdaterad)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'oppet', ?)`,
      )
      .bind(
        id,
        b,
        koordinat(data.lat, -90, 90, "Latituden"),
        koordinat(data.lon, -180, 180, "Longituden"),
        text(data.viltart, 40, "Viltarten"),
        text(data.text, 500, "Texten"),
        jag.id,
        skapad,
        nu,
      )
      .run();
    const rad = await ettEftersok(db, id);
    if (rad.jaktlagId !== b) throw new ApiFel(409, "Id:t används redan.");
    return json({ eftersok: rad }, 201);
  }

  if (a === "eftersok" && b && c && delar.length === 3 && metod === "POST") {
    const rad = await ettEftersok(db, b);
    const roll = await minRoll(db, rad.jaktlagId, jag.id);
    const data = await kropp(request);
    if (c === "ta") {
      // Bara ett öppet eftersök kan tas. Databasen avgör om två trycker samtidigt.
      const svar = await db
        .prepare(
          "UPDATE eftersok SET status = 'taget', tagetAv = ?, tagetHund = ?, tagetTid = ?, uppdaterad = ? WHERE id = ? AND status = 'oppet'",
        )
        .bind(jag.id, text(data.hund, 60, "Hundens namn"), nu, nu, b)
        .run();
      const efter = await ettEftersok(db, b);
      if (svar.meta.changes === 0 && efter.tagetAv !== jag.id) {
        throw new ApiFel(
          409,
          efter.status === "avslutat" ? "Eftersöket är redan avslutat." : `Redan taget av ${efter.tagetNamn ?? "någon annan"}.`,
          { eftersok: efter },
        );
      }
      return json({ eftersok: efter });
    }
    if (c === "lamna") {
      if (rad.status !== "taget" || (rad.tagetAv !== jag.id && roll !== "ansvarig")) {
        throw new ApiFel(400, "Du har inte det här eftersöket.");
      }
      await db
        .prepare(
          "UPDATE eftersok SET status = 'oppet', tagetAv = NULL, tagetHund = '', tagetTid = NULL, uppdaterad = ? WHERE id = ?",
        )
        .bind(nu, b)
        .run();
      return json({ eftersok: await ettEftersok(db, b) });
    }
    if (c === "avsluta") {
      if (rad.status === "avslutat") return json({ eftersok: rad });
      if (rad.tagetAv !== jag.id && rad.skapadAv !== jag.id && roll !== "ansvarig") {
        throw new ApiFel(403, "Bara den som tagit eller markerat eftersöket, eller en ansvarig, kan avsluta det.");
      }
      const resultat = data.resultat;
      if (resultat !== "hittat" && resultat !== "inte_hittat" && resultat !== "avbrutet") {
        throw new ApiFel(400, "Välj Hittat, Inte hittat eller Avbrutet.");
      }
      await db
        .prepare(
          "UPDATE eftersok SET status = 'avslutat', resultat = ?, avslutText = ?, avslutad = ?, uppdaterad = ? WHERE id = ?",
        )
        .bind(resultat, text(data.text, 500, "Texten"), nu, nu, b)
        .run();
      return json({ eftersok: await ettEftersok(db, b) });
    }
  }

  // ── Chatt ────────────────────────────────────────────────────────────
  if (a === "jaktlag" && b && c === "meddelande" && delar.length === 3 && metod === "POST") {
    await minRoll(db, b, jag.id);
    const data = await kropp(request);
    const id = ettId(data.id);
    await db
      .prepare(
        "INSERT OR IGNORE INTO meddelande (id, jaktlagId, userId, text, skapad, uppdaterad) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, b, jag.id, text(data.text, MAX_MEDDELANDE, "Meddelandet", true), nu, nu)
      .run();
    return json({ id, skapad: nu }, 201);
  }

  if (a === "meddelande" && b && delar.length >= 2) {
    const rad = await db
      .prepare("SELECT jaktlagId, userId FROM meddelande WHERE id = ?")
      .bind(b)
      .first<{ jaktlagId: string; userId: string }>();
    if (!rad) throw new ApiFel(404, "Meddelandet finns inte.");
    const roll = await minRoll(db, rad.jaktlagId, jag.id);
    if (c === "rapportera" && delar.length === 3 && metod === "POST") {
      const data = await kropp(request);
      await db
        .prepare("INSERT OR IGNORE INTO rapport (id, meddelandeId, userId, orsak, skapad) VALUES (?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), b, jag.id, text(data.orsak, 300, "Orsaken"), nu)
        .run();
      return json({ ok: true });
    }
    if (delar.length === 2 && metod === "DELETE") {
      if (rad.userId !== jag.id && roll !== "ansvarig") {
        throw new ApiFel(403, "Du kan bara ta bort dina egna meddelanden.");
      }
      await db.prepare("UPDATE meddelande SET borttaget = 1, text = '', uppdaterad = ? WHERE id = ?").bind(nu, b).run();
      return json({ ok: true });
    }
  }

  if (a === "blockering" && delar.length === 1 && metod === "POST") {
    const data = await kropp(request);
    const vem = text(data.userId, 80, "Användaren", true);
    if (vem === jag.id) throw new ApiFel(400, "Du kan inte blockera dig själv.");
    const finns = await db.prepare("SELECT id FROM user WHERE id = ?").bind(vem).first();
    if (!finns) throw new ApiFel(404, "Användaren finns inte.");
    await db
      .prepare("INSERT OR IGNORE INTO blockering (userId, blockeradUserId, skapad) VALUES (?, ?, ?)")
      .bind(jag.id, vem, nu)
      .run();
    return json({ ok: true });
  }
  if (a === "blockering" && b && delar.length === 2 && metod === "DELETE") {
    await db.prepare("DELETE FROM blockering WHERE userId = ? AND blockeradUserId = ?").bind(jag.id, b).run();
    return json({ ok: true });
  }

  throw new ApiFel(404, "Finns inte.");
}
