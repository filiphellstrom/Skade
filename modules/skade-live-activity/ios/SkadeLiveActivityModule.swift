import ExpoModulesCore
import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Läget appen vill att låsskärmen ska visa - byggs i src/liveActivity.ts
/// från databasen (databasen är facit).
struct LasskarmLage: Record {
  @Field var jaktdagId: String = ""
  @Field var jaktmark: String = ""
  @Field var hundNamn: String? = nil
  @Field var drevId: String? = nil
  @Field var drevStart: Double? = nil
  @Field var drevNummer: Int = 1
}

/// Brygga JS -> ActivityKit för Skades låsskärmskort (sprint 7).
///
/// Anropas bara från src/liveActivity.ts. Allt är no-op (och kastar aldrig
/// för "stöds inte") på iOS < 17 eller om Live Activities är avstängda för
/// appen - låsskärmen är en bonus, aldrig något som får hindra att en
/// jaktdag eller ett drev sparas.
public class SkadeLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SkadeLiveActivity")

    // Diagnostik: notera att appens JS-motor startat i den här processen
    // (modulen skapas när JS-runtime laddas). Jämförs med låsskärms-
    // knapparnas pid för att se om JS startar när en knapp trycks.
    OnCreate {
      let rad: [String: Any] = [
        "tid": Date().timeIntervalSince1970,
        "pid": Int(ProcessInfo.processInfo.processIdentifier),
      ]
      let d = UserDefaults.standard
      var lista = d.array(forKey: "skade.diagnostik.jsStarter") as? [[String: Any]] ?? []
      lista.append(rad)
      d.set(Array(lista.suffix(20)), forKey: "skade.diagnostik.jsStarter")
    }

    Function("areActivitiesEnabled") { () -> Bool in
      if #available(iOS 17.0, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    /// Visar exakt `lage` på låsskärmen: uppdaterar en aktiv aktivitet för
    /// samma jaktdag, annars (ingen, eller inaktuell efter iOS 8-timmars-
    /// gräns) startas en ny. Aktiviteter för andra jaktdagar avslutas.
    /// Returnerar "uppdaterad", "startad", "avstängd" eller "stöds inte".
    AsyncFunction("synka") { (lage: LasskarmLage) async throws -> String in
      if #available(iOS 17.0, *) {
        return try await SkadeActivities.synka(lage)
      }
      return "stöds inte"
    }

    /// Tar bort alla Skade-kort från låsskärmen (ingen pågående jaktdag).
    AsyncFunction("avslutaAlla") { () async -> Void in
      if #available(iOS 17.0, *) {
        await SkadeActivities.avslutaAlla()
      }
    }

    /// Mätpunkterna från låsskärmsknapparna och JS-starterna, som JSON.
    Function("diagnostik") { () -> String in
      let d = UserDefaults.standard
      let data: [String: Any] = [
        "intents": d.array(forKey: "skade.diagnostik.intents") ?? [],
        "jsStarter": d.array(forKey: "skade.diagnostik.jsStarter") ?? [],
        "pid": Int(ProcessInfo.processInfo.processIdentifier),
      ]
      guard let json = try? JSONSerialization.data(withJSONObject: data),
        let text = String(data: json, encoding: .utf8)
      else {
        return "{}"
      }
      return text
    }
  }
}

@available(iOS 17.0, *)
enum SkadeActivities {
  static func synka(_ lage: LasskarmLage) async throws -> String {
    let innehall = ActivityContent(
      state: SkadeJaktdagAttributes.ContentState(
        hundNamn: lage.hundNamn,
        drevId: lage.drevId,
        drevStart: lage.drevStart,
        drevNummer: lage.drevNummer
      ),
      staleDate: nil
    )

    var finns = false
    for activity in Activity<SkadeJaktdagAttributes>.activities {
      if activity.attributes.jaktdagId == lage.jaktdagId && activity.activityState == .active && !finns {
        await activity.update(innehall)
        finns = true
      } else {
        // Annan jaktdag, dubblett, eller inaktuell (8-timmarsgränsen):
        // bort med den. En ny startas nedan om det behövs.
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
    if finns {
      return "uppdaterad"
    }

    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      return "avstängd"
    }
    _ = try Activity.request(
      attributes: SkadeJaktdagAttributes(jaktdagId: lage.jaktdagId, jaktmark: lage.jaktmark),
      content: innehall,
      pushType: nil
    )
    return "startad"
  }

  static func avslutaAlla() async {
    for activity in Activity<SkadeJaktdagAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
