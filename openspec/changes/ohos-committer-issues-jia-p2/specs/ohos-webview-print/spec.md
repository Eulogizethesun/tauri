# ohos-webview-print Delta

## ADDED Requirements

### Requirement: createPdf SHALL forward the requested scale
The ArkTS PDF construction path SHALL forward the caller-provided `scale` value from `WebviewPdfConfig` into the system `PdfConfiguration` object passed to `controller.createPdf()`, instead of silently dropping it (system default applied).

#### Scenario: Explicit scale reaches createPdf
- **WHEN** `create_pdf` is called with a configuration whose `scale` is defined (e.g. `2.0`)
- **THEN** the `PdfConfiguration` handed to `controller.createPdf()` carries `scale = 2.0`

#### Scenario: Scale omitted keeps system default
- **WHEN** `create_pdf` is called without a `scale` value
- **THEN** the `PdfConfiguration` handed to `controller.createPdf()` does not set a `scale` field and the system default applies

#### Scenario: wry comment matches the implemented capability
- **WHEN** the wry OHOS source comment describing the ArkTS PDF configuration is read
- **THEN** it no longer claims that `PdfConfiguration` has no `scale` field
- **AND** it states that scale is forwarded via `WebviewPdfConfig`
