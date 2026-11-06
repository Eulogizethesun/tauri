# pack-publish.ps1 — build the OHPM-publishable HAR on top of pack.bat.
#
# Lives in the tauri-ohos-publish skill: it is publish-process tooling and
# carries the publish identity policy (@ylong-rs/ohrs-ability /
# Eulogizethesun), which belongs to the publish process, not to the code
# repo. It runs against an openharmony-ability checkout passed as the
# target dir and does not depend on its own location:
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File pack-publish.ps1 `
#     <path-to-openharmony-ability>
#
# pack.bat (dev flow, untouched) rebuilds the `package/` mirror + dev HAR
# `ability.har`. This script then assembles everything OHPM requires that the
# dev flow does not produce — ON THE GENERATED TREE ONLY. No repo source is
# modified, so nothing needs to be reverted after publishing:
#
#   - package/README.md, CHANGELOG.md, src/main/module.json5
#       copied from `native_ability/`
#   - package/LICENSE, LICENSE-APACHE, LICENSE-MIT
#       copied from the repo ROOT — `native_ability/LICENSE*` are `../`
#       symlinks that Windows checkouts materialize as broken reference
#       text; never copy license text from there
#   - publish identity stamped onto the generated copies only:
#       name       @ohos-rs/ability    -> @ylong-rs/ohrs-ability
#       repository harmony-contrib/... -> Eulogizethesun/...
#       README package-name references -> publish name (negative lookahead
#       keeps `@ohos-rs/ability-plugin-*` untouched — never rename those)
#
# Result: `ohrs-ability-<version>.har` next to `ability.har`, both inside
# the target checkout. The assemble / stamp / tar phase runs inside
# try/finally, so even a mid-flight failure (e.g. a tar error AFTER the
# manifest was stamped) restores package/ to its pack.bat state: a stale
# publish identity in package/oh-package.json5 would poison the dev
# ability.har that local file: consumers match by `@ohos-rs/ability`, so
# the restore must never be skipped.

param([string]$ScriptDir)

$ErrorActionPreference = 'Stop'

if (-not $ScriptDir) {
  throw "usage: pack-publish.ps1 <path-to-openharmony-ability>"
}
$ScriptDir = $ScriptDir.Trim(' "\').Replace('/', '\')
if (-not (Test-Path (Join-Path $ScriptDir 'pack.bat'))) {
  throw "$ScriptDir does not look like an openharmony-ability checkout (pack.bat not found)"
}

$srcName = '@ohos-rs/ability'
$pubName = '@ylong-rs/ohrs-ability'
$srcRepo = 'https://github.com/harmony-contrib/openharmony-ability.git'
$pubRepo = 'https://github.com/Eulogizethesun/openharmony-ability.git'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# 1) Full dev pack (rebuilds package/ + ability.har). pack.bat resolves its
#    final `tar ... package` relative to the cwd, so pin the cwd first.
Push-Location $ScriptDir
try {
  & cmd.exe /c (Join-Path $ScriptDir 'pack.bat')
  if ($LASTEXITCODE -ne 0) { throw "pack.bat failed (exit $LASTEXITCODE)" }
} finally {
  Pop-Location
}

$pkgDir   = Join-Path $ScriptDir 'package'
$manifest = Join-Path $pkgDir   'oh-package.json5'
$readme   = Join-Path $pkgDir   'README.md'
$native   = Join-Path $ScriptDir 'native_ability'

# 2) Assemble the OHPM-required files onto the generated tree. First clear
#    any stale copies a previously failed run may have left behind: pack.bat
#    does not know these paths, so it would bake them verbatim into its next
#    dev pack (ability.har).
foreach ($f in @('README.md', 'CHANGELOG.md', 'src\main\module.json5',
                 'LICENSE', 'LICENSE-APACHE', 'LICENSE-MIT')) {
  $stale = Join-Path $pkgDir $f
  if (Test-Path $stale) { Remove-Item $stale -Force -ErrorAction SilentlyContinue }
}

$added   = @()
$stamped = $false
try {
  foreach ($f in @('README.md', 'CHANGELOG.md')) {
    Copy-Item (Join-Path $native $f) (Join-Path $pkgDir $f) -Force
    $added += (Join-Path $pkgDir $f)
  }
  $moduleJson = Join-Path $pkgDir 'src\main\module.json5'
  Copy-Item (Join-Path $native 'src\main\module.json5') $moduleJson -Force
  $added += $moduleJson

  foreach ($f in @('LICENSE', 'LICENSE-APACHE', 'LICENSE-MIT')) {
    $src = Join-Path $ScriptDir $f
    if (-not (Test-Path $src) -or (Get-Item $src).Length -lt 100) {
      throw "repo-root $f is missing or suspiciously small - publish needs the real license text"
    }
    Copy-Item $src (Join-Path $pkgDir $f) -Force
    $added += (Join-Path $pkgDir $f)
  }

  # 3) Stamp the publish identity onto the generated copies only.
  $manifestText = [System.IO.File]::ReadAllText($manifest)
  if ($manifestText -notmatch ('"' + [regex]::Escape($srcName) + '"')) {
    throw "expected name `"$srcName`" in $manifest - was pack.bat run against a modified source?"
  }
  $manifestText = $manifestText.Replace("`"$srcName`"", "`"$pubName`"")
  if ($manifestText.Contains($srcRepo)) {
    $manifestText = $manifestText.Replace($srcRepo, $pubRepo)
  }
  if ($manifestText -notmatch '"version"\s*:\s*"([^"]+)"') {
    throw "no version field in $manifest"
  }
  $version = $Matches[1]
  [System.IO.File]::WriteAllText($manifest, $manifestText, $utf8NoBom)
  $stamped = $true

  $readmeText = [System.IO.File]::ReadAllText($readme)
  $readmeText = [regex]::Replace($readmeText, [regex]::Escape($srcName) + '(?!-)', $pubName)
  [System.IO.File]::WriteAllText($readme, $readmeText, $utf8NoBom)

  # 4) Tar the publish HAR. Resolve bsdtar explicitly: under a
  #    git-bash-parented PowerShell, bare `tar` resolves to GNU tar, which
  #    reads `D:\...` as a remote-host spec ("Cannot connect to D:").
  $tarExe = Join-Path $env:SystemRoot 'System32\tar.exe'
  if (-not (Test-Path $tarExe)) { $tarExe = 'tar' }
  $harPath = Join-Path $ScriptDir ("ohrs-ability-{0}.har" -f $version)
  & $tarExe -czf $harPath -C $ScriptDir package
  if ($LASTEXITCODE -ne 0) { throw "tar failed (exit $LASTEXITCODE)" }
} finally {
  # 5) Leave the tree exactly as pack.bat left it — on success AND on
  #    failure. Restore the manifest FIRST: it is the only file whose
  #    residue (a publish identity) silently breaks local file: builds.
  #    Removing the assembled files is best-effort — a locked file stays
  #    visible in git status instead of aborting the manifest restore.
  if ($stamped) {
    Copy-Item (Join-Path $native 'oh-package.json5') $manifest -Force
  }
  foreach ($f in $added) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
}

# Refuse to leave a poisoned tree silently: after the restore, the generated
# manifest must again be byte-identical to native_ability/oh-package.json5.
if (Test-Path $manifest) {
  $finalText  = [System.IO.File]::ReadAllText($manifest)
  $sourceText = [System.IO.File]::ReadAllText((Join-Path $native 'oh-package.json5'))
  if ($finalText -cne $sourceText) {
    throw "cleanup failed: package/oh-package.json5 differs from native_ability/oh-package.json5 - restore it before the next pack"
  }
}

Write-Host ''
Write-Host "[pack-publish] publish HAR : $harPath"
Write-Host "[pack-publish] identity    : $pubName @ $version (repository: $pubRepo)"
Write-Host "[pack-publish] dev HAR     : ability.har (untouched, source identity)"
Write-Host "[pack-publish] package/    : restored to pack.bat state"
