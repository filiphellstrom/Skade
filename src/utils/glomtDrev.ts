import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { lasSakert, sparaSakert } from "./lagring";

/**
 * Påminnelse om glömt drev (2026-11-15): en lokal notis om ett drev har
 * pågått i tre timmar, så att en glömd stopptryckning inte förstör
 * statistiken. Schemaläggs när drevet startas och tas bort när det
 * stoppas. Bara en påminnelse åt gången (fast id).
 *
 * - Av/på under Inställningar. På från början, men appen frågar inte om
 *   lov för notiser mitt i jakten: påminnelsen läggs bara om notiser
 *   redan är tillåtna. Lov ges när man slår på den i Inställningar
 *   (eller redan har gett det för dokumentpåminnelser).
 * - Ett drev som startas från låsskärmen får sin påminnelse först när
 *   appen öppnas nästa gång (timern synkar då).
 * - Ingenting görs på webben.
 */

const NOTIS_ID = "glomt-drev";
const NYCKEL = "glomtDrev:pa";
export const GLOMT_DREV_TIMMAR = 3;

export async function glomtDrevPa(): Promise<boolean> {
  return (await lasSakert(NYCKEL)) !== "0";
}

/** Slår på eller av. Vid På frågas om lov för notiser. Svarar om påminnelsen kan visas. */
export async function sattGlomtDrev(pa: boolean): Promise<boolean> {
  sparaSakert(NYCKEL, pa ? "1" : "0");
  if (Platform.OS === "web") return false;
  if (!pa) {
    await Notifications.cancelScheduledNotificationAsync(NOTIS_ID).catch(() => {});
    return false;
  }
  let lov = await Notifications.getPermissionsAsync();
  if (!lov.granted && lov.canAskAgain) {
    lov = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
  }
  return lov.granted;
}

export async function notiserTillatna(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Ser till att påminnelsen stämmer med läget: ett pågående drev har en
 * påminnelse tre timmar efter start, annars finns ingen. Får aldrig
 * kasta fel – timern ska inte påverkas.
 */
export async function synkaGlomtDrev(
  drev: { startTimestamp: number; jaktdagId: string } | null,
  hundNamn?: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const tid = drev ? new Date((drev.startTimestamp + GLOMT_DREV_TIMMAR * 3600) * 1000) : null;
    if (!drev || !tid || tid.getTime() <= Date.now() + 5000 || !(await glomtDrevPa())) {
      await Notifications.cancelScheduledNotificationAsync(NOTIS_ID).catch(() => {});
      return;
    }
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    // Samma id ersätter en tidigare påminnelse.
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIS_ID,
      content: {
        title: "Pågår drevet fortfarande?",
        body: `${hundNamn ? `${hundNamn}s drev` : "Drevet"} har pågått i ${GLOMT_DREV_TIMMAR} timmar. Tryck för att öppna timern och stoppa om det är över.`,
        data: { glomtDrevJaktdagId: drev.jaktdagId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tid },
    });
  } catch {
    // Ingen påminnelse den här gången.
  }
}
