import ActivityKit
import Foundation

/// Datan en Skade-Live Activity bär med sig.
///
/// OBS: exakt samma struct finns i
/// modules/skade-live-activity/ios/SkadeDrevAttributes.swift (appens sida,
/// som startar/avslutar aktiviteten). ActivityKit matchar de två på
/// typnamn och fält, så de MÅSTE hållas identiska - ändra båda samtidigt.
struct SkadeDrevAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// Hunden som driver just nu.
    var hundNamn: String
    /// Drevets start, unix-sekunder (samma som Drev.startTimestamp i
    /// databasen). Klockan räknas av systemet utifrån detta.
    var startTimestamp: Double
  }

  /// Drev.id i databasen - används för att avgöra om aktiviteten hör till
  /// det drev som faktiskt pågår (se src/liveActivity.ts).
  var drevId: String
  /// Jaktmarkens namn, visas under hundnamnet.
  var jaktmark: String
}
