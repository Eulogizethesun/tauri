#!/bin/bash
# env.sh — 共享环境配置，自动检测 DevEco Studio 路径
# 被 build-ohos.sh 和 sign-and-install.sh source

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_LOCAL="$SCRIPT_DIR/.env.local"

# ─── 加载已有配置 ───
if [ -f "$ENV_LOCAL" ]; then
    source "$ENV_LOCAL"
fi

# ─── 自动检测 DevEco Studio (Git Bash 路径格式) ───
detect_deveco_home() {
    local candidates=(
        "/d/app/DevEco-Studio"
        "/d/app/DevEco Studio"
        "/c/Program Files/Huawei/DevEco Studio"
        "/c/Program Files (x86)/Huawei/DevEco Studio"
        "$HOME/DevEco-Studio"
    )
    for path in "${candidates[@]}"; do
        if [ -d "$path/sdk/default/openharmony" ]; then
            echo "$path"
            return 0
        fi
    done
    return 1
}

if [ -z "$DEVECO_HOME" ]; then
    DEVECO_HOME=$(detect_deveco_home)
    if [ -z "$DEVECO_HOME" ]; then
        echo "ERROR: DevEco Studio not found."
        echo "Please create $ENV_LOCAL with content:"
        echo '  DEVECO_HOME="/path/to/DevEco-Studio"'
        exit 1
    fi
    # 保存配置
    echo "DEVECO_HOME=\"$DEVECO_HOME\"" > "$ENV_LOCAL"
    echo "Saved DevEco Studio path to $ENV_LOCAL"
fi

# ─── 验证路径有效性 ───
if [ ! -d "$DEVECO_HOME/sdk/default/openharmony" ]; then
    echo "ERROR: DEVECO_HOME=$DEVECO_HOME is invalid (sdk not found)"
    echo "Delete $ENV_LOCAL and re-run to reconfigure."
    exit 1
fi

# ─── 短路径转换（处理含空格的路径，如 "C:\Program Files\..."）───
to_short_path() {
    local winpath="$1"
    if [[ "$winpath" == *" "* ]]; then
        local short=$(powershell -Command "(New-Object -ComObject Scripting.FileSystemObject).GetFolder('$winpath').ShortPath" 2>/dev/null | tr -d '\r')
        if [ -n "$short" ]; then echo "$short"; return; fi
    fi
    echo "$winpath"
}

# ─── 导出环境变量 ───
export DEVECO_HOME
export OHOS_HOME="$DEVECO_HOME/sdk/default/openharmony"
export JAVA_HOME="$DEVECO_HOME/jbr"
# Windows 格式路径，供 cargo-mobile2、clang.exe 等使用
export DEV_ECO_STUDIO_INSTALL_PATH=$(echo "$DEVECO_HOME" | sed 's|^/\(.\)/|\U\1:\\|; s|/|\\|g')
# 如果路径含空格，转为短路径（Rust/Cargo 不支持空格路径）
if [[ "$DEV_ECO_STUDIO_INSTALL_PATH" == *" "* ]]; then
    DEV_ECO_STUDIO_INSTALL_PATH=$(to_short_path "$DEV_ECO_STUDIO_INSTALL_PATH")
    export DEV_ECO_STUDIO_INSTALL_PATH
fi
export PATH="$DEVECO_HOME/jbr/bin:$PATH:$DEVECO_HOME/tools/hvigor/bin:$DEVECO_HOME/tools/ohpm/bin:$OHOS_HOME/toolchains"

# ─── 设置 ohos clang 编译器 (供 ring 等 native crate 使用) ───
# 基于已转换的短路径 DEV_ECO_STUDIO_INSTALL_PATH 构建所有 Windows 路径
OHOS_WIN_ROOT="${DEV_ECO_STUDIO_INSTALL_PATH}\\sdk\\default\\openharmony"
OHOS_CLANG="${OHOS_WIN_ROOT}\\native\\llvm\\bin\\clang.exe"
OHOS_SYSROOT="${OHOS_WIN_ROOT}\\native\\sysroot"
OHOS_AR="${OHOS_WIN_ROOT}\\native\\llvm\\bin\\llvm-ar.exe"
export CC_aarch64_unknown_linux_ohos="$OHOS_CLANG"
export CFLAGS_aarch64_unknown_linux_ohos="--target=aarch64-linux-ohos --sysroot=$OHOS_SYSROOT -D__MUSL__"
export AR_aarch64_unknown_linux_ohos="$OHOS_AR"

# ─── Rust linker 配置 ───
export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_LINKER="$OHOS_CLANG"
export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_RUSTFLAGS="-C link-arg=--target=aarch64-linux-ohos -C link-arg=--sysroot=$OHOS_SYSROOT -C link-arg=-D__MUSL__"

# ─── 推导项目根目录（skill 在 .claude/skills/ohos-build/scripts/ 下）───
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
export PROJECT_ROOT

# ─── 设备类型配置 ───
# OHOS_DEVICE_TYPE: mobile 或 desktop
# - mobile: 编译为移动端模式（默认）
# - desktop: 编译为桌面端模式，启用 desktop cfg 功能
export OHOS_DEVICE_TYPE="${OHOS_DEVICE_TYPE:-mobile}"

# ─── OHOS NDK & SDK (ohrs/hvigorw 需要) ───
# ohrs expects OHOS_NDK_HOME pointing to the SDK root (not /native subdirectory)
# ohrs internally appends /native itself; double /native/native causes panics
export OHOS_NDK_HOME="$DEV_ECO_STUDIO_INSTALL_PATH\\sdk\\default\\openharmony"
# hvigorw expects DEVECO_SDK_HOME
export DEVECO_SDK_HOME="$DEV_ECO_STUDIO_INSTALL_PATH"
