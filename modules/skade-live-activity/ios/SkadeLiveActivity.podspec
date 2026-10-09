Pod::Spec.new do |s|
  s.name           = 'SkadeLiveActivity'
  s.version        = '0.1.0'
  s.summary        = 'Startar och avslutar Skades Live Activity (drevklockan på låsskärmen).'
  s.description    = 'Lokal Expo-modul i Skade-appen. Brygga JS -> ActivityKit.'
  s.license        = 'UNLICENSED'
  s.author         = 'Skade'
  s.homepage       = 'https://github.com/filiphellstrom/Skade'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Svagt länkad: appen stödjer iOS 15.1, ActivityKit finns från 16.1.
  s.weak_frameworks = 'ActivityKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
