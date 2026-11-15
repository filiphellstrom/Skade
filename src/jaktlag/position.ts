import * as Location from "expo-location";
import type { Punkt } from "./typer";

/**
 * Telefonens position just nu, eller null om den inte går att få
 * (nekad behörighet, ingen GPS). Frågar om lov första gången.
 */
export async function hamtaPosition(): Promise<(Punkt & { noggrannhet: number | null }) | null> {
  try {
    let lov = await Location.getForegroundPermissionsAsync();
    if (!lov.granted && lov.canAskAgain) {
      lov = await Location.requestForegroundPermissionsAsync();
    }
    if (!lov.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, noggrannhet: pos.coords.accuracy ?? null };
  } catch {
    return null;
  }
}
