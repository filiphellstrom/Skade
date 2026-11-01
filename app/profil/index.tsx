import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { uppdateraProfil, uppdateraProfilBild } from "@/db/queries/profil";
import { hamtaDokumentForProfil } from "@/db/queries/dokument";
import type { Dokument } from "@/db/types";
import { useProfil } from "@/contexts/ProfilContext";
import { avstand } from "@/theme/tokens";
import { BildVal } from "@/components/BildVal";
import { DokumentStatusChip } from "@/components/DokumentStatusChip";
import { Avatar } from "@/components/ui/Avatar";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Etikett, Falt, Felrad, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { dokumentStatus } from "@/utils/dokumentStatus";
import { taBortFil } from "@/utils/filer";

/**
 * Profil (designen 2026-10-29, byggd 2026-11-01). Nås via den runda
 * profilknappen på Hem, ligger i rot-stacken utan flikfält.
 *
 * Profilbild (sparas direkt vid val), namn och e-post (sparas när man
 * lämnar fältet) och dokumentlistan. Dokument sorteras med de som går ut
 * först överst. Allt ligger bara lokalt på telefonen.
 */
export default function Profil() {
  const { profil, uppdateraProfilFranDatabas } = useProfil();
  const [namn, setNamn] = useState(profil.namn);
  const [epost, setEpost] = useState(profil.mailadress ?? "");
  const [dokument, setDokument] = useState<Dokument[]>([]);
  const [bildVal, setBildVal] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const d = await hamtaDokumentForProfil(db, profil.id);
        if (!avbruten) {
          setDokument(d);
        }
      })();
      return () => {
        avbruten = true;
      };
    }, [profil.id]),
  );

  const sparaUppgifter = async () => {
    setFel(null);
    const nyttNamn = namn.trim();
    if (!nyttNamn) {
      setFel("Namnet kan inte vara tomt.");
      setNamn(profil.namn);
      return;
    }
    const nyEpost = epost.trim() || null;
    if (nyttNamn === profil.namn && nyEpost === profil.mailadress) {
      return;
    }
    try {
      const db = await getDatabase();
      await uppdateraProfil(db, profil.id, { namn: nyttNamn, mailadress: nyEpost });
      await uppdateraProfilFranDatabas();
    } catch {
      setFel("Kunde inte spara. Försök igen.");
    }
  };

  const sattBild = async (bild: string | null) => {
    const db = await getDatabase();
    await uppdateraProfilBild(db, profil.id, bild);
    taBortFil(profil.bild);
    await uppdateraProfilFranDatabas();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Skarm>
        <TillbakaKnapp />

        <View style={styles.topp}>
          <Avatar bild={profil.bild} namn={profil.namn} storlek={112} onByt={() => setBildVal(true)} />
          <Txt variant="title1" accessibilityRole="header" style={styles.namn}>
            {profil.namn}
          </Txt>
          <Knapp
            variant="text"
            titel={profil.bild ? "Byt profilbild" : "Lägg till profilbild"}
            onPress={() => setBildVal(true)}
            style={styles.centrerad}
          />
        </View>

        <View style={styles.falt}>
          <Falt
            etikett="Namn"
            value={namn}
            onChangeText={setNamn}
            onEndEditing={sparaUppgifter}
            autoCapitalize="words"
            returnKeyType="done"
          />
          <Falt
            etikett="E-post"
            value={epost}
            onChangeText={setEpost}
            onEndEditing={sparaUppgifter}
            placeholder="Valfritt"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
          <Felrad text={fel} />
        </View>

        <View>
          <Etikett>DOKUMENT</Etikett>
          {dokument.length === 0 ? (
            <Kort>
              <Txt variant="body" farg="inkMuted">
                Spara en bild av jägarexamen, vapenlicens eller försäkring här, så har du den med dig i skogen.
              </Txt>
            </Kort>
          ) : (
            <Kort lista>
              {dokument.map((d, i) => {
                const s = dokumentStatus(d);
                return (
                  <Listrad
                    key={d.id}
                    forsta={i === 0}
                    ikon="dokument"
                    titel={d.namn}
                    extra={<DokumentStatusChip status={s.typ} text={s.text} />}
                    hojd={80}
                    accessibilityLabel={`${d.namn}, ${s.text}`}
                    onPress={() => router.push(`/profil/dokument/${d.id}`)}
                  />
                );
              })}
            </Kort>
          )}
          <Knapp
            titel="Lägg till dokument"
            ikon="plus"
            onPress={() => router.push("/profil/dokument/ny")}
            style={styles.laggTill}
          />
          <Txt variant="caption" farg="inkMuted" style={styles.info}>
            Dokumenten sparas bara på den här telefonen och delas aldrig. Kopiorna ersätter inte originalen.
          </Txt>
        </View>
      </Skarm>
      <BildVal
        oppen={bildVal}
        titel="Profilbild"
        prefix="profil"
        harBild={!!profil.bild}
        onNy={sattBild}
        onTaBort={() => sattBild(null)}
        onStang={() => setBildVal(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topp: { alignItems: "center", gap: avstand.s1 },
  namn: { marginTop: avstand.s2 },
  centrerad: { alignSelf: "center" },
  falt: { gap: avstand.s4 },
  laggTill: { marginTop: avstand.s3 },
  info: { marginTop: avstand.s3 },
});
