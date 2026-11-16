import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { avstand } from "@/theme/tokens";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { kontoKlient } from "@/konto/klient";
import { appleFinns, hamtaKontoKonfig, loggaInMedApple, loggaInMedGoogle } from "@/konto/inloggning";
import type { InloggResultat, KontoKonfig } from "@/konto/inloggning";
import { AppleKnapp } from "./AppleKnapp";

/**
 * Knapparna Logga in med Apple och Google, för startskärmen och jaktlagen
 * (2026-11-16), så att man inte behöver gå via Profil. Profilens KontoKort
 * har kvar sina egna knappar.
 *
 * Bara de sätt servern har uppsatta visas (/api/konfig): Apple i appen om
 * telefonen har Sign in with Apple, Apple på webben om servern har Apples
 * webbuppgifter, Google överallt. Går servern inte att nå visas en rad om
 * det, eller ingenting om tystUtanServer är satt (startskärmen ska fungera
 * som förut utan täckning).
 *
 * tillbaka: dit webbläsaren (webben) eller länken skade:// (appen) leder
 * efter Google, och efter Apple på webben. Apple i appen stannar i appen.
 */
export function InloggKnappar({
  tillbaka,
  tystUtanServer = false,
  onRender,
}: {
  tillbaka: string;
  tystUtanServer?: boolean;
  /** Säger till om några knappar visas, så föräldern kan dölja sin ruta. */
  onRender?: (visas: boolean) => void;
}) {
  const { refetch } = kontoKlient.useSession();
  // undefined = hämtas, null = servern gick inte att nå.
  const [konfig, setKonfig] = useState<KontoKonfig | null | undefined>(undefined);
  const [appleOk, setAppleOk] = useState(false);
  const [arbetar, setArbetar] = useState<string | null>(null);
  const [fel, setFel] = useState<string | null>(null);

  useEffect(() => {
    let avbruten = false;
    Promise.all([hamtaKontoKonfig(), appleFinns()])
      .then(([k, a]) => {
        if (avbruten) return;
        setKonfig(k);
        setAppleOk(a);
      })
      .catch(() => {
        if (!avbruten) setKonfig(null);
      });
    return () => {
      avbruten = true;
    };
  }, []);

  const visaApple = Platform.OS === "web" ? !!konfig?.apple.webb : appleOk && !!konfig?.apple.app;
  const visaGoogle = !!konfig?.google;
  const visas = visaApple || visaGoogle || (konfig === null && !tystUtanServer);

  useEffect(() => {
    if (konfig !== undefined) onRender?.(visas);
  }, [konfig, visas, onRender]);

  const kor = async (vad: string, jobb: () => Promise<InloggResultat>) => {
    if (arbetar) return;
    setFel(null);
    setArbetar(vad);
    const r = await jobb();
    setArbetar(null);
    if (r.ok) {
      // Apple i appen loggar in utan att lämna appen; sessionen hämtas om.
      // (Google och Apple på webben lämnar sidan och kommer tillbaka.)
      refetch();
    } else if (!r.avbruten) {
      setFel(r.fel ?? "Något gick fel. Försök igen.");
    }
  };

  if (konfig === undefined || !visas) {
    return null;
  }

  return (
    <View style={styles.knappar}>
      {konfig === null && (
        <InlineBanner text="Kan inte nå servern just nu. Försök igen när du har täckning." typ="info" />
      )}
      {visaApple && <AppleKnapp onPress={() => kor("apple", () => loggaInMedApple(tillbaka))} />}
      {visaGoogle && (
        <Knapp
          titel="Logga in med Google"
          variant="sekundar"
          onPress={() => kor("google", () => loggaInMedGoogle(tillbaka))}
          laddar={arbetar === "google"}
          disabled={!!arbetar}
        />
      )}
      {fel && <InlineBanner text={fel} typ="error" />}
    </View>
  );
}

const styles = StyleSheet.create({
  knappar: { gap: avstand.s3 },
});
