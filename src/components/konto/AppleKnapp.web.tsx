import { Knapp } from "@/components/ui/Knapp";

/** På webben: vanlig knapp som skickar vidare till Apples inloggningssida. */
export function AppleKnapp({ onPress }: { onPress: () => void }) {
  return <Knapp titel="Logga in med Apple" variant="sekundar" onPress={onPress} />;
}
