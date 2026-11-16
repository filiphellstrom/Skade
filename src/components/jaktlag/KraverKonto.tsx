import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useJag } from "@/jaktlag/jag";
import { useFarger } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { InloggKnappar } from "@/components/konto/InloggKnappar";
import { Kort } from "@/components/ui/Kort";
import { Rubrikrad, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Jaktlag kräver ett konto. Utan inloggning visas en förklaring och
 * knapparna för att logga in direkt här (2026-11-16; förut en knapp till
 * Profil). Barnen får den inloggade användaren.
 */
export function KraverKonto({
  titel,
  children,
}: {
  titel: string;
  children: (jag: { id: string; namn: string }) => ReactNode;
}) {
  const f = useFarger();
  const { jag, vantar } = useJag();
  if (jag) {
    return <>{children(jag)}</>;
  }
  if (vantar) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }
  return (
    <Skarm>
      <TillbakaKnapp />
      <Rubrikrad titel={titel} />
      <Kort style={styles.kort}>
        <Txt variant="body">Jaktlag delas med andra och kräver därför ett konto.</Txt>
        <Txt variant="body" farg="inkMuted">
          Drev, hundar och dokument ligger kvar i telefonen som förut.
        </Txt>
        <InloggKnappar tillbaka="/jaktlag" />
      </Kort>
    </Skarm>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  kort: { gap: avstand.s3 },
});
