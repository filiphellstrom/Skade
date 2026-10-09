import ActivityKit
import Foundation

/// Datan en Skade-Live Activity bär med sig. EN aktivitet per pågående
/// jaktdag (sprint 7): den startas när jaktdagen har en aktiv hund, ligger
/// kvar hela dagen och växlar mellan "redo" och "drev pågår".
///
/// Tre identiska kopior måste hållas i synk (ActivityKit matchar dem på
/// typnamn och fält):
/// - targets/widget/_shared/SkadeJaktdagAttributes.swift (den här - widgeten
///   och huvudappen, där intenten körs),
/// - modules/skade-live-activity/ios/SkadeJaktdagAttributes.swift
///   (bryggmodulen som startar/uppdaterar aktiviteten från JS).
@available(iOS 16.1, *)
struct SkadeJaktdagAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// Aktiv hunds namn, nil = ingen hund vald än (då visas ingen knapp).
    var hundNamn: String?
    /// Pågående drevets id, nil = inget drev pågår.
    var drevId: String?
    /// Pågående drevets start, unix-sekunder (samma som Drev.startTimestamp).
    var drevStart: Double?
    /// Pågående drevets nummer, eller nästa drevs nummer om inget pågår.
    var drevNummer: Int
  }

  /// Jaktdag.id i databasen.
  var jaktdagId: String
  /// Jaktmarkens namn.
  var jaktmark: String
}
