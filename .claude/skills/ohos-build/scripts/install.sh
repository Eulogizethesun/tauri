#!/bin/bash
# Tauri OpenHarmony HAP 安装脚本
# hvigorw 已通过 build-profile.json5 中的签名配置完成签名（含 system_basic 权限）
# 本脚本只负责：卸载旧版 → 安装 → 启动

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"

OHOS_PROJECT="$PROJECT_ROOT/examples/api/src-tauri/gen/ohos"
ENTRY_MODULE="entry_${OHOS_DEVICE_TYPE:-desktop}"
SIGNED_HAP="$OHOS_PROJECT/${ENTRY_MODULE}/build/default/outputs/default/${ENTRY_MODULE}-default-signed.hap"

# ─── 检查已签名 HAP ───
if [ ! -f "$SIGNED_HAP" ]; then
    echo "ERROR: Signed HAP not found at:"
    echo "  $SIGNED_HAP"
    echo "Run build-ohos.sh first (hvigorw will sign it automatically)."
    exit 1
fi

# ─── 自动检测 bundle name ───
APP_JSON="$OHOS_PROJECT/AppScope/app.json5"
if [ -f "$APP_JSON" ]; then
    BUNDLE_NAME=$(grep -o '"bundleName"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | head -1 | sed 's/.*"bundleName"[[:space:]]*:[[:space:]]*"//;s/"//')
fi
if [ -z "$BUNDLE_NAME" ]; then
    echo "ERROR: Cannot detect bundleName from $APP_JSON"
    exit 1
fi

# ─── 自动检测设备 ───
select_device() {
    local targets
    targets=$(hdc list targets 2>&1 | tr -d '\r' | grep -v '^\[' | grep -v '^$' || true)
    local count=$(echo "$targets" | grep -c . || true)

    if [ -z "$targets" ] || [ "$count" -eq 0 ]; then
        echo "ERROR: No device connected. Check hdc connection."
        exit 1
    elif [ "$count" -eq 1 ]; then
        DEVICE_SN="$targets"
    else
        echo "Multiple devices detected:"
        local i=1
        while IFS= read -r line; do
            echo "  [$i] $line"
            i=$((i+1))
        done <<< "$targets"
        echo "Select device [1-$count]:"
        read -r choice
        DEVICE_SN=$(echo "$targets" | sed -n "${choice}p")
    fi

    if [ -z "$DEVICE_SN" ]; then
        echo "ERROR: No device selected."
        exit 1
    fi
}

DEVICE_SN="${DEVICE_SN:-$1}"
if [ -z "$DEVICE_SN" ]; then
    select_device
fi

echo "=== Tauri OpenHarmony Install ==="
echo "Device: $DEVICE_SN"
echo "Bundle: $BUNDLE_NAME"
echo "HAP: $SIGNED_HAP"
echo ""

# ─── 卸载旧版本 ───
echo ">>> Uninstalling old bundle..."
hdc -t "$DEVICE_SN" shell bm uninstall -n "$BUNDLE_NAME" 2>&1 | tr -d '\r' || true

# ─── 安装 ───
echo ">>> Installing..."
WIN_HAP=$(echo "$SIGNED_HAP" | sed 's|^/\(.\)/|\U\1:\\|; s|/|\\|g')
hdc -t "$DEVICE_SN" install "$WIN_HAP" 2>&1 | tr -d '\r'

# ─── 启动 ───
echo ">>> Launching..."
hdc -t "$DEVICE_SN" shell aa start -b "$BUNDLE_NAME" -a EntryAbility 2>&1 | tr -d '\r'

echo ""
echo "=== Done ==="
