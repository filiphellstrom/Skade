import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { avslutaJaktdag, hamtaPagaendeJaktdag } from "@/db/queries/jaktdag";
import { hamtaHundarForJaktdag } from "@/db/queries/hund";
import { hamtaPagaendeDrev } from "@/db/queries/drev";
import {
  hamtaAvslutadeJaktdagarForProfil,
  hamtaDrevMedHundnamnForJaktdag,
} from "@/db/queries/statistik";
import type { Drev, Hund, Jaktdag, JaktdagMedSummering } from "@/db/types";
import { useProfil } from "@/contexts/ProfilContext";
import { synkaLasskarm } from "@/liveActivity";
import { useFarger } from "@/theme/TemaContext";
import { avstand, radie } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Etikett, Felrad, IkonKnapp, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { antalDrevText, formateraDag, formateraVaraktighet, listaNamn } from "@/utils/format";

/**
 * Hem-fliken (sprint 6, designlyftet). "Skade" som rubrik, kugghjul till
 * Inställningar uppe till höger, och sedan antingen:
 *
 * - en pågående jaktdag: kort i brandSoft med jaktmark, antal drev, total
 *   tid och hundar, "Fortsätt jaktdag" och "Avsluta jaktdag". Fortsätt går
 *   till "Välj hundar som ska jaga" om ingen hund är vald än, annars
 *   direkt till timern. Avsluta är inaktiv medan ett drev pågår (samma
 *   spärr som avslutaJaktdag() redan har).
 * - ingen pågående: en stor "Ny jaktdag"-knapp. Appen tillåter bara en
 *   jaktdag åt gången (beslutat 2026-08-23).
 *
 * Under det "Senaste aktivitet": de tre senast avslutade jaktdagarna,
 * tryck för att öppna dem i Historik-fliken.
 *
 * Hundlistan som låg här tidigare finns nu i Hundar-fliken.
 *
 * Datan hämtas om vid varje fokus och när appen aktiveras igen (ett drev
 * kan ha stoppats från låsskärmen). Låsskärmen (Live Activity) synkas mot
 * databasen samtidigt, se src/liveActivity.ts.
 */
interface Pagaende {
  jaktdag: Jaktdag;
  drev: Drev | null;
  hundar: Hund[];
  antalDrev: number;
  totalTid: number;
}

