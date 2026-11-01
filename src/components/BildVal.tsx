import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { HjulArk } from "@/components/HjulVal";
import { Knapp } from "@/components/ui/Knapp";
import { Felrad } from "@/components/ui/Delar";
import { BehorighetSaknas, valjOchSparaBild } from "@/utils/filer";
import type { BildKalla } from "@/utils/filer";

/**
 * Ark för att byta profil- eller hundbild: Ta bild, Välj bild och (om en
 * bild finns) Ta bort bild. Bilden beskärs till kvadrat och sparas
 * lokalt (src/utils/filer.ts). `onNy` får det sparade värdet; anroparen
 * sparar det i databasen och tar bort den gamla filen.
 */
export function BildVal({
  oppen,
  titel,
  prefix,
  harBild,
  onNy,
  onTaBort,
  onStang,
}: {
  oppen: boolean;
  titel: string;
  prefix: string;
  harBild: boolean;
  onNy: (sparad: string) => Promise<void> | void;
  onTaBort: () => Promise<void> | void;
  onStang: () => void;
}) {
  const [fel, setFel] = useState<string | null>(null);
  const [arbetar, setArbetar] = useState(false);

  const valj = async (kalla: BildKalla) => {
    setFel(null);
    setArbetar(true);
    try {
      const sparad = await valjOchSparaBild(kalla, prefix, { kvadrat: true });
      if (sparad) {
        await onNy(sparad);
        onStang();
      }
    } catch (e) {
      setFel(e instanceof BehorighetSaknas ? e.message : "Kunde inte spara bilden. Försök igen.");
    } finally {
      setArbetar(false);
    }
  };

  return (
    <HjulArk oppen={oppen} titel={titel} onStang={onStang} stangTitel="Avbryt">
      <View style={styles.knappar}>
        {Platform.OS !== "web" && (
          <Knapp titel="Ta bild" ikon="kamera" variant="sekundar" onPress={() => valj("kamera")} disabled={arbetar} />
        )}
        <Knapp titel="Välj bild" variant="sekundar" onPress={() => valj("bibliotek")} laddar={arbetar} />
        {harBild && (
          <Knapp
            titel="Ta bort bild"
            variant="text"
            onPress={async () => {
              await onTaBort();
              onStang();
            }}
          />
        )}
        <Felrad text={fel} />
      </View>
    </HjulArk>
  );
}

const styles = StyleSheet.create({
  knappar: { gap: 12 },
});
