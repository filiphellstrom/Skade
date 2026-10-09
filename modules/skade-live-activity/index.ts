import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

/** Läget låsskärmskortet ska visa - se SkadeLiveActivityModule.swift. */
export interface LasskarmLage {
  jaktdagId: string;
  jaktmark: string;
  hundNamn: string | null;
  drevId: string | null;
  drevStart: number | null;
  drevNummer: number;
}

/**
 * Typad åtkomst till den native modulen i ./ios. Finns bara i iOS-byggen
 * (inte Expo Go, inte webben, inte Android) - då är `modul` null och alla
 * anrop i src/liveActivity.ts blir no-ops.
 */
interface SkadeLiveActivityNative {
  areActivitiesEnabled(): boolean;
  synka(lage: LasskarmLage): Promise<string>;
  avslutaAlla(): Promise<void>;
  diagnostik(): string;
}

export const modul: SkadeLiveActivityNative | null =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<SkadeLiveActivityNative>("SkadeLiveActivity")
    : null;
