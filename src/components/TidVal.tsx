import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie } from "@/theme/tokens";
import type { UnixTimestamp } from "@/db/types";
import { Rullhjul } from "@/components/Rullhjul";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Txt } from "@/components/ui/Txt";

const TIMMAR = Array.from({ length: 24 }, (_, i) => i);
const MINUTER = Array.from({ length: 60 }, (_, i) => i);
const tt = (n: number) => String(n).padStart(2, "0");

function klocka(ts: UnixTimestamp): string {
  const d = new Date(ts * 1000);
  return `${tt(d.getHours())}:${tt(d.getMinutes())}`;
}

/** Drevets längd i hela minuter, t.ex. "12 min" eller "1 h 05 min". */
export function langdText(sekunder: number): string {
  const min = Math.floor(Math.max(0, sekunder) / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${tt(min % 60)} min`;
}

/** Byter klockslaget på ett UnixTimestamp - datumet hålls fast, sekunder nollas. */
function medKlockslag(ts: UnixTimestamp, timme: number, minut: number): UnixTimestamp {
  const d = new Date(ts * 1000);
  d.setHours(timme, minut, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

interface TidValProps {
  start: UnixTimestamp;
  slut: UnixTimestamp;
  onStart: (ts: UnixTimestamp) => void;
  onSlut: (ts: UnixTimestamp) => void;
}

type Vilken = "start" | "slut";

/**
 * Tidsvalet i drev-vyn (förslag B i designfilen, valt av Filip
 * 2026-10-09, utan snabbknappar). Ett listkort med Start, Slut och
 * Längd. Tryck på Start eller Slut så glider ett ark upp med två
 * rullhjul (timme : minut). Ändringen syns direkt i vyn, men sparas
 * först när man trycker Spara i drev-vyn.
 *
 * Bara klockslaget ändras, datumet är drevets eget (som tidigare
 * TidField). Ersätter TidField och dess +/- -stegare.
 */
export function TidVal({ start, slut, onStart, onSlut }: TidValProps) {
  const [ark, setArk] = useState<Vilken | null>(null);
  const langd = langdText(slut - start);

  return (
    <>
      <Kort lista>
        <Listrad
          forsta
          titel="Start"
          hoger={klocka(start)}
          hojd={64}
          accessibilityLabel={`Starttid ${klocka(start)}, ändra`}
          onPress={() => setArk("start")}
        />
        <Listrad
          titel="Slut"
          hoger={klocka(slut)}
          hojd={64}
          accessibilityLabel={`Sluttid ${klocka(slut)}, ändra`}
          onPress={() => setArk("slut")}
        />
        <Listrad titel="Längd" hoger={langd} hogerFarg="inkMuted" hojd={56} />
      </Kort>
      <TidArk
        vilken={ark}
        varde={ark === "slut" ? slut : start}
        langd={langd}
        onChange={(ts) => (ark === "slut" ? onSlut(ts) : onStart(ts))}
        onStang={() => setArk(null)}
      />
    </>
  );
}

interface TidArkProps {
  vilken: Vilken | null;
  varde: UnixTimestamp;
  langd: string;
  onChange: (ts: UnixTimestamp) => void;
  onStang: () => void;
}

/** Arket med rullhjulen. Tona in bakgrunden och låt arket glida upp. */
function TidArk({ vilken, varde, langd, onChange, onStang }: TidArkProps) {
  const { farger, schema } = useTema();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [synlig, setSynlig] = useState(false);
  // Titeln ligger kvar medan arket glider ut.
  const [visad, setVisad] = useState<Vilken>("start");

  useEffect(() => {
    if (vilken) {
      setVisad(vilken);
      setSynlig(true);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else if (synlig) {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setSynlig(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vilken]);

  const d = new Date(varde * 1000);
  const timme = d.getHours();
  const minut = d.getMinutes();
  const titel = visad === "slut" ? "Sluttid" : "Starttid";

  return (
    <Modal visible={synlig} transparent animationType="none" onRequestClose={onStang} statusBarTranslucent>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: schema === "dark" ? "rgba(0,0,0,0.55)" : "rgba(20,32,27,0.35)", opacity: anim },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onStang} accessibilityLabel="Stäng" accessibilityRole="button" />
      </Animated.View>
      <Animated.View
        style={[
          styles.ark,
          {
            backgroundColor: farger.surface200,
            paddingBottom: Math.max(insets.bottom, avstand.s4) + avstand.s2,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
          },
        ]}
        accessibilityViewIsModal
      >
        <View style={[styles.grepp, { backgroundColor: farger.border }]} />
        <View style={styles.rubrik}>
          <Txt variant="title2" accessibilityRole="header">
            {titel}
          </Txt>
          <Txt variant="body" farg="inkMuted">
            Längd {langd}
          </Txt>
        </View>
        <View style={styles.hjul}>
          <Rullhjul
            etikett={`${titel}, timme`}
            varden={TIMMAR}
            valt={timme}
            format={tt}
            onChange={(t) => onChange(medKlockslag(varde, t, minut))}
          />
          <Txt variant="title2" style={styles.kolon}>
            :
          </Txt>
          <Rullhjul
            etikett={`${titel}, minut`}
            varden={MINUTER}
            valt={minut}
            format={tt}
            onChange={(m) => onChange(medKlockslag(varde, timme, m))}
          />
        </View>
        <Knapp titel="Klar" onPress={onStang} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ark: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radie.lg,
    borderTopRightRadius: radie.lg,
    paddingTop: avstand.s2,
    paddingHorizontal: avstand.s4,
    gap: avstand.s3,
  },
  grepp: { alignSelf: "center", width: 36, height: 5, borderRadius: 3 },
  rubrik: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  hjul: { flexDirection: "row", alignItems: "center", gap: avstand.s1, paddingHorizontal: avstand.s6 },
  kolon: { paddingHorizontal: avstand.s1 },
});
