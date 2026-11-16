import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { avstand } from "@/theme/tokens";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Txt } from "@/components/ui/Txt";
import { kontoKlient } from "@/konto/klient";
import { hamtaKontoKonfig, loggaInMedApple, loggaInMedGoogle, loggaUt } from "@/konto/inloggning";
import type { InloggResultat, KontoKonfig } from "@/konto/inloggning";
import { AppleKnapp } from "./AppleKnapp";

/** Apple kan utelämna e-postadressen; servern sparar då en platshållare som inte ska visas. */
function visaEpost(epost: string): string | null {
  return epost.endsWith("@apple.skade.invalid") ? null : epost;
}

/**
 * Inloggning direkt på startskärmen på webben (2026-11-16). Förut fick man
 * fylla i namn och hund och sedan gå via Profil för att logga in.
 *
 * Inloggningen skickar webbläsaren till Google eller Apple och tillbaka till
 * roten ("/"). Startskärmen visas då igen, nu inloggad: namnet hämtas från
 * kontot och hunden blir frivillig (se OnboardingScreen).
 *
 * Knapparna visas bara för de sätt servern har uppsatta för webben
 * (/api/konfig). Går servern inte att nå visas ingenting, och startskärmen
 * fungerar som förut.
 */
export function StartInloggning({ onKonto }: { onKonto: (konto: { namn: string } | null) => void }) {
  const { data: session, isPending, refetch } = kontoKlient.useSession();
  // undefined = hämtas, null = servern gick inte att nå.
  const [konfig, setKonfig] = useState<KontoKonfig | null | undefined>(undefined);
  const [arbetar, setArbetar] = useState<string | null>(null);
  const [fel, setFel] = useState<string | null>(null);

  useEffect(() => {
    let avbruten = false;
    hamtaKontoKonfig()
      .then((k) => {
        if (!avbruten) setKonfig(k);
      })
      .catch(() => {
        if (!avbruten) setKonfig(null);
      });
    return () => {
      avbruten = true;
    };
  }, []);

  const anvandare = session?.user ?? null;
  const namn = anvandare?.name?.trim() ?? "";
  useEffect(() => {
    if (isPending) return;
    onKonto(anvandare ? { namn } : null);
    // onKonto kommer från föräldern och byts inte; bara inloggningen styr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, anvandare?.id, namn]);

  const kor = async (vad: string, jobb: () => Promise<InloggResultat>) => {
    if (arbetar) return;
    setFel(null);
    setArbetar(vad);
    const r = await jobb();
    // Lyckas det lämnar webbläsaren sidan; knappen får snurra tills dess.
    if (!r.ok) {
      setArbetar(null);
      if (!r.avbruten) setFel(r.fel ?? "Något gick fel. Försök igen.");
    }
  };

  const tryckLoggaUt = async () => {
    setFel(null);
    setArbetar("ut");
    const ok = await loggaUt();
    setArbetar(null);
    if (ok) refetch();
    else setFel("Kunde inte logga ut. Försök igen.");
  };

  if (isPending || konfig === undefined) {
    return null;
  }

  if (anvandare) {
    const epost = visaEpost(anvandare.email);
    return (
      <Kort>
        <View style={styles.inne}>
          <Txt variant="bodyStrong">Du är inloggad{namn ? ` som ${namn}` : ""}</Txt>
          {epost && (
            <Txt variant="caption" farg="inkMuted">
              {epost}
            </Txt>
          )}
          <Txt variant="body" farg="inkMuted">
            Kontrollera namnet nedan. Hunden kan du lägga till nu eller senare under Hundar.
          </Txt>
          {fel && <InlineBanner text={fel} typ="error" />}
          <Knapp titel="Inte du? Logga ut" variant="text" onPress={tryckLoggaUt} laddar={arbetar === "ut"} />
        </View>
      </Kort>
    );
  }

  const visaGoogle = !!konfig?.google;
  const visaApple = !!konfig?.apple.webb;
  if (!visaGoogle && !visaApple) {
    return null;
  }

  return (
    <Kort>
      <View style={styles.inne}>
        <Txt variant="bodyStrong">Har du ett konto?</Txt>
        <Txt variant="body" farg="inkMuted">
          Logga in så hämtas ditt namn från kontot, och du kommer direkt åt dina jaktlag.
        </Txt>
        {visaGoogle && (
          <Knapp
            titel="Logga in med Google"
            variant="sekundar"
            onPress={() => kor("google", () => loggaInMedGoogle("/"))}
            laddar={arbetar === "google"}
          />
        )}
        {visaApple && <AppleKnapp onPress={() => kor("apple", () => loggaInMedApple("/"))} />}
        {fel && <InlineBanner text={fel} typ="error" />}
      </View>
    </Kort>
  );
}

const styles = StyleSheet.create({
  inne: { gap: avstand.s3 },
});
