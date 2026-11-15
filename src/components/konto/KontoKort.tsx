import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useProfil } from "@/contexts/ProfilContext";
import { avstand } from "@/theme/tokens";
import { InlineBanner } from "@/components/InlineBanner";
import { Etikett } from "@/components/ui/Delar";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Txt } from "@/components/ui/Txt";
import { kontoKlient } from "@/konto/klient";
import {
  appleFinns,
  hamtaKontoKonfig,
  kopplaGoogle,
  loggaInMedApple,
  loggaInMedGoogle,
  loggaUt,
  raderaKonto,
} from "@/konto/inloggning";
import type { InloggResultat, KontoKonfig } from "@/konto/inloggning";
import { AppleKnapp } from "./AppleKnapp";

/** Apple kan utelämna e-postadressen; servern sparar då en platshållare som inte ska visas. */
function visaEpost(epost: string): string | null {
  return epost.endsWith("@apple.skade.invalid") ? null : epost;
}

/**
 * Konto på profilsidan (steg 1 av server och inloggning, 2026-11-11).
 *
 * Kontot är frivilligt: appen fungerar som förut utan det, och drev, hundar
 * och dokument ligger kvar i telefonen. Kontot behövs för det som delas i
 * ett jaktlag. Inloggning med Apple (iOS egen ruta) eller Google. Knapparna
 * visas bara för de sätt servern har uppsatta (/api/konfig).
 */
