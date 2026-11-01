import { Image, Modal, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTema } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";

/**
 * Visar ett dokument i helskärm: en bild (nyp för att zooma) eller en PDF
 * (iOS egen PDF-visning via WebView). Stäng-knapp uppe till vänster.
 */
export function FilVisare({
  uri,
  filtyp,
  oppen,
  onStang,
}: {
  uri: string | null;
  filtyp: "bild" | "pdf" | null;
  oppen: boolean;
  onStang: () => void;
}) {
  const { farger } = useTema();
  const insets = useSafeAreaInsets();
  const fonster = useWindowDimensions();
  if (!uri) {
    return null;
  }
  return (
    <Modal visible={oppen} animationType="slide" onRequestClose={onStang} presentationStyle="fullScreen">
      <View style={[styles.fyll, { backgroundColor: farger.surface100, paddingTop: insets.top + avstand.s2 }]}>
        <View style={styles.topp}>
          <Knapp titel="Stäng" variant="sekundar" fullBredd={false} kompakt onPress={onStang} />
        </View>
        {filtyp === "pdf" ? (
          Platform.OS === "web" ? (
            <View style={styles.fyll}>
              <iframe src={uri} title="Dokument" style={{ border: 0, width: "100%", height: "100%" }} />
            </View>
          ) : (
            <WebView
              source={{ uri }}
              originWhitelist={["*"]}
              allowFileAccess
              allowingReadAccessToURL={uri}
              style={[styles.fyll, { backgroundColor: farger.surface100 }]}
            />
          )
        ) : (
          <ScrollView
            style={styles.fyll}
            contentContainerStyle={styles.bildBehallare}
            maximumZoomScale={5}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri }}
              style={{ width: fonster.width, height: fonster.height - insets.top - insets.bottom - 80 }}
              resizeMode="contain" accessibilityLabel="Dokumentet" />
          </ScrollView>
        )}
        <View style={{ height: insets.bottom }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  topp: { paddingHorizontal: avstand.s4, paddingBottom: avstand.s2, flexDirection: "row" },
  bildBehallare: { flexGrow: 1, justifyContent: "center" },
});
