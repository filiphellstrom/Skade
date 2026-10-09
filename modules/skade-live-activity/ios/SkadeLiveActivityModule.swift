import ExpoModulesCore
import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Brygga JS -> ActivityKit för drevklockan på låsskärmen.
///
/// Anropas bara från src/liveActivity.ts. Alla funktioner är no-ops (och
/// kastar aldrig för "stöds inte") på iOS < 16.2 eller om användaren
/// stängt av Live Activities för appen - låsskärmen är en bonus, aldrig
/// något som får hindra att ett drev sparas.
public class SkadeLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SkadeLiveActivity")

    Function("areActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    /// drevId för den Live Activity som visas just nu, eller nil.
    Function("currentDrevId") { () -> String? in
      if #available(iOS 16.2, *) {
        return SkadeActivities.aktivaDrevId()
      }
      return nil
    }

    /// Avslutar ev. gamla aktiviteter och startar en ny för drevet.
    /// Returnerar aktivitetens id, eller nil om Live Activities inte är
    /// tillgängliga.
    AsyncFunction("startDrev") {
      (drevId: String, jaktmark: String, hundNamn: String, startTimestamp: Double) async throws -> String? in
      if #available(iOS 16.2, *) {
        return try await SkadeActivities.starta(
          drevId: drevId,
          jaktmark: jaktmark,
          hundNamn: hundNamn,
          startTimestamp: startTimestamp
        )
      }
      return nil
    }

    /// Avslutar alla Skade-aktiviteter direkt (försvinner från låsskärmen).
    AsyncFunction("endAll") { () async -> Void in
      if #available(iOS 16.2, *) {
        await SkadeActivities.avslutaAlla()
      }
    }
  }
}

@available(iOS 16.2, *)
enum SkadeActivities {
  static func aktivaDrevId() -> String? {
    return Activity<SkadeDrevAttributes>.activities
      .first(where: { $0.activityState == .active })?
      .attributes.drevId
  }

  static func starta(
    drevId: String,
    jaktmark: String,
    hundNamn: String,
    startTimestamp: Double
  ) async throws -> String? {
    await avslutaAlla()

    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      return nil
    }

    let attributes = SkadeDrevAttributes(drevId: drevId, jaktmark: jaktmark)
    let state = SkadeDrevAttributes.ContentState(
      hundNamn: hundNamn,
      startTimestamp: startTimestamp
    )
    let activity = try Activity.request(
      attributes: attributes,
      content: ActivityContent(state: state, staleDate: nil),
      pushType: nil
    )
    return activity.id
  }

  static func avslutaAlla() async {
    for activity in Activity<SkadeDrevAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
