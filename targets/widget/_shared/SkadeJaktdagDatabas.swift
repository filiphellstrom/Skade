import Foundation
import SQLite3

/// Native läsning och skrivning mot appens egen SQLite-databas - bara det
/// låsskärmsknapparna (StartaDrevIntent, StoppaDrevIntent) behöver.
///
/// HÅLL I SYNK med src/db/queries/drev.ts:
/// - startaDrev(): samma INSERT. Databasens unika index
///   idx_one_active_drev_per_jaktdag garanterar max ett pågående drev.
/// - stoppaDrev(): samma läsning före skrivning och samma UPDATE
///   (endTimestamp, duration, updatedAt).
/// Ingen egen valideringsregel utöver de som redan finns där (förstudien,
/// fråga 3). Viltart och utfall förblir NULL - kompletteras i Historik.
///
/// Databasen ligger kvar i appens egen sandlåda (Documents/SQLite/skade.db,
/// där expo-sqlite lägger den) - INTE i en App Group (0xdead10cc-risken).
/// Körs bara i appens process (LiveActivityIntent), aldrig i widgeten.
@available(iOS 17.0, *)
enum SkadeJaktdagDatabas {
  enum Fel: Error, CustomLocalizedStringResourceConvertible {
    case kundeInteOppna
    case sqlFel(String)

    var localizedStringResource: LocalizedStringResource {
      switch self {
      case .kundeInteOppna:
        return "Kunde inte öppna Skades databas."
      case .sqlFel(let meddelande):
        return "Skade kunde inte spara (\(meddelande))."
      }
    }
  }

  /// Jaktdagens läge enligt databasen - facit för vad låsskärmen visar.
  struct Lage {
    var pagar: Bool
    var hundId: String?
    var hundNamn: String?
    var drevId: String?
    var drevStart: Int64?
    var antalDrev: Int

    var innehall: SkadeJaktdagAttributes.ContentState {
      SkadeJaktdagAttributes.ContentState(
        hundNamn: hundNamn,
        drevId: drevId,
        drevStart: drevStart.map(Double.init),
        drevNummer: drevId != nil ? max(antalDrev, 1) : antalDrev + 1
      )
    }
  }

  static var databasUrl: URL {
    let dokument = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    return dokument.appendingPathComponent("SQLite").appendingPathComponent("skade.db")
  }

  private static func oppna() throws -> OpaquePointer {
    var db: OpaquePointer?
    guard sqlite3_open_v2(databasUrl.path, &db, SQLITE_OPEN_READWRITE, nil) == SQLITE_OK,
      let oppnad = db
    else {
      sqlite3_close(db)
      throw Fel.kundeInteOppna
    }
    // Appens egen anslutning (expo-sqlite) kan hålla ett lås en kort stund.
    sqlite3_busy_timeout(oppnad, 3000)
    return oppnad
  }

  private static func fel(_ db: OpaquePointer) -> Fel {
    Fel.sqlFel(String(cString: sqlite3_errmsg(db)))
  }

  /// Läser jaktdagens läge. nil = jaktdagen finns inte.
  static func lasLage(jaktdagId: String) throws -> Lage? {
    let db = try oppna()
    defer { sqlite3_close(db) }
    return try lasLage(db: db, jaktdagId: jaktdagId)
  }

  private static func lasLage(db: OpaquePointer, jaktdagId: String) throws -> Lage? {
    var lage: Lage?

    try fraga(
      db,
      "SELECT j.status, j.aktivHundId, h.namn FROM Jaktdag j LEFT JOIN Hund h ON h.id = j.aktivHundId WHERE j.id = ?",
      [jaktdagId]
    ) { stmt in
      lage = Lage(
        pagar: text(stmt, 0) == "pagar",
        hundId: text(stmt, 1),
        hundNamn: text(stmt, 2),
        drevId: nil,
        drevStart: nil,
        antalDrev: 0
      )
    }
    guard var funnet = lage else {
      return nil
    }

    try fraga(
      db,
      "SELECT id, startTimestamp FROM Drev WHERE jaktdagId = ? AND endTimestamp IS NULL",
      [jaktdagId]
    ) { stmt in
      funnet.drevId = text(stmt, 0)
      funnet.drevStart = sqlite3_column_int64(stmt, 1)
    }

    try fraga(db, "SELECT COUNT(*) FROM Drev WHERE jaktdagId = ?", [jaktdagId]) { stmt in
      funnet.antalDrev = Int(sqlite3_column_int64(stmt, 0))
    }
    return funnet
  }

