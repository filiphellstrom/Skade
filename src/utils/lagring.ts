import { Platform } from "react-native";
import Storage from "expo-sqlite/kv-store";

/**
 * Små inställningar utanför appens databas (tema, senaste sida).
 *
 * På webben används webbläsarens localStorage i stället för kv-store:
 * wa-sqlite (SQLite på webben) kraschar om två databaser används
 * samtidigt, och kv-store är en egen databas bredvid skade.db.
 */
export async function lasSakert(nyckel: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return globalThis.localStorage?.getItem(nyckel) ?? null;
    }
    return await Storage.getItem(nyckel);
  } catch {
    return null;
  }
}

export function sparaSakert(nyckel: string, varde: string): void {
  try {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(nyckel, varde);
      return;
    }
    Storage.setItem(nyckel, varde).catch((e) => {
      console.warn(`[lagring] kunde inte spara ${nyckel}`, e);
    });
  } catch (e) {
    console.warn(`[lagring] kunde inte spara ${nyckel}`, e);
  }
}
