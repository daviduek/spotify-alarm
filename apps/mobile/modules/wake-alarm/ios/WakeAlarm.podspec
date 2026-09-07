Pod::Spec.new do |s|
  s.name           = 'WakeAlarm'
  s.version        = '0.1.0'
  s.summary        = 'Wake native alarm engine for iOS (AlarmKit).'
  s.description    = 'Schedules, stops and snoozes system alarms through AlarmKit and bundles the Wake fallback sounds.'
  s.author         = 'Wake'
  s.homepage       = 'https://github.com/daviduek/spotify-alarm'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # AlarmKit only exists on iOS 26+. Weak-link so the binary still launches on
  # older iOS versions; every call site is guarded with `#available(iOS 26, *)`.
  s.weak_frameworks = 'AlarmKit'

  # Fallback sounds are copied into the main app bundle so AlarmKit's
  # `.named("wake_classic.wav")` can resolve them without JavaScript.
  s.resources = 'Sounds/*.wav'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
