import { Tabs } from "expo-router";
import { Flikfalt } from "@/components/ui/Flikfalt";

/**
 * Fem bottenflikar: Hem, Hundar, Historik, Jaktmarker, Karta (Design
 * Systemet, navigation.md; Karta tillagd 2026-11-04). Varje flik utom Hem och Karta har en egen stack (egen _layout.tsx)
 * och därmed egen navigeringshistorik. Jaktdagsflödet och Inställningar
 * ligger UTANFÖR flikarna i rot-stacken, så flikfältet döljs där.
 */
export default function FlikLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <Flikfalt {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Hem" }} />
      <Tabs.Screen name="hundar" options={{ title: "Hundar" }} />
      <Tabs.Screen name="historik" options={{ title: "Historik" }} />
      <Tabs.Screen name="jaktmarker" options={{ title: "Jaktmarker" }} />
      <Tabs.Screen name="karta" options={{ title: "Karta" }} />
    </Tabs>
  );
}
