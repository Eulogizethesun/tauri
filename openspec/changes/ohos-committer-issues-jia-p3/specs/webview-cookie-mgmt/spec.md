# webview-cookie-mgmt Specification

## MODIFIED Requirements

### Requirement: Set a single cookie

The system SHALL allow setting a single cookie on OHOS by delegating to `WebCookieManager.configCookieSync`, deriving the target URL from the cookie's domain and formatting the cookie as a Set-Cookie string. The cookie bridge calls (`fetchCookieSync`/`configCookieSync`) SHALL forward the incognito context of the originating webview as their optional third parameter (`incognito`), so cookies operate on the correct profile when the webview was created with `incognitoMode(true)`; non-incognito webviews SHALL pass `false`/absent and keep today's behavior unchanged.

#### Scenario: Set cookie with domain

- **WHEN** `set_cookie(cookie)` is called with a cookie whose `domain` is `example.com`, `name`=`token`, `value=`abc`
- **THEN** the system calls `configCookieSync("https://example.com", "token=abc; Domain=example.com; Path=/")` and returns `Ok(())`

#### Scenario: Set cookie without domain falls back to current URL

- **WHEN** `set_cookie(cookie)` is called with a cookie whose `domain` is empty and the webview current URL is `https://foo.com`
- **THEN** the system uses `https://foo.com` as the target URL

#### Scenario: Set cookie with no domain and no current URL

- **WHEN** `set_cookie(cookie)` is called with an empty domain and the current URL cannot be obtained
- **THEN** the system logs a warning and returns `Ok(())` without calling the ArkTS API

#### Scenario: Incognito webview scopes cookie calls

- **WHEN** a webview created with `incognito: true` calls `set_cookie` (or `get_cookies`)
- **THEN** the ArkTS `configCookieSync`/`fetchCookieSync` call SHALL carry `incognito=true` as its third parameter

#### Scenario: Non-incognito webview keeps wire compatibility

- **WHEN** a webview created without `incognito` calls `set_cookie`
- **THEN** the cookie call SHALL behave exactly as before this change (third parameter absent or `false`)
