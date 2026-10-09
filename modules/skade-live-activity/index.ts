import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

/**
 * Typad åtkomst till den native modulen i ./ios. Finns bara i iOS-byggen
 * (inte Expo Go, inte webben, inte Android) - då är `modul` null och alla
 * anrop i src/liveActivity.ts blir no-ops.
 */
interface SkadeLiveActivityNative {
  areActivitiesEnabled(): boolean;
  currentDrevId(): string | null;
  startDrev(
    drevId: string,
    jaktmark: string,
    hundNamn: string,
    startTimestamp: number,
  ): Promise<string | null>;
  endAll(): Promise<void>;
}

export const modul: SkadeLiveActivityNative | null =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<SkadeLiveActivityNative>("SkadeLiveActivity")
    : null;
