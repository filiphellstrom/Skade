import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { felText, raderaPlan, sparaPlan, useLagData, useSynk, valjAktivPlan } from "@/jaktlag/lager";
import { dagOchTid, planDatum } from "@/jaktlag/format";
import { hamtaPosition } from "@/jaktlag/position";
import { avstandMeter, formateraAvstand, mittUppdrag, riktningGrader, ruttLangd, vaderstreck } from "@/jaktlag/typer";
import type { PlanStatus, Punkt, Uppdrag } from "@/jaktlag/typer";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie, tryck } from "@/theme/tokens";
import { lasSakert, sparaSakert } from "@/utils/lagring";
import { KraverKonto } from "@/components/jaktlag/KraverKonto";
import { InlineBanner } from "@/components/InlineBanner";
import { Ikon } from "@/components/ui/Ikon";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Etikett, Rubrikrad, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * En jaktplan (2026-11-15), som hundföraren ser den.
 *
 * Överst det egna uppdraget: hund, släpptid, släpplats med avstånd och
 * vägbeskrivning, ruttens längd och de viktiga punkterna, som bockas av
 * efter hand (sparas i telefonen). Under det samlingen och allas uppdrag.
 * "Visa på kartan" lägger planen på Karta-fliken. Allt ligger sparat i
 * telefonen och fungerar utan täckning.
 *
 * Ansvariga publicerar, drar tillbaka, stänger och raderar planen här.
 * Uppdrag och rutter ritas på kartan på webben.
 */
export default function PlanSida() {
  return <KraverKonto titel="Jaktplan">{(jag) => <Innehall jag={jag} />}</KraverKonto>;
}

