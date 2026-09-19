import UIKit
import CryptoKit

actor ArtworkCache {
    static let shared = ArtworkCache()
    private let memory = NSCache<NSURL, UIImage>()

    func image(for url: URL) async throws -> UIImage {
        if let cached = memory.object(forKey: url as NSURL) { return cached }

        let key = SHA256.hash(data: Data(url.absoluteString.utf8))
            .map { String(format: "%02x", $0) }.joined()
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let file = dir.appending(path: "XboxArtwork").appending(path: key)

        if let data = try? Data(contentsOf: file), let image = UIImage(data: data) {
            memory.setObject(image, forKey: url as NSURL)
            return image
        }

        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode,
              let image = UIImage(data: data) else { throw URLError(.badServerResponse) }

        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: file, options: .atomic)
        memory.setObject(image, forKey: url as NSURL)
        return image
    }
}
