import { Stack } from "expo-router";
import { useFarger } from "@/theme/TemaContext";

/** Egen stack för fliken, så att den har egen navigeringshistorik. */
export default function FlikStack() {
  const f = useFarger();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: f.surface100 } }} />
  );
}
