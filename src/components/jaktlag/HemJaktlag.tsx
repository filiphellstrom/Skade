import { useCallback } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useJag } from "@/jaktlag/jag";
import { hamtaLista, laddaFranMinne, synka, useAktivaEftersok, useLagLista } from "@/jaktlag/lager";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Etikett } from "@/components/ui/Delar";

/**
 * Jaktlag på Hem (2026-11-15): en rad som leder till jaktlagen. Visar
 * hur många eftersök som väntar på att någon tar dem. När Hem visas och
 * man är inloggad hämtas lagen och deras senaste läge en gång.
 */
export function HemJaktlag() {
  const { jag } = useJag();
  const lista = useLagLista();
  const oppna = useAktivaEftersok().filter((e) => e.status === "oppet").length;
  const inloggad = !!jag;

  useFocusEffect(
    useCallback(() => {
      laddaFranMinne();
      if (!inloggad) return;
      hamtaLista()
        .then((lag) => Promise.all(lag.slice(0, 5).map((l) => synka(l.id).catch(() => null))))
        .catch(() => {});
    }, [inloggad]),
  );

  const namn = inloggad && lista && lista.length > 0 ? lista.map((l) => l.namn).join(", ") : null;

  return (
    <View>
      <Etikett>JAKTLAG</Etikett>
      <Kort lista>
        <Listrad
          forsta
          ikon="jaktmark"
          titel={namn ?? "Jaktlag"}
          undertitel={
            namn
              ? "Planer, eftersök och chatt"
              : inloggad
                ? "Planera jakten, ta eftersök och chatta med hundförarna"
                : "Logga in med Apple eller Google för att planera jakten med hundförarna"
          }
          hoger={oppna > 0 ? `${oppna} eftersök` : undefined}
          hogerFarg="signal"
          onPress={() => router.push(lista && lista.length === 1 && inloggad ? `/jaktlag/${lista[0].id}` : "/jaktlag")}
        />
      </Kort>
    </View>
  );
}
