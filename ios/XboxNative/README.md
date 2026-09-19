# Xbox Native for iOS / iPadOS

Native SwiftUI companion to the Xbox web replica in this repository.

This target is intentionally not a WKWebView wrapper. It provides a native dashboard shell, adaptive iPhone/iPad layout, Guide overlay, library/store surfaces, controller-aware focus, haptics, artwork caching, and a cloud launch client that talks only to the existing server-side gateway.

## Build

Open `ios/XboxNative/Package.swift` in Xcode 16+ on macOS and run the XboxNative scheme on iOS/iPadOS 17 or newer. For an IPA, archive/sign with your own Apple signing identity or use a signing workflow.

No Stratus/API credential belongs in this client.