function Innehall({ jag }: { jag: { id: string; namn: string } }) {
  const { lagId, planId } = useLocalSearchParams<{ lagId: string; planId: string }>();
  const { farger } = useTema();
  const data = useLagData(lagId);
  const plan = data?.planer.find((p) => p.id === planId);
  const [avbockade, setAvbockade] = useState<string[]>([]);
  const [jagAr, setJagAr] = useState<Punkt | null>(null);
  const [fel, setFel] = useState<string | null>(null);
  const [arbetar, setArbetar] = useState<string | null>(null);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
  useSynk(lagId, 15000, () => router.replace("/jaktlag"));

  const nyckel = `jaktlag:avbockat:${planId}`;
  useEffect(() => {
    lasSakert(nyckel).then((t) => {
      try {
        setAvbockade(t ? (JSON.parse(t) as string[]) : []);
      } catch {
        setAvbockade([]);
      }
    });
    hamtaPosition().then(setJagAr);
  }, [nyckel]);

  if (!plan || !data) {
    return (
      <Skarm>
        <TillbakaKnapp />
        <Rubrikrad titel="Jaktplan" />
        <Kort>
          <Txt farg="inkMuted">{data ? "Planen finns inte längre, eller så har den dragits tillbaka." : "Hämtar…"}</Txt>
        </Kort>
      </Skarm>
    );
  }

  const ansvarig = data.lag.minRoll === "ansvarig";
  const mitt = mittUppdrag(plan, jag.id, jag.namn);
  const ovriga = plan.innehall.uppdrag.filter((u) => u.id !== mitt?.id);
  const samling = plan.innehall.samling;

  const bocka = (id: string) => {
    const ny = avbockade.includes(id) ? avbockade.filter((x) => x !== id) : [...avbockade, id];
    setAvbockade(ny);
    sparaSakert(nyckel, JSON.stringify(ny));
  };

  const bytStatus = async (status: PlanStatus) => {
    if (arbetar) return;
    setArbetar(status);
    setFel(null);
    try {
      await sparaPlan(lagId, plan, { namn: plan.namn, datum: plan.datum, status, innehall: plan.innehall });
    } catch (e) {
      setFel(felText(e));
    } finally {
      setArbetar(null);
    }
  };

  const radera = async () => {
    setArbetar("radera");
    try {
      await raderaPlan(lagId, plan.id);
      router.replace(`/jaktlag/${lagId}`);
    } catch (e) {
      setFel(felText(e));
      setArbetar(null);
      setBekraftaRadera(false);
    }
  };

  const visaPaKartan = () => {
    valjAktivPlan({ lagId, planId: plan.id });
    router.push("/karta?plan=1");
  };

  const vagTill = (p: Punkt) => void Linking.openURL(`https://maps.apple.com/?daddr=${p.lat},${p.lon}`);
  const avstandTill = (p: Punkt) =>
    jagAr ? `${formateraAvstand(avstandMeter(jagAr, p))} ${vaderstreck(riktningGrader(jagAr, p))} om dig` : null;

  return (
    <Skarm>
      <TillbakaKnapp />
      <Rubrikrad titel={plan.namn} undertitel={`${planDatum(plan.datum)} · ${data.lag.namn}`} />
      {fel && <InlineBanner text={fel} />}
      {plan.status === "utkast" && (
        <InlineBanner typ="info" text="Utkast. Planen syns bara för ansvariga tills den publiceras." />
      )}
      {plan.status === "stangd" && <InlineBanner typ="info" text="Planen är stängd. Jakten är över." />}
      <Txt variant="caption" farg="inkMuted">
        Senast ändrad {dagOchTid(plan.uppdaterad)}
      </Txt>

      <Knapp titel="Visa på kartan" ikon="karta" onPress={visaPaKartan} />

      {mitt ? (
        <View style={styles.block}>
          <Etikett farg="brand">MITT UPPDRAG</Etikett>
          <Kort variant="pagaende" style={styles.kort}>
            <View style={styles.rubrikRad}>
              <View style={[styles.prick, { backgroundColor: mitt.farg }]} />
              <Txt variant="title2" style={styles.flex1}>
                {mitt.hund ? `Släpp ${mitt.hund}` : "Släpp"}
                {mitt.slappTid ? ` kl ${mitt.slappTid}` : ""}
              </Txt>
            </View>
            {!!mitt.anteckning && <Txt>{mitt.anteckning}</Txt>}
            {mitt.slapp ? (
              <>
                {avstandTill(mitt.slapp) && <Txt farg="inkMuted">Släpplatsen ligger {avstandTill(mitt.slapp)}</Txt>}
                <Knapp titel="Vägbeskrivning till släpplatsen" variant="sekundar" onPress={() => vagTill(mitt.slapp as Punkt)} />
              </>
            ) : (
              <Txt farg="inkMuted">Ingen släpplats är utsatt än.</Txt>
            )}
            {mitt.rutt.length >= 2 && (
              <Txt farg="inkMuted">
                Rutt: {formateraAvstand(ruttLangd(mitt.rutt))}, {mitt.rutt.length} punkter
              </Txt>
            )}
          </Kort>
          <ViktigaPunkter uppdrag={mitt} avbockade={avbockade} onBocka={bocka} />
          <Knapp
            titel="Starta jaktdag"
            variant="sekundar"
            onPress={() =>
              router.push(
                plan.innehall.jaktmark?.namn
                  ? `/jaktdag/ny?jaktmark=${encodeURIComponent(plan.innehall.jaktmark.namn)}`
                  : "/jaktdag/ny",
              )
            }
          />
        </View>
      ) : (
        plan.innehall.uppdrag.length > 0 && (
          <Kort>
            <Txt farg="inkMuted">
              Du har inget eget uppdrag i den här planen. Säg till den ansvariga om det är fel – uppdraget ska stå på
              ditt namn ({jag.namn}).
            </Txt>
          </Kort>
        )
      )}

      {samling && (
        <View style={styles.block}>
          <Etikett>SAMLING</Etikett>
          <Kort style={styles.kort}>
            <Txt variant="heading">{samling.tid ? `Kl ${samling.tid}` : "Samlingsplats"}</Txt>
            {!!samling.text && <Txt>{samling.text}</Txt>}
            {avstandTill(samling) && <Txt farg="inkMuted">{avstandTill(samling)}</Txt>}
            <Knapp titel="Vägbeskrivning till samlingen" variant="sekundar" onPress={() => vagTill(samling)} />
          </Kort>
        </View>
      )}

      {!!plan.innehall.anteckning && (
        <View style={styles.block}>
          <Etikett>FRÅN DEN ANSVARIGA</Etikett>
          <Kort>
            <Txt>{plan.innehall.anteckning}</Txt>
          </Kort>
        </View>
      )}

      {ovriga.length > 0 && (
        <View style={styles.block}>
          <Etikett>{mitt ? "DE ANDRAS UPPDRAG" : "UPPDRAG"}</Etikett>
          <Kort style={styles.lista}>
            {ovriga.map((u, i) => (
              <View key={u.id} style={[styles.uppdragRad, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farger.border }]}>
                <View style={[styles.prick, { backgroundColor: u.farg }]} />
                <View style={styles.flex1}>
                  <Txt variant="bodyStrong">
                    {u.forare || "Hundförare"}
                    {u.hund ? ` – ${u.hund}` : ""}
                  </Txt>
                  <Txt variant="caption" farg="inkMuted">
                    {[
                      u.slappTid ? `Släpper ${u.slappTid}` : null,
                      u.slapp ? null : "Ingen släpplats än",
                      u.rutt.length >= 2 ? `Rutt ${formateraAvstand(ruttLangd(u.rutt))}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Släpplats utsatt"}
                  </Txt>
                  {!!u.anteckning && (
                    <Txt variant="caption" farg="inkMuted">
                      {u.anteckning}
                    </Txt>
                  )}
                </View>
              </View>
            ))}
          </Kort>
        </View>
      )}

      {plan.innehall.uppdrag.length === 0 && (
        <Kort>
          <Txt farg="inkMuted">
            Planen har inga uppdrag än.
            {ansvarig ? " Öppna planen på webben och rita ut släpplatser och rutter." : ""}
          </Txt>
        </Kort>
      )}

      {ansvarig && (
        <View style={styles.block}>
          <Etikett>FÖR ANSVARIGA</Etikett>
          {Platform.OS === "web" ? (
            <Knapp
              titel="Redigera på kartan"
              variant="sekundar"
              onPress={() => router.push(`/jaktlag/${lagId}/plan/${plan.id}/redigera`)}
            />
          ) : (
            <Txt variant="caption" farg="inkMuted">
              Släpplatser och rutter ritas på skade.hellstrom.fyi, helst på en dator.
            </Txt>
          )}
          {plan.status === "utkast" && (
            <Knapp titel="Publicera för jaktlaget" laddar={arbetar === "publicerad"} onPress={() => bytStatus("publicerad")} />
          )}
          {plan.status === "publicerad" && (
            <>
              <Knapp titel="Stäng planen (jakten är över)" variant="sekundar" laddar={arbetar === "stangd"} onPress={() => bytStatus("stangd")} />
              <Knapp titel="Dra tillbaka till utkast" variant="sekundar" laddar={arbetar === "utkast"} onPress={() => bytStatus("utkast")} />
            </>
          )}
          {plan.status === "stangd" && (
            <Knapp titel="Öppna planen igen" variant="sekundar" laddar={arbetar === "publicerad"} onPress={() => bytStatus("publicerad")} />
          )}
          {bekraftaRadera ? (
            <>
              <InlineBanner text="Planen tas bort för hela jaktlaget. Det går inte att ångra." />
              <Knapp titel="Ja, radera planen" variant="fara" laddar={arbetar === "radera"} onPress={radera} />
              <Knapp titel="Avbryt" variant="sekundar" onPress={() => setBekraftaRadera(false)} />
            </>
          ) : (
            <Knapp titel="Radera plan" variant="faraLiten" onPress={() => setBekraftaRadera(true)} />
          )}
        </View>
      )}
    </Skarm>
  );
}

/** De viktiga punkterna på rutten, i ordning, att bocka av efter hand. */
function ViktigaPunkter({
  uppdrag,
  avbockade,
  onBocka,
}: {
  uppdrag: Uppdrag;
  avbockade: string[];
  onBocka: (id: string) => void;
}) {
  const { farger } = useTema();
  const viktiga = uppdrag.rutt.filter((p) => p.viktig);
  if (viktiga.length === 0) return null;
  return (
    <View style={styles.block}>
      <Etikett>VIKTIGA PUNKTER PÅ RUTTEN</Etikett>
      <Kort style={styles.lista}>
        {viktiga.map((p, i) => {
          const klar = avbockade.includes(p.id);
          return (
            <Pressable
              key={p.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: klar }}
              onPress={() => onBocka(p.id)}
              style={[styles.bockRad, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farger.border }]}
            >
              <View
                style={[
                  styles.ruta,
                  { borderColor: klar ? farger.brand : farger.borderStrong, backgroundColor: klar ? farger.brand : "transparent" },
                ]}
              >
                {klar && <Ikon namn="bock" farg={farger.onBrand} storlek={18} />}
              </View>
              <Txt style={styles.flex1} farg={klar ? "inkMuted" : "ink"}>
                {p.text || `Viktig punkt ${i + 1}`}
              </Txt>
            </Pressable>
          );
        })}
      </Kort>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: avstand.s3 },
  kort: { gap: avstand.s3 },
  lista: { paddingVertical: 0 },
  flex1: { flex: 1 },
  rubrikRad: { flexDirection: "row", alignItems: "center", gap: avstand.s3 },
  prick: { width: 16, height: 16, borderRadius: 8 },
  uppdragRad: { flexDirection: "row", alignItems: "center", gap: avstand.s3, paddingVertical: avstand.s3 },
  bockRad: { flexDirection: "row", alignItems: "center", gap: avstand.s3, minHeight: tryck.min, paddingVertical: avstand.s2 },
  ruta: { width: 28, height: 28, borderRadius: radie.sm, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
