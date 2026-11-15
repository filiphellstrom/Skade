import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import qrcode from "qrcode-generator";

/**
 * QR-kod ritad som SVG. Alltid svart på vitt med vit marginal, annars
 * läser kameran den inte i mörkt läge.
 */
export function QrKod({ text, storlek = 220 }: { text: string; storlek?: number }) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const antal = qr.getModuleCount();
    let vag = "";
    for (let r = 0; r < antal; r++) {
      for (let k = 0; k < antal; k++) {
        if (qr.isDark(r, k)) vag += `M${k} ${r}h1v1h-1z`;
      }
    }
    return { d: vag, n: antal };
  }, [text]);
  const marginal = 4;
  const total = n + marginal * 2;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="QR-kod med inbjudan till jaktlaget">
      <Svg width={storlek} height={storlek} viewBox={`${-marginal} ${-marginal} ${total} ${total}`}>
        <Rect x={-marginal} y={-marginal} width={total} height={total} fill="#ffffff" />
        <Path d={d} fill="#000000" />
      </Svg>
    </View>
  );
}
