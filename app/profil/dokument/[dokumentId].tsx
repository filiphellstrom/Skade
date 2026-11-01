import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import {
  hamtaDokument,
  raderaDokument,
  sattDokumentNotis,
  skapaDokument,
  uppdateraDokument,
} from "@/db/queries/dokument";
import type { Dokument, DokumentFiltyp, DokumentTyp, UnixTimestamp } from "@/db/types";
import { useProfil } from "@/contexts/ProfilContext";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie } from "@/theme/tokens";
import { DatumRad, HjulArk, midnatt } from "@/components/HjulVal";
import { FilVisare } from "@/components/FilVisare";
import { InlineBanner } from "@/components/InlineBanner";
import { Ikon } from "@/components/ui/Ikon";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Etikett, Falt, Felrad, Skarm, TillbakaKnapp, ValChip } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { DOKUMENT_TYPER, PAMINNELSE_DAGAR, typTitel } from "@/utils/dokumentStatus";
import { BehorighetSaknas, filUri, taBortFil, valjOchSparaBild, valjOchSparaDokumentFil } from "@/utils/filer";
import { avbokaPaminnelse, schemalaggPaminnelse } from "@/utils/paminnelser";

/**
 * Ett dokument på profilen (designen 2026-10-29, byggd 2026-11-01).
 * `dokumentId` "ny" skapar ett nytt.
 *
 * - Typ: Jägarexamen, Vapenlicens, Försäkring, Övrigt. Namnet följer typen
 *   tills man skriver ett eget (t.ex. "Jaktkort 2026").
 * - Fil: ta en bild med kameran, välj en bild eller välj en bild/PDF i
 *   Filer. Tryck på förhandsvisningen för att se den i helskärm.
 * - "Inget slutdatum" (t.ex. jägarexamen) eller "Giltigt till" med
 *   Apples datumhjul och en påminnelse 7, 30 eller 60 dagar före, kl 09:00.
 *
 * Inget sparas förrän man trycker Spara. En fil som valts men aldrig
 * sparats tas bort när man lämnar skärmen.
 */

function standardSlutdatum(): UnixTimestamp {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return midnatt(d);
}

