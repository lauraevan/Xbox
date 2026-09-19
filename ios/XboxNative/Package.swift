// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "XboxNative",
    platforms: [.iOS(.v17)],
    products: [.library(name: "XboxNative", targets: ["XboxNative"])],
    targets: [
        .target(
            name: "XboxNative",
            path: "Sources/XboxNative",
            resources: [.process("Resources")]
        )
    ]
)
