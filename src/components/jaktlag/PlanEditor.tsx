import { StyleSheet } from "react-native";
import { router } from "expo-router";
import type { LagData, Plan } from "@/jaktlag/typer";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Rubrikrad, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Planeraren finns bara på webben (PlanEditor.web.tsx): att rita rutter
 * görs bäst med mus och stor skärm. I appen visas en förklaring.
 */
export function PlanEditor({ lagId, plan }: { lagId: string; plan: Plan; data: LagData }) {
  return (
    <Skarm>
      <TillbakaKnapp />
      <Rubrikrad titel="Planera jakten" undertitel={plan.namn} />
      <Kort style={styles.kort}>
        <Txt>
          Släpplatser och rutter ritas på kartan på skade.hellstrom.fyi, helst på en dator. Logga in med samma konto
          där, så finns planen under Jaktlag.
        </Txt>
        <Knapp titel="Visa planen" onPress={() => router.replace(`/jaktlag/${lagId}/plan/${plan.id}`)} />
      </Kort>
    </Skarm>
  );
}

const styles = StyleSheet.create({
  kort: { gap: avstand.s3 },
});
