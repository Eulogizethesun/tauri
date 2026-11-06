# ohos-event-lifecycle-forward Delta

## ADDED Requirements

### Requirement: Unknown StageEventType values are logged and ignored
The window-stage-event bridge SHALL NOT panic on an unrecognized numeric `StageEventType` value. The conversion from the raw event code SHALL be fallible; an unrecognized value SHALL be reported with a warn log and the event SHALL be dropped without disturbing the bridge thread. This replaces the previous `From<i32>` implementation that panicked on unknown values.

#### Scenario: Recognized values still route
- **WHEN** the ArkTS bridge forwards a window stage event code in the known range (1..=6, e.g. Active/Inactive)
- **THEN** the conversion succeeds and the event is routed exactly as before (GainedFocus/LostFocus dispatch chain unchanged)

#### Scenario: Unknown value is dropped with a warn, not a panic
- **WHEN** the ArkTS bridge forwards an event code outside the known range (e.g. `0`, `7`, or a future system-introduced value)
- **THEN** a warn containing the unrecognized value is emitted
- **AND** the closure returns `Ok(())` and the bridge thread continues (no panic)
