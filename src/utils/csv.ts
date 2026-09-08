/**
 * Minimal CSV-byggare (RFC 4180-artad). Ett fält citeras med citattecken
 * bara om det innehåller kommatecken, citattecken eller radbrytning -
 * annars lämnas det som det är, för att hålla filen lättläst. Citattecken
 * inuti ett citerat fält dubbleras enligt standarden.
 *
 * Delad av alla exportfunktioner (se src/utils/export.ts) - ingen egen
 * CSV-logik ska ligga där.
 */
function citeraFalt(varde: string): string {
  if (/[",\n\r]/.test(varde)) {
    return `"${varde.replace(/"/g, '""')}"`;
  }
  return varde;
}

/**
 * Bygger en komplett CSV-sträng (CRLF-radslut, enligt RFC 4180) från en
 * rubrikrad och en lista av rader. Varje rad måste ha lika många fält som
 * `rubriker`.
 */
export function tillCsv(rubriker: string[], rader: string[][]): string {
  const alla = [rubriker, ...rader];
  return alla.map((rad) => rad.map(citeraFalt).join(",")).join("\r\n");
}
