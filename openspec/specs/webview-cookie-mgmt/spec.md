# webview-cookie-mgmt Specification

## Purpose
TBD - created by archiving change p1-webview-cookie. Update Purpose after archive.

## Requirements

### Requirement: Set a single cookie

The system SHALL allow setting a single cookie on OHOS by delegating to `WebCookieManager.configCookieSync`, deriving the target URL from the cookie's domain and formatting the cookie as a Set-Cookie string. The formatted string SHALL preserve the cookie's persistence attributes: an expiration date SHALL appear as `Expires` in IMF-fixdate, a max-age duration as `Max-Age` in whole seconds. Session cookies (no expiry, no max-age) SHALL include neither attribute, matching current behavior. The cookie bridge calls (`fetchCookieSync`/`configCookieSync`) SHALL forward the incognito context of the originating webview as their optional third parameter (`incognito`), so cookies operate on the correct profile when the webview was created with `incognitoMode(true)`; non-incognito webviews SHALL pass `false`/absent and keep today's behavior unchanged.

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

#### Scenario: Incognito webview scopes cookie calls

- **WHEN** a webview created with `incognito: true` calls `set_cookie` (or `get_cookies`)
- **THEN** the ArkTS `configCookieSync`/`fetchCookieSync` call SHALL carry `incognito=true` as its third parameter

#### Scenario: Non-incognito webview keeps wire compatibility

- **WHEN** a webview created without `incognito` calls `set_cookie`
- **THEN** the cookie call SHALL behave exactly as before this change (third parameter absent or `false`)

### Requirement: Get cookies best-effort
Because OHOS `WebCookieManager` has no API to enumerate all cookies across all URLs, `cookies()` SHALL return cookies for the webview's current URL as a best-effort degradation, and SHALL return an empty vector when no current URL is available.

#### Scenario: Get cookies with a loaded URL
- **WHEN** `cookies()` is called and the webview current URL is `https://example.com`
- **THEN** the system returns the parsed cookies for that URL (same result as `cookies_for_url("https://example.com")`)

#### Scenario: Get cookies with no URL
- **WHEN** `cookies()` is called and the current URL is empty or cannot be obtained
- **THEN** the system returns an empty `Vec<Cookie>`

### Requirement: Delete single cookie is a no-op
Because OHOS `WebCookieManager` provides no single-cookie deletion (only `clearAllCookies` / `clearSessionCookie`), `delete_cookie(cookie)` SHALL be a no-op that returns `Ok(())` and emits a warning. It SHALL NOT call `clearAllCookies` (which would incorrectly delete all cookies).

#### Scenario: Delete cookie logs warning
- **WHEN** `delete_cookie(cookie)` is called
- **THEN** the system emits `log::warn!` indicating the platform lacks single-cookie deletion and returns `Ok(())` without modifying any cookie store

### Requirement: cookies_for_url remains available
The existing `cookies_for_url(url)` behavior SHALL remain unchanged and continue to return parsed cookies for the given URL via `WebCookieManager.fetchCookieSync`.

#### Scenario: cookies_for_url unchanged
- **WHEN** `cookies_for_url("https://example.com")` is called
- **THEN** the system returns the same parsed cookies as before this change (no behavioral change)

### Requirement: API version safety
The implementation SHALL use only `WebCookieManager` APIs available at API version 11+ (`fetchCookieSync`, `configCookieSync(url, value, incognito?)`, `clearAllCookies*`) and SHALL NOT use API 14+ (`configCookieSync` 4-arg) or API 15+ (`saveCookieSync`) overloads without a version guard, to remain compatible with the minimum supported API 12.

#### Scenario: No API 14+ overload used
- **WHEN** the ArkTS bridge sets a cookie
- **THEN** it calls the 3-argument `configCookieSync(url, value, incognito?)` form, not the 4-argument API 14+ form

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
