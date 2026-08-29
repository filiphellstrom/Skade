import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { avslutaJaktdag, hamtaPagaendeJaktdag } from "@/db/queries/jaktdag";
import { hamtaHundarMedSenasteJaktdag } from "@/db/queries/hund";
import { hamtaPagaendeDrev } from "@/db/queries/drev";
import { useProfil } from "@/contexts/ProfilContext";
import type { Drev, HundMedSenasteJaktdag, Jaktdag } from "@/db/types";
import { BigButton } from "@/components/BigButton";
import { InfoRow } from "@/components/InfoRow";
import { InlineBanner } from "@/components/InlineBanner";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useThemeColors } from "@/theme/colors";

/**
 * Huvudskärm (Sprint 2). Två lägen beroende på om profilen har en
 * pågående jaktdag (status 'pagar'):
 *
 * - Ingen pågående: visar "Ny jaktdag"-knappen som förut.
 * - En pågående: "Ny jaktdag" döljs (appen tillåter bara en jaktdag åt
 *   gången, beslutat 2026-08-23) och ett "Fortsätt jaktdag"-kort visas
 *   istället. Fortsätt-knappen navigerar till "Välj hund" om aktivHundId
 *   fortfarande är null (t.ex. om man tryckte tillbaka innan hundvalet
 *   slutfördes) annars direkt till timern - se hamtaPagaendeJaktdag().
 *
 * "Avsluta jaktdag" finns numera även här (inte bara på timern) - grå och
 * inaktiv om ett drev pågår (samma spärr som avslutaJaktdag() redan
 * kastar fel för, se Sprint 1), annars tryckbar direkt utan att behöva gå
 * in via "Fortsätt jaktdag" → Timer.
 *
 * Under det: en enkel hundlista med senaste jaktdag + total drevtid
 * (hamtaHundarMedSenasteJaktdag(), fanns redan som query sedan tidigare).
 * Hunden vars drev pågår just nu visar "Drev pågår" istället för sin
 * totala drevtid, se pagaendeDrev.hundId nedan.
 *
 * Sprint 3: varje hundrad är nu tryckbar och öppnar app/hund/[hundId].tsx
 * för redigering/arkivering/radering (InfoRow tar en valfri onPress-prop).
 * En liten länk under hundlistan leder vidare till app/hund/arkiverade.tsx.
 *
 * Datan hämtas om varje gång skärmen får fokus (useFocusEffect), inte bara
 * vid första monteringen. Orsak (bugg hittad av Filip 2026-08-23): en
 * router.back() hit - t.ex. efter att ha lagt till en hund via
 * huvudskärmens "+ Lägg till hund"-länk - återanvänder samma redan
 * monterade skärm-instans istället för att skapa en ny, så en vanlig
 * useEffect med tomt beroende hade visat kvar den gamla listan. Bara
 * router.replace() (t.ex. efter avslutaJaktdag()) skapar en ny instans
 * och råkade därför alltid visa färsk data.
 */
