import SwiftUI
import GameController

@main
public struct XboxNativeApp: App {
    @State private var model = DashboardModel()

    public init() {}

    public var body: some Scene {
        WindowGroup {
            DashboardView()
                .environment(model)
                .preferredColorScheme(.dark)
        }
    }
}

@Observable
final class DashboardModel {
    var selectedGameID = Game.sample.first!.id
    var guidePresented = false
    var selectedSection: Section = .home

    enum Section: String, CaseIterable, Identifiable {
        case home = "Home"
        case library = "My games & apps"
        case store = "Store"
        var id: Self { self }
    }

    var selectedGame: Game {
        Game.sample.first(where: { $0.id == selectedGameID }) ?? Game.sample[0]
    }
}
