import Foundation

actor CloudGateway {
    static let shared = CloudGateway()

    // The app only talks to the existing server-side gateway. Never place
    // Stratus or Ember credentials in this client.
    var gatewayBaseURL: URL?

    struct Session: Decodable {
        let uuid: String?
        let url: String?
    }

    func createSession(for game: Game) async throws -> Session {
        guard let gatewayBaseURL else { throw GatewayError.notConfigured }
        var components = URLComponents(url: gatewayBaseURL.appending(path: "api/stratus"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "action", value: "create"),
            URLQueryItem(name: "game", value: game.cloudAlias ?? game.title)
        ]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            throw GatewayError.upstream
        }
        return try JSONDecoder().decode(Session.self, from: data)
    }

    enum GatewayError: LocalizedError {
        case notConfigured, upstream
        var errorDescription: String? {
            switch self {
            case .notConfigured: "Cloud gateway is not configured."
            case .upstream: "Cloud gaming service returned an error."
            }
        }
    }
}
