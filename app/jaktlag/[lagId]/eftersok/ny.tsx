import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaKartdata } from "@/db/queries/kartpunkt";
import { useProfil } from "@/contexts/ProfilContext";
import { felText, markeraEftersok, useLagData } from "@/jaktlag/lager";
import { hamtaPosition } from "@/jaktlag/position";
import type { Punkt } from "@/jaktlag/typer";
import { avstand } from "@/theme/tokens";
import { formateraKoordinat } from "@/utils/koordinat";
import { VILTARTER } from "@/utils/vilt";
import { arPass } from "@/vind/gpx";
import { KraverKonto } from "@/components/jaktlag/KraverKonto";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Etikett, Falt, Rubrikrad, Segment, Skarm, TillbakaKnapp, ValChip } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Markera ett eftersök (2026-11-15).
 *
 * Platsen är antingen telefonens position eller ett pass – den som
 * markerar står sällan själv på skottplatsen, men vet ofta vilket pass
 * det gäller. Passen kommer från planerna i jaktlaget och från de
 * jaktmarker som importerats i telefonen. Utan täckning sparas
 * eftersöket och skickas när täckningen är tillbaka.
 */
export default function NyttEftersok() {
  return <KraverKonto titel="Markera eftersök">{(jag) => <Innehall jag={jag} />}</KraverKonto>;
}

interface Pass extends Punkt {
  namn: string;
}

function Innehall({ jag }: { jag: { id: string; namn: string } }) {
  const { lagId } = useLocalSearchParams<{ lagId: string }>();
  const { profil } = useProfil();
  const data = useLagData(lagId);
  const [plats, setPlats] = useState<"position" | "pass">("position");
  const [position, setPosition] = useState<(Punkt & { noggrannhet: number | null }) | null | undefined>(undefined);
  const [lokalaPass, setLokalaPass] = useState<Pass[]>([]);
  const [valtPass, setValtPass] = useState<Pass | null>(null);
  const [viltart, setViltart] = useState("");
  const [text, setText] = useState("");
  const [fel, setFel] = useState<string | null>(null);
  const [arbetar, setArbetar] = useState(false);

  const sokPosition = useCallback(async () => {
    setPosition(undefined);
    setPosition(await hamtaPosition());
  }, []);

  useEffect(() => {
    sokPosition();
  }, [sokPosition]);

  useEffect(() => {
    (async () => {
      const db = await getDatabase();
      const kartdata = await hamtaKartdata(db, profil.id);
      setLokalaPass(
        kartdata.flatMap((k) =>
          k.punkter.filter((p) => arPass(p.typ) && p.namn).map((p) => ({ namn: p.namn, lat: p.lat, lon: p.lon })),
        ),
      );
    })().catch(() => {});
  }, [profil.id]);

  // Pass från jaktlagets planer först, sedan de som bara finns i telefonen. Ett namn visas en gång.
  const allaPass: Pass[] = [];
  const sedda = new Set<string>();
  const planPass = (data?.planer ?? []).flatMap((p) =>
    (p.innehall.jaktmark?.punkter ?? []).filter((x) => arPass(x.typ) && x.namn),
  );
  for (const p of [...planPass, ...lokalaPass]) {
    if (!sedda.has(p.namn)) {
      sedda.add(p.namn);
      allaPass.push({ namn: p.namn, lat: p.lat, lon: p.lon });
    }
  }
  allaPass.sort((a, b) => a.namn.localeCompare(b.namn, "sv", { numeric: true }));

  const vald: Punkt | null = plats === "pass" ? valtPass : (position ?? null);

  const markera = async () => {
    if (!vald || arbetar) return;
    setArbetar(true);
    setFel(null);
    try {
      const passText = plats === "pass" && valtPass ? `Vid ${valtPass.namn}. ` : "";
      const { id } = await markeraEftersok(lagId, jag, {
        lat: vald.lat,
        lon: vald.lon,
        viltart,
        text: `${passText}${text.trim()}`.trim(),
      });
      router.replace(`/jaktlag/${lagId}/eftersok/${id}`);
    } catch (e) {
      setFel(felText(e));
      setArbetar(false);
    }
  };

  return (
    <Skarm
      sidfot={<Knapp titel="Markera eftersök" onPress={markera} disabled={!vald} laddar={arbetar} />}
    >
      <TillbakaKnapp />
      <Rubrikrad titel="Markera eftersök" undertitel={data?.lag.namn} />
      {fel && <InlineBanner text={fel} />}

      <View style={styles.block}>
        <Etikett>PLATS</Etikett>
        {allaPass.length > 0 && (
          <Segment
            etikett="Plats för eftersöket"
            val={[
              { varde: "position", titel: "Min position" },
              { varde: "pass", titel: "Vid ett pass" },
            ]}
            varde={plats}
            onChange={setPlats}
          />
        )}
        {plats === "position" ? (
          <Kort style={styles.kort}>
            {position === undefined ? (
              <Txt farg="inkMuted">Söker position…</Txt>
            ) : position === null ? (
              <>
                <Txt>Positionen gick inte att hämta. Kontrollera att Skade får använda platsen.</Txt>
                <Knapp titel="Försök igen" variant="sekundar" onPress={sokPosition} />
              </>
            ) : (
              <>
                <Txt variant="bodyStrong" selectable>
                  {formateraKoordinat(position.lat, "lat")} {formateraKoordinat(position.lon, "lon")}
                </Txt>
                <Txt variant="caption" farg="inkMuted">
                  Där du står nu
                  {position.noggrannhet !== null ? `, noggrannhet ±${Math.round(position.noggrannhet)} m` : ""}. Skriv
                  nedan om skottplatsen ligger någon annanstans.
                </Txt>
                <Knapp titel="Uppdatera position" variant="text" onPress={sokPosition} />
              </>
            )}
          </Kort>
        ) : (
          <View style={styles.chips}>
            {allaPass.map((p) => (
              <ValChip key={p.namn} titel={p.namn} vald={valtPass?.namn === p.namn} onPress={() => setValtPass(p)} hojd={48} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.block}>
        <Etikett>VILTART</Etikett>
        <View style={styles.chips}>
          {VILTARTER.map((v) => (
            <ValChip key={v} titel={v} vald={viltart === v} onPress={() => setViltart(viltart === v ? "" : v)} hojd={48} />
          ))}
        </View>
      </View>

      <Falt
        etikett="Beskrivning"
        value={text}
        onChangeText={setText}
        placeholder="T.ex. skott 08:15, gick mot nordväst"
        maxLength={400}
        multiline
        style={styles.fritext}
      />
    </Skarm>
  );
}

const styles = StyleSheet.create({
  block: { gap: avstand.s3 },
  kort: { gap: avstand.s2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  fritext: { minHeight: 96, textAlignVertical: "top", paddingTop: avstand.s3 },
});
