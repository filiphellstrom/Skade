import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { felText, gaMed, hamtaLista, laddaFranMinne, skapaLag, useLagLista } from "@/jaktlag/lager";
import { avstand } from "@/theme/tokens";
import { KraverKonto } from "@/components/jaktlag/KraverKonto";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Etikett, Falt, Rubrikrad, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Mina jaktlag (2026-11-15). Skapa ett lag eller gå med i ett med en
 * inbjudningskod. En inbjudningslänk eller QR-kod öppnar den här skärmen
 * med koden ifylld (skade://jaktlag?kod=…).
 */
export default function JaktlagLista() {
  return <KraverKonto titel="Jaktlag">{() => <Innehall />}</KraverKonto>;
}

function Innehall() {
  const { kod: kodParam } = useLocalSearchParams<{ kod?: string }>();
  const lista = useLagLista();
  const [fel, setFel] = useState<string | null>(null);
  const [namn, setNamn] = useState("");
  const [kod, setKod] = useState(kodParam ?? "");
  const [arbetar, setArbetar] = useState<"skapa" | "ga-med" | null>(null);

  useEffect(() => {
    if (kodParam) setKod(kodParam);
  }, [kodParam]);

  useFocusEffect(
    useCallback(() => {
      laddaFranMinne();
      hamtaLista().then(
        () => setFel(null),
        (e) => setFel(felText(e)),
      );
    }, []),
  );

  const skapa = async () => {
    if (namn.trim() === "" || arbetar) return;
    setArbetar("skapa");
    setFel(null);
    try {
      const id = await skapaLag(namn.trim());
      setNamn("");
      router.push(`/jaktlag/${id}`);
    } catch (e) {
      setFel(felText(e));
    } finally {
      setArbetar(null);
    }
  };

  const gaMedLag = async () => {
    if (kod.trim() === "" || arbetar) return;
    setArbetar("ga-med");
    setFel(null);
    try {
      const id = await gaMed(kod.trim());
      setKod("");
      router.push(`/jaktlag/${id}`);
    } catch (e) {
      setFel(felText(e));
    } finally {
      setArbetar(null);
    }
  };

  return (
    <Skarm>
      <TillbakaKnapp onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <Rubrikrad titel="Jaktlag" undertitel="Planera jakten, ta eftersök och chatta med de andra hundförarna." />
      {fel && <InlineBanner text={fel} />}

      <View>
        <Etikett>MINA JAKTLAG</Etikett>
        {lista === null ? (
          <Kort>
            <Txt farg="inkMuted">Hämtar…</Txt>
          </Kort>
        ) : lista.length === 0 ? (
          <Kort>
            <Txt farg="inkMuted">Du är inte med i något jaktlag än. Skapa ett, eller gå med i ett med en kod.</Txt>
          </Kort>
        ) : (
          <Kort lista>
            {lista.map((l, i) => (
              <Listrad
                key={l.id}
                forsta={i === 0}
                ikon="jaktmark"
                titel={l.namn}
                undertitel={`${l.antalMedlemmar} ${l.antalMedlemmar === 1 ? "medlem" : "medlemmar"}${l.minRoll === "ansvarig" ? " · du är ansvarig" : ""}`}
                onPress={() => router.push(`/jaktlag/${l.id}`)}
              />
            ))}
          </Kort>
        )}
      </View>

      <View>
        <Etikett>GÅ MED I ETT JAKTLAG</Etikett>
        <Kort style={styles.kort}>
          <Falt
            etikett="Inbjudningskod"
            value={kod}
            onChangeText={setKod}
            placeholder="T.ex. ABCD2345"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="go"
            onSubmitEditing={gaMedLag}
          />
          <Knapp titel="Gå med" onPress={gaMedLag} disabled={kod.trim() === ""} laddar={arbetar === "ga-med"} />
        </Kort>
      </View>

      <View>
        <Etikett>SKAPA ETT JAKTLAG</Etikett>
        <Kort style={styles.kort}>
          <Falt
            etikett="Namn"
            value={namn}
            onChangeText={setNamn}
            placeholder="T.ex. Stava-Lidberga"
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={skapa}
          />
          <Knapp
            titel="Skapa jaktlag"
            variant="sekundar"
            onPress={skapa}
            disabled={namn.trim() === ""}
            laddar={arbetar === "skapa"}
          />
          <Txt variant="caption" farg="inkMuted">
            Du blir ansvarig och kan bjuda in de andra med en kod.
          </Txt>
        </Kort>
      </View>
    </Skarm>
  );
}

const styles = StyleSheet.create({
  kort: { gap: avstand.s3 },
});
