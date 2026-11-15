import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDatabase } from "@/db/client";
import { hamtaKartdata } from "@/db/queries/kartpunkt";
import type { Kartdata } from "@/db/queries/kartpunkt";
import { useProfil } from "@/contexts/ProfilContext";
import { ApiFel, felText, sparaPlan } from "@/jaktlag/lager";
import { giltigTid, giltigtDatum, planDatum } from "@/jaktlag/format";
import { tillPlanJaktmark } from "@/jaktlag/planmark";
import { formateraAvstand, ruttLangd, UPPDRAGSFARGER } from "@/jaktlag/typer";
import type { LagData, Plan, PlanInnehall, PlanStatus, Punkt, Uppdrag } from "@/jaktlag/typer";
import { useTema } from "@/theme/TemaContext";
import { avstand, FONT, radie } from "@/theme/tokens";
import { randomUUID } from "@/utils/uuid";
import { InlineBanner } from "@/components/InlineBanner";
import { laggInKartstilar, laggPaKartlager, planGranser, ritaPlan } from "@/components/karta/planLeaflet";
import type { Kartlagerval } from "@/components/karta/planLeaflet";
import { Knapp } from "@/components/ui/Knapp";
import { Etikett, Falt, TillbakaKnapp, ValChip } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Planeraren (2026-11-15): den ansvariga ritar jaktplanen på kartan.
 * Bara på webben – planering görs bäst med mus och stor skärm.
 *
 * Till vänster planens uppgifter och uppdragen, till höger kartan.
 * Ett uppdrag i taget är valt och ritas fullt ut; de andra syns som små
 * märkta släpplatser. För det valda uppdraget:
 *  - "Sätt släpplats": nästa klick på kartan sätter släpplatsen.
 *  - "Rita rutt": varje klick lägger till en punkt. Första punkten är
 *    start (A) och sista är mål (B). Punkter kan dras, märkas som viktiga
 *    (!) med en kort text, och tas bort.
 * Samlingsplatsen sätts på samma sätt. Markörer flyttas genom att dras.
 *
 * Inget sparas förrän man trycker Spara eller Publicera. En publicerad
 * plan som sparas går ut till jaktlaget direkt. Om någon annan ansvarig
 * hunnit ändra planen under tiden säger servern ifrån i stället för att
 * skriva över.
 */

type Lage = "inget" | "slapp" | "rutt" | "samling";

const SVERIGE: L.LatLngExpression = [62.5, 16.5];

const LAGESTEXT: Record<Exclude<Lage, "inget">, string> = {
  slapp: "Klicka på kartan där hunden ska släppas.",
  rutt: "Klicka på kartan för att lägga till punkter på rutten, i den ordning de ska gås. Tryck Klar när rutten är färdig.",
  samling: "Klicka på kartan där ni samlas.",
};

