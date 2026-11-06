import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { importeraSpar } from "@/db/queries/spar";
import type { SparImportResultat } from "@/db/queries/spar";
import { tolkaGarminGpx } from "@/spar/hundspar";
import type { GarminFil } from "@/spar/hundspar";
import type { Uuid } from "@/db/types";

/**
 * Välj en eller flera GPX-filer från Garmin-handenheten (ett halsband per
 * fil, t.ex. "Aston.gpx", och gärna förarens "Current.gpx") och koppla
 * spåren till jaktdagens drev. Returnerar null om användaren avbröt.
 */
export async function valjOchImporteraHundspar(
  db: SQLiteDatabase,
  jaktdagId: Uuid,
): Promise<SparImportResultat | null> {
  const val = await DocumentPicker.getDocumentAsync({
    // GPX saknar ofta en egen typ i iOS - tillåt alla och kontrollera innehållet.
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (val.canceled || !val.assets?.length) {
    return null;
  }
  const filer: GarminFil[] = [];
  for (const fil of val.assets) {
    let text: string;
    try {
      if (Platform.OS === "web") {
        text = fil.file ? await fil.file.text() : await (await fetch(fil.uri)).text();
      } else {
        text = await new File(fil.uri).text();
      }
    } catch {
      throw new Error(`Kunde inte läsa ${fil.name}.`);
    }
    try {
      filer.push(tolkaGarminGpx(text));
    } catch {
      throw new Error(`${fil.name} är ingen GPX-fil.`);
    }
  }
  if (filer.every((f) => f.spar.length === 0)) {
    throw new Error("Filerna innehåller inga spår med tider.");
  }
  return importeraSpar(db, jaktdagId, filer);
}
