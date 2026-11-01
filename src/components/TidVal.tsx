import { useState } from "react";
import type { UnixTimestamp } from "@/db/types";
import { AppleHjul, HjulArk, klockslag } from "@/components/HjulVal";
import { Kort, Listrad } from "@/components/ui/Kort";

const tt = (n: number) => String(n).padStart(2, "0");

/** Drevets längd i hela minuter, t.ex. "12 min" eller "1 h 05 min". */
export function langdText(sekunder: number): string {
  const min = Math.floor(Math.max(0, sekunder) / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${tt(min % 60)} min`;
}

interface TidValProps {
  start: UnixTimestamp;
  slut: UnixTimestamp;
  onStart: (ts: UnixTimestamp) => void;
  onSlut: (ts: UnixTimestamp) => void;
}

type Vilken = "start" | "slut";

/**
 * Tidsvalet i drev-vyn. Ett listkort med Start, Slut och Längd. Tryck på
 * Start eller Slut så glider ett ark upp med Apples egna rullhjul
 * (2026-11-01, se HjulVal.tsx - ersätter appens egna hjul i appen, som
 * nu bara används i webbversionen). Ändringen syns direkt i vyn, men
 * sparas först när man trycker Spara i drev-vyn.
 *
 * Bara klockslaget ändras, datumet är drevets eget.
 */
export function TidVal({ start, slut, onStart, onSlut }: TidValProps) {
  const [ark, setArk] = useState<Vilken | null>(null);
  // Titeln ligger kvar medan arket glider ut.
  const [visad, setVisad] = useState<Vilken>("start");
  const langd = langdText(slut - start);
  const oppna = (v: Vilken) => {
    setVisad(v);
    setArk(v);
  };

  return (
    <>
      <Kort lista>
        <Listrad
          forsta
          titel="Start"
          hoger={klockslag(start)}
          hojd={64}
          accessibilityLabel={`Starttid ${klockslag(start)}, ändra`}
          onPress={() => oppna("start")}
        />
        <Listrad
          titel="Slut"
          hoger={klockslag(slut)}
          hojd={64}
          accessibilityLabel={`Sluttid ${klockslag(slut)}, ändra`}
          onPress={() => oppna("slut")}
        />
        <Listrad titel="Längd" hoger={langd} hogerFarg="inkMuted" hojd={56} />
      </Kort>
      <HjulArk
        oppen={ark !== null}
        titel={visad === "slut" ? "Sluttid" : "Starttid"}
        undertitel={`Längd ${langd}`}
        onStang={() => setArk(null)}
      >
        <AppleHjul
          key={visad}
          lage="tid"
          varde={visad === "slut" ? slut : start}
          onChange={visad === "slut" ? onSlut : onStart}
          etikett={visad === "slut" ? "Sluttid" : "Starttid"}
        />
      </HjulArk>
    </>
  );
}
