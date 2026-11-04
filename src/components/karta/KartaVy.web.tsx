import { StyleSheet } from "react-native";
import { Kort } from "@/components/ui/Kort";
import { Rubrikrad, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { avstand } from "@/theme/tokens";

/**
 * Webbversionen av kartfliken. react-native-maps (Apple Maps) finns bara
 * i iPhone-appen, så här visas bara en förklaring. En riktig webbkarta
 * kan läggas till senare om den behövs.
 */
export function KartaVy() {
  return (
    <Skarm>
      <Rubrikrad titel="Karta" />
      <Kort style={styles.kort}>
        <Txt variant="heading">Kartan finns i iPhone-appen</Txt>
        <Txt farg="inkMuted">
          I appen visar kartan var du är, även ute i skogen utan täckning.
          Webbversionen har ingen karta än.
        </Txt>
      </Kort>
    </Skarm>
  );
}

const styles = StyleSheet.create({
  kort: { gap: avstand.s2, padding: avstand.s4 },
});
