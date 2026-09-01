#!/bin/bash
# Rebuild openharmony-ability HAR (DefaultWebview.ets changed) → refresh ohpm+junctions → build HAP → install.
set -euo pipefail

SKILL_SCRIPTS="/d/xuqiu/tauri-3.0/tauri/.claude/skills/ohos-build/scripts"
ABILITY_DIR="/d/xuqiu/tauri-3.0/openharmony-ability"
OHOS_PROJECT="/d/xuqiu/tauri-3.0/tauri/examples/api/src-tauri/gen/ohos"

echo "=== sourcing env.sh ==="
source "$SKILL_SCRIPTS/env.sh"
echo "PROJECT_ROOT=$PROJECT_ROOT  OHOS_DEVICE_TYPE=$OHOS_DEVICE_TYPE"

echo "=== 1/4 rebuild HAR ==="
cd "$ABILITY_DIR"
ohrs build --arch arm64 --skip-napi-check 2>&1 | tail -8 || true
bash scripts/pack.sh 2>&1 | tail -4
tar -czf ability.har package
ls -la ability.har

echo "=== 2/4 refresh ohpm + @tauri junctions ==="
cd "$OHOS_PROJECT"
ohpm install --all 2>&1 | tail -4
# rebuild @tauri junctions (ohpm install deletes them — SKILL #11)
mkdir -p oh_modules/@tauri
for pkg in app notification global-shortcut dialog; do
  src=""; case $pkg in app) src="tauri" ;; *) src="$pkg" ;; esac
  [ -d "$src" ] && cmd //c "mklink /J \"oh_modules\\@tauri\\$pkg\" \"$(pwd -W)\\$src\"" 2>/dev/null && echo "  junction @tauri/$pkg -> $src"
done
echo "HAR_REFRESH_DONE"

echo "=== 3/4 build-ohos.sh (desktop, VITE_AUTOTEST=false) ==="
OHOS_DEVICE_TYPE=desktop VITE_AUTOTEST=false bash "$SKILL_SCRIPTS/build-ohos.sh"

echo "=== 4/4 sign-and-install.sh ==="
bash "$SKILL_SCRIPTS/sign-and-install.sh"

echo "=== ALL_DONE ==="
