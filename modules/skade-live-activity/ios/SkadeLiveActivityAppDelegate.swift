import ExpoModulesCore
import UIKit

/// Tar bort Skades låsskärmskort när appen stängs helt (Filip 2026-10-09:
/// "Det ska inte vara med på låsskärmen när appen är nedstängd och
/// avslutad").
///
/// iOS anropar applicationWillTerminate bara om appen fortfarande KÖR när
/// den sveps bort i appväxlaren - en app som redan har pausats (suspended)
/// dödas utan förvarning, och då ligger kortet kvar. För att täcka det
/// vanliga fallet (lämna appen och svep bort den direkt) ber appen om
/// extra bakgrundstid när den går till bakgrunden, så att den hinner få
/// anropet. iOS ger normalt runt 30 sekunder.
///
/// Registreras i expo-module.config.json (appDelegateSubscribers) och
/// körs därför även om appens JS inte har startat.
public class SkadeLiveActivityAppDelegate: ExpoAppDelegateSubscriber {
  private var bakgrundsjobb: UIBackgroundTaskIdentifier = .invalid

  public func applicationDidEnterBackground(_ application: UIApplication) {
    guard bakgrundsjobb == .invalid else {
      return
    }
    bakgrundsjobb = application.beginBackgroundTask(withName: "SkadeLasskarm") { [weak self] in
      self?.slappJobb(application)
    }
  }

  public func applicationWillEnterForeground(_ application: UIApplication) {
    slappJobb(application)
  }

  public func applicationWillTerminate(_ application: UIApplication) {
    if #available(iOS 17.0, *) {
      SkadeActivities.avslutaAllaInnanAvslut()
    }
  }

  private func slappJobb(_ application: UIApplication) {
    if bakgrundsjobb != .invalid {
      application.endBackgroundTask(bakgrundsjobb)
      bakgrundsjobb = .invalid
    }
  }
}
