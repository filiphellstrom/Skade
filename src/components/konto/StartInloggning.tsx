import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { avstand } from "@/theme/tokens";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Txt } from "@/components/ui/Txt";
import { kontoKlient } from "@/konto/klient";
import { loggaUt } from "@/konto/inloggning";
import { InloggKnappar } from "./InloggKnappar";

/** Apple kan utelämna e-postadressen; servern sparar då en platshållare som inte ska visas. */
function visaEpost(epost: string): string | null {
  return epost.endsWith("@apple.skade.invalid") ? null : epost;
}

/**
 * Inloggning direkt på startskärmen, på webben (2026-11-16) och i appen
 * (samma dag). Förut fick man fylla i namn och hund och sedan gå via
 * Profil för att logga in.
 *
 * Inloggad: namnet hämtas från kontot och hunden blir frivillig (se
 * OnboardingScreen). Går servern inte att nå visas ingen ruta alls, och
 * startskärmen fungerar som förut.
 */
export function StartInloggning({ onKonto }: { onKonto: (konto: { namn: string } | null) => void }) {
  const { data: session, isPending, refetch } = kontoKlient.useSession();
  const [knapparVisas, setKnapparVisas] = useState(false);
  const [arbetar, setArbetar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const anvandare = session?.user ?? null;
  const namn = anvandare?.name?.trim() ?? "";
  useEffect(() => {
    if (isPending) return;
    onKonto(anvandare ? { namn } : null);
    // onKonto kommer från föräldern och byts inte; bara inloggningen styr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, anvandare?.id, namn]);

  const tryckLoggaUt = async () => {
    setFel(null);
    setArbetar(true);
    const ok = await loggaUt();
    setArbetar(false);
    if (ok) refetch();
    else setFel("Kunde inte logga ut. Försök igen.");
  };

  if (isPending) {
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
          <Knapp titel="Inte du? Logga ut" variant="text" onPress={tryckLoggaUt} laddar={arbetar} />
        </View>
      </Kort>
    );
  }

  return (
    <Kort style={knapparVisas ? undefined : styles.dold}>
      <View style={styles.inne}>
        <Txt variant="bodyStrong">Har du ett konto?</Txt>
        <Txt variant="body" farg="inkMuted">
          Logga in så hämtas ditt namn från kontot, och du kommer direkt åt dina jaktlag.
        </Txt>
        <InloggKnappar tillbaka="/" tystUtanServer onRender={setKnapparVisas} />
      </View>
    </Kort>
  );
}

const styles = StyleSheet.create({
  inne: { gap: avstand.s3 },
  dold: { display: "none" },
});
