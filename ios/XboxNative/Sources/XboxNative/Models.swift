import Foundation

struct Game: Identifiable, Hashable {
    let id: String
    let title: String
    let cover: URL?
    let hero: URL?
    let cloudAlias: String?

    static let sample: [Game] = [
        .init(id: "forza-horizon-5", title: "Forza Horizon 5", cover: nil, hero: nil, cloudAlias: "forza horizon 5"),
        .init(id: "gta-v", title: "Grand Theft Auto V", cover: nil, hero: nil, cloudAlias: "grand theft auto v"),
        .init(id: "silksong", title: "Hollow Knight: Silksong", cover: nil, hero: nil, cloudAlias: "hollow knight silksong"),
        .init(id: "elden-ring", title: "Elden Ring", cover: nil, hero: nil, cloudAlias: "elden ring"),
        .init(id: "rdr2", title: "Red Dead Redemption 2", cover: nil, hero: nil, cloudAlias: "red dead redemption 2"),
        .init(id: "minecraft", title: "Minecraft", cover: nil, hero: nil, cloudAlias: "minecraft")
    ]
}