export default function DokumentSkarm() {
  const { farger } = useTema();
  const { profil } = useProfil();
  const { dokumentId } = useLocalSearchParams<{ dokumentId: string }>();
  const nytt = dokumentId === "ny";

  const [laddat, setLaddat] = useState(nytt);
  const [original, setOriginal] = useState<Dokument | null>(null);
  const [typ, setTyp] = useState<DokumentTyp>("vapenlicens");
  const [namn, setNamn] = useState(typTitel("vapenlicens"));
  const [egetNamn, setEgetNamn] = useState(false);
  const [fil, setFil] = useState<string | null>(null);
  const [filtyp, setFiltyp] = useState<DokumentFiltyp | null>(null);
  const [utanSlut, setUtanSlut] = useState(false);
  const [giltigTill, setGiltigTill] = useState<UnixTimestamp>(standardSlutdatum());
  const [dagar, setDagar] = useState(30);

  const [filVal, setFilVal] = useState(false);
  const [visa, setVisa] = useState(false);
  const [arbetar, setArbetar] = useState(false);
  const [sparar, setSparar] = useState(false);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Filer som valts här men inte sparats ska bort när skärmen stängs.
  const sparadFil = useRef<string | null>(null);
  const valdFil = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (valdFil.current && valdFil.current !== sparadFil.current) {
        taBortFil(valdFil.current);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (nytt) {
        return;
      }
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const d = await hamtaDokument(db, dokumentId);
        if (avbruten || !d) {
          return;
        }
        setOriginal(d);
        setTyp(d.typ);
        setNamn(d.namn);
        setEgetNamn(d.namn !== typTitel(d.typ));
        setFil(d.fil);
        setFiltyp(d.filtyp);
        sparadFil.current = d.fil;
        valdFil.current = d.fil;
        setUtanSlut(d.giltigTill === null);
        if (d.giltigTill !== null) {
          setGiltigTill(d.giltigTill);
        }
        setDagar(d.paminnelseDagar);
        setLaddat(true);
      })();
      return () => {
        avbruten = true;
      };
    }, [dokumentId, nytt]),
  );

  const valjTyp = (t: DokumentTyp) => {
    setTyp(t);
    if (!egetNamn) {
      setNamn(typTitel(t));
    }
    // Jägarexamen gäller för alltid.
    if (t === "jagarexamen" && nytt) {
      setUtanSlut(true);
    }
  };

  const nyFil = (ny: string, nyTyp: DokumentFiltyp) => {
    if (valdFil.current && valdFil.current !== sparadFil.current) {
      taBortFil(valdFil.current);
    }
    valdFil.current = ny;
    setFil(ny);
    setFiltyp(nyTyp);
  };

  const hamta = async (kalla: "kamera" | "bilder" | "filer") => {
    setFel(null);
    setArbetar(true);
    try {
      if (kalla === "filer") {
        const r = await valjOchSparaDokumentFil();
        if (r) {
          nyFil(r.fil, r.filtyp);
        }
      } else {
        const r = await valjOchSparaBild(kalla === "kamera" ? "kamera" : "bibliotek", "dokument");
        if (r) {
          nyFil(r, "bild");
        }
      }
      setFilVal(false);
    } catch (e) {
      setFel(e instanceof BehorighetSaknas ? e.message : "Kunde inte spara filen. Försök igen.");
    } finally {
      setArbetar(false);
    }
  };

  const tillbaka = () => (router.canGoBack() ? router.back() : router.replace("/profil"));

  const spara = async () => {
    const namnet = namn.trim() || typTitel(typ);
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      const falt = {
        typ,
        namn: namnet,
        fil,
        filtyp: fil ? filtyp : null,
        giltigTill: utanSlut ? null : giltigTill,
        paminnelseDagar: dagar,
      };
      let dok: Dokument;
      if (original) {
        await uppdateraDokument(db, original.id, falt);
        dok = { ...original, ...falt };
      } else {
        dok = await skapaDokument(db, profil.id, falt);
      }
      // Filen är sparad - den gamla (om den byttes) kan tas bort.
      if (sparadFil.current && sparadFil.current !== fil) {
        taBortFil(sparadFil.current);
      }
      sparadFil.current = fil;

      await avbokaPaminnelse(original?.notisId ?? null);
      const p = await schemalaggPaminnelse(dok);
      await sattDokumentNotis(db, dok.id, p.notisId);

      if (p.notisId === null && p.orsak === "nekad") {
        setOriginal({ ...dok, notisId: null });
        setInfo(
          "Dokumentet är sparat, men Skade får inte visa notiser, så du får ingen påminnelse. Slå på notiser under Inställningar > Skade > Notiser.",
        );
        setSparar(false);
        return;
      }
      tillbaka();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte spara dokumentet.");
      setSparar(false);
    }
  };

  const radera = async () => {
    if (!original) {
      return;
    }
    setSparar(true);
    try {
      const db = await getDatabase();
      await avbokaPaminnelse(original.notisId);
      await raderaDokument(db, original.id);
      taBortFil(original.fil);
      if (valdFil.current !== original.fil) {
        taBortFil(valdFil.current);
      }
      sparadFil.current = null;
      valdFil.current = null;
      tillbaka();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte radera dokumentet.");
      setSparar(false);
    }
  };

  if (!laddat) {
    return (
      <View style={[styles.laddar, { backgroundColor: farger.surface100 }]}>
        <ActivityIndicator size="large" color={farger.brand} />
      </View>
    );
  }

  const uri = filUri(fil);
  const paminnelseText = `Du får en notis på telefonen ${dagar} dagar före slutdatum, klockan 09:00.`;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Skarm
        sidfot={
          info ? (
            <Knapp titel="Klar" onPress={tillbaka} />
          ) : (
            <Knapp titel="Spara" onPress={spara} laddar={sparar} />
          )
        }
      >
        <TillbakaKnapp />
        <Txt variant="title1" accessibilityRole="header">
          {namn.trim() || typTitel(typ)}
        </Txt>

        {info && <InlineBanner text={info} typ="info" />}

        <View>
          <Etikett>TYP</Etikett>
          <View style={styles.chips}>
            {DOKUMENT_TYPER.map((t) => (
              <ValChip key={t.typ} titel={t.titel} vald={typ === t.typ} onPress={() => valjTyp(t.typ)} />
            ))}
          </View>
        </View>

        <Falt
          etikett="Namn"
          value={namn}
          onChangeText={(v) => {
            setNamn(v);
            setEgetNamn(v.trim() !== "" && v.trim() !== typTitel(typ));
          }}
          placeholder={typTitel(typ)}
          autoCapitalize="sentences"
        />

        <View style={styles.filBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={uri ? "Visa dokumentet i helskärm" : "Lägg till en bild av dokumentet"}
            onPress={() => (uri ? setVisa(true) : setFilVal(true))}
            style={[styles.forhand, { backgroundColor: farger.surface300 }]}
          >
            {uri && filtyp === "bild" ? (
              <Image source={{ uri }} style={styles.forhandBild} resizeMode="cover" />
            ) : (
              <View style={styles.forhandTom}>
                <Ikon namn="dokument" farg={farger.inkMuted} storlek={48} linje={1.5} />
                <Txt variant="caption" farg="inkMuted">
                  {uri ? "PDF · tryck för att öppna" : "Bild av dokumentet"}
                </Txt>
              </View>
            )}
          </Pressable>
          <View style={styles.filKnappar}>
            {Platform.OS !== "web" && (
              <Knapp
                titel="Ta bild"
                ikon="kamera"
                variant="sekundar"
                fullBredd={false}
                style={styles.flex}
                onPress={() => hamta("kamera")}
                disabled={arbetar}
              />
            )}
            <Knapp
              titel="Välj bild eller PDF"
              variant="sekundar"
              fullBredd={false}
              style={styles.flex}
              onPress={() => setFilVal(true)}
              laddar={arbetar}
            />
          </View>
        </View>

        <Kort lista>
          <View style={styles.vaxelRad}>
            <View style={styles.flex}>
              <Txt variant="heading">Inget slutdatum</Txt>
              <Txt variant="caption" farg="inkMuted">
                Till exempel jägarexamen
              </Txt>
            </View>
            <Switch
              value={utanSlut}
              onValueChange={setUtanSlut}
              trackColor={{ false: farger.borderStrong, true: farger.brand }}
              ios_backgroundColor={farger.borderStrong}
              accessibilityLabel="Inget slutdatum"
            />
          </View>
          {utanSlut ? (
            <View style={[styles.paminnelse, { borderTopColor: farger.border }]}>
              <Txt variant="caption" farg="inkMuted">
                Ingen påminnelse behövs när dokumentet inte har något slutdatum.
              </Txt>
            </View>
          ) : (
            <>
              <DatumRad
                iKort
                forsta={false}
                titel="Giltigt till"
                varde={giltigTill}
                onChange={setGiltigTill}
              />
              <View style={[styles.paminnelse, { borderTopColor: farger.border }]}>
                <Txt variant="heading">Påminn mig</Txt>
                <View style={styles.dagar}>
                  {PAMINNELSE_DAGAR.map((d) => (
                    <View key={d} style={styles.flex}>
                      <ValChip fyll titel={`${d} dagar`} vald={dagar === d} onPress={() => setDagar(d)} />
                    </View>
                  ))}
                </View>
                <Txt variant="caption" farg="inkMuted">
                  {Platform.OS === "web"
                    ? "Påminnelser fungerar bara i appen på telefonen."
                    : paminnelseText}
                </Txt>
              </View>
            </>
          )}
        </Kort>

        <Felrad text={fel} />

        {original && (
          <View style={styles.radera}>
            {!bekraftaRadera ? (
              <Knapp titel="Radera dokument" variant="faraLiten" onPress={() => setBekraftaRadera(true)} />
            ) : (
              <>
                <InlineBanner
                  text={`${original.namn} och bilden av det tas bort från telefonen. Det går inte att ångra.`}
                  typ="error"
                />
                <Knapp titel="Ja, radera" variant="fara" onPress={radera} laddar={sparar} />
                <Knapp titel="Avbryt" variant="sekundar" onPress={() => setBekraftaRadera(false)} />
              </>
            )}
          </View>
        )}
      </Skarm>

      <HjulArk oppen={filVal} titel="Lägg till fil" onStang={() => setFilVal(false)} stangTitel="Avbryt">
        <View style={styles.valKnappar}>
          <Knapp titel="Välj bild" variant="sekundar" onPress={() => hamta("bilder")} disabled={arbetar} />
          <Knapp titel="Välj PDF eller bild i Filer" variant="sekundar" onPress={() => hamta("filer")} disabled={arbetar} />
        </View>
      </HjulArk>
      <FilVisare uri={uri} filtyp={filtyp} oppen={visa} onStang={() => setVisa(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  filBlock: { gap: avstand.s3 },
  forhand: { height: 220, borderRadius: radie.lg, overflow: "hidden" },
  forhandBild: { width: "100%", height: "100%" },
  forhandTom: { flex: 1, alignItems: "center", justifyContent: "center", gap: avstand.s2 },
  filKnappar: { flexDirection: "row", gap: avstand.s3 },
  vaxelRad: {
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s3,
    minHeight: 72,
    paddingHorizontal: avstand.s4,
    paddingVertical: avstand.s2,
  },
  paminnelse: { borderTopWidth: 1, padding: avstand.s4, gap: avstand.s2 },
  dagar: { flexDirection: "row", gap: avstand.s2 },
  radera: { gap: avstand.s3, alignItems: "stretch" },
  valKnappar: { gap: avstand.s3 },
});