  /// Startar ett drev för jaktdagens aktiva hund. Gör ingenting om
  /// jaktdagen är avslutad, saknar aktiv hund eller redan har ett
  /// pågående drev (t.ex. startat i appen) - då visar låsskärmen bara
  /// rätt läge efteråt. Returnerar true om ett drev startades.
  @discardableResult
  static func startaDrev(jaktdagId: String, nu: Date = Date()) throws -> Bool {
    let db = try oppna()
    defer { sqlite3_close(db) }

    guard let lage = try lasLage(db: db, jaktdagId: jaktdagId),
      lage.pagar,
      let hundId = lage.hundId,
      lage.drevId == nil
    else {
      return false
    }

    let sekunder = Int64(nu.timeIntervalSince1970)
    let id = UUID().uuidString.lowercased()
    let ok = try skriv(
      db,
      """
      INSERT INTO Drev (id, jaktdagId, hundId, startTimestamp, endTimestamp, duration, species, outcome, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
      """,
      [id, jaktdagId, hundId, sekunder, sekunder, sekunder],
      tillatUnikKrock: true
    )
    return ok
  }

  /// Stoppar jaktdagens pågående drev - men bara om det är det drev
  /// låsskärmen visade (forvantatDrevId). Har appen hunnit stoppa det och
  /// starta ett nytt stoppas inte det nya av en gammal knapp.
  /// Returnerar true om ett drev stoppades.
  @discardableResult
  static func stoppaDrev(jaktdagId: String, forvantatDrevId: String, nu: Date = Date()) throws -> Bool {
    let db = try oppna()
    defer { sqlite3_close(db) }

    guard let lage = try lasLage(db: db, jaktdagId: jaktdagId),
      let drevId = lage.drevId,
      drevId == forvantatDrevId,
      let start = lage.drevStart
    else {
      return false
    }

    let sekunder = Int64(nu.timeIntervalSince1970)
    let duration = max(0, sekunder - start)
    try skriv(
      db,
      "UPDATE Drev SET endTimestamp = ?, duration = ?, updatedAt = ? WHERE id = ? AND endTimestamp IS NULL",
      [sekunder, duration, sekunder, drevId]
    )
    return sqlite3_changes(db) > 0
  }

  // MARK: - SQLite-hjälp

  private static func bind(_ stmt: OpaquePointer?, _ varden: [Any]) {
    for (i, v) in varden.enumerated() {
      let index = Int32(i + 1)
      if let s = v as? String {
        sqlite3_bind_text(stmt, index, s, -1, SQLITE_TRANSIENT_SKADE)
      } else if let n = v as? Int64 {
        sqlite3_bind_int64(stmt, index, n)
      }
    }
  }

  private static func text(_ stmt: OpaquePointer?, _ kolumn: Int32) -> String? {
    guard let c = sqlite3_column_text(stmt, kolumn) else {
      return nil
    }
    return String(cString: c)
  }

  private static func fraga(
    _ db: OpaquePointer,
    _ sql: String,
    _ varden: [Any],
    rad: (OpaquePointer?) -> Void
  ) throws {
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
      throw fel(db)
    }
    defer { sqlite3_finalize(stmt) }
    bind(stmt, varden)
    while true {
      let r = sqlite3_step(stmt)
      if r == SQLITE_ROW {
        rad(stmt)
      } else if r == SQLITE_DONE {
        return
      } else {
        throw fel(db)
      }
    }
  }

  /// Kör en skrivning. Med tillatUnikKrock räknas ett brott mot ett unikt
  /// index (t.ex. att ett drev hann startas i appen) som "inget gjordes".
  @discardableResult
  private static func skriv(
    _ db: OpaquePointer,
    _ sql: String,
    _ varden: [Any],
    tillatUnikKrock: Bool = false
  ) throws -> Bool {
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
      throw fel(db)
    }
    defer { sqlite3_finalize(stmt) }
    bind(stmt, varden)
    let r = sqlite3_step(stmt)
    if r == SQLITE_DONE {
      return true
    }
    if tillatUnikKrock && sqlite3_extended_errcode(db) == SQLITE_CONSTRAINT_UNIQUE_SKADE {
      return false
    }
    throw fel(db)
  }
}

/// SQLITE_CONSTRAINT_UNIQUE är ett sammansatt C-makro (SQLITE_CONSTRAINT |
/// (8 << 8)) som Swift inte importerar säkert - värdet skrivs ut här.
private let SQLITE_CONSTRAINT_UNIQUE_SKADE: Int32 = 2067

/// SQLITE_TRANSIENT finns inte som Swift-konstant - SQLite ska kopiera
/// strängen direkt eftersom Swift-strängens buffert är tillfällig.
private let SQLITE_TRANSIENT_SKADE = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
