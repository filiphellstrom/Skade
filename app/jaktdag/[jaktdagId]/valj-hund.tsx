import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

/**
 * Sida 2: Välj hund - platshållare från scaffolding.
 * Ska: koppla vald(a) hund(ar) till jaktdagen och sätta aktivHundId, se
 * src/db/queries/hund.ts -> laggTillHundIJaktdag() och
 * src/db/queries/jaktdag.ts -> settAktivHund(). Byggs i Sprint 1-chatten.
 */
export default function ValjHund() {
  const { jaktdagId } = useLocalSearchParams<{ jaktdagId: string }>();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Välj hund (jaktdag {jaktdagId})</Text>
    </View>
  );
}
