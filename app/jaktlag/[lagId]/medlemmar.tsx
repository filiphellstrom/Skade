import { useState } from "react";
import { Platform, Share, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { andraRoll, bytKod, bytLagNamn, felText, raderaLag, taBortMedlem, useLagData, useSynk } from "@/jaktlag/lager";
import { visaKod } from "@/jaktlag/format";
import type { Medlem } from "@/jaktlag/typer";
import { avstand } from "@/theme/tokens";
import { KraverKonto } from "@/components/jaktlag/KraverKonto";
import { QrKod } from "@/components/jaktlag/QrKod";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Etikett, Falt, Rubrikrad, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Medlemmar och inbjudan (2026-11-15).
 *
 * Alla ser vilka som är med. Ansvariga ser inbjudningskoden (som text och
 * QR), kan byta den, döpa om laget, göra andra till ansvariga och ta bort
 * medlemmar. QR-koden innehåller länken skade://jaktlag?kod=…, som öppnar
 * appen med koden ifylld när man riktar kameran mot den.
 */
export default function Medlemmar() {
  return <KraverKonto titel="Medlemmar">{(jag) => <Innehall jag={jag} />}</KraverKonto>;
}

function Innehall({ jag }: { jag: { id: string; namn: string } }) {
  const { lagId } = useLocalSearchParams<{ lagId: string }>();
  const data = useLagData(lagId);
  const [fel, setFel] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [vald, setVald] = useState<Medlem | null>(null);
  const [bekrafta, setBekrafta] = useState<"lamna" | "radera" | "ta-bort" | "kod" | null>(null);
  const [nyttNamn, setNyttNamn] = useState<string | null>(null);
  const [arbetar, setArbetar] = useState(false);
  useSynk(lagId, 20000, () => router.replace("/jaktlag"));

  if (!data) {
    return (
      <Skarm>
        <TillbakaKnapp />
        <Rubrikrad titel="Medlemmar" />
      </Skarm>
    );
  }
  const ansvarig = data.lag.minRoll === "ansvarig";
  const kod = data.lag.kod;
  const lank = kod ? `skade://jaktlag?kod=${kod}` : "";

  const kor = async (jobb: () => Promise<void>, efter?: () => void) => {
    if (arbetar) return;
    setArbetar(true);
    setFel(null);
    setInfo(null);
    try {
      await jobb();
      efter?.();
    } catch (e) {
      setFel(felText(e));
    } finally {
      setArbetar(false);
      setBekrafta(null);
    }
  };

  const dela = async () => {
    const text = `Gå med i jaktlaget ${data.lag.namn} i Skade. Öppna Jaktlag i appen och skriv koden ${visaKod(kod ?? "")}, eller öppna länken: ${lank}`;
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(text);
        setInfo("Inbjudan är kopierad. Klistra in den i ett meddelande.");
      } catch {
        setInfo(`Koden är ${visaKod(kod ?? "")}.`);
      }
      return;
    }
    await Share.share({ message: text }).catch(() => {});
  };

  return (
    <Skarm>
      <TillbakaKnapp />
      <Rubrikrad titel="Medlemmar" undertitel={data.lag.namn} />
      {fel && <InlineBanner text={fel} />}
      {info && <InlineBanner text={info} typ="info" />}

      {ansvarig && kod && (
        <View style={styles.block}>
          <Etikett>BJUD IN</Etikett>
          <Kort style={styles.inbjudan}>
            <Txt variant="title1" selectable style={styles.kod}>
              {visaKod(kod)}
            </Txt>
            <Txt variant="caption" farg="inkMuted" style={styles.mitt}>
              Den som ska gå med öppnar Jaktlag i Skade och skriver koden, eller riktar kameran mot QR-koden.
            </Txt>
            <QrKod text={lank} />
            <Knapp titel="Dela inbjudan" ikon="dela" onPress={dela} />
            {bekrafta === "kod" ? (
              <>
                <InlineBanner text="Den gamla koden slutar gälla direkt. De som redan är med påverkas inte." typ="info" />
                <Knapp titel="Ja, byt kod" variant="sekundar" onPress={() => kor(() => bytKod(lagId))} laddar={arbetar} />
                <Knapp titel="Avbryt" variant="text" onPress={() => setBekrafta(null)} />
              </>
            ) : (
              <Knapp titel="Byt kod" variant="text" onPress={() => setBekrafta("kod")} />
            )}
          </Kort>
        </View>
      )}

      <View style={styles.block}>
        <Etikett>{`MEDLEMMAR (${data.medlemmar.length})`}</Etikett>
        <Kort lista>
          {data.medlemmar.map((m, i) => (
            <Listrad
              key={m.userId}
              forsta={i === 0}
              avatar={{ bild: null, namn: m.namn }}
              titel={m.userId === jag.id ? `${m.namn} (du)` : m.namn}
              undertitel={m.roll === "ansvarig" ? "Ansvarig" : "Hundförare"}
              onPress={ansvarig && m.userId !== jag.id ? () => setVald(vald?.userId === m.userId ? null : m) : undefined}
            />
          ))}
        </Kort>
        {ansvarig && !vald && data.medlemmar.length > 1 && (
          <Txt variant="caption" farg="inkMuted">
            Tryck på en medlem för att ändra roll eller ta bort.
          </Txt>
        )}
        {vald && (
          <Kort style={styles.kort}>
            <Txt variant="heading">{vald.namn}</Txt>
            {bekrafta === "ta-bort" ? (
              <>
                <InlineBanner text={`${vald.namn} tas bort ur jaktlaget och ser inte längre planer, eftersök eller chatt.`} />
                <Knapp
                  titel="Ja, ta bort"
                  variant="fara"
                  laddar={arbetar}
                  onPress={() => kor(() => taBortMedlem(lagId, vald.userId, false), () => setVald(null))}
                />
                <Knapp titel="Avbryt" variant="sekundar" onPress={() => setBekrafta(null)} />
              </>
            ) : (
              <>
                <Knapp
                  titel={vald.roll === "ansvarig" ? "Gör till hundförare" : "Gör till ansvarig"}
                  variant="sekundar"
                  laddar={arbetar}
                  onPress={() =>
                    kor(
                      () => andraRoll(lagId, vald.userId, vald.roll === "ansvarig" ? "hundforare" : "ansvarig"),
                      () => setVald(null),
                    )
                  }
                />
                <Knapp titel="Ta bort ur jaktlaget" variant="faraLiten" onPress={() => setBekrafta("ta-bort")} />
              </>
            )}
          </Kort>
        )}
      </View>

      {ansvarig && (
        <View style={styles.block}>
          <Etikett>JAKTLAGETS NAMN</Etikett>
          <Kort style={styles.kort}>
            <Falt value={nyttNamn ?? data.lag.namn} onChangeText={setNyttNamn} maxLength={60} accessibilityLabel="Jaktlagets namn" />
            <Knapp
              titel="Spara namn"
              variant="sekundar"
              disabled={nyttNamn === null || nyttNamn.trim() === "" || nyttNamn.trim() === data.lag.namn}
              laddar={arbetar && bekrafta === null}
              onPress={() => kor(() => bytLagNamn(lagId, (nyttNamn ?? "").trim()), () => setNyttNamn(null))}
            />
          </Kort>
        </View>
      )}

      <View style={styles.block}>
        {bekrafta === "lamna" ? (
          <>
            <InlineBanner
              text={
                data.medlemmar.length === 1
                  ? "Du är ensam i jaktlaget. Lämnar du tas laget bort med planer, eftersök och chatt. Det går inte att ångra."
                  : "Du ser inte längre jaktlagets planer, eftersök eller chatt. Du kan gå med igen med en ny inbjudan."
              }
            />
            <Knapp
              titel="Ja, lämna jaktlaget"
              variant="fara"
              laddar={arbetar}
              onPress={() => kor(() => taBortMedlem(lagId, jag.id, true), () => router.replace("/jaktlag"))}
            />
            <Knapp titel="Avbryt" variant="sekundar" onPress={() => setBekrafta(null)} />
          </>
        ) : bekrafta === "radera" ? (
          <>
            <InlineBanner text="Jaktlaget tas bort för alla, med planer, eftersök och chatt. Det går inte att ångra." />
            <Knapp
              titel="Ja, radera jaktlaget"
              variant="fara"
              laddar={arbetar}
              onPress={() => kor(() => raderaLag(lagId), () => router.replace("/jaktlag"))}
            />
            <Knapp titel="Avbryt" variant="sekundar" onPress={() => setBekrafta(null)} />
          </>
        ) : (
          <View style={styles.farligt}>
            <Knapp titel="Lämna jaktlaget" variant="faraLiten" onPress={() => setBekrafta("lamna")} />
            {ansvarig && <Knapp titel="Radera jaktlaget" variant="faraLiten" onPress={() => setBekrafta("radera")} />}
          </View>
        )}
      </View>
    </Skarm>
  );
}

const styles = StyleSheet.create({
  block: { gap: avstand.s3 },
  kort: { gap: avstand.s3 },
  inbjudan: { gap: avstand.s3, alignItems: "center" },
  kod: { letterSpacing: 2, fontVariant: ["tabular-nums"] },
  mitt: { textAlign: "center" },
  farligt: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s3 },
});
