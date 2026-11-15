import { useEffect, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaHundarForProfil } from "@/db/queries/hund";
import { useProfil } from "@/contexts/ProfilContext";
import { avslutaEftersok, felText, lamnaEftersok, taEftersok, useLagData, useSynk } from "@/jaktlag/lager";
import { dagOchTid, eftersokLage } from "@/jaktlag/format";
import { hamtaPosition } from "@/jaktlag/position";
import { avstandMeter, formateraAvstand, RESULTAT_NAMN, riktningGrader, vaderstreck } from "@/jaktlag/typer";
import type { EftersokResultat, Punkt } from "@/jaktlag/typer";
import { avstand } from "@/theme/tokens";
import { formateraKoordinat } from "@/utils/koordinat";
import { KraverKonto } from "@/components/jaktlag/KraverKonto";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Etikett, Falt, Rubrikrad, Skarm, TillbakaKnapp, ValChip } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Ett eftersök (2026-11-15): var, vad, vem som tagit det och hur det gick.
 *
 * - "Jag tar det" med vald hund. Servern avgör om två trycker samtidigt;
 *   den som kom sist får veta vem som tog det.
 * - Den som tagit det kan lämna tillbaka det eller avsluta med Hittat,
 *   Inte hittat eller Avbrutet. Även den som markerade det och ansvariga
 *   kan avsluta.
 * - Uppdateras var 8:e sekund medan skärmen visas.
 */
export default function EftersokSida() {
  return <KraverKonto titel="Eftersök">{(jag) => <Innehall jag={jag} />}</KraverKonto>;
}

const RESULTAT: EftersokResultat[] = ["hittat", "inte_hittat", "avbrutet"];

