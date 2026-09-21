import SwiftUI

struct DashboardView: View {
    @Environment(DashboardModel.self) private var model
    @Namespace private var focusNamespace
    @FocusState private var focusedGame: String?

    var body: some View {
        @Bindable var model = model

        ZStack(alignment: .leading) {
            LinearGradient(
                colors: [.black, Color(red: 0.035, green: 0.045, blue: 0.04)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 24) {
                topBar
                Spacer(minLength: 40)
                hero
                gameRail
                Spacer()
            }
            .padding(.horizontal, 34)
            .padding(.vertical, 22)
            .blur(radius: model.guidePresented ? 5 : 0)
            .scaleEffect(model.guidePresented ? 0.985 : 1)
            .animation(.snappy(duration: 0.24), value: model.guidePresented)

            if model.guidePresented {
                GuideView()
                    .transition(.move(edge: .leading).combined(with: .opacity))
            }
        }
        .onAppear { focusedGame = model.selectedGameID }
        .onChange(of: focusedGame) { _, id in
            guard let id else { return }
            model.selectedGameID = id
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        }
    }

    private var topBar: some View {
        HStack(spacing: 18) {
            Button {
                withAnimation(.snappy) { model.guidePresented = true }
            } label: {
                Image(systemName: "xbox.logo")
                    .font(.system(size: 27, weight: .semibold))
            }
            .buttonStyle(ConsoleButtonStyle())

            Text("xboxtest")
                .font(.headline)
                .foregroundStyle(.white)

            Spacer()

            Image(systemName: "magnifyingglass")
            Image(systemName: "gearshape")
            Text(Date.now, style: .time)
                .font(.headline.monospacedDigit())
        }
        .foregroundStyle(.white)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("QUICK RESUME")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white.opacity(0.62))
            Text(model.selectedGame.title)
                .font(.system(size: 42, weight: .semibold, design: .rounded))
                .contentTransition(.numericText())
            Text("Ready to play")
                .foregroundStyle(.white.opacity(0.62))
        }
        .foregroundStyle(.white)
    }

    private var gameRail: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 18) {
                ForEach(Game.sample) { game in
                    Button {
                        model.selectedGameID = game.id
                    } label: {
                        GameTile(game: game, selected: model.selectedGameID == game.id)
                    }
                    .buttonStyle(.plain)
                    .focused($focusedGame, equals: game.id)
                }

                Button {
                    withAnimation(.snappy) { model.guidePresented = true }
                } label: {
                    SystemTile(icon: "person.2.fill", title: "Friends & community")
                }
                .buttonStyle(.plain)
            }
            .scrollTargetLayout()
        }
        .scrollIndicators(.hidden)
        .scrollTargetBehavior(.viewAligned)
    }
}

private struct GameTile: View {
    let game: Game
    let selected: Bool

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Rectangle()
                .fill(.white.opacity(0.08))
            Image(systemName: game.id == "minecraft" ? "cube.fill" : "gamecontroller.fill")
                .font(.system(size: 54))
                .foregroundStyle(.white.opacity(0.8))
            if selected {
                Text(game.title)
                    .font(.headline)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.black.opacity(0.74))
            }
        }
        .frame(width: selected ? 224 : 180, height: selected ? 224 : 180)
        .clipShape(RoundedRectangle(cornerRadius: 5))
        .overlay {
            if selected {
                RoundedRectangle(cornerRadius: 5).stroke(.white, lineWidth: 4)
            }
        }
        .animation(.snappy(duration: 0.22), value: selected)
    }
}

private struct SystemTile: View {
    let icon: String
    let title: String

    var body: some View {
        ZStack {
            Rectangle().fill(Color(red: 0.06, green: 0.43, blue: 0.08))
            VStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 48))
                Text(title).font(.headline)
            }
        }
        .frame(width: 180, height: 180)
        .clipShape(RoundedRectangle(cornerRadius: 5))
        .foregroundStyle(.white)
    }
}

private struct ConsoleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.92 : 1)
            .animation(.snappy(duration: 0.14), value: configuration.isPressed)
    }
}
