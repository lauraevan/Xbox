import SwiftUI

struct GuideView: View {
    @Environment(DashboardModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image(systemName: "xbox.logo")
                Text("Guide").font(.title2.bold())
                Spacer()
                Button("Close") {
                    withAnimation(.snappy) { model.guidePresented = false }
                }
            }
            .padding(24)

            Divider().overlay(.white.opacity(0.15))

            guideRow("Home", icon: "house.fill")
            guideRow("People", icon: "person.2.fill")
            guideRow("Parties & chats", icon: "bubble.left.and.bubble.right.fill")
            guideRow("Achievements", icon: "trophy.fill")
            guideRow("Capture & share", icon: "square.and.arrow.up.fill")

            Divider().overlay(.white.opacity(0.15)).padding(.vertical, 12)

            VStack(alignment: .leading, spacing: 7) {
                Text("Friends")
                    .font(.headline)
                Text("No Xbox friends loaded")
                    .foregroundStyle(.white.opacity(0.7))
                Text("Connect a real Xbox data source before showing friends, presence, requests, or suggestions.")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.48))
            }
            .padding(24)

            Spacer()
        }
        .frame(width: 390)
        .frame(maxHeight: .infinity)
        .background(.ultraThinMaterial)
        .background(Color.black.opacity(0.78))
        .foregroundStyle(.white)
        .shadow(radius: 35)
    }

    private func guideRow(_ title: String, icon: String) -> some View {
        Button {
            if title == "Home" {
                model.selectedSection = .home
                withAnimation(.snappy) { model.guidePresented = false }
            }
        } label: {
            HStack(spacing: 16) {
                Image(systemName: icon).frame(width: 28)
                Text(title).font(.headline)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(.white.opacity(0.45))
            }
            .padding(.horizontal, 24)
            .frame(height: 58)
        }
        .buttonStyle(.plain)
    }
}
