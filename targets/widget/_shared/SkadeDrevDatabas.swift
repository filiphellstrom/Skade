import Foundation
import SQLite3

/// Minimal, native skrivning mot appens egen SQLite-databas - bara det
/// StoppaDrevIntent behöver för att stoppa ett drev från låsskärmen.
///
/// HÅLL I SYNK med stoppaDrev() i src/db/queries/drev.ts: samma läsning
/// före skrivning och samma UPDATE (endTimestamp, duration, updatedAt).
/// Ingen egen valideringslogik utöver den som redan finns där - se
/// förstudien (claude/live-activity-jaktmark-forstudie.md, fråga 3).
///
/// Databasen ligger kvar i appens egen sandlåda (Documents/SQLite/skade.db,
/// där expo-sqlite lägger den) - INTE i en App Group. Det här körs bara i
/// appens process (LiveActivityIntent), aldrig i widget-processen.
@available(iOS 17.0, *)
enum SkadeDrevDatabas {
  enum Fel: Error, CustomLocalizedStringResourceConvertible {
    case kundeInteOppna
    case sqlFel(String)

    var localizedStringResource: LocalizedStringResource {
      switch self {
      case .kundeInteOppna:
        return "Kunde inte öppna Skades databas."
      case .sqlFel(let meddelande):
        return "Kunde inte stoppa drevet (\(meddelande))."
      }
    }
  }

  enum Resultat {
    /// Drevet var pågående och är nu stoppat.
    case stoppat
    /// Drevet var redan stoppat (t.ex. i appen) eller finns inte längre -
    /// inget att göra, låsskärmen ska bara städas bort.
    case ingetAttGora
  }

  static var databasUrl: URL {
    let dokument = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    return dokument.appendingPathComponent("SQLite").appendingPathComponent("skade.db")
  }

  static func stoppaDrev(id drevId: String, nu: Date = Date()) throws -> Resultat {
    var db: OpaquePointer?
    guard
      sqlite3_open_v2(databasUrl.path, &db, SQLITE_OPEN_READWRITE, nil) == SQLITE_OK,
      let db
    else {
      sqlite3_close(db)
      throw Fel.kundeInteOppna
    }
    defer { sqlite3_close(db) }

    // Appens egen anslutning (expo-sqlite) kan hålla ett lås en kort stund.
    sqlite3_busy_timeout(db, 3000)

    // 1. Läs drevet först - samma kontroll som stoppaDrev() i TypeScript.
    guard let startTimestamp = try lasPagaendeStart(db: db, drevId: drevId) else {
      return .ingetAttGora
    }

    // 2. Stoppa. `AND endTimestamp IS NULL` skyddar mot att appen hann
    // stoppa samma drev mellan läsningen och skrivningen.
    let sekunder = Int64(nu.timeIntervalSince1970)
    let duration = max(0, sekunder - startTimestamp)

    var stmt: OpaquePointer?
    let sql = "UPDATE Drev SET endTimestamp = ?, duration = ?, updatedAt = ? WHERE id = ? AND endTimestamp IS NULL"
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
      throw Fel.sqlFel(String(cString: sqlite3_errmsg(db)))
    }
    defer { sqlite3_finalize(stmt) }

    sqlite3_bind_int64(stmt, 1, sekunder)
    sqlite3_bind_int64(stmt, 2, duration)
    sqlite3_bind_int64(stmt, 3, sekunder)
    sqlite3_bind_text(stmt, 4, drevId, -1, SQLITE_TRANSIENT_SKADE)

    guard sqlite3_step(stmt) == SQLITE_DONE else {
      throw Fel.sqlFel(String(cString: sqlite3_errmsg(db)))
    }
    return sqlite3_changes(db) > 0 ? .stoppat : .ingetAttGora
  }

  /// startTimestamp för drevet om det pågår, annars nil (stoppat/saknas).
  private static func lasPagaendeStart(db: OpaquePointer, drevId: String) throws -> Int64? {
    var stmt: OpaquePointer?
    let sql = "SELECT startTimestamp FROM Drev WHERE id = ? AND endTimestamp IS NULL"
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
      throw Fel.sqlFel(String(cString: sqlite3_errmsg(db)))
    }
    defer { sqlite3_finalize(stmt) }

    sqlite3_bind_text(stmt, 1, drevId, -1, SQLITE_TRANSIENT_SKADE)

    switch sqlite3_step(stmt) {
    case SQLITE_ROW:
      return sqlite3_column_int64(stmt, 0)
    case SQLITE_DONE:
      return nil
    default:
      throw Fel.sqlFel(String(cString: sqlite3_errmsg(db)))
    }
  }
}

/// SQLITE_TRANSIENT finns inte som Swift-konstant - SQLite ska kopiera
/// strängen direkt eftersom Swift-strängens buffert är tillfällig.
private let SQLITE_TRANSIENT_SKADE = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
