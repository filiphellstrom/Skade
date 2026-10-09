import ActivityKit
import Foundation

/// KOPIA av targets/widget/_shared/SkadeJaktdagAttributes.swift - måste
/// vara identisk (ActivityKit matchar på typnamn och fält). Ändra båda
/// samtidigt. Se kommentaren i originalet.
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
