/** 59.329301 → "59,32930° N", 5 decimaler ≈ 1 m. */
export function formateraKoordinat(varde: number, axel: "lat" | "lon"): string {
  const riktning =
    axel === "lat" ? (varde >= 0 ? "N" : "S") : varde >= 0 ? "Ö" : "V";
  return `${Math.abs(varde).toFixed(5).replace(".", ",")}° ${riktning}`;
}
