## ADDED Requirements

### Requirement: Version initialization at startup
The system SHALL initialize version information once during application startup, before any version query API is called. Version information SHALL be received from the ArkTS side via the `AbilityInitContext` NAPI object and cached in Rust for the lifetime of the process.

#### Scenario: Successful version initialization
- **WHEN** the ArkTS `NativeAbility.onCreate()` calls `nativeModule.init(context)` with `sdkApiVersion` and `distributionOSApiVersion` fields populated
- **THEN** the Rust `version::init()` function SHALL store both values in `OnceLock` statics, and all subsequent calls to `sdk_api_version()` and `distribution_api_version()` SHALL return the cached values without NAPI overhead

#### Scenario: Version initialization called twice
- **WHEN** `version::init()` is called a second time after successful initialization
- **THEN** the second call SHALL be a no-op (OnceLock guarantees write-once semantics), and the original values SHALL be preserved

#### Scenario: Version query before initialization
- **WHEN** `sdk_api_version()` or `distribution_api_version()` is called before `init()` has been invoked
- **THEN** the function SHALL return `0`, indicating uninitialized state

### Requirement: Query OpenHarmony SDK API version
The system SHALL provide a `sdk_api_version()` function that returns the OpenHarmony base API Level as an integer. This value corresponds to the `since N` annotations in OHOS API documentation.

#### Scenario: Query sdk_api_version on API 14 device
- **WHEN** the application runs on a device with OpenHarmony SDK API Level 14
- **THEN** `version::sdk_api_version()` SHALL return `14`

#### Scenario: Query sdk_api_version on API 20 device
- **WHEN** the application runs on a device with OpenHarmony SDK API Level 20
- **THEN** `version::sdk_api_version()` SHALL return `20`

### Requirement: Query HarmonyOS distribution API version
The system SHALL provide a `distribution_api_version()` function that returns the HarmonyOS distribution API version as an integer, calculated as `M × 10000 + S × 100 + F`. This value corresponds to the `since M.S.F(N)` annotations in OHOS API documentation.

#### Scenario: Query distribution_api_version on HarmonyOS 5.0.1
- **WHEN** the application runs on a device with HarmonyOS 5.0.1(13)
- **THEN** `version::distribution_api_version()` SHALL return `50001` (5×10000 + 0×100 + 1)

#### Scenario: Query distribution_api_version on HarmonyOS 6.0.0
- **WHEN** the application runs on a device with HarmonyOS 6.0.0(20)
- **THEN** `version::distribution_api_version()` SHALL return `60000` (6×10000 + 0×100 + 0)

### Requirement: System capability detection via canIUse
The system SHALL provide a `can_i_use(syscap: &str) -> bool` function that queries whether the current device supports a specific SystemCapability. The function SHALL call the ArkTS global `canIUse()` function via NAPI bridge on each invocation. NAPI call overhead is negligible (microseconds), so no caching is needed.

#### Scenario: Query supported capability
- **WHEN** `can_i_use("SystemCapability.Window.SessionManager")` is called on a device that supports this capability
- **THEN** the function SHALL return `true`

#### Scenario: Query unsupported capability
- **WHEN** `can_i_use("SystemCapability.Sensor.SensorServiceKit")` is called on a device without sensor support (e.g., a TV)
- **THEN** the function SHALL return `false`

#### Scenario: NAPI call failure
- **WHEN** the NAPI call to ArkTS `canIUse()` fails (e.g., ArkHelper not initialized)
- **THEN** the function SHALL return `false` (conservative default) and log a warning

### Requirement: ArkTS side version info passing
The ArkTS `NativeAbility.onCreate()` SHALL read version information from `@kit.BasicServicesKit` and pass it to the Rust side via the extended `AbilityInitContext` NAPI object. The new fields SHALL be optional (`sdkApiVersion?: number`, `distributionOSApiVersion?: number`) to maintain backward compatibility with existing consumers that do not yet pass these fields, consistent with the existing `AbilityInitContext` pattern where all fields are optional.

#### Scenario: AbilityInitContext includes version fields
- **WHEN** `NativeAbility.onCreate()` constructs the `AbilityInitContext` object
- **THEN** the object SHALL include `sdkApiVersion: deviceInfo.sdkApiVersion` and `distributionOSApiVersion: deviceInfo.distributionOSApiVersion` fields

#### Scenario: Old consumer does not pass version fields
- **WHEN** an older version of the ArkTS side does not include `sdkApiVersion`/`distributionOSApiVersion` in `AbilityInitContext`
- **THEN** the Rust `AbilityInitContext` struct SHALL receive `None` for both fields, and `sdk_api_version()` / `distribution_api_version()` SHALL return `0`

### Requirement: ArkTS canIUse bridge
The ArkTS `ArkHelper` interface SHALL expose a `checkCanIUse(syscap: string): boolean` method that calls the ArkTS global `canIUse()` function and returns the result to the Rust side via NAPI. The method name SHALL be `checkCanIUse` (not `canIUse`) to avoid shadowing the ArkTS global `canIUse()` function, which would cause infinite recursion if a method body calls `canIUse()` without explicit scope resolution.

#### Scenario: Rust calls ArkHelper.checkCanIUse
- **WHEN** the Rust `can_i_use()` function invokes `ArkHelper.checkCanIUse("SystemCapability.xxx")` via NAPI
- **THEN** the ArkTS `checkCanIUse()` method SHALL call the global `canIUse()` function and return the boolean result
