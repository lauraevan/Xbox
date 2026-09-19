# Xbox Native for iOS / iPadOS

Native SwiftUI companion to the Xbox web replica in this repository. This is not a WKWebView wrapper.

## IPA

The repository includes a GitHub Actions workflow named **Xbox iOS IPA**. Any change under this folder triggers a macOS build that generates an unsigned device IPA artifact named `XboxNative-unsigned-ipa`.

The IPA is intentionally unsigned so no Apple certificate, provisioning profile, password, or Stratus credential is committed to this repository. Sign/install it with your normal sideloading tool and Apple identity.

## Local build

The app is generated with XcodeGen from `project.yml`, targets iOS/iPadOS 17+, and supports iPhone and iPad. Run `xcodegen generate` and open the generated Xcode project, or let GitHub Actions build the IPA.

Cloud gaming talks only to the existing server-side Stratus gateway. Never put Stratus or Ember API keys in the iOS client.
