import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type { DokumentFiltyp } from "@/db/types";
import { randomUUID } from "./uuid";

/**
 * Bilder och dokumentfiler (migration 0005). Allt sparas bara lokalt.
 *
 * I appen kopieras varje vald fil in i en egen mapp i appens
 * Documents-katalog, och databasen sparar bara FILNAMNET. iOS byter
 * appens containersökväg vid uppdateringar, så en full sökväg i
 * databasen skulle sluta fungera efter nästa version.
 *
 * På webben (bara för test) finns inget filsystem att lita på, så filen
 * sparas som en data:-URL direkt i databaskolumnen.
 *
 * Mappen ligger i Documents, som ingår i telefonens iCloud-säkerhetskopia.
 * Det är medvetet: byter man telefon följer bilder och dokument med.
 */

const MAPP = "skade-filer";

function mapp(): Directory {
  const d = new Directory(Paths.document, MAPP);
  if (!d.exists) {
    d.create({ intermediates: true, idempotent: true });
  }
  return d;
}

/** Det som går att visa i <Image source={{ uri }}> eller dela, för ett sparat värde. */
export function filUri(sparad: string | null | undefined): string | null {
  if (!sparad) {
    return null;
  }
  if (Platform.OS === "web" || /^(data:|https?:|file:|blob:)/.test(sparad)) {
    return sparad;
  }
  return new File(mapp(), sparad).uri;
}

/** Tar bort en sparad fil. Tyst om den redan är borta. */
export function taBortFil(sparad: string | null | undefined): void {
  if (!sparad || Platform.OS === "web" || sparad.startsWith("data:")) {
    return;
  }
  try {
    const f = new File(mapp(), sparad);
    if (f.exists) {
      f.delete();
    }
  } catch (e) {
    console.warn("[filer] kunde inte ta bort", sparad, e);
  }
}

async function tillDataUrl(uri: string): Promise<string> {
  if (uri.startsWith("data:")) {
    return uri;
  }
  const blob = await (await fetch(uri)).blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Kopierar en vald fil (från bildväljaren, kameran eller dokumentväljaren)
 * in i appens egen mapp och returnerar värdet som ska sparas i databasen.
 */
export async function sparaFil(uri: string, prefix: string, filandelse: string): Promise<string> {
  if (Platform.OS === "web") {
    return tillDataUrl(uri);
  }
  const namn = `${prefix}-${randomUUID()}.${filandelse}`;
  new File(uri).copy(new File(mapp(), namn));
  return namn;
}

function filandelseFor(uri: string, mimeType: string | null | undefined, standard: string): string {
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/heic") {
    return "heic";
  }
  const m = uri.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : standard;
}

export type BildKalla = "kamera" | "bibliotek";

export class BehorighetSaknas extends Error {}

/**
 * Låter användaren ta eller välja en bild. Returnerar det sparade värdet
 * (se sparaFil) eller null om användaren avbröt.
 *
 * `kvadrat`: beskärs till kvadrat (profil- och hundbild, visas rund).
 */
export async function valjOchSparaBild(
  kalla: BildKalla,
  prefix: string,
  { kvadrat = false }: { kvadrat?: boolean } = {},
): Promise<string | null> {
  const val: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: kvadrat,
    aspect: kvadrat ? [1, 1] : undefined,
    quality: kvadrat ? 0.6 : 0.8,
  };
  let svar: ImagePicker.ImagePickerResult;
  if (kalla === "kamera" && Platform.OS !== "web") {
    const b = await ImagePicker.requestCameraPermissionsAsync();
    if (!b.granted) {
      throw new BehorighetSaknas(
        "Skade har inte tillgång till kameran. Tillåt det under Inställningar > Skade, eller välj en bild i stället.",
      );
    }
    svar = await ImagePicker.launchCameraAsync(val);
  } else {
    svar = await ImagePicker.launchImageLibraryAsync(val);
  }
  if (svar.canceled || !svar.assets?.[0]) {
    return null;
  }
  const a = svar.assets[0];
  return sparaFil(a.uri, prefix, filandelseFor(a.uri, a.mimeType, "jpg"));
}

/** Väljer en bild eller PDF i Filer-appen. Null om användaren avbröt. */
export async function valjOchSparaDokumentFil(): Promise<{ fil: string; filtyp: DokumentFiltyp } | null> {
  const svar = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (svar.canceled || !svar.assets?.[0]) {
    return null;
  }
  const a = svar.assets[0];
  const andelse = filandelseFor(a.name || a.uri, a.mimeType, "pdf");
  const filtyp: DokumentFiltyp = andelse === "pdf" ? "pdf" : "bild";
  return { fil: await sparaFil(a.uri, "dokument", andelse), filtyp };
}
