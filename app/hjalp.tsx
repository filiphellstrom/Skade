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
    titel: "Släppt, söker, tappt och kopplad",
    stycken: [
      "Innan ett drev kan du trycka Släppt när du släpper hunden. Timern visar då hur länge hunden har sökt, och när du trycker Starta drev sparas söktiden. Tar hunden inte upp trycker du Kopplad när du har kopplat den.",
      "Under ett drev finns knappen Tappt. Tryck den när hunden tappar, och Tog upp igen när den tar upp igen. Timern visar hur länge drevet stått i tappt.",
      "Stoppar du drevet medan det står i tappt frågar appen om drevet slutade vid tappten. Svarar du ja blir sluttiden tidpunkten för tappten.",
      "Allt det här är frivilligt. Vill du bara ta tid trycker du Starta drev och Stoppa drev som vanligt. I drevvyn ser du alla händelser och kan ta bort den som blev fel.",
    ],
  },
  {
    titel: "Väder och före",
    stycken: [
      "När ett drev startar hämtar Skade vädret (temperatur och vind) från SMHI för jaktmarkens ungefärliga position. Saknas täckning försöker appen igen när du öppnar timern, i upp till tre timmar efter drevstarten.",
      "Jaktmarkens position sätts första gången du startar en jaktdag där och du har gett Skade tillgång till platstjänster. Den avrundas till ungefär en kilometer, och du kan ändra eller ta bort den under Jaktmarker.",
      "Före (barmark, frost, blött, spårsnö, djup snö eller skare) väljer du själv när du startar jaktdagen, eller i efterhand under Historik. Appen föreslår samma före som senast på samma mark om det var inom tre dagar.",
      "Under Statistik ser du snittdrevtid per före och per temperatur. Väderdata kommer från SMHI.",
    ],
  },
  {
    titel: "Fällt vilt och jaktdagbok",
    stycken: [
      "Sätter du utfallet Fälld på ett drev och sparar frågar appen direkt om det fällda viltet: art, antal och skytt, och för älg och kronhjort även kön och ålder. Tryck Hoppa över om du vill fylla i senare.",
      "Vilt som fälls utan drev, till exempel på pass, lägger du till på jaktdagen under Historik.",
      "Under Historik kan du också skriva en anteckning om dagen i jaktdagboken.",
      "Under Inställningar kan du skapa en säsongsrapport som PDF för ett jaktår (1 juli–30 juni) och exportera allt fällt vilt till en CSV-fil. Rapporten är ett underlag för jaktlagets rapportering i Viltdata.",
    ],
  },
  {
    titel: "Dela ett drev eller en jaktdag som bild",
    stycken: [
      "Tryck Dela som bild i drevvyn eller på en jaktdag i Historik. Du ser bilden innan du delar och kan välja om jaktmarken och hundens bild ska synas. Jaktmarken är dold från början.",
    ],
  },
  {
    titel: "Efter ett drev: viltart och utfall",
    stycken: [
      "När du stoppar ett drev kan du ange viltart och utfall direkt. Tryck på ett valt alternativ igen för att ta bort valet.",
      "Finns inte viltet i listan trycker du Eget och skriver det själv.",
      "Under Tid kan du justera start- och sluttid om du tryckte lite sent. Tryck på Start eller Slut, rulla hjulen för timme och minut (telefonen ger ett litet klick för varje steg) och tryck Klar. Tryck sedan Spara.",
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
      "Byte av hund görs i appen. Kortet försvinner när du avslutar jaktdagen eller stänger appen helt genom att svepa bort den. Öppnar du appen igen under en pågående jaktdag kommer kortet tillbaka.",
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
      "Fliken Hundar visar dina hundar med bild, total drevtid och antal drev. Tryck på en hund för att ändra namn, ras, födelsedatum och kommentar, eller för att lägga till en bild (Ta bild eller Välj bild).",
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
    titel: "Karta",
    stycken: [
      "Fliken Karta visar var du är. Första gången frågar Skade om platsåtkomst. Har du sagt nej kan du ändra det med Öppna Inställningar.",
      "Rutan överst visar din position i grader och hur noggrann den är. Min position centrerar kartan på dig igen, och Satellit växlar till satellitbild.",
      "Till höger i rutan visas nästa soluppgång eller solnedgång där du står, beroende på vilken som kommer först. Tiden räknas ut i telefonen och fungerar utan täckning.",
      "Positionen fungerar utan täckning, men själva kartbilden visas bara där den redan har laddats. Titta gärna på området hemma innan jakten. Positionen sparas inte.",
      "På webben (skade.hellstrom.fyi) finns också en karta, med valen Karta och Terräng (höjdkurvor). Den visar jaktmarkens gräns och markeringar och passar för att titta på marken på en stor skärm. Vind och vittring finns bara i appen än.",
    ],
  },
  {
    titel: "Vind och vittring",
    stycken: [
      "Importera jaktmarkens gräns, pass och torn från en GPX-fil, till exempel kartexporten från WeHunt: öppna jaktmarken under Jaktmarker och tryck Importera GPX-fil. Samma fil kan importeras igen utan att något dubbleras.",
      "Tryck Vind på kartan. Pilarna visar dit vinden blåser enligt SMHI:s prognos. En västlig vind kommer från väster och pilarna pekar mot öster. Längre och tjockare pil betyder starkare vind.",
      "Tryck på ett pass eller var som helst på kartan för att välja jägarposition. Utan val används din egen position. Den gula zonen visar ungefär åt vilket håll vittringen förs från platsen. Den är bredare när vinden är byig, svag eller vrider, och längden och bredden kan ändras i panelen.",
      "Zonen är en uppskattning, ingen exakt gräns. Terräng, skog, öppna ytor, lokala vindar och termik ingår inte än.",
      "Välj tid med timmarna under vinden. Panelen visar källan, när prognosen gäller och när den hämtades. Utan täckning visas den senast hämtade prognosen, med en varning. Prognoserna sparas i telefonen så att de kan kopplas till jaktdagen.",
    ],
  },
  {
    titel: "Hundspår från Garmin",
    stycken: [
      "Skade kan visa hundens spår från en Garmin Alpha-handenhet (Alpha 100 och nyare). Koppla handenheten till datorn med USB och spara GPX-filerna i Filer-appen: en fil per halsband, till exempel Aston.gpx, och Current.gpx för ditt eget spår.",
      "Öppna jaktdagen i Historik och tryck Importera GPX-filer under Spår från Garmin. Välj alla filer på en gång. Bara den jaktdagens del av filerna används, så det gör inget om filerna innehåller flera dagar.",
      "Spåren kopplas till dreven efter tid, från släppt (om du tryckte Släppt) till drevslut. Hunden kommer från drevet, inte från halsbandets namn i Garmin. Har Aston burit halsbandet på förmiddagen och Astrid på eftermiddagen hamnar spåren ändå rätt. Är två halsband ute under samma drev väljs det halsband som heter som drevets hund.",
      "Visa spåren på kartan visar varje drev i egen färg och ditt eget spår streckat. Sträckan räknas utan GPS-brus när hunden står still, och Längst bort är hundens största avstånd från dig under drevet.",
      "Importera igen om du ändrat tiden på ett drev: den nya importen ersätter de gamla spåren. Spåren innehåller exakta positioner och sparas bara i telefonen.",
    ],
  },
  {
    titel: "Profil och dokument",
    stycken: [
      "Tryck på den runda profilbilden uppe till höger på Hem för att öppna din profil. Där byter du profilbild, namn och e-post.",
      "Under Dokument sparar du en bild eller PDF av till exempel jägarexamen, vapenlicens eller försäkring, så att du alltid har dem med dig. Tryck på bilden för att se den i helskärm.",
      "Ange Giltigt till så får du en påminnelse på telefonen 7, 30 eller 60 dagar innan dokumentet går ut, klockan 09:00. Går ett dokument ut snart, eller har det redan gått ut, syns det också överst på Hem.",
      "Dokumenten sparas bara på den här telefonen och delas aldrig. Kopiorna ersätter inte originalen.",
    ],
  },
  {
    titel: "Konto",
    stycken: [
      "Längst ned i profilen kan du logga in med Apple eller Google. Kontot är frivilligt. Appen fungerar som vanligt utan det.",
      "Kontot behövs för det som delas i ett jaktlag. På servern sparas ditt namn och din e-postadress. Loggar du in med Apple kan du välja att dölja e-postadressen.",
      "Drev, hundar, jaktdagar och dokument ligger kvar i telefonen även när du är inloggad.",
      "Radera konto tar bort kontot från servern permanent. Har du varit inloggad länge kan du behöva logga in igen först. Det som finns i telefonen påverkas inte.",
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
      "Allt du registrerar sparas bara i telefonen, och appen fungerar helt offline. Till en server skickas bara det som beskrivs under Konto (om du loggar in), samt en avrundad position till SMHI för väder och vind.",
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
