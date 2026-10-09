/**
 * Widget-extension-målet för Skades Live Activity (drevklockan på
 * låsskärmen och i Dynamic Island). Genereras in i Xcode-projektet av
 * @bacons/apple-targets vid `expo prebuild` / EAS Build.
 *
 * Steg 2-3 i förstudien (claude/live-activity-jaktmark-forstudie.md):
 * Live Activity med drevklocka och en stoppknapp. Ingen App Group behövs -
 * all text skickas med från appen när aktiviteten startas, och
 * widget-processen läser aldrig databasen. Stoppknappen är en
 * LiveActivityIntent (_shared/StoppaDrevIntent.swift) som iOS kör i
 * APPENS process, där den skriver direkt till appens egen databas.
 *
 * Filerna i _shared/ kompileras in i både widgeten och huvudappen.
 *
 * deploymentTarget 16.2: lägsta iOS för Activity.request(attributes:
 * content:). Stoppknappen kräver iOS 17 och visas bara där
 * (`if #available` i SkadeDrevLiveActivity.swift).
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: "widget",
  name: "SkadeWidget",
  displayName: "Skade",
  bundleIdentifier: ".widget",
  deploymentTarget: "16.2",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit", "AppIntents"],
  colors: {
    $accent: { color: "#2F6B3A", darkColor: "#5FA968" },
    skadeGron: { color: "#2F6B3A", darkColor: "#5FA968" },
  },
};
