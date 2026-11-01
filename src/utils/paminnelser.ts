import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { router, useRootNavigationState } from "expo-router";
import * as Notifications from "expo-notifications";
import type { Dokument } from "@/db/types";
import { datumText } from "@/components/HjulVal";

/**
 * Lokala påminnelser för dokument som går ut (designen 2026-10-29): en
 * notis klockan 09:00, 7, 30 eller 60 dagar före slutdatum. Helt lokalt
 * på telefonen - ingen server och inga push-notiser.
 *
 * Varje dokument har högst en schemalagd påminnelse, vars id sparas i
 * Dokument.notisId. Den avbokas och schemaläggs om varje gång dokumentet
 * sparas, och avbokas när det raderas.
 *
 * Ingenting görs på webben.
 */

if (Platform.OS !== "web") {
  // Visa påminnelsen även om appen råkar vara öppen just då.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Klockslaget då påminnelsen kommer. */
export function paminnelseTid(d: Pick<Dokument, "giltigTill" | "paminnelseDagar">): Date | null {
  if (d.giltigTill === null) {
    return null;
  }
  const t = new Date(d.giltigTill * 1000);
  t.setDate(t.getDate() - d.paminnelseDagar);
  t.setHours(9, 0, 0, 0);
  return t;
}

export async function avbokaPaminnelse(notisId: string | null): Promise<void> {
  if (!notisId || Platform.OS === "web") {
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(notisId).catch(() => {});
}

export type PaminnelseResultat =
  | { notisId: string }
  | { notisId: null; orsak: "webb" | "ingetSlutdatum" | "passerad" | "nekad" };

/**
 * Schemalägger påminnelsen för ett dokument. Ber om lov att visa notiser
 * första gången. Returnerar null-id med en orsak när ingen påminnelse
 * lades (t.ex. om tiden redan passerat - då syns varningen på Hem i
 * stället).
 */
export async function schemalaggPaminnelse(d: Dokument): Promise<PaminnelseResultat> {
  if (Platform.OS === "web") {
    return { notisId: null, orsak: "webb" };
  }
  const tid = paminnelseTid(d);
  if (!tid || d.giltigTill === null) {
    return { notisId: null, orsak: "ingetSlutdatum" };
  }
  if (tid.getTime() <= Date.now()) {
    return { notisId: null, orsak: "passerad" };
  }
  let lov = await Notifications.getPermissionsAsync();
  if (!lov.granted && lov.canAskAgain) {
    lov = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
  }
  if (!lov.granted) {
    return { notisId: null, orsak: "nekad" };
  }
  const notisId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${d.namn} går ut om ${d.paminnelseDagar} dagar`,
      body: `Giltigt till ${datumText(d.giltigTill)}. Tryck för att öppna dokumentet i Skade.`,
      data: { dokumentId: d.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tid },
  });
  return { notisId };
}

/**
 * Öppnar dokumentet när man trycker på en påminnelse (även när appen
 * startas av trycket). Renderas i appens Stack-layout (app/_layout.tsx).
 */
function PaminnelseNavigeringApp() {
  const svar = Notifications.useLastNotificationResponse();
  const navigation = useRootNavigationState();
  const hanterad = useRef<string | null>(null);
  useEffect(() => {
    if (!svar || !navigation?.key) {
      return;
    }
    const id = svar.notification.request.identifier;
    const dokumentId = svar.notification.request.content.data?.dokumentId;
    if (hanterad.current === id || typeof dokumentId !== "string") {
      return;
    }
    hanterad.current = id;
    router.push(`/profil/dokument/${dokumentId}`);
  }, [svar, navigation?.key]);
  return null;
}

export const PaminnelseNavigering = Platform.OS === "web" ? () => null : PaminnelseNavigeringApp;