export function PlanEditor({ lagId, plan, data }: { lagId: string; plan: Plan; data: LagData }) {
  const { farger } = useTema();
  const { profil } = useProfil();
  const { width } = useWindowDimensions();
  const bred = width >= 900;

  const [namn, setNamn] = useState(plan.namn);
  const [datum, setDatum] = useState(plan.datum);
  const [innehall, setInnehall] = useState<PlanInnehall>(plan.innehall);
  const [status, setStatus] = useState<PlanStatus>(plan.status);
  const [version, setVersion] = useState(plan.version);
  const [andrad, setAndrad] = useState(false);
  const [valtId, setValtId] = useState<string | null>(plan.innehall.uppdrag[0]?.id ?? null);
  const [valdPunktId, setValdPunktId] = useState<string | null>(null);
  const [lage, setLage] = useState<Lage>("inget");
  const [visaAlla, setVisaAlla] = useState(false);
  const [kartval, setKartval] = useState<Kartlagerval>("terrang");
  const [marker, setMarker] = useState<Kartdata[]>([]);
  const [sparar, setSparar] = useState<PlanStatus | null>(null);
  const [fel, setFel] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const behallare = useRef<HTMLDivElement>(null);
  const karta = useRef<L.Map | null>(null);
  const kartlager = useRef<L.TileLayer | null>(null);
  const plangrupp = useRef<L.LayerGroup | null>(null);
  const harPassat = useRef(false);
  // Kartans klick-lyssnare skapas en gång och läser det senaste läget härifrån.
  const nu = useRef({ lage, valtId });
  nu.current = { lage, valtId };

  const andra = useCallback((fn: (i: PlanInnehall) => PlanInnehall) => {
    setInnehall(fn);
    setAndrad(true);
    setInfo(null);
  }, []);

  const andraUppdrag = useCallback(
    (id: string, fn: (u: Uppdrag) => Uppdrag) =>
      andra((i) => ({ ...i, uppdrag: i.uppdrag.map((u) => (u.id === id ? fn(u) : u)) })),
    [andra],
  );

  // Jaktmarker som finns importerade i den här webbläsaren.
  useEffect(() => {
    (async () => {
      const db = await getDatabase();
      const k = await hamtaKartdata(db, profil.id);
      setMarker(k.filter((x) => x.grans.length > 0 || x.punkter.length > 0));
    })().catch(() => {});
  }, [profil.id]);

  // Varna om man lämnar sidan med osparade ändringar.
  useEffect(() => {
    if (!andrad) return;
    const varna = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", varna);
    return () => window.removeEventListener("beforeunload", varna);
  }, [andrad]);

  // Kartan skapas en gång.
  useEffect(() => {
    if (!behallare.current) return;
    laggInKartstilar(FONT[400]);
    const k = L.map(behallare.current, { zoomControl: false }).setView(SVERIGE, 5);
    L.control.zoom({ position: "bottomleft", zoomInTitle: "Zooma in", zoomOutTitle: "Zooma ut" }).addTo(k);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(k);
    k.attributionControl.setPrefix(false);
    plangrupp.current = L.layerGroup().addTo(k);
    const visaNamn = () => behallare.current?.classList.toggle("visa-namn", k.getZoom() >= 14);
    k.on("zoomend", visaNamn);
    k.on("click", (e: L.LeafletMouseEvent) => {
      const p: Punkt = { lat: Math.round(e.latlng.lat * 1e6) / 1e6, lon: Math.round(e.latlng.lng * 1e6) / 1e6 };
      const { lage: l, valtId: id } = nu.current;
      if (l === "samling") {
        setInnehall((i) => ({ ...i, samling: { ...(i.samling ?? {}), ...p } }));
        setAndrad(true);
        setLage("inget");
      } else if (l === "slapp" && id) {
        setInnehall((i) => ({ ...i, uppdrag: i.uppdrag.map((u) => (u.id === id ? { ...u, slapp: p } : u)) }));
        setAndrad(true);
        setLage("inget");
      } else if (l === "rutt" && id) {
        setInnehall((i) => ({
          ...i,
          uppdrag: i.uppdrag.map((u) => (u.id === id ? { ...u, rutt: [...u.rutt, { id: randomUUID(), ...p }] } : u)),
        }));
        setAndrad(true);
      }
    });
    karta.current = k;
    const storlek = new ResizeObserver(() => k.invalidateSize());
    storlek.observe(behallare.current);
    return () => {
      storlek.disconnect();
      k.remove();
      karta.current = null;
      kartlager.current = null;
    };
  }, []);

  useEffect(() => {
    const k = karta.current;
    if (!k) return;
    kartlager.current?.remove();
    kartlager.current = laggPaKartlager(k, kartval);
  }, [kartval]);

  useEffect(() => {
    behallare.current?.classList.toggle("skade-ritar", lage !== "inget");
  }, [lage]);

  // Rita om planen när något ändras.
  useEffect(() => {
    if (!plangrupp.current) return;
    ritaPlan(plangrupp.current, innehall, {
      fokusId: valtId,
      visaAllaRutter: visaAlla,
      redigera: {
        onFlyttaSlapp: (id, p) => andraUppdrag(id, (u) => ({ ...u, slapp: p })),
        onFlyttaRuttpunkt: (id, punktId, p) =>
          andraUppdrag(id, (u) => ({ ...u, rutt: u.rutt.map((r) => (r.id === punktId ? { ...r, ...p } : r)) })),
        onValjRuttpunkt: (_id, punktId) => setValdPunktId(punktId),
        onFlyttaSamling: (p) => andra((i) => ({ ...i, samling: { ...(i.samling ?? {}), ...p } })),
        onValjUppdrag: (id) => {
          setValtId(id);
          setValdPunktId(null);
          setLage("inget");
        },
      },
    });
    if (!harPassat.current) {
      const granser = planGranser(innehall);
      if (granser && karta.current) {
        karta.current.fitBounds(granser, { padding: [40, 40], maxZoom: 15 });
        harPassat.current = true;
      }
    }
  }, [innehall, valtId, visaAlla, andra, andraUppdrag]);

  const visaAllt = () => {
    const granser = planGranser(innehall);
    if (granser) karta.current?.fitBounds(granser, { padding: [40, 40], maxZoom: 15 });
  };

  const valt = innehall.uppdrag.find((u) => u.id === valtId) ?? null;

  const nyttUppdrag = () => {
    const id = randomUUID();
    andra((i) => ({
      ...i,
      uppdrag: [
        ...i.uppdrag,
        { id, forare: "", hund: "", farg: UPPDRAGSFARGER[i.uppdrag.length % UPPDRAGSFARGER.length], rutt: [] },
      ],
    }));
    setValtId(id);
    setValdPunktId(null);
    setLage("inget");
  };

  const tiderOk = useMemo(
    () =>
      giltigTid(innehall.samling?.tid ?? "") && innehall.uppdrag.every((u) => giltigTid(u.slappTid ?? "")),
    [innehall],
  );
  const kanSpara = giltigtDatum(datum) && namn.trim() !== "" && tiderOk && !sparar;

  const spara = async (nyStatus: PlanStatus) => {
    if (!kanSpara) return;
    setSparar(nyStatus);
    setFel(null);
    setInfo(null);
    setLage("inget");
    try {
      const sparad = await sparaPlan(lagId, { ...plan, version }, { namn: namn.trim(), datum, status: nyStatus, innehall });
      setVersion(sparad.version);
      setStatus(nyStatus);
      setAndrad(false);
      setInfo(
        nyStatus === "publicerad"
          ? "Sparat. Planen är publicerad och går ut till jaktlaget."
          : "Sparat som utkast. Bara ansvariga ser planen.",
      );
    } catch (e) {
      setFel(
        e instanceof ApiFel && e.status === 409
          ? "Någon annan har ändrat planen medan du arbetade. Ladda om sidan för att se den senaste versionen. Dina osparade ändringar går då förlorade."
          : felText(e),
      );
    } finally {
      setSparar(null);
    }
  };

  return (
    <View style={[styles.rot, { flexDirection: bred ? "row" : "column-reverse", backgroundColor: farger.surface100 }]}>
      <ScrollView
        style={[bred ? styles.panelBred : styles.panelSmal, { backgroundColor: farger.surface100, borderColor: farger.border }]}
        contentContainerStyle={styles.panelInnehall}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topprad}>
          <TillbakaKnapp
            onPress={() => {
              if (andrad && !window.confirm("Du har osparade ändringar. Vill du lämna planeraren utan att spara?")) return;
              router.replace(`/jaktlag/${lagId}/plan/${plan.id}`);
            }}
          />
          <View style={styles.flex1}>
            <Txt variant="heading">Planera jakten</Txt>
            <Txt variant="caption" farg="inkMuted">
              {data.lag.namn} · {status === "publicerad" ? "Publicerad" : status === "stangd" ? "Stängd" : "Utkast"}
              {andrad ? " · osparade ändringar" : ""}
            </Txt>
          </View>
        </View>

        {fel && <InlineBanner text={fel} />}
        {info && <InlineBanner text={info} typ="info" />}

        <View style={styles.knapprad}>
          <View style={styles.flex1}>
            <Knapp
              titel={status === "publicerad" ? "Spara" : "Spara utkast"}
              variant={status === "publicerad" ? "primar" : "sekundar"}
              disabled={!kanSpara || !andrad}
              laddar={sparar !== null && sparar === status}
              onPress={() => spara(status === "stangd" ? "stangd" : status)}
            />
          </View>
          {status !== "publicerad" && (
            <View style={styles.flex1}>
              <Knapp titel="Publicera" disabled={!kanSpara} laddar={sparar === "publicerad"} onPress={() => spara("publicerad")} />
            </View>
          )}
        </View>
        {status === "publicerad" && (
          <Txt variant="caption" farg="inkMuted">
            Planen är publicerad. Det du sparar går ut till jaktlaget direkt.
          </Txt>
        )}

        <Falt etikett="Namn" value={namn} onChangeText={(t) => (setNamn(t), setAndrad(true))} maxLength={80} />
        <View style={styles.tatt}>
          <Falt
            etikett="Datum"
            value={datum}
            onChangeText={(t) => (setDatum(t), setAndrad(true))}
            placeholder="ÅÅÅÅ-MM-DD"
            maxLength={10}
          />
          <Txt variant="caption" farg={giltigtDatum(datum) ? "inkMuted" : "signal"}>
            {giltigtDatum(datum) ? planDatum(datum) : "Skriv datumet som ÅÅÅÅ-MM-DD."}
          </Txt>
        </View>

        <View style={styles.sektion}>
          <Etikett>JAKTMARK</Etikett>
          <Txt variant="caption" farg="inkMuted">
            {innehall.jaktmark
              ? `${innehall.jaktmark.namn}: gräns och ${innehall.jaktmark.punkter.length} markeringar följer med planen.`
              : "Ingen jaktmark vald. Välj en för att få med gräns och pass, som alla i laget då ser."}
          </Txt>
          <View style={styles.chips}>
            {marker.map((m) => (
              <ValChip
                key={m.jaktmark.id}
                titel={m.jaktmark.namn}
                vald={innehall.jaktmark?.namn === m.jaktmark.namn}
                hojd={44}
                onPress={() => {
                  andra((i) => ({ ...i, jaktmark: tillPlanJaktmark(m) }));
                  harPassat.current = false;
                }}
              />
            ))}
            {innehall.jaktmark && (
              <ValChip titel="Ingen" vald={false} hojd={44} onPress={() => andra((i) => ({ ...i, jaktmark: null }))} />
            )}
          </View>
          {marker.length === 0 && !innehall.jaktmark && (
            <Txt variant="caption" farg="inkMuted">
              Inga jaktmarker finns importerade i den här webbläsaren. Importera GPX-filen under Jaktmarker.
            </Txt>
          )}
        </View>

        <View style={styles.sektion}>
          <Etikett>SAMLING</Etikett>
          <View style={styles.knapprad}>
            <Knapp
              titel={innehall.samling ? "Flytta samlingsplatsen" : "Sätt samlingsplats"}
              variant="sekundar"
              fullBredd={false}
              onPress={() => setLage(lage === "samling" ? "inget" : "samling")}
            />
            {innehall.samling && (
              <Knapp titel="Ta bort" variant="text" onPress={() => andra((i) => ({ ...i, samling: null }))} />
            )}
          </View>
          {innehall.samling && (
            <>
              <Falt
                etikett="Tid"
                value={innehall.samling.tid ?? ""}
                placeholder="07:30"
                maxLength={5}
                onChangeText={(t) => andra((i) => (i.samling ? { ...i, samling: { ...i.samling, tid: t } } : i))}
              />
              {!giltigTid(innehall.samling.tid ?? "") && (
                <Txt variant="caption" farg="signal">
                  Skriv tiden som TT:MM, t.ex. 07:30.
                </Txt>
              )}
              <Falt
                etikett="Plats i ord"
                value={innehall.samling.text ?? ""}
                placeholder="T.ex. vid ladan"
                maxLength={120}
                onChangeText={(t) => andra((i) => (i.samling ? { ...i, samling: { ...i.samling, text: t } } : i))}
              />
            </>
          )}
        </View>

        <View style={styles.sektion}>
          <Etikett>{`UPPDRAG (${innehall.uppdrag.length})`}</Etikett>
          {innehall.uppdrag.map((u) => {
            const vald = u.id === valtId;
            return (
              <View
                key={u.id}
                style={[
                  styles.uppdrag,
                  { backgroundColor: farger.surface200, borderColor: vald ? u.farg : farger.border, borderWidth: vald ? 2 : 1 },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: vald }}
                  onPress={() => {
                    setValtId(vald ? null : u.id);
                    setValdPunktId(null);
                    setLage("inget");
                  }}
                  style={styles.uppdragRubrik}
                >
                  <View style={[styles.prick, { backgroundColor: u.farg }]} />
                  <View style={styles.flex1}>
                    <Txt variant="bodyStrong">
                      {u.forare || "Ny hundförare"}
                      {u.hund ? ` – ${u.hund}` : ""}
                    </Txt>
                    <Txt variant="caption" farg="inkMuted">
                      {[
                        u.slapp ? (u.slappTid ? `Släpp ${u.slappTid}` : "Släpplats satt") : "Ingen släpplats",
                        u.rutt.length >= 2 ? `rutt ${formateraAvstand(ruttLangd(u.rutt))}` : "ingen rutt",
                      ].join(" · ")}
                    </Txt>
                  </View>
                </Pressable>

                {vald && (
                  <View style={styles.uppdragInnehall}>
                    <Txt variant="caption" farg="inkMuted">
                      Hundförare
                    </Txt>
                    <View style={styles.chips}>
                      {data.medlemmar.map((m) => (
                        <ValChip
                          key={m.userId}
                          titel={m.namn}
                          vald={u.userId === m.userId}
                          hojd={40}
                          onPress={() => andraUppdrag(u.id, (x) => ({ ...x, userId: m.userId, forare: m.namn }))}
                        />
                      ))}
                    </View>
                    <Falt
                      value={u.forare}
                      placeholder="Eller skriv ett namn"
                      maxLength={60}
                      accessibilityLabel="Hundförarens namn"
                      onChangeText={(t) =>
                        andraUppdrag(u.id, (x) => ({
                          ...x,
                          forare: t,
                          // Skriver man ett annat namn är uppdraget inte längre kopplat till medlemmen.
                          userId: data.medlemmar.find((m) => m.userId === x.userId)?.namn === t ? x.userId : null,
                        }))
                      }
                    />
                    <Falt
                      etikett="Hund"
                      value={u.hund}
                      maxLength={60}
                      onChangeText={(t) => andraUppdrag(u.id, (x) => ({ ...x, hund: t }))}
                    />
                    <Falt
                      etikett="Släpptid"
                      value={u.slappTid ?? ""}
                      placeholder="08:00"
                      maxLength={5}
                      onChangeText={(t) => andraUppdrag(u.id, (x) => ({ ...x, slappTid: t }))}
                    />
                    {!giltigTid(u.slappTid ?? "") && (
                      <Txt variant="caption" farg="signal">
                        Skriv tiden som TT:MM, t.ex. 08:00.
                      </Txt>
                    )}
                    <Falt
                      etikett="Anteckning"
                      value={u.anteckning ?? ""}
                      placeholder="T.ex. släpp mot vinden, håll dig väster om bäcken"
                      maxLength={300}
                      multiline
                      onChangeText={(t) => andraUppdrag(u.id, (x) => ({ ...x, anteckning: t }))}
                    />

                    <View style={styles.chips}>
                      {UPPDRAGSFARGER.map((farg) => (
                        <Pressable
                          key={farg}
                          accessibilityRole="button"
                          accessibilityLabel={`Färg ${farg}`}
                          accessibilityState={{ selected: u.farg === farg }}
                          onPress={() => andraUppdrag(u.id, (x) => ({ ...x, farg }))}
                          style={[styles.fargval, { backgroundColor: farg, borderColor: u.farg === farg ? farger.ink : "transparent" }]}
                        />
                      ))}
                    </View>

                    <View style={styles.knapprad}>
                      <Knapp
                        titel={u.slapp ? "Flytta släpplats" : "Sätt släpplats"}
                        variant={lage === "slapp" ? "primar" : "sekundar"}
                        fullBredd={false}
                        onPress={() => setLage(lage === "slapp" ? "inget" : "slapp")}
                      />
                      <Knapp
                        titel={lage === "rutt" ? "Klar med rutten" : u.rutt.length > 0 ? "Fortsätt rita rutt" : "Rita rutt"}
                        variant={lage === "rutt" ? "primar" : "sekundar"}
                        fullBredd={false}
                        onPress={() => setLage(lage === "rutt" ? "inget" : "rutt")}
                      />
                    </View>

                    {u.rutt.length > 0 && (
                      <View style={styles.tatt}>
                        <Txt variant="caption" farg="inkMuted">
                          Ruttens punkter. Dra dem på kartan för att flytta. Märk de som är extra viktiga att gå igenom.
                        </Txt>
                        {u.rutt.map((p, i) => {
                          const typ = i === 0 ? "A · Start" : i === u.rutt.length - 1 && u.rutt.length > 1 ? "B · Mål" : `${i + 1}`;
                          const markerad = valdPunktId === p.id;
                          return (
                            <View
                              key={p.id}
                              style={[
                                styles.punkt,
                                { borderColor: markerad ? u.farg : farger.border, backgroundColor: farger.surface100 },
                              ]}
                            >
                              <View style={styles.punktRad}>
                                <Pressable style={styles.flex1} onPress={() => setValdPunktId(markerad ? null : p.id)}>
                                  <Txt variant="bodyStrong">
                                    {typ}
                                    {p.viktig ? " · viktig" : ""}
                                  </Txt>
                                </Pressable>
                                <ValChip
                                  titel="Viktig"
                                  vald={!!p.viktig}
                                  hojd={36}
                                  onPress={() =>
                                    andraUppdrag(u.id, (x) => ({
                                      ...x,
                                      rutt: x.rutt.map((r) => (r.id === p.id ? { ...r, viktig: !r.viktig } : r)),
                                    }))
                                  }
                                />
                                <Knapp
                                  titel="Ta bort"
                                  variant="text"
                                  accessibilityLabel={`Ta bort punkt ${typ}`}
                                  onPress={() =>
                                    andraUppdrag(u.id, (x) => ({ ...x, rutt: x.rutt.filter((r) => r.id !== p.id) }))
                                  }
                                />
                              </View>
                              {(p.viktig || markerad || !!p.text) && (
                                <Falt
                                  value={p.text ?? ""}
                                  placeholder="T.ex. gå igenom granplanteringen"
                                  maxLength={80}
                                  accessibilityLabel={`Text för punkt ${typ}`}
                                  onChangeText={(t) =>
                                    andraUppdrag(u.id, (x) => ({
                                      ...x,
                                      rutt: x.rutt.map((r) => (r.id === p.id ? { ...r, text: t } : r)),
                                    }))
                                  }
                                />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    <View style={styles.knapprad}>
                      {u.rutt.length > 0 && (
                        <Knapp titel="Töm rutten" variant="text" onPress={() => andraUppdrag(u.id, (x) => ({ ...x, rutt: [] }))} />
                      )}
                      <Knapp
                        titel="Ta bort uppdraget"
                        variant="faraLiten"
                        onPress={() => {
                          andra((i) => ({ ...i, uppdrag: i.uppdrag.filter((x) => x.id !== u.id) }));
                          setValtId(null);
                          setLage("inget");
                        }}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          <Knapp titel="Lägg till uppdrag" ikon="plus" variant="sekundar" onPress={nyttUppdrag} />
        </View>

        <Falt
          etikett="Meddelande till jaktlaget"
          value={innehall.anteckning ?? ""}
          placeholder="T.ex. samling vid ladan, kanal 3 på radion"
          maxLength={600}
          multiline
          onChangeText={(t) => andra((i) => ({ ...i, anteckning: t }))}
        />
        <Txt variant="caption" farg="inkMuted">
          Symboler på kartan: S = släpplats, A = start, B = mål, ! = viktig punkt, ⚑ = samling. De andras uppdrag
          visas som små märkta släpplatser.
        </Txt>
      </ScrollView>

      <View style={styles.kartyta}>
        <div ref={behallare} className="skade-karta" style={kartStil} />
        {lage !== "inget" && (
          <View style={[styles.hjalp, { backgroundColor: farger.brand }]}>
            <Txt style={[styles.flex1, { color: farger.onBrand }]}>{LAGESTEXT[lage]}</Txt>
            <Knapp titel={lage === "rutt" ? "Klar" : "Avbryt"} variant="sekundar" fullBredd={false} kompakt onPress={() => setLage("inget")} />
          </View>
        )}
        <View style={styles.kartknappar}>
          <Knapp
            titel={kartval === "karta" ? "Terräng" : "Karta"}
            variant="sekundar"
            fullBredd={false}
            kompakt
            onPress={() => setKartval(kartval === "karta" ? "terrang" : "karta")}
          />
          <Knapp
            titel={visaAlla ? "Dölj andras rutter" : "Visa allas rutter"}
            variant="sekundar"
            fullBredd={false}
            kompakt
            onPress={() => setVisaAlla(!visaAlla)}
          />
          <Knapp titel="Visa hela planen" variant="sekundar" fullBredd={false} kompakt onPress={visaAllt} />
        </View>
        {!valt && innehall.uppdrag.length > 0 && lage === "inget" && (
          <View style={[styles.tips, { backgroundColor: farger.surface200, borderColor: farger.border }]}>
            <Txt variant="caption">Välj ett uppdrag i listan, eller klicka på en släpplats, för att rita dess rutt.</Txt>
          </View>
        )}
      </View>
    </View>
  );
}

const kartStil = { position: "absolute", inset: 0, zIndex: 0 } as const;

const styles = StyleSheet.create({
  rot: { flex: 1 },
  flex1: { flex: 1 },
  panelBred: { width: 400, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  panelSmal: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth },
  panelInnehall: { padding: avstand.s4, gap: avstand.s4, paddingBottom: avstand.s7 },
  topprad: { flexDirection: "row", alignItems: "center", gap: avstand.s3 },
  knapprad: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: avstand.s2 },
  sektion: { gap: avstand.s2 },
  tatt: { gap: avstand.s2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  uppdrag: { borderRadius: radie.md, overflow: "hidden" },
  uppdragRubrik: { flexDirection: "row", alignItems: "center", gap: avstand.s3, padding: avstand.s3 },
  uppdragInnehall: { padding: avstand.s3, paddingTop: 0, gap: avstand.s3 },
  prick: { width: 18, height: 18, borderRadius: 9 },
  fargval: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  punkt: { borderWidth: 1, borderRadius: radie.sm, padding: avstand.s2, gap: avstand.s2 },
  punktRad: { flexDirection: "row", alignItems: "center", gap: avstand.s2 },
  kartyta: { flex: 1, minHeight: 320 },
  hjalp: {
    position: "absolute",
    top: avstand.s3,
    left: avstand.s3,
    right: avstand.s3,
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s3,
    borderRadius: radie.md,
    paddingHorizontal: avstand.s4,
    paddingVertical: avstand.s2,
  },
  kartknappar: {
    position: "absolute",
    right: avstand.s3,
    bottom: avstand.s5,
    zIndex: 1,
    alignItems: "flex-end",
    gap: avstand.s2,
  },
  tips: {
    position: "absolute",
    left: avstand.s3,
    top: avstand.s3,
    zIndex: 1,
    maxWidth: 320,
    borderRadius: radie.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: avstand.s3,
    paddingVertical: avstand.s2,
  },
});
