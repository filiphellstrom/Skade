import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { getDatabase } from "@/db/client";

/**
 * Rot-layout: initierar SQLite-databasen (öppnar anslutning, kör
 * migrations) innan några skärmar renderas. Se src/db/client.ts.
 */
export default function RootLayout() {
  const [databasKlar, setDatabasKlar] = useState(false);

  useEffect(() => {
    getDatabase().then(() => setDatabasKlar(true));
  }, []);

  if (!databasKlar) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
