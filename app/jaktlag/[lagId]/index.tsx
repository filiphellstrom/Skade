import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useLagData, useSynk } from "@/jaktlag/lager";
import { dagOchTid, eftersokLage, planDatum } from "@/jaktlag/format";
import { mittUppdrag } from "@/jaktlag/typer";
import { avstand } from "@/theme/tokens";
import { KraverKonto } from "@/components/jaktlag/KraverKonto";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Etikett, Rubrikrad, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Ett jaktlag (2026-11-15): eftersök, planer, chatt och medlemmar.
 * Hålls uppdaterat var 12:e sekund medan skärmen visas. Utan täckning
 * visas det som senast hämtades.
 */
export default function JaktlagSida() {
  return <KraverKonto titel="Jaktlag">{(jag) => <Innehall jag={jag} />}</KraverKonto>;
}

function Innehall({ jag }: { jag: { id: string; namn: string } }) {
  const { lagId } = useLocalSearchParams<{ lagId: string }>();
  const data = useLagData(lagId);
  const [visaAllaEftersok, setVisaAllaEftersok] = useState(false);
  useSynk(lagId, 12000, () => router.replace("/jaktlag"));

  if (!data) {
    return (
      <Skarm>
        <TillbakaKnapp />
        <Rubrikrad titel="Jaktlag" />
        <Kort>
          <Txt farg="inkMuted">Hämtar jaktlaget…</Txt>
        </Kort>
      </Skarm>
    );
  }

  const ansvarig = data.lag.minRoll === "ansvarig";
  const aktiva = data.eftersok.filter((e) => e.status !== "avslutat");
  const avslutade = data.eftersok.filter((e) => e.status === "avslutat");
  const visadeAvslutade = visaAllaEftersok ? avslutade : avslutade.slice(0, 2);
  const sista = data.meddelanden.filter((m) => !m.borttaget).at(-1);
  const gammal = Date.now() - data.hamtad > 60000;

  return (
    <Skarm>
      <TillbakaKnapp onPress={() => (router.canGoBack() ? router.back() : router.replace("/jaktlag"))} />
      <Rubrikrad
        titel={data.lag.namn}
        undertitel={`${data.medlemmar.length} ${data.medlemmar.length === 1 ? "medlem" : "medlemmar"}${ansvarig ? " · du är ansvarig" : ""}`}
      />
      {gammal && (
        <Txt variant="caption" farg="inkMuted">
          Ingen kontakt med servern. Visar det som hämtades {dagOchTid(data.hamtad)}.
        </Txt>
      )}

      <View style={styles.block}>
        <Etikett>EFTERSÖK</Etikett>
        {aktiva.length + visadeAvslutade.length > 0 && (
          <Kort lista>
            {[...aktiva, ...visadeAvslutade].map((e, i) => (
              <Listrad
                key={e.id}
                forsta={i === 0}
                titel={`${e.viltart || "Eftersök"} · ${dagOchTid(e.skapad)}`}
                undertitel={eftersokLage(e)}
                hoger={e.status === "oppet" && !e.vantar ? "Öppet" : undefined}
                hogerFarg="signal"
                onPress={() => router.push(`/jaktlag/${lagId}/eftersok/${e.id}`)}
              />
            ))}
          </Kort>
        )}
        {avslutade.length > 2 && !visaAllaEftersok && (
          <Knapp titel={`Visa alla avslutade (${avslutade.length})`} variant="text" onPress={() => setVisaAllaEftersok(true)} />
        )}
        <Knapp titel="Markera eftersök" ikon="plus" onPress={() => router.push(`/jaktlag/${lagId}/eftersok/ny`)} />
      </View>

      <View style={styles.block}>
        <Etikett>JAKTPLANER</Etikett>
        {data.planer.length === 0 ? (
          <Kort>
            <Txt farg="inkMuted">
              {ansvarig
                ? "Ingen plan än. Skapa en och rita ut släpplatser och rutter på kartan."
                : "Ingen plan är publicerad än."}
            </Txt>
          </Kort>
        ) : (
          <Kort lista>
            {data.planer.map((p, i) => {
              const mitt = mittUppdrag(p, jag.id, jag.namn);
              return (
                <Listrad
                  key={p.id}
                  forsta={i === 0}
                  ikon="jaktmark"
                  titel={p.namn}
                  undertitel={`${planDatum(p.datum)} · ${
                    p.status === "utkast"
                      ? "Utkast – syns bara för ansvariga"
                      : mitt
                        ? `Du släpper ${mitt.hund || "hund"}${mitt.slappTid ? ` ${mitt.slappTid}` : ""}`
                        : `${p.innehall.uppdrag.length} uppdrag`
                  }`}
                  hoger={p.status === "stangd" ? "Stängd" : undefined}
                  hogerFarg="inkMuted"
                  hojd={72}
                  onPress={() => router.push(`/jaktlag/${lagId}/plan/${p.id}`)}
                />
              );
            })}
          </Kort>
        )}
        {ansvarig && (
          <Knapp titel="Ny plan" ikon="plus" variant="sekundar" onPress={() => router.push(`/jaktlag/${lagId}/plan/ny`)} />
        )}
      </View>

      <View style={styles.block}>
        <Etikett>CHATT OCH MEDLEMMAR</Etikett>
        <Kort lista>
          <Listrad
            forsta
            titel="Chatt"
            undertitel={sista ? `${sista.namn}: ${sista.text}`.slice(0, 80) : "Inga meddelanden än"}
            hoger={sista ? dagOchTid(sista.skapad) : undefined}
            hogerFarg="inkMuted"
            onPress={() => router.push(`/jaktlag/${lagId}/chatt`)}
          />
          <Listrad
            titel="Medlemmar"
            undertitel={ansvarig ? "Bjud in, ändra roller, lämna laget" : "Se vilka som är med, lämna laget"}
            hoger={String(data.medlemmar.length)}
            hogerFarg="inkMuted"
            onPress={() => router.push(`/jaktlag/${lagId}/medlemmar`)}
          />
        </Kort>
      </View>
    </Skarm>
  );
}

const styles = StyleSheet.create({
  block: { gap: avstand.s3 },
});
