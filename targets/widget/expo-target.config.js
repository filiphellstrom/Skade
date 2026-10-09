/**
 * Widget-extension-målet för Skades Live Activity (drevklockan på
 * låsskärmen och i Dynamic Island). Genereras in i Xcode-projektet av
 * @bacons/apple-targets vid `expo prebuild` / EAS Build.
 *
 * Steg 2 i förstudien (claude/live-activity-jaktmark-forstudie.md):
 * en statisk Live Activity utan knappar. Ingen App Group behövs än -
 * all text skickas med från appen när aktiviteten startas, och
 * widget-processen läser aldrig databasen.
 *
 * deploymentTarget 16.2: lägsta iOS för Activity.request(attributes:
 * content:) som modulen i modules/skade-live-activity använder. Höjs till
 * 17.0 när stoppknappen (LiveActivityIntent) byggs i nästa steg.
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: "widget",
  name: "SkadeWidget",
  displayName: "Skade",
  bundleIdentifier: ".widget",
  deploymentTarget: "16.2",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit"],
  colors: {
    $accent: { color: "#2F6B3A", darkColor: "#5FA968" },
    skadeGron: { color: "#2F6B3A", darkColor: "#5FA968" },
  },
};
