## ADDED Requirements

### Requirement: OHOS lifecycle events forwarded to Tauri
The system SHALL forward Start/SaveState/ContentRectChange/Pause as RunEvent variants.

#### Scenario: Started event
- **WHEN** OHOS calls onAbilityStart → `RunEvent::Started` emitted

#### Scenario: SaveStateRequested event
- **WHEN** OHOS calls onAbilitySaveState → `RunEvent::SaveStateRequested` emitted

#### Scenario: ContentRectChanged event
- **WHEN** content rect changes → `RunEvent::ContentRectChanged { rect, reason }` emitted

#### Scenario: Suspended event
- **WHEN** OHOS calls pause → `RunEvent::Suspended` emitted

### Requirement: Resumed/Suspended bridge fix
The system SHALL bridge `Event::Resumed` and `Event::Suspended` in tauri-runtime-wry for all platforms.
