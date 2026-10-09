import { TillbakaKnapp } from "@/components/ui/Delar";

interface BackButtonProps {
  onPress?: () => void;
}

/** Äldre namn för Design Systemets stora Tillbaka-knapp. */
export function BackButton({ onPress }: BackButtonProps) {
  return <TillbakaKnapp onPress={onPress} />;
}
