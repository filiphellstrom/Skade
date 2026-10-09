import ActivityKit
import Foundation

/// Datan en Skade-Live Activity bär med sig.
///
/// OBS: exakt samma struct finns i
/// targets/widget/_shared/SkadeDrevAttributes.swift (widget-extensionen
/// och huvudappen). ActivityKit matchar de två på
/// typnamn och fält, så de MÅSTE hållas identiska - ändra båda samtidigt.
@available(iOS 16.1, *)
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