export default function Hem() {
  const f = useFarger();
  const { profil } = useProfil();

  const [laddat, setLaddat] = useState(false);
  const [pagaende, setPagaende] = useState<Pagaende | null>(null);
  const [senaste, setSenaste] = useState<JaktdagMedSummering[]>([]);
  const [avslutar, setAvslutar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const [forgrundRunda, setForgrundRunda] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        setForgrundRunda((n) => n + 1);
      }
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const j = await hamtaPagaendeJaktdag(db, profil.id);
        let p: Pagaende | null = null;
        if (j) {
          const [drev, hundar, allaDrev] = await Promise.all([
            hamtaPagaendeDrev(db, j.id),
            hamtaHundarForJaktdag(db, j.id),
            hamtaDrevMedHundnamnForJaktdag(db, j.id),
          ]);
          const avslutade = allaDrev.filter((d) => d.endTimestamp !== null);
          p = {
            jaktdag: j,
            drev,
            hundar,
            antalDrev: avslutade.length,
            totalTid: avslutade.reduce((s, d) => s + (d.duration ?? 0), 0),
          };
        }
        const avslutadeDagar = await hamtaAvslutadeJaktdagarForProfil(db, profil.id);
        if (!avbruten) {
          setPagaende(p);
          setSenaste(avslutadeDagar.slice(0, 3));
          setLaddat(true);
          // Låsskärmskortet ska spegla databasen (src/liveActivity.ts).
          void synkaLasskarm(profil.id);
        }
      })();
      return () => {
        avbruten = true;
      };
      // forgrundRunda triggar bara omladdning (se ovan).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profil.id, forgrundRunda]),
  );

  const fortsatt = () => {
    if (!pagaende) {
      return;
    }
    const j = pagaende.jaktdag;
    router.push(j.aktivHundId ? `/jaktdag/${j.id}/timer` : `/jaktdag/${j.id}/valj-hund`);
  };

  const avsluta = async () => {
    if (!pagaende || pagaende.drev || avslutar) {
      return;
    }
    setFel(null);
    setAvslutar(true);
    try {
      const db = await getDatabase();
      await avslutaJaktdag(db, pagaende.jaktdag.id);
      setPagaende(null);
      // Jaktdagen är slut: kortet på låsskärmen ska bort.
      void synkaLasskarm(profil.id);
      setSenaste(await hamtaAvslutadeJaktdagarForProfil(db, profil.id).then((r) => r.slice(0, 3)));
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte avsluta jaktdagen. Försök igen.");
    } finally {
      setAvslutar(false);
    }
  };

  if (!laddat) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  const sammanfattning = pagaende
    ? [
        pagaende.antalDrev > 0 ? antalDrevText(pagaende.antalDrev) : null,
        pagaende.totalTid > 0 ? formateraVaraktighet(pagaende.totalTid) : null,
        listaNamn(pagaende.hundar.map((h) => h.namn)) || null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Skarm>
      <View style={styles.topp}>
        <View style={styles.flex1}>
          <Txt variant="display" accessibilityRole="header">
            Skade
          </Txt>
          <Txt variant="body" farg="inkMuted" style={styles.halsning}>
            Hej {profil.namn}. Din jaktdagbok för drivande hund.
          </Txt>
        </View>
        <IkonKnapp
          ikon="installningar"
          etikett="Inställningar"
          onPress={() => router.push("/installningar")}
        />
      </View>

      {pagaende ? (
        <Kort variant="pagaende">
          <Etikett farg="brand">PÅGÅENDE JAKTDAG</Etikett>
          <Txt variant="title2">{pagaende.jaktdag.jaktmark}</Txt>
          <Txt variant="caption" style={styles.sammanfattning}>
            {[pagaende.drev ? "Drev pågår" : null, sammanfattning || (pagaende.drev ? null : "Inga drev än")]
              .filter(Boolean)
              .join(" · ")}
          </Txt>
          <View style={styles.knappar}>
            <Knapp titel="Fortsätt jaktdag" onPress={fortsatt} />
            <Knapp
              titel="Avsluta jaktdag"
              variant="sekundar"
              onPress={avsluta}
              disabled={pagaende.drev !== null}
              laddar={avslutar}
              style={pagaende.drev ? undefined : { backgroundColor: f.surface200 }}
            />
            {pagaende.drev !== null && (
              <Txt variant="caption" farg="ink">
                Stoppa det pågående drevet för att kunna avsluta jaktdagen.
              </Txt>
            )}
            <Felrad text={fel} />
          </View>
        </Kort>
      ) : (
        <Knapp
          titel="Ny jaktdag"
          ikon="plus"
          minHojd={72}
          onPress={() => router.push("/jaktdag/ny")}
          style={styles.nyJaktdag}
        />
      )}

      <View>
        <Etikett>SENASTE AKTIVITET</Etikett>
        {senaste.length === 0 ? (
          <Kort>
            <Txt variant="body" farg="inkMuted">
              Inga avslutade jaktdagar än. De visas här när du har avslutat din första.
            </Txt>
          </Kort>
        ) : (
          <Kort lista>
            {senaste.map((j, i) => (
              <Listrad
                key={j.id}
                forsta={i === 0}
                titel={j.jaktmark}
                undertitel={`${formateraDag(j.datum)} · ${antalDrevText(j.antalDrev)}`}
                hoger={formateraVaraktighet(j.totalDrevtid)}
                onPress={() => router.push(`/historik/${j.id}`)}
              />
            ))}
          </Kort>
        )}
      </View>
    </Skarm>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  flex1: { flex: 1 },
  topp: { flexDirection: "row", alignItems: "flex-start", gap: avstand.s3 },
  halsning: { marginTop: avstand.s2 },
  sammanfattning: { marginTop: avstand.s1 },
  knappar: { marginTop: avstand.s4, gap: avstand.s3 },
  nyJaktdag: { borderRadius: radie.lg },
});
