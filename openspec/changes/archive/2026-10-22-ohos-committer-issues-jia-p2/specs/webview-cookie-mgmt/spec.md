# webview-cookie-mgmt Delta

## MODIFIED Requirements

### Requirement: Set a single cookie
The system SHALL allow setting a single cookie on OHOS by delegating to `WebCookieManager.configCookieSync`, deriving the target URL from the cookie's domain and formatting the cookie as a Set-Cookie string. The formatted string SHALL preserve the cookie's persistence attributes: an expiration date SHALL appear as `Expires` in IMF-fixdate, a max-age duration as `Max-Age` in whole seconds. Session cookies (no expiry, no max-age) SHALL include neither attribute, matching current behavior.

#### Scenario: Set cookie with domain
- **WHEN** `set_cookie(cookie)` is called with a cookie whose `domain` is `example.com`, `name`=`token`, `value`=`abc`
- **THEN** the system calls `configCookieSync("https://example.com", "token=abc; Domain=example.com; Path=/")` and returns `Ok(())`

#### Scenario: Set cookie without domain falls back to current URL
- **WHEN** `set_cookie(cookie)` is called with a cookie whose `domain` is empty and the webview current URL is `https://foo.com`
- **THEN** the system uses `https://foo.com` as the target URL

#### Scenario: Set cookie with no domain and no current URL
- **WHEN** `set_cookie(cookie)` is called with an empty domain and the current URL cannot be obtained
- **THEN** the system logs a warning and returns `Ok(())` without calling the ArkTS API

#### Scenario: Persistent cookie keeps Expires and Max-Age
- **WHEN** `set_cookie(cookie)` is called with a cookie carrying an expiration datetime and/or a max-age duration
- **THEN** the formatted Set-Cookie string contains `Expires=<IMF-fixdate>` (UTC, e.g. `Thu, 01 Jan 2026 00:00:00 GMT`) and/or `Max-Age=<seconds>`, so the cookie persists across webview restarts instead of degrading to a session cookie

#### Scenario: Session cookie omits both attributes
- **WHEN** `set_cookie(cookie)` is called with a session cookie (no expiration and no max-age)
- **THEN** the formatted Set-Cookie string contains neither an `Expires` nor a `Max-Age` attribute

## ADDED Requirements

### Requirement: clearAllBrowsingData clears cookies on OHOS
`clear_all_browsing_data` on OHOS SHALL additionally clear the webview's non-incognito cookie store (persistent and session) via `WebCookieManager.clearAllCookiesSync(false)` before the existing browsing-data cleanup. The call SHALL be availability-guarded so the wipe cannot abort or panic the cleanup.

#### Scenario: Cookies do not survive clearAllBrowsingData
- **WHEN** a page has set cookies via `document.cookie` and the app calls `clear_all_browsing_data`
- **THEN** `WebCookieManager.clearAllCookiesSync(false)` has been invoked (clearing the non-incognito store)
- **AND** a subsequent read of `document.cookie` on the page observes no cookies

#### Scenario: Cookie API is guarded, not bare
- **WHEN** the cookie-wipe call site is inspected
- **THEN** `clearAllCookiesSync(false)` is wrapped in a typeof availability probe plus try/catch (#222 precedent)
- **AND** an absent or throwing API yields a warning disclosing the skipped wipe, after which the remaining browsing-data cleanup proceeds and `clear_all_browsing_data` does not fail the caller

#### Scenario: wry docs disclose the cleared scope
- **WHEN** the `clear_all_browsing_data` public documentation is read for the OHOS platform
- **THEN** it states that cookies are cleared
- **AND** it discloses the two remaining gaps (SSL cache and clientAuthCache are not cleared, no public SDK API)
