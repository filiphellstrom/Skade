import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

/**
 * Sida 3: Starta/stoppa timer - platshållare från scaffolding.
 * Ska: starta/stoppa Drev via src/db/queries/drev.ts (startaDrev/stoppaDrev).
 * Timern byggs robust med start-/endTimestamp, inte en löpande räknare -
 * se projektinstruktionen avsnitt 8/9. Byggs i Sprint 1-chatten.
 */
export default function Timer() {
  const { jaktdagId } = useLocalSearchParams<{ jaktdagId: string }>();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Timer (jaktdag {jaktdagId})</Text>
    </View>
  );
}
