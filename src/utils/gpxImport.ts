import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { importeraGpx } from "@/db/queries/kartpunkt";
import type { ImportResultat } from "@/db/queries/kartpunkt";
import { tolkaGpx } from "@/vind/gpx";
import type { Uuid } from "@/db/types";

/**
 * Välj en GPX-fil (Filer-appen, t.ex. WeHunts "map-export.gpx") och
 * importera gränsen och markeringarna till en jaktmark. Returnerar null
 * om användaren avbröt. Kastar fel med en begriplig text om filen inte
 * gick att läsa.
 */
export async function valjOchImporteraGpx(
  db: SQLiteDatabase,
  jaktmarkId: Uuid,
): Promise<ImportResultat | null> {
  const val = await DocumentPicker.getDocumentAsync({
    // GPX saknar ofta en egen typ i iOS - tillåt alla och kontrollera innehållet.
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (val.canceled || !val.assets?.[0]) {
    return null;
  }
  const fil = val.assets[0];
  let text: string;
  try {
    if (Platform.OS === "web") {
      text = fil.file ? await fil.file.text() : await (await fetch(fil.uri)).text();
    } else {
      text = await new File(fil.uri).text();
    }
  } catch {
    throw new Error("Kunde inte läsa filen.");
  }
  const innehall = tolkaGpx(text);
  if (innehall.punkter.length === 0 && innehall.spar.length === 0) {
    throw new Error("Filen innehåller inga markeringar eller spår.");
  }
  return importeraGpx(db, jaktmarkId, innehall);
}
