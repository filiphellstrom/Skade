import { Text } from "react-native";
import type { TextProps, TextStyle, StyleProp } from "react-native";
import { typ } from "@/theme/tokens";
import type { TypNamn } from "@/theme/tokens";
import { useFarger } from "@/theme/TemaContext";
import type { Farger } from "@/theme/tokens";

/**
 * All text i appen går genom Txt, så att typsnitt och typstil alltid
 * kommer från Design Systemet. `farg` är ett FÄRGNAMN från temat
 * (standard "ink"), aldrig ett hex-värde.
 */
interface Props extends TextProps {
  variant?: TypNamn;
  farg?: keyof Farger;
  style?: StyleProp<TextStyle>;
}

export function Txt({ variant = "body", farg = "ink", style, ...rest }: Props) {
  const farger = useFarger();
  return <Text {...rest} style={[typ[variant], { color: farger[farg] }, style]} />;
}