function Innehall({ jag }: { jag: { id: string; namn: string } }) {
  const { lagId, eftersokId } = useLocalSearchParams<{ lagId: string; eftersokId: string }>();
  const { profil } = useProfil();
  const data = useLagData(lagId);
  const e = data?.eftersok.find((x) => x.id === eftersokId);
  const [hundar, setHundar] = useState<string[]>([]);
  const [hund, setHund] = useState("");
  const [lage, setLage] = useState<"visa" | "ta" | "avsluta">("visa");
  const [resultat, setResultat] = useState<EftersokResultat | null>(null);
  const [text, setText] = useState("");
  const [fel, setFel] = useState<string | null>(null);
  const [arbetar, setArbetar] = useState(false);
  const [jagAr, setJagAr] = useState<Punkt | null>(null);
  useSynk(lagId, 8000, () => router.replace("/jaktlag"));

  useEffect(() => {
    (async () => {
      const db = await getDatabase();
      const lista = await hamtaHundarForProfil(db, profil.id);
      setHundar(lista.map((h) => h.namn));
      if (lista.length === 1) setHund(lista[0].namn);
    })().catch(() => {});
    hamtaPosition().then(setJagAr);
  }, [profil.id]);

  if (!e) {
    return (
      <Skarm>
        <TillbakaKnapp />
        <Rubrikrad titel="Eftersök" />
        <Kort>
          <Txt farg="inkMuted">{data ? "Eftersöket finns inte längre." : "Hämtar…"}</Txt>
        </Kort>
      </Skarm>
    );
  }

  const kor = async (jobb: () => Promise<unknown>) => {
    if (arbetar) return;
    setArbetar(true);
    setFel(null);
    try {
      await jobb();
      setLage("visa");
    } catch (err) {
      setFel(felText(err));
      setLage("visa");
    } finally {
      setArbetar(false);
    }
  };

  const mitt = e.tagetAv === jag.id;
  const farAvsluta =
    e.status !== "avslutat" && !e.vantar && (mitt || e.skapadAv === jag.id || data?.lag.minRoll === "ansvarig");
  const mal: Punkt = { lat: e.lat, lon: e.lon };

  return (
    <Skarm>
      <TillbakaKnapp />
      <Rubrikrad titel={e.viltart ? `Eftersök: ${e.viltart.toLowerCase()}` : "Eftersök"} undertitel={eftersokLage(e)} />
      {fel && <InlineBanner text={fel} />}
      {e.vantar && (
        <InlineBanner
          typ="info"
          text="Eftersöket är sparat i telefonen men har inte nått de andra än. Det skickas när täckningen är tillbaka. Säg till på radion så länge."
        />
      )}

      <Kort style={styles.kort}>
        <Txt variant="caption" farg="inkMuted">
          Markerat {dagOchTid(e.skapad)} av {e.skapadNamn ?? "borttagen användare"}
        </Txt>
        {!!e.text && <Txt>{e.text}</Txt>}
        <Txt variant="bodyStrong" selectable>
          {formateraKoordinat(e.lat, "lat")} {formateraKoordinat(e.lon, "lon")}
        </Txt>
        {jagAr && (
          <Txt farg="inkMuted">
            {formateraAvstand(avstandMeter(jagAr, mal))} {vaderstreck(riktningGrader(jagAr, mal))} om dig
          </Txt>
        )}
        <View style={styles.rad}>
          <Knapp
            titel="Visa på kartan"
            variant="sekundar"
            fullBredd={false}
            onPress={() =>
              router.push(
                `/karta?punkt=${e.lat},${e.lon}&punktNamn=${encodeURIComponent(e.viltart ? `Eftersök ${e.viltart.toLowerCase()}` : "Eftersök")}`,
              )
            }
          />
          <Knapp
            titel="Vägbeskrivning"
            variant="sekundar"
            fullBredd={false}
            onPress={() => void Linking.openURL(`https://maps.apple.com/?daddr=${e.lat},${e.lon}`)}
          />
        </View>
      </Kort>

      {e.status === "taget" && (
        <Kort style={styles.kort}>
          <Etikett farg="brand">TAGET</Etikett>
          <Txt variant="heading">
            {mitt ? "Du har tagit det" : (e.tagetNamn ?? "Borttagen användare")}
            {e.tagetHund ? ` med ${e.tagetHund}` : ""}
          </Txt>
          {e.tagetTid && (
            <Txt variant="caption" farg="inkMuted">
              Sedan {dagOchTid(e.tagetTid)}
            </Txt>
          )}
        </Kort>
      )}

      {e.status === "avslutat" && (
        <Kort style={styles.kort}>
          <Etikett>AVSLUTAT</Etikett>
          <Txt variant="heading">{e.resultat ? RESULTAT_NAMN[e.resultat] : "Avslutat"}</Txt>
          {!!e.avslutText && <Txt>{e.avslutText}</Txt>}
          <Txt variant="caption" farg="inkMuted">
            {e.avslutad ? dagOchTid(e.avslutad) : ""}
            {e.tagetNamn ? ` · ${e.tagetNamn}${e.tagetHund ? ` med ${e.tagetHund}` : ""}` : ""}
          </Txt>
        </Kort>
      )}

      {lage === "ta" && (
        <Kort style={styles.kort}>
          <Txt variant="heading">Vilken hund tar du?</Txt>
          {hundar.length > 0 && (
            <View style={styles.chips}>
              {hundar.map((h) => (
                <ValChip key={h} titel={h} vald={hund === h} onPress={() => setHund(h)} hojd={48} />
              ))}
            </View>
          )}
          <Falt value={hund} onChangeText={setHund} placeholder="Hundens namn" maxLength={60} accessibilityLabel="Hundens namn" />
          <Knapp titel="Jag tar det" laddar={arbetar} onPress={() => kor(() => taEftersok(e.id, hund.trim()))} />
          <Knapp titel="Avbryt" variant="sekundar" onPress={() => setLage("visa")} />
        </Kort>
      )}

      {lage === "avsluta" && (
        <Kort style={styles.kort}>
          <Txt variant="heading">Hur gick det?</Txt>
          <View style={styles.chips}>
            {RESULTAT.map((r) => (
              <ValChip key={r} titel={RESULTAT_NAMN[r]} vald={resultat === r} onPress={() => setResultat(r)} hojd={48} />
            ))}
          </View>
          <Falt
            value={text}
            onChangeText={setText}
            placeholder="T.ex. låg 300 m från skottplatsen"
            maxLength={400}
            accessibilityLabel="Kommentar"
          />
          <Knapp
            titel="Avsluta eftersöket"
            disabled={!resultat}
            laddar={arbetar}
            onPress={() => resultat && kor(() => avslutaEftersok(e.id, resultat, text.trim()))}
          />
          <Knapp titel="Avbryt" variant="sekundar" onPress={() => setLage("visa")} />
        </Kort>
      )}

      {lage === "visa" && (
        <View style={styles.knappar}>
          {e.status === "oppet" && !e.vantar && <Knapp titel="Jag tar det" onPress={() => setLage("ta")} />}
          {farAvsluta && (
            <Knapp titel="Avsluta eftersöket" variant={mitt ? "primar" : "sekundar"} onPress={() => setLage("avsluta")} />
          )}
          {e.status === "taget" && (mitt || data?.lag.minRoll === "ansvarig") && (
            <Knapp
              titel={mitt ? "Lämna tillbaka" : "Gör eftersöket öppet igen"}
              variant="sekundar"
              laddar={arbetar}
              onPress={() => kor(() => lamnaEftersok(e.id))}
            />
          )}
        </View>
      )}
    </Skarm>
  );
}

const styles = StyleSheet.create({
  kort: { gap: avstand.s2 },
  rad: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2, marginTop: avstand.s2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  knappar: { gap: avstand.s3 },
});
