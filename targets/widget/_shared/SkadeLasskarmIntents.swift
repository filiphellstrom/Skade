import ActivityKit
import AppIntents
import Foundation

/// Starta- och Stoppa-knapparna på låsskärmens Live Activity.
///
/// Ligger i targets/widget/_shared/ och kompileras in i både widgeten (som
/// ritar knappen) och huvudappen. Som LiveActivityIntent kör iOS perform()
/// i APPENS process, inte i widget-processen - därför kan de skriva till
/// appens databas (SkadeJaktdagDatabas.swift).
///
/// Databasen är facit: skrivningen görs först, och sedan ritas kortet om
/// från det databasen säger (SkadeLasskarm.uppdatera). Kastar skrivningen
/// ett fel lämnas kortet orört - det ska aldrig se ut som att ett drev
/// sparats när det inte gjorts.
@available(iOS 17.0, *)
struct StartaDrevIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Starta drev"
  static var description = IntentDescription("Startar ett drev för aktiv hund i Skade.")
  static var isDiscoverable: Bool = false

  @Parameter(title: "Jaktdag-id")
  var jaktdagId: String

  init() {}

  init(jaktdagId: String) {
    self.jaktdagId = jaktdagId
  }

  func perform() async throws -> some IntentResult {
    let start = Date()
    do {
      let gjort = try SkadeJaktdagDatabas.startaDrev(jaktdagId: jaktdagId)
      await SkadeLasskarm.uppdatera(jaktdagId: jaktdagId)
      SkadeDiagnostik.loggaIntent(typ: "Starta", start: start, resultat: gjort ? "startat" : "inget att göra")
    } catch {
      SkadeDiagnostik.loggaIntent(typ: "Starta", start: start, resultat: "fel: \(error)")
      throw error
    }
    return .result()
  }
}

@available(iOS 17.0, *)
struct StoppaDrevIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stoppa drev"
  static var description = IntentDescription("Stoppar det pågående drevet i Skade.")
  static var isDiscoverable: Bool = false

  @Parameter(title: "Jaktdag-id")
  var jaktdagId: String

  /// Drevet kortet visade när man tryckte - se stoppaDrev(forvantatDrevId:).
  @Parameter(title: "Drev-id")
  var drevId: String

  init() {}

  init(jaktdagId: String, drevId: String) {
    self.jaktdagId = jaktdagId
    self.drevId = drevId
  }

  func perform() async throws -> some IntentResult {
    let start = Date()
    do {
      let gjort = try SkadeJaktdagDatabas.stoppaDrev(jaktdagId: jaktdagId, forvantatDrevId: drevId)
      await SkadeLasskarm.uppdatera(jaktdagId: jaktdagId)
      SkadeDiagnostik.loggaIntent(typ: "Stoppa", start: start, resultat: gjort ? "stoppat" : "inget att göra")
    } catch {
      SkadeDiagnostik.loggaIntent(typ: "Stoppa", start: start, resultat: "fel: \(error)")
      throw error
    }
    return .result()
  }
}

/// Ritar om låsskärmskortet från databasen efter en knapptryckning.
@available(iOS 17.0, *)
enum SkadeLasskarm {
  static func uppdatera(jaktdagId: String) async {
    let lage = try? SkadeJaktdagDatabas.lasLage(jaktdagId: jaktdagId)
    for activity in Activity<SkadeJaktdagAttributes>.activities
    where activity.attributes.jaktdagId == jaktdagId {
      if let lage, lage.pagar {
        await activity.update(ActivityContent(state: lage.innehall, staleDate: nil))
      } else {
        // Jaktdagen är avslutad eller borta: kortet ska bort.
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}

/// Mätpunkter för förstudiens obesvarade frågor, som bara kan besvaras på
/// en riktig iPhone. Sparas i appens UserDefaults (ingen App Group
/// behövs - intenten körs i appens process) och visas under
/// Inställningar → Låsskärmsdiagnostik.
///
/// - Latens: tiden från perform() startar till databas + kort är klara.
/// - Force-quit: varje rad sparar processens pid. Bryggmodulen sparar pid
///   när appens JS startar. Ett intent-pid som inte finns bland tidigare
///   JS-starter = iOS startade en ny process för knappen.
/// - Hermes/JS: finns en JS-start med samma pid strax efter intenten
///   startade JS i den processen; annars kördes bara Swift.
enum SkadeDiagnostik {
  static let intentNyckel = "skade.diagnostik.intents"
  static let jsNyckel = "skade.diagnostik.jsStarter"

  static func loggaIntent(typ: String, start: Date, resultat: String) {
    let rad: [String: Any] = [
      "typ": typ,
      "tid": start.timeIntervalSince1970,
      "ms": Int(Date().timeIntervalSince(start) * 1000),
      "pid": Int(ProcessInfo.processInfo.processIdentifier),
      "resultat": resultat,
    ]
    lagg(rad, under: intentNyckel)
  }

  static func lagg(_ rad: [String: Any], under nyckel: String) {
    let d = UserDefaults.standard
    var lista = d.array(forKey: nyckel) as? [[String: Any]] ?? []
    lista.append(rad)
    d.set(Array(lista.suffix(20)), forKey: nyckel)
  }
}
