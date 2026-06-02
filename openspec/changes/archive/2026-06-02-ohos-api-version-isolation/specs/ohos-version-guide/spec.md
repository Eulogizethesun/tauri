## ADDED Requirements

### Requirement: Version isolation best practices document
The system SHALL provide a comprehensive developer guide document (in Chinese) that explains the OHOS version isolation strategy and provides concrete code patterns for using high-version APIs safely. The document SHALL be placed in the `openharmony-ability` repository and referenced from the Tauri OHOS development workflow.

#### Scenario: Developer needs to use API 14+ feature
- **WHEN** a developer wants to use an OHOS API that requires SDK API Level 14 or higher
- **THEN** the guide SHALL provide a clear code template showing how to use `version::sdk_api_version() >= 14` with a fallback implementation for lower versions

#### Scenario: Developer needs to use HarmonyOS 6.0.0+ feature
- **WHEN** a developer wants to use a HarmonyOS-specific API marked `since 6.0.0(20)`
- **THEN** the guide SHALL provide a code template showing how to use `version::distribution_api_version() >= 60000` with a fallback

### Requirement: Two-dimensional version decision matrix
The guide SHALL explain the difference between `sdkApiVersion` and `distributionOSApiVersion`, and provide a clear decision matrix for when to use which.

#### Scenario: OpenHarmony base API (marked since N)
- **WHEN** the API documentation shows `since 14` (without M.S.F format)
- **THEN** the guide SHALL instruct to use `sdk_api_version() >= 14` for version checking

#### Scenario: HarmonyOS-specific API (marked since M.S.F(N))
- **WHEN** the API documentation shows `since 5.0.1(13)` (with M.S.F format)
- **THEN** the guide SHALL instruct to use `distribution_api_version() >= 50001` (5×10000 + 0×100 + 1) for version checking

#### Scenario: Unclear API version source
- **WHEN** the developer is unsure whether an API is OpenHarmony base or HarmonyOS-specific
- **THEN** the guide SHALL instruct to check the API's module path: `openharmony/` path → use `sdk_api_version()`; `hms/` path → use `distribution_api_version()`

### Requirement: canIUse vs version number decision guidance
The guide SHALL explain when to use `can_i_use()` (capability detection) versus version number comparison, and provide examples of each pattern.

#### Scenario: Feature depends on hardware capability
- **WHEN** the feature depends on device hardware (e.g., NFC, sensor, camera feature)
- **THEN** the guide SHALL instruct to use `can_i_use("SystemCapability.xxx")` as the primary check

#### Scenario: Feature depends on software version only
- **WHEN** the feature depends on a software API that is available on all devices of sufficient version
- **THEN** the guide SHALL instruct to use version number comparison (`sdk_api_version() >= N` or `distribution_api_version() >= M*10000+S*100+F`)

#### Scenario: Combined check pattern
- **WHEN** the feature depends on both capability and version
- **THEN** the guide SHALL show the combined pattern: first `can_i_use()` (Rust 侧调用 ArkHelper.checkCanIUse)，then version check

### Requirement: Degradation patterns
The guide SHALL provide concrete code examples for common degradation patterns when a high-version API is not available.

#### Scenario: Function fallback pattern
- **WHEN** a new function API is not available on lower versions
- **THEN** the guide SHALL show how to provide an alternative implementation or gracefully skip the feature with a log message

#### Scenario: UI component attribute fallback
- **WHEN** a new UI component attribute (e.g., `List.backToTop` from API 15) is not available on lower versions
- **THEN** the guide SHALL show how to use `AttributeModifier` pattern to conditionally apply the attribute

#### Scenario: Complete feature disable
- **WHEN** a feature has no reasonable fallback on lower versions
- **THEN** the guide SHALL show how to hide/disable the feature entry point (button, menu item) when the version check fails

### Requirement: Rust-side version guard examples
The guide SHALL provide Rust code examples for the most common version guard patterns in the Tauri/tao/wry codebase. The examples SHALL follow the same style as Windows/macOS — direct integer comparison without convenience wrapper functions.

#### Scenario: Guard in wry::ohos
- **WHEN** adding a version-dependent feature to `wry::ohos::InnerWebView`
- **THEN** the guide SHALL show a code template following the Windows/macOS pattern (direct integer comparison):
```rust
use openharmony_ability::version;
// 与 Windows `WIN_VERSION.build >= 17763` 风格一致
if version::sdk_api_version() >= 14 {
    // Use API 14+ feature
} else {
    // Fallback
}
```

#### Scenario: Guard in tao::ohos
- **WHEN** adding a version-dependent window feature to `tao::platform_impl::ohos`
- **THEN** the guide SHALL show a code template using `version::distribution_api_version() >= N` for HarmonyOS-specific window APIs, with the version number formula documented inline:
```rust
// HarmonyOS 6.0.0(20) = 6*10000 + 0*100 + 0 = 60000
if version::distribution_api_version() >= 60000 {
    // Use HarmonyOS 6.0.0+ window API
}
```

### Requirement: Version number reference table
The guide SHALL include a reference table mapping common version strings to their integer values, to help developers avoid calculation errors.

#### Scenario: Developer looks up version number
- **WHEN** a developer needs to check for API `since 5.0.1(13)`
- **THEN** the guide SHALL provide a table entry showing `5.0.1(13) → 50001` and the code `distribution_api_version() >= 50001`

#### Scenario: Common versions covered
- **WHEN** the developer consults the reference table
- **THEN** the table SHALL cover at minimum: `5.0.0(12) → 50000`, `5.0.1(13) → 50001`, `5.0.2(14) → 50002`, `5.1.0(15) → 50100`, `6.0.0(20) → 60000`
