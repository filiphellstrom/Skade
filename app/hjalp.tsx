import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFarger } from "@/theme/TemaContext";
import { avstand, tryck } from "@/theme/tokens";
import { Kort } from "@/components/ui/Kort";
import { Etikett, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Ikon } from "@/components/ui/Ikon";
import { Txt } from "@/components/ui/Txt";

/**
 * Hjälp (öppnas från Inställningar). Beskriver appen ur användarens
 * perspektiv, ett ämne i taget. Varje ämne fälls ut vid tryck så att
 * sidan går att överblicka.
 *
 * HÅLL TEXTEN AKTUELL när funktioner ändras - den beskriver hur appen
 * faktiskt fungerar (navigation, knappnamn, regler som "en jaktdag åt
 * gången"). Svensk text, versal bara först i meningen, inga utropstecken.
 */
interface Amne {
  titel: string;
  stycken: string[];
}

const KOM_IGANG: Amne[] = [
  {
    titel: "Vad är Skade?",
    stycken: [
      "Skade är en jaktdagbok för drivande hund. Du tar tid på varje drev, ser vilket vilt som drevs och hur det gick, och bygger upp historik och statistik per hund över säsongen.",
      "Appen fungerar helt utan täckning. Allt sparas direkt i telefonen.",
    ],
  },
  {
    titel: "Så är appen uppbyggd",
    stycken: [
      "Längst ner finns fyra flikar: Hem, Hundar, Historik och Jaktmarker. Varje flik minns var du var, så du kan byta flik och komma tillbaka.",
      "Inställningar och den här hjälpen når du via kugghjulet uppe till höger på Hem.",
      "När du jagar (ny jaktdag, välj hundar, timern) döljs flikarna så att skärmen bara visar det du behöver. Tillbaka-knappen uppe till vänster, eller ett svep från vänsterkanten, tar dig tillbaka.",
    ],
  },
];

const JAKTDAGEN: Amne[] = [
  {
    titel: "Starta en jaktdag",
    stycken: [
      "Tryck Ny jaktdag på Hem. Välj en jaktmark du jagat på förut, eller välj Ny jaktmark och skriv namnet. Datumet blir alltid dagens.",
      "Skriver du ett namn som redan finns, oavsett stora eller små bokstäver, används den befintliga jaktmarken i stället för att en dubblett skapas.",
      "Tryck Starta jaktdag. Det kan bara finnas en pågående jaktdag åt gången.",
    ],
  },
  {
    titel: "Välj hundar som ska jaga",
    stycken: [
      "Markera de hundar som är med under dagen. Saknas en hund kan du trycka Lägg till hund direkt härifrån.",
      "Väljer du flera hundar frågar appen vilken som driver först. Tryck sedan Bekräfta för att komma till timern.",
    ],
  },
  {
    titel: "Ta tid på ett drev",
    stycken: [
      "Timern visar hunden som driver, jaktmarken och vilket drev i ordningen det är. Tryck Starta drev när hunden tar upp, och Stoppa drev när drevet är slut. Det finns ingen bekräftelse, så knappen reagerar direkt.",
      "Tiden fortsätter att räknas även om du låser telefonen eller byter app, eftersom den räknas från när drevet startade.",
      "Har du flera hundar med kan du trycka Byt hund under hundnamnet mellan två drev.",
      "Knappen uppe till höger växlar timern mellan mörkt och ljust, till exempel mörkt i skymning och ljust i skarp sol. Valet gäller bara timern och sparas.",
    ],
  },
  {
    titel: "Efter ett drev: viltart och utfall",
    stycken: [
      "När du stoppar ett drev kan du ange viltart och utfall direkt. Tryck på ett valt alternativ igen för att ta bort valet.",
      "Finns inte viltet i listan trycker du Eget och skriver det själv.",
      "Under Tid kan du justera start- och sluttid om du tryckte lite sent. Tryck på Start eller Slut och rulla hjulen för timme och minut, och tryck Klar. Tryck sedan Spara.",
      "Har du inte tid trycker du Hoppa över. Drevet är redan sparat, och du kan fylla i resten senare från Historik.",
      "Radera drev tar bort drevet helt, efter en bekräftelse. Knappen är medvetet liten så att man inte trycker på den av misstag.",
    ],
  },
  {
    titel: "Avsluta jaktdagen",
    stycken: [
      "Gå tillbaka till Hem och tryck Avsluta jaktdag på kortet för den pågående jaktdagen. Pågår ett drev måste du stoppa det först.",
      "Vill du fortsätta jaga efter en paus trycker du Fortsätt jaktdag på samma kort.",
    ],
  },
  {
    titel: "Låsskärmen (iPhone med iOS 17 eller senare)",
    stycken: [
      "När jaktdagen har en vald hund visas ett kort på låsskärmen och i Dynamic Island. Det visar hunden, jaktmarken och tiden för pågående drev.",
      "Du kan starta och stoppa drev direkt på låsskärmen, utan att låsa upp. Ett drev som stoppas där sparas utan viltart och utfall. I Historik får det markeringen Saknar viltart och utfall, så att du ser vad som behöver kompletteras.",
      "Byte av hund görs i appen. Kortet försvinner när du avslutar jaktdagen.",
      "iOS tillåter att kortet uppdateras i högst åtta timmar. Öppna appen någon gång under en lång jaktdag, så startas ett nytt kort.",
      "Syns inget kort kan Live Activities vara avstängt för Skade. Det slås på i telefonens Inställningar under Skade.",
    ],
  },
];