export function KontoKort() {
  const { profil } = useProfil();
  const { data: session, isPending, refetch } = kontoKlient.useSession();
  // undefined = hämtas, null = servern gick inte att nå.
  const [konfig, setKonfig] = useState<KontoKonfig | null | undefined>(undefined);
  const [appleOk, setAppleOk] = useState(false);
  const [googleKopplat, setGoogleKopplat] = useState<boolean | null>(null);
  const [arbetar, setArbetar] = useState<string | null>(null);
  const [fel, setFel] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [bekraftaRadering, setBekraftaRadering] = useState(false);

  const laddaKonfig = useCallback(async () => {
    setKonfig(undefined);
    const [k, a] = await Promise.all([hamtaKontoKonfig(), appleFinns()]);
    setKonfig(k);
    setAppleOk(a);
  }, []);

  useEffect(() => {
    laddaKonfig();
  }, [laddaKonfig]);

  const anvandare = session?.user ?? null;
  const anvandarId = anvandare?.id ?? null;
  const serverNamn = anvandare?.name ?? "";

  // Apple skickar bara namnet första gången. Saknas det tar vi namnet från profilen.
  useEffect(() => {
    if (anvandarId && serverNamn.trim() === "" && profil.namn.trim() !== "") {
      kontoKlient.updateUser({ name: profil.namn.trim() }).catch(() => {});
    }
  }, [anvandarId, serverNamn, profil.namn]);

  useEffect(() => {
    if (!anvandarId) {
      setGoogleKopplat(null);
      return;
    }
    let avbruten = false;
    kontoKlient
      .listAccounts()
      .then(({ data }) => {
        if (!avbruten) {
          setGoogleKopplat(!!data?.some((k) => k.providerId === "google"));
        }
      })
      .catch(() => {});
    return () => {
      avbruten = true;
    };
  }, [anvandarId]);

  const kor = async (vad: string, jobb: () => Promise<InloggResultat>) => {
    if (arbetar) {
      return;
    }
    setFel(null);
    setInfo(null);
    setArbetar(vad);
    const r = await jobb();
    setArbetar(null);
    if (r.ok) {
      refetch();
    } else if (!r.avbruten) {
      setFel(r.fel ?? "Något gick fel. Försök igen.");
    }
  };

  const tryckLoggaUt = async () => {
    setFel(null);
    setInfo(null);
    setArbetar("ut");
    const ok = await loggaUt();
    setArbetar(null);
    setBekraftaRadering(false);
    if (!ok) {
      setFel("Kunde inte logga ut. Kontrollera täckningen och försök igen.");
    }
  };

  const tryckRadera = async () => {
    setFel(null);
    setInfo(null);
    setArbetar("radera");
    const r = await raderaKonto();
    setArbetar(null);
    setBekraftaRadering(false);
    if (r === "raderat") {
      refetch();
      setInfo("Kontot är raderat. Det som finns i telefonen ligger kvar.");
    } else if (r === "logga-in-igen") {
      await loggaUt();
      setInfo("För att radera kontot behöver du logga in igen först. Logga in och tryck sedan på Radera konto.");
    } else {
      setFel("Kunde inte radera kontot. Kontrollera täckningen och försök igen.");
    }
  };

  const visaApple = Platform.OS === "web" ? !!konfig?.apple.webb : appleOk && !!konfig?.apple.app;
  const visaGoogle = !!konfig?.google;

  return (
    <View>
      <Etikett>KONTO</Etikett>
      {anvandare ? (
        <View style={styles.block}>
          <Kort>
            <Txt variant="heading">{serverNamn.trim() || profil.namn}</Txt>
            {visaEpost(anvandare.email) && (
              <Txt variant="body" farg="inkMuted">
                {visaEpost(anvandare.email)}
              </Txt>
            )}
            <Txt variant="caption" farg="inkMuted" style={styles.luft}>
              Inloggad. Kontot används för jaktlag. Drev, hundar och dokument ligger kvar i telefonen.
            </Txt>
          </Kort>
          {info && <InlineBanner text={info} typ="info" />}
          {fel && <InlineBanner text={fel} />}
          {visaGoogle && googleKopplat === false && (
            <Knapp
              titel="Koppla Google-konto"
              variant="sekundar"
              onPress={() => kor("koppla", kopplaGoogle)}
              laddar={arbetar === "koppla"}
              disabled={!!arbetar}
            />
          )}
          {!bekraftaRadering ? (
            <>
              <Knapp
                titel="Logga ut"
                variant="sekundar"
                onPress={tryckLoggaUt}
                laddar={arbetar === "ut"}
                disabled={!!arbetar}
              />
              <Knapp
                titel="Radera konto"
                variant="faraLiten"
                onPress={() => setBekraftaRadering(true)}
                disabled={!!arbetar}
              />
            </>
          ) : (
            <>
              <InlineBanner text="Kontot och allt som hör till det på servern tas bort permanent. Det går inte att ångra. Drev, hundar och dokument i telefonen påverkas inte." />
              <Knapp
                titel="Ja, radera kontot"
                variant="fara"
                onPress={tryckRadera}
                laddar={arbetar === "radera"}
              />
              <Knapp
                titel="Avbryt"
                variant="sekundar"
                onPress={() => setBekraftaRadering(false)}
                disabled={!!arbetar}
              />
            </>
          )}
        </View>
      ) : (
        <View style={styles.block}>
          <Kort>
            <Txt variant="body" farg="inkMuted">
              Med ett konto kan du vara med i ett jaktlag. Appen fungerar som vanligt utan konto, och drev,
              hundar och dokument ligger kvar i telefonen.
            </Txt>
          </Kort>
          {info && <InlineBanner text={info} typ="info" />}
          {fel && <InlineBanner text={fel} />}
          {konfig === null && (
            <>
              <InlineBanner text="Kan inte nå servern just nu. Försök igen när du har täckning." typ="info" />
              <Knapp titel="Försök igen" variant="sekundar" onPress={laddaKonfig} />
            </>
          )}
          {konfig && !visaApple && !visaGoogle && (
            <InlineBanner text="Inloggningen är inte påslagen här än." typ="info" />
          )}
          {visaApple && !isPending && <AppleKnapp onPress={() => kor("apple", loggaInMedApple)} />}
          {visaGoogle && !isPending && (
            <Knapp
              titel="Logga in med Google"
              variant="sekundar"
              onPress={() => kor("google", loggaInMedGoogle)}
              laddar={arbetar === "google"}
              disabled={!!arbetar}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: avstand.s3 },
  luft: { marginTop: avstand.s2 },
});
