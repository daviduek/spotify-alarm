import Foundation
import SwiftData
import os.log

/// Thin facade over SwiftData for alarms. Lives at the app level and is
/// shared via the AppContainer.
@MainActor
final class AlarmStore: ObservableObject {
    @Published private(set) var alarms: [Alarm] = []

    private let container: ModelContainer
    private let scheduler: NotificationScheduler
    private let log = AppLog.engine

    init(container: ModelContainer, scheduler: NotificationScheduler) {
        self.container = container
        self.scheduler = scheduler
        refresh()
    }

    func refresh() {
        let context = container.mainContext
        let descriptor = FetchDescriptor<Alarm>(
            sortBy: [SortDescriptor(\.hour), SortDescriptor(\.minute)]
        )
        do {
            self.alarms = try context.fetch(descriptor)
        } catch {
            log.error("Failed to fetch alarms: \(error.localizedDescription)")
            self.alarms = []
        }
    }

    func save(_ alarm: Alarm) async {
        let context = container.mainContext
        if alarm.modelContext == nil {
            context.insert(alarm)
        }
        alarm.updatedAt = .now
        try? context.save()
        refresh()
        await scheduler.reschedule(for: alarm)
    }

    func delete(_ alarm: Alarm) {
        let context = container.mainContext
        scheduler.cancel(for: alarm)
        context.delete(alarm)
        try? context.save()
        refresh()
    }

    func setEnabled(_ enabled: Bool, on alarm: Alarm) async {
        alarm.isEnabled = enabled
        alarm.updatedAt = .now
        try? container.mainContext.save()
        refresh()
        if enabled {
            await scheduler.reschedule(for: alarm)
        } else {
            scheduler.cancel(for: alarm)
        }
    }

    func alarm(with id: UUID) -> Alarm? {
        alarms.first(where: { $0.id == id })
    }
}
