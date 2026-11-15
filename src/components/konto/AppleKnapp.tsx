import * as AppleAuthentication from "expo-apple-authentication";
import { useTema } from "@/theme/TemaContext";
import { radie, tryck } from "@/theme/tokens";

/**
 * Apples egen inloggningsknapp – Apple kräver att den ser ut så här.
 * Svart i ljust läge, vit i mörkt.
 */
export function AppleKnapp({ onPress }: { onPress: () => void }) {
  const { schema } = useTema();
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={
        schema === "dark"
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={radie.md}
      style={{ height: tryck.min, alignSelf: "stretch" }}
      onPress={onPress}
    />
  );
}
