import { Kort, Listrad } from "@/components/ui/Kort";

interface InfoRowProps {
  titel: string;
  undertitel?: string;
  /** Kort text längst till höger, t.ex. total drevtid eller "Drev pågår". */
  hoger?: string;
  /** Gör hela raden tryckbar och visar en pil (t.ex. hund → redigera). */
  onPress?: () => void;
}

/**
 * Äldre API: en fristående rad i ett eget kort. Nya skärmar lägger i
 * stället flera <Listrad/> i ett gemensamt <Kort lista/> (Design
 * Systemet: "Listor använder ett kort med rader i stället för ett kort
 * per rad").
 */
export function InfoRow({ titel, undertitel, hoger, onPress }: InfoRowProps) {
  return (
    <Kort lista>
      <Listrad forsta titel={titel} undertitel={undertitel} hoger={hoger} onPress={onPress} />
    </Kort>
  );
}
