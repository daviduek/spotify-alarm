import Foundation
import SwiftData

@Model
final class Alarm: Identifiable {
    @Attribute(.unique) var id: UUID
    var label: String
    var hour: Int
    var minute: Int
    var isEnabled: Bool
    var repeatDaysRaw: Int

    // Spotify content
    var contentURI: String
    var contentTitle: String
    var contentSubtitle: String
    var contentArtworkURL: String?
    var contentKindRaw: String

    // Volume ramp
    var startVolume: Int          // 0-100
    var endVolume: Int            // 0-100
    var rampStepSeconds: Int      // intervalo de subida en segundos
    var rampStepDelta: Int        // cuánto sube por intervalo (puntos %)

    var createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        label: String = "Alarma",
        hour: Int,
        minute: Int,
        isEnabled: Bool = true,
        repeatDays: Set<Weekday> = [],
        content: SpotifyContent,
        ramp: VolumeRamp,
        createdAt: Date = .now
    ) {
        self.id = id
        self.label = label
        self.hour = hour
        self.minute = minute
        self.isEnabled = isEnabled
        self.repeatDaysRaw = Weekday.mask(repeatDays)
        self.contentURI = content.uri
        self.contentTitle = content.title
        self.contentSubtitle = content.subtitle
        self.contentArtworkURL = content.artworkURL
        self.contentKindRaw = content.kind.rawValue
        self.startVolume = ramp.startVolume
        self.endVolume = ramp.endVolume
        self.rampStepSeconds = ramp.stepSeconds
        self.rampStepDelta = ramp.stepDelta
        self.createdAt = createdAt
        self.updatedAt = createdAt
    }

    var repeatDays: Set<Weekday> {
        get { Weekday.from(mask: repeatDaysRaw) }
        set { repeatDaysRaw = Weekday.mask(newValue) }
    }

    var content: SpotifyContent {
        SpotifyContent(
            uri: contentURI,
            title: contentTitle,
            subtitle: contentSubtitle,
            artworkURL: contentArtworkURL,
            kind: SpotifyContent.Kind(rawValue: contentKindRaw) ?? .track
        )
    }

    var ramp: VolumeRamp {
        VolumeRamp(
            startVolume: startVolume,
            endVolume: endVolume,
            stepSeconds: rampStepSeconds,
            stepDelta: rampStepDelta
        )
    }

    /// Next fire date in the user's current timezone.
    func nextFireDate(after reference: Date = .now, calendar: Calendar = .current) -> Date? {
        var comps = DateComponents()
        comps.hour = hour
        comps.minute = minute
        comps.second = 0

        if repeatDays.isEmpty {
            return calendar.nextDate(after: reference, matching: comps, matchingPolicy: .nextTime)
        }

        // Repeating: find the next matching weekday.
        for offset in 0..<8 {
            guard let candidate = calendar.date(byAdding: .day, value: offset, to: reference),
                  let day = Weekday(date: candidate, calendar: calendar)
            else { continue }
            if !repeatDays.contains(day) { continue }
            var dayComps = calendar.dateComponents([.year, .month, .day], from: candidate)
            dayComps.hour = hour
            dayComps.minute = minute
            dayComps.second = 0
            if let fire = calendar.date(from: dayComps), fire > reference {
                return fire
            }
        }
        return nil
    }
}

enum Weekday: Int, CaseIterable, Codable {
    case sunday = 1, monday, tuesday, wednesday, thursday, friday, saturday

    var shortName: String {
        switch self {
        case .sunday: "D"; case .monday: "L"; case .tuesday: "M"
        case .wednesday: "X"; case .thursday: "J"; case .friday: "V"
        case .saturday: "S"
        }
    }

    static func mask(_ days: Set<Weekday>) -> Int {
        days.reduce(0) { $0 | (1 << $1.rawValue) }
    }

    static func from(mask: Int) -> Set<Weekday> {
        var result: Set<Weekday> = []
        for day in Weekday.allCases where mask & (1 << day.rawValue) != 0 {
            result.insert(day)
        }
        return result
    }

    init?(date: Date, calendar: Calendar = .current) {
        let weekday = calendar.component(.weekday, from: date)
        self.init(rawValue: weekday)
    }
}
