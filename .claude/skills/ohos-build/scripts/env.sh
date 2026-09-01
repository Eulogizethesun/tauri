#!/bin/bash
# env.sh — 共享环境配置，定位 DevEco Studio 路径
# 被 build-ohos.sh / run-tests.sh / prerequisites.sh / install.sh source
#
# DevEco Studio 路径解析优先级（不落盘，不读 .env.local）：
#   1. DEV_ECO_STUDIO_INSTALL_PATH 环境变量（Windows 格式，如 C:\myprogram\DevEcoStudio）
#   2. DEVECO_HOME 环境变量（Git Bash 格式，如 /c/myprogram/DevEcoStudio）
#   3. detect_deveco_home() 自动检测候选路径
#   4. 都没有 → 报错退出

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Windows 路径 → Git Bash 路径 ───
win_to_bash_path() {
    local win_path="$1"
    # C:\foo\bar → /c/foo/bar
    local drive="${win_path:0:1}"
    local rest="${win_path:2}"
    local lower_drive
    lower_drive=$(echo "$drive" | tr '[:upper:]' '[:lower:]')
    local bash_rest="${rest//\\//}"
    echo "/${lower_drive}${bash_rest}"
}

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

# ─── 优先级 1: DEV_ECO_STUDIO_INSTALL_PATH (Windows 格式) ───
if [ -n "$DEV_ECO_STUDIO_INSTALL_PATH" ]; then
    DEVECO_HOME=$(win_to_bash_path "$DEV_ECO_STUDIO_INSTALL_PATH")
fi

# ─── 优先级 2: DEVECO_HOME (Git Bash 格式，已设则直接用) ───
# ─── 优先级 3: 自动检测 ───
if [ -z "$DEVECO_HOME" ]; then
    DEVECO_HOME=$(detect_deveco_home)
fi

# ─── 优先级 4: 报错退出 ───
if [ -z "$DEVECO_HOME" ]; then
    echo "ERROR: DevEco Studio not found."
    echo "Set one of these environment variables:"
    echo '  DEV_ECO_STUDIO_INSTALL_PATH="C:\path\to\DevEcoStudio"   (Windows format)'
    echo '  DEVECO_HOME="/c/path/to/DevEcoStudio"                    (Git Bash format)'
    echo "Or install DevEco Studio in a standard location for auto-detection."
    exit 1
fi

# ─── 验证路径有效性 ───
if [ ! -d "$DEVECO_HOME/sdk/default/openharmony" ]; then
    echo "ERROR: DEVECO_HOME=$DEVECO_HOME is invalid (sdk not found)"
    echo "Set DEV_ECO_STUDIO_INSTALL_PATH or DEVECO_HOME to the correct DevEco Studio path."
    exit 1
fi

# ─── 导出环境变量 ───
export DEVECO_HOME
export OHOS_HOME="$DEVECO_HOME/sdk/default/openharmony"
export JAVA_HOME="$DEVECO_HOME/jbr"
# Windows 格式路径，供 cargo-mobile2、clang.exe 等使用
export DEV_ECO_STUDIO_INSTALL_PATH=$(echo "$DEVECO_HOME" | sed 's|^/\(.\)/|\U\1:\\|; s|/|\\|g')
export PATH="$DEVECO_HOME/jbr/bin:$PATH:$DEVECO_HOME/tools/hvigor/bin:$DEVECO_HOME/tools/ohpm/bin:$OHOS_HOME/toolchains"

# ─── 设置 ohos clang 编译器 (供 ring 等 native crate 使用) ───
OHOS_CLANG=$(echo "$OHOS_HOME/native/llvm/bin/clang.exe" | sed 's|^/\(.\)/|\U\1:\\|; s|/|\\|g')
OHOS_SYSROOT=$(echo "$OHOS_HOME/native/sysroot" | sed 's|^/\(.\)/|\U\1:\\|; s|/|\\|g')
OHOS_AR=$(echo "$OHOS_HOME/native/llvm/bin/llvm-ar.exe" | sed 's|^/\(.\)/|\U\1:\\|; s|/|\\|g')

# 转 8.3 短路径（去除空格），避免 cc-rs 对 CFLAGS 字符串分词时
# 把 "C:\Program Files\..." 按空格拆断。短路径在本机恒定存在。
to_short_path() {
    local p="$1"
    # 仅当路径含空格时才转；不含空格直接返回原值
    if [[ "$p" == *" "* ]]; then
        # powershell FSO ShortPath，失败则回退原值
        local short
        short=$(powershell.exe -NoProfile -Command "(New-Object -ComObject Scripting.FileSystemObject).GetFolder('$p').ShortPath" 2>/dev/null | tr -d '\r')
        if [ -n "$short" ]; then
            echo "$short"
            return
        fi
    fi
    echo "$p"
}

OHOS_CLANG=$(to_short_path "$OHOS_CLANG")
OHOS_SYSROOT=$(to_short_path "$OHOS_SYSROOT")
OHOS_AR=$(to_short_path "$OHOS_AR")

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
# - mobile: 编译为移动端模式
# - desktop: 编译为桌面端模式，启用 desktop cfg 功能（默认）
export OHOS_DEVICE_TYPE="${OHOS_DEVICE_TYPE:-desktop}"

# ─── OHOS NDK & SDK (ohrs/hvigorw 需要) ───
# ohrs expects OHOS_NDK_HOME pointing to the SDK root (not /native subdirectory)
# ohrs internally appends /native itself; double /native/native causes panics
export OHOS_NDK_HOME="$DEV_ECO_STUDIO_INSTALL_PATH\\sdk\\default\\openharmony"
# hvigorw expects DEVECO_SDK_HOME
export DEVECO_SDK_HOME="$DEV_ECO_STUDIO_INSTALL_PATH"
