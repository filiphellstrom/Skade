import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

/// Live Activity för en pågående jaktdag (sprint 7). Visar aktiv hund,
/// jaktmark och drevnummer, en löpande klocka när ett drev pågår och en
/// knapp som växlar mellan Starta och Stoppa drev - fungerar med låst
/// skärm. Klockan räknas av systemet (Text(timerInterval:)), så appen
/// behöver inte uppdatera aktiviteten varje sekund.
///
/// Färger enligt Design Systemet: Starta i brand-grönt, Stoppa i signal,
/// alltid ord + ikon (grönt och rött skiljer sig inte nog i ljushet).
struct SkadeDrevLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: SkadeJaktdagAttributes.self) { context in
      SkadeLasskarmVy(context: context)
        .activityBackgroundTint(Color.black.opacity(0.85))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text(context.state.hundNamn ?? "Ingen hund vald")
              .font(.headline)
              .lineLimit(1)
            Text("Drev \(context.state.drevNummer)")
              .font(.caption)
              .foregroundColor(.secondary)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          DrevTid(state: context.state)
            .font(.title2.weight(.semibold))
            .frame(maxWidth: 120, alignment: .trailing)
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Text(context.attributes.jaktmark)
              .font(.subheadline)
              .foregroundColor(.secondary)
              .lineLimit(1)
            Spacer()
            DrevKnapp(jaktdagId: context.attributes.jaktdagId, state: context.state)
          }
        }
      } compactLeading: {
        Image(systemName: "pawprint.fill")
          .foregroundColor(Color("skadeGron"))
      } compactTrailing: {
        if context.state.drevStart != nil {
          DrevTid(state: context.state)
            .frame(maxWidth: 64)
        } else {
          Image(systemName: "play.fill")
            .foregroundColor(Color("skadeGron"))
        }
      } minimal: {
        Image(systemName: context.state.drevStart != nil ? "pawprint.fill" : "play.fill")
          .foregroundColor(Color("skadeGron"))
      }
    }
  }
}

private struct SkadeLasskarmVy: View {
  let context: ActivityViewContext<SkadeJaktdagAttributes>

  var body: some View {
    let pagar = context.state.drevStart != nil
    HStack(alignment: .center, spacing: 16) {
      VStack(alignment: .leading, spacing: 4) {
        Label(pagar ? "Drev pågår" : "Jaktdag pågår", systemImage: "pawprint.fill")
          .font(.caption.weight(.semibold))
          .foregroundColor(Color("skadeGron"))
        Text(context.state.hundNamn ?? "Välj hund i appen")
          .font(.title3.weight(.bold))
          .foregroundColor(.white)
          .lineLimit(1)
        Text("\(context.attributes.jaktmark) · Drev \(context.state.drevNummer)")
          .font(.subheadline)
          .foregroundColor(.white.opacity(0.7))
          .lineLimit(1)
      }
      Spacer(minLength: 8)
      VStack(alignment: .trailing, spacing: 8) {
        DrevTid(state: context.state)
          .font(.system(size: 34, weight: .semibold))
          .foregroundColor(pagar ? .white : .white.opacity(0.55))
        DrevKnapp(jaktdagId: context.attributes.jaktdagId, state: context.state)
      }
    }
    .padding(16)
  }
}

/// Starta eller Stoppa beroende på läget. Ingen knapp utan aktiv hund -
/// hundbyte och hundval kräver appen.
private struct DrevKnapp: View {
  let jaktdagId: String
  let state: SkadeJaktdagAttributes.ContentState

  var body: some View {
    if let drevId = state.drevId {
      Button(intent: StoppaDrevIntent(jaktdagId: jaktdagId, drevId: drevId)) {
        Label("Stoppa", systemImage: "stop.fill")
          .font(.headline)
          .padding(.horizontal, 6)
      }
      .buttonStyle(.borderedProminent)
      .tint(Color(red: 0.71, green: 0.21, blue: 0.12))
    } else if state.hundNamn != nil {
      Button(intent: StartaDrevIntent(jaktdagId: jaktdagId)) {
        Label("Starta", systemImage: "play.fill")
          .font(.headline)
          .padding(.horizontal, 6)
      }
      .buttonStyle(.borderedProminent)
      .tint(Color("skadeGron"))
    }
  }
}

/// Löpande mm:ss / h:mm:ss från drevets start, eller 00:00 när inget pågår.
private struct DrevTid: View {
  let state: SkadeJaktdagAttributes.ContentState

  var body: some View {
    if let start = state.drevStart {
      Text(timerInterval: Date(timeIntervalSince1970: start)...Date.distantFuture, countsDown: false)
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
    } else {
      Text("00:00")
        .monospacedDigit()
    }
  }
}