const OVRIGT: Amne[] = [
  {
    titel: "Historik och statistik",
    stycken: [
      "Under fliken Historik finns två lägen överst. Logg visar alla avslutade jaktdagar, nyast först. Tryck på en jaktdag för att se dess drev, och tryck på ett drev för att ändra hund, tid, viltart eller utfall.",
      "Statistik visar total drevtid och antal drev per hund, och hur dreven fördelar sig på viltart och utfall.",
      "Med Allt, Helår och Intervall väljer du vilken period som visas.",
    ],
  },
  {
    titel: "Hundar",
    stycken: [
      "Fliken Hundar visar dina hundar med total drevtid och antal drev. Tryck på en hund för att ändra namn, ras, födelsedatum och kommentar.",
      "Lägg till hund finns uppe till höger.",
      "Arkivera hund döljer en hund som inte längre jagar men behåller all historik. Arkiverade hundar finns under Visa arkiverade hundar och kan återställas.",
      "Radera hund tar bort hunden och, efter en bekräftelse, all dess historik permanent.",
    ],
  },
  {
    titel: "Jaktmarker",
    stycken: [
      "Fliken Jaktmarker visar varje jaktmark med antal jaktdagar, senaste jaktdag och total drevtid.",
      "Du kan lägga till en jaktmark i förväg med Lägg till, och döpa om en jaktmark genom att trycka på den. Det nya namnet syns på alla jaktdagar som hör till marken.",
      "Jaktmarker skapas också automatiskt när du skriver ett nytt namn vid Ny jaktdag.",
    ],
  },
  {
    titel: "Inställningar",
    stycken: [
      "Tema: Ljust, Mörkt eller System. System följer telefonens inställning. Timern har en egen ljus/mörk-knapp.",
      "Exportera till CSV skapar en fil med alla drev som du kan mejla till dig själv och öppna i Excel. Exporten tar alltid med all historik, oavsett vilken period du valt i Historik. Det finns även en genväg till exporten i Historik.",
    ],
  },
  {
    titel: "Dina data",
    stycken: [
      "Allt du registrerar sparas bara i telefonen. Ingenting skickas till någon server, och appen fungerar helt offline.",
      "Det betyder också att data inte följer med om du byter eller återställer telefonen. Exportera till CSV regelbundet om du vill ha en egen kopia.",
      "Webbversionen av Skade sparar sina data separat i webbläsaren och delar dem inte med appen.",
    ],
  },
];

function AmneRad({ amne, forsta }: { amne: Amne; forsta: boolean }) {
  const f = useFarger();
  const [oppen, setOppen] = useState(false);
  return (
    <View style={!forsta && { borderTopWidth: 1, borderTopColor: f.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: oppen }}
        onPress={() => setOppen((o) => !o)}
        style={({ pressed }) => [styles.rubrikRad, pressed && { backgroundColor: f.surface300 }]}
      >
        <Txt variant="heading" style={styles.flex1}>
          {amne.titel}
        </Txt>
        <View style={{ transform: [{ rotate: oppen ? "90deg" : "0deg" }] }}>
          <Ikon namn="framat" farg={f.inkMuted} storlek={20} />
        </View>
      </Pressable>
      {oppen && (
        <View style={styles.text}>
          {amne.stycken.map((s) => (
            <Txt key={s} variant="body" farg="ink">
              {s}
            </Txt>
          ))}
        </View>
      )}
    </View>
  );
}

function Grupp({ etikett, amnen }: { etikett: string; amnen: Amne[] }) {
  return (
    <View>
      <Etikett>{etikett}</Etikett>
      <Kort lista>
        {amnen.map((a, i) => (
          <AmneRad key={a.titel} amne={a} forsta={i === 0} />
        ))}
      </Kort>
    </View>
  );
}

export default function Hjalp() {
  return (
    <Skarm>
      <View style={styles.topp}>
        <TillbakaKnapp />
        <View>
          <Txt variant="title1" accessibilityRole="header">
            Hjälp
          </Txt>
          <Txt variant="body" farg="inkMuted">
            Tryck på ett ämne för att läsa mer.
          </Txt>
        </View>
      </View>

      <Grupp etikett="KOMMA IGÅNG" amnen={KOM_IGANG} />
      <Grupp etikett="JAKTDAGEN" amnen={JAKTDAGEN} />
      <Grupp etikett="ÖVRIGT" amnen={OVRIGT} />
    </Skarm>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  topp: { gap: avstand.s4 },
  rubrikRad: {
    minHeight: tryck.min,
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s3,
    paddingHorizontal: avstand.s4,
    paddingVertical: avstand.s2,
  },
  text: {
    gap: avstand.s3,
    paddingHorizontal: avstand.s4,
    paddingBottom: avstand.s4,
  },
});
