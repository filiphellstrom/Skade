import ActivityKit
import AppIntents
import Foundation

/// "Stoppa"-knappen på låsskärmens Live Activity.
///
/// Ligger i targets/widget/_shared/ och kompileras in i både widgeten (som
/// ritar knappen) och huvudappen. Eftersom den är en LiveActivityIntent
/// kör iOS perform() i APPENS process, inte i widget-processen - därför
/// kan den skriva till appens databas (se SkadeDrevDatabas.swift).
///
/// Databasen är facit: drevet stoppas där först. Bara om det lyckas (eller
/// drevet redan var stoppat) tas aktiviteten bort från låsskärmen. Kastar
/// perform() ett fel ligger kortet kvar, så det aldrig ser ut som att ett
/// drev sparats när det inte gjorts.
///
/// Viltart/utfall sätts inte här - de förblir NULL och kan fyllas i senare
/// från historiken, precis som när man stoppar i appen och hoppar över.
@available(iOS 17.0, *)
struct StoppaDrevIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stoppa drev"
  static var description = IntentDescription("Stoppar det pågående drevet i Skade.")
  static var isDiscoverable: Bool = false

  @Parameter(title: "Drev-id")
  var drevId: String

  init() {}

  init(drevId: String) {
    self.drevId = drevId
  }

  func perform() async throws -> some IntentResult {
    _ = try SkadeDrevDatabas.stoppaDrev(id: drevId)

    for activity in Activity<SkadeDrevAttributes>.activities
    where activity.attributes.drevId == drevId {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
    return .result()
  }
}
