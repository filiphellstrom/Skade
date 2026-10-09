import ActivityKit
import SwiftUI
import WidgetKit

/// Live Activity för ett pågående drev: hundens namn, jaktmark och en
/// löpande klocka. Klockan räknas av systemet (Text(timerInterval:)) från
/// drevets starttid, så appen behöver inte uppdatera aktiviteten varje
/// sekund - och klockan fortsätter gå även om appen är suspenderad.
///
/// Stoppknappen (iOS 17+) kör StoppaDrevIntent i _shared/.
struct SkadeDrevLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: SkadeDrevAttributes.self) { context in
      SkadeLasskarmVy(context: context)
        .activityBackgroundTint(Color.black.opacity(0.8))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label(context.state.hundNamn, systemImage: "pawprint.fill")
            .font(.headline)
            .foregroundColor(Color("skadeGron"))
            .lineLimit(1)
        }
        DynamicIslandExpandedRegion(.trailing) {
          DrevKlocka(start: context.state.startTimestamp)
            .font(.title2.weight(.semibold))
            .frame(maxWidth: 110, alignment: .trailing)
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Text(context.attributes.jaktmark)
              .font(.subheadline)
              .foregroundColor(.secondary)
              .lineLimit(1)
            Spacer()
            StoppKnapp(drevId: context.attributes.drevId)
          }
        }
      } compactLeading: {
        Image(systemName: "pawprint.fill")
          .foregroundColor(Color("skadeGron"))
      } compactTrailing: {
        DrevKlocka(start: context.state.startTimestamp)
          .frame(maxWidth: 64)
      } minimal: {
        Image(systemName: "pawprint.fill")
          .foregroundColor(Color("skadeGron"))
      }
    }
  }
}

private struct SkadeLasskarmVy: View {
  let context: ActivityViewContext<SkadeDrevAttributes>

  var body: some View {
    HStack(alignment: .center, spacing: 16) {
      VStack(alignment: .leading, spacing: 4) {
        Label("Drev pågår", systemImage: "pawprint.fill")
          .font(.caption.weight(.semibold))
          .foregroundColor(Color("skadeGron"))
        Text(context.state.hundNamn)
          .font(.title3.weight(.bold))
          .foregroundColor(.white)
          .lineLimit(1)
        Text(context.attributes.jaktmark)
          .font(.subheadline)
          .foregroundColor(.white.opacity(0.7))
          .lineLimit(1)
      }
      Spacer(minLength: 8)
      VStack(alignment: .trailing, spacing: 8) {
        DrevKlocka(start: context.state.startTimestamp)
          .font(.system(size: 34, weight: .semibold))
          .foregroundColor(.white)
        StoppKnapp(drevId: context.attributes.drevId)
      }
    }
    .padding(16)
  }
}

/// Stoppar drevet direkt från låsskärmen (iOS 17+). På iOS 16 visas
/// kortet utan knapp - då stoppar man i appen som vanligt.
private struct StoppKnapp: View {
  let drevId: String

  var body: some View {
    if #available(iOS 17.0, *) {
      Button(intent: StoppaDrevIntent(drevId: drevId)) {
        Label("Stoppa", systemImage: "stop.fill")
          .font(.headline)
          .padding(.horizontal, 6)
      }
      .buttonStyle(.borderedProminent)
      .tint(Color(red: 0.70, green: 0.15, blue: 0.12))
    }
  }
}

/// Löpande mm:ss / h:mm:ss från drevets start.
private struct DrevKlocka: View {
  let start: Double

  var body: some View {
    let startDatum = Date(timeIntervalSince1970: start)
    Text(timerInterval: startDatum...Date.distantFuture, countsDown: false)
      .monospacedDigit()
      .multilineTextAlignment(.trailing)
  }
}
