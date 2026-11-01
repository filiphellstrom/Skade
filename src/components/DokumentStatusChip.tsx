import { StyleSheet, View } from "react-native";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie, typ } from "@/theme/tokens";
import type { StatusTyp } from "@/utils/dokumentStatus";
import { Ikon } from "@/components/ui/Ikon";
import type { IkonNamn } from "@/components/ui/Ikon";
import { Txt } from "@/components/ui/Txt";

/**
 * Statuschip på ett dokument (designen 2026-10-29): Giltig (brand på
 * brandSoft), Går ut snart (warn på warnSoft), Utgånget (signal, kantad),
 * Inget slutdatum (neutral). Alltid ikon + ord, aldrig bara färg.
 */
export function DokumentStatusChip({ status, text }: { status: StatusTyp; text: string }) {
  const { farger } = useTema();
  const stil = {
    giltig: { bg: farger.brandSoft, fg: "brand" as const, kant: "transparent", ikon: "bock" as IkonNamn },
    snart: { bg: farger.warnSoft, fg: "warn" as const, kant: "transparent", ikon: "klocka" as IkonNamn },
    utgatt: { bg: "transparent", fg: "signal" as const, kant: farger.signal, ikon: "varning" as IkonNamn },
    ingen: { bg: farger.surface300, fg: "inkMuted" as const, kant: "transparent", ikon: null },
  }[status];
  return (
    <View style={[styles.chip, { backgroundColor: stil.bg, borderColor: stil.kant }]}>
      {stil.ikon && <Ikon namn={stil.ikon} farg={farger[stil.fg]} storlek={14} linje={2} />}
      <Txt variant="caption" farg={stil.fg} style={styles.text}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s1,
    paddingHorizontal: avstand.s2,
    paddingVertical: 2,
    borderRadius: radie.sm,
    borderWidth: 1.5,
    marginTop: avstand.s1,
  },
  text: { fontFamily: typ.bodyStrong.fontFamily },
});