export default function HuvudSkarm() {
  const colors = useThemeColors();
  const { profil } = useProfil();

  const [pagaende, setPagaende] = useState<Jaktdag | null>(null);
  const [hundar, setHundar] = useState<HundMedSenasteJaktdag[] | null>(null);
  const [pagaendeDrev, setPagaendeDrev] = useState<Drev | null>(null);
  const [avslutar, setAvslutar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const [p, h] = await Promise.all([
          hamtaPagaendeJaktdag(db, profil.id),
          hamtaHundarMedSenasteJaktdag(db, profil.id),
        ]);
        const drev = p ? await hamtaPagaendeDrev(db, p.id) : null;
        if (!avbruten) {
          setPagaende(p);
          setHundar(h);
          setPagaendeDrev(drev);
        }
      })();

      return () => {
        avbruten = true;
      };
    }, [profil.id]),
  );

  const fortsattJaktdag = () => {
    if (!pagaende) {
      return;
    }
    const mal = pagaende.aktivHundId
      ? `/jaktdag/${pagaende.id}/timer`
      : `/jaktdag/${pagaende.id}/valj-hund`;
    router.push(mal);
  };

  const avsluta = async () => {
    if (!pagaende || pagaendeDrev || avslutar) {
      return;
    }
    setFel(null);
    setAvslutar(true);
    try {
      const db = await getDatabase();
      await avslutaJaktdag(db, pagaende.id);
      setPagaende(null);
      setPagaendeDrev(null);
    } catch (e) {
      setFel(
        e instanceof Error ? e.message : "Kunde inte avsluta jaktdagen.",
      );
    } finally {
      setAvslutar(false);
    }
  };

  if (hundar === null) {
    return (
      <View style={[styles.laddar, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.innehall}
    >
      <View>
        <Text style={[styles.halsning, { color: colors.textMuted }]}>
          Hej, {profil.namn}
        </Text>
        <Text style={[styles.rubrik, { color: colors.text }]}>Skade</Text>
      </View>

      {pagaende ? (
        <View style={styles.block}>
          <InfoRow
            titel={pagaende.jaktmark}
            undertitel={new Date(pagaende.datum * 1000).toLocaleDateString(
              "sv-SE",
              { weekday: "long", day: "numeric", month: "long" },
            )}
            hoger="Pågår"
          />
          <BigButton label="Fortsätt jaktdag" onPress={fortsattJaktdag} />

          {fel && <InlineBanner text={fel} typ="error" />}

          <BigButton
            label="Avsluta jaktdag"
            variant="secondary"
            onPress={avsluta}
            disabled={pagaendeDrev !== null}
            laddar={avslutar}
          />
          {pagaendeDrev !== null && (
            <Text style={[styles.avslutaHint, { color: colors.textMuted }]}>
              Stoppa det pågående drevet för att kunna avsluta jaktdagen.
            </Text>
          )}
        </View>
      ) : (
        <BigButton
          label="Ny jaktdag"
          onPress={() => router.push("/jaktdag/ny")}
        />
      )}

      <View style={styles.block}>
        <Text style={[styles.delrubrik, { color: colors.text }]}>
          Dina hundar
        </Text>

        <View style={styles.lista}>
          {hundar.map((h) => (
            <InfoRow
              key={h.hundId}
              titel={h.namn}
              undertitel={
                h.senasteJaktDatum
                  ? `Senaste jaktdag: ${new Date(
                      h.senasteJaktDatum * 1000,
                    ).toLocaleDateString("sv-SE", {
                      day: "numeric",
                      month: "long",
                    })}`
                  : "Ingen jaktdag än"
              }
              hoger={
                pagaendeDrev?.hundId === h.hundId
                  ? "Drev pågår"
                  : h.totalDrevtid > 0
                    ? formateraTid(h.totalDrevtid)
                    : undefined
              }
              onPress={() => router.push(`/hund/${h.hundId}`)}
            />
          ))}
        </View>

        <BigButton
          label="+ Lägg till hund"
          variant="secondary"
          onPress={() => router.push("/hund/ny")}
        />

        <Text
          accessibilityRole="link"
          onPress={() => router.push("/hund/arkiverade")}
          style={[styles.arkivLank, { color: colors.textMuted }]}
        >
          Visa arkiverade hundar
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  innehall: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 28,
  },
  halsning: {
    fontSize: 16,
    fontWeight: "600",
  },
  rubrik: {
    fontSize: 40,
    fontWeight: "800",
    marginTop: 4,
  },
  block: {
    gap: 12,
  },
  delrubrik: {
    fontSize: 18,
    fontWeight: "700",
  },
  lista: {
    gap: 10,
  },
  avslutaHint: {
    fontSize: 13,
    textAlign: "center",
  },
  arkivLank: {
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
    textAlign: "center",
    paddingVertical: 10,
  },
});
