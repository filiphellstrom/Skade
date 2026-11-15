import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Känselsvar när ett tryck gått igenom – så att man märker det med vantar
 * och utan att titta på skärmen. Starta och Stoppa ger ett tydligt
 * kvitto, händelser (Tappt, Släppt, Kopplad) ett kortare slag.
 * Ingenting händer på webben, och ett fel här får aldrig störa timern.
 */
export function kannTryck(typ: "start" | "stopp" | "handelse"): void {
  if (Platform.OS === "web") return;
  try {
    if (typ === "start") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (typ === "stopp") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  } catch {
    // Saknas stöd i telefonen gör det ingenting.
  }
}
