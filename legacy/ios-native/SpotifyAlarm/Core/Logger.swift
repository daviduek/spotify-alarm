import Foundation
import os.log

enum AppLog {
    static let subsystem = Bundle.main.bundleIdentifier ?? "com.daviduek.spotifyalarm"
    static let auth = Logger(subsystem: subsystem, category: "auth")
    static let api = Logger(subsystem: subsystem, category: "api")
    static let appRemote = Logger(subsystem: subsystem, category: "appRemote")
    static let engine = Logger(subsystem: subsystem, category: "engine")
    static let ui = Logger(subsystem: subsystem, category: "ui")
}
