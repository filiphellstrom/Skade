/**
 * Widget-extension-målet för Skades Live Activity (drevklockan på
 * låsskärmen och i Dynamic Island). Genereras in i Xcode-projektet av
 * @bacons/apple-targets vid `expo prebuild` / EAS Build.
 *
 * Sprint 7 (förstudien claude/live-activity-jaktmark-forstudie.md): en
 * Live Activity per jaktdag med drevklocka och Starta/Stoppa-knapp. Ingen
 * App Group behövs (beslut 2026-10-09) -
 * all text skickas med från appen när aktiviteten startas, och
 * widget-processen läser aldrig databasen. Knapparna är
 * LiveActivityIntents (_shared/SkadeLasskarmIntents.swift) som iOS kör i
 * APPENS process, där de skriver direkt till appens egen databas.
 *
 * Filerna i _shared/ kompileras in i både widgeten och huvudappen.
 *
 * deploymentTarget 17.0: interaktiva knappar på Live Activities kräver
 * iOS 17 (beslut 2026-10-09: bara låsskärmsdelen kräver 17, appen i
 * övrigt stödjer äldre iOS - där visas helt enkelt inget kort).
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: "widget",
  name: "SkadeWidget",
  displayName: "Skade",
  bundleIdentifier: ".widget",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit", "AppIntents"],
  colors: {
    $accent: { color: "#2F6B3A", darkColor: "#5FA968" },
    skadeGron: { color: "#2F6B3A", darkColor: "#5FA968" },
  },
};
