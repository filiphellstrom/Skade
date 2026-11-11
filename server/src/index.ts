import { hamtaAuth } from "./auth.ts";
import { appleWebbKlar, googleKlar, tillatnaOrigins, type Miljo } from "./miljo.ts";

function corsHeaders(request: Request, m: Miljo): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin || !tillatnaOrigins(m).includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      request.headers.get("Access-Control-Request-Headers") ?? "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function hantera(request: Request, m: Miljo): Promise<Response> {
  const { pathname } = new URL(request.url);
  const auth = hamtaAuth(m);

  if (pathname.startsWith("/api/auth")) return auth.handler(request);

  if (pathname === "/api/halsa") return json({ ok: true, tjanst: "skade-api" });

  // Vilka inloggningssätt som är uppsatta, så klienterna bara visar knappar som fungerar.
  if (pathname === "/api/konfig") {
    return json({
      apple: { app: true, webb: appleWebbKlar(m) },
      google: googleKlar(m),
    });
  }

  if (pathname === "/api/mig") {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return json({ fel: "Inte inloggad" }, 401);
    const { id, name, email, image, createdAt } = session.user;
    return json({ id, namn: name, epost: email, bild: image ?? null, skapad: createdAt });
  }

  return json({ fel: "Finns inte" }, 404);
}

export default {
  async fetch(request: Request, m: Miljo): Promise<Response> {
    const cors = corsHeaders(request, m);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    let svar: Response;
    try {
      svar = await hantera(request, m);
    } catch (fel) {
      console.error("Ohanterat fel", fel);
      svar = json({ fel: "Serverfel" }, 500);
    }
    const ut = new Response(svar.body, svar);
    for (const [namn, varde] of Object.entries(cors)) ut.headers.set(namn, varde);
    return ut;
  },
} satisfies ExportedHandler<Miljo>;
