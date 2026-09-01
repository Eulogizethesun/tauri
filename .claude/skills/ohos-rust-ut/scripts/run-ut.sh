#!/bin/bash
# OHOS Rust 单元测试一键脚本
# 交叉编译 → 推送设备 → 运行 → 输出结果
# 支持 workspace 内 crate 和独立 crate（openharmony-ability, muda, tauri 等）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 复用 ohos-build 的环境配置
source "$SCRIPT_DIR/../../ohos-build/scripts/env.sh"

# ─── 参数 ───
PACKAGE="${PACKAGE:-tauri}"
TEST_FILTER="${TEST_FILTER:-}"       # 可选: 只跑匹配的测试 (e.g. "path::ohos")
FEATURES="${FEATURES:-}"             # 可选: 启用的 features (e.g. "menu,webview")
DEVICE_SN="${DEVICE_SN:-}"
DEVICE_DIR="${DEVICE_DIR:-/data/local/tmp}"
TARGET="aarch64-unknown-linux-ohos"
DEVICE_TYPE="${OHOS_DEVICE_TYPE:-desktop}"

# 位置参数：第一个为 TEST_FILTER
if [ -n "$1" ] && [[ "$1" != -* ]]; then
    TEST_FILTER="$1"
    shift
fi

HDC_ARGS=""
if [ -n "$DEVICE_SN" ]; then
    HDC_ARGS="-t $DEVICE_SN"
fi

# ─── 自动检测 WORKDIR ───
# 根据 PACKAGE 名称动态扫描 Cargo.toml 查找对应的 workspace 根目录
detect_workdir() {
    local pkg="$1"
    local repo_root="$(cd "$PROJECT_ROOT/.." && pwd)"

    # 候选目录：PROJECT_ROOT 本身 + REPO_ROOT 下所有一级子目录
    local candidates=("$PROJECT_ROOT")
    for dir in "$repo_root"/*/; do
        [ -d "$dir" ] && candidates+=("$dir")
    done

    for candidate in "${candidates[@]}"; do
        local cargo_toml="$candidate/Cargo.toml"
        [ ! -f "$cargo_toml" ] && continue

        # 检查是否是 workspace
        if grep -q '^\[workspace\]' "$cargo_toml" 2>/dev/null; then
            # workspace 根包本身（[package] 与 [workspace] 同文件，根包不在 members 列表里）
            if grep -q '^\[package\]' "$cargo_toml" 2>/dev/null && grep -q "^name = \"$pkg\"" "$cargo_toml" 2>/dev/null; then
                echo "$candidate"
                return 0
            fi
            # 提取 members 数组内容（支持单行和多行格式）
            local members_str
            members_str=$(sed -n '/^\[workspace\]/,/^\[/p' "$cargo_toml" | tr '\n' ' ' | sed 's/.*members\s*=\s*\[\s*\(.*\)\].*/\1/' | tr ',' '\n' | sed 's/["'\'' ]//g')

            for member in $members_str; do
                [ -z "$member" ] && continue
                if [[ "$member" == *"*"* ]]; then
                    # 通配符模式：展开匹配
                    local member_dir
                    member_dir=$(dirname "$candidate/$member")
                    for actual_dir in "$member_dir"/*/; do
                        [ ! -d "$actual_dir" ] && continue
                        if [ -f "${actual_dir}Cargo.toml" ] && grep -q "name = \"$pkg\"" "${actual_dir}Cargo.toml" 2>/dev/null; then
                            echo "$candidate"
                            return 0
                        fi
                    done
                else
                    if [ -f "$candidate/$member/Cargo.toml" ] && grep -q "name = \"$pkg\"" "$candidate/$member/Cargo.toml" 2>/dev/null; then
                        echo "$candidate"
                        return 0
                    fi
                fi
            done
        else
            # 非 workspace：直接检查 package name
            if grep -q "name = \"$pkg\"" "$cargo_toml" 2>/dev/null; then
                echo "$candidate"
                return 0
            fi
        fi
    done

    # 回退到 PROJECT_ROOT
    echo "$PROJECT_ROOT"
}

WORKDIR=$(detect_workdir "$PACKAGE")

echo "=== OHOS Rust UT Runner ==="
echo "Package:       $PACKAGE"
echo "Features:      ${FEATURES:-<default>}"
echo "Test filter:   ${TEST_FILTER:-<all>}"
echo "Device type:   $DEVICE_TYPE"
echo "Target:        $TARGET"
echo "Device:        ${DEVICE_SN:-auto}"
echo "Working dir:   $WORKDIR"
echo ""

# ─── Step 1: 交叉编译测试二进制 ───
echo ">>> Step 1: Cross-compiling test binary..."
cd "$WORKDIR"

# 检查是否是 workspace（有 Cargo.toml 且包含 [workspace]）
IS_WORKSPACE=false
if grep -q '^\[workspace\]' Cargo.toml 2>/dev/null; then
    IS_WORKSPACE=true
fi

# 构建 cargo test 命令
# 注意：编译阶段不需要 TEST_FILTER，filter 只在设备端运行时使用
CARGO_CMD="OHOS_DEVICE_TYPE=$DEVICE_TYPE cargo test"
CARGO_CMD="$CARGO_CMD --target $TARGET"

if [ "$IS_WORKSPACE" = true ]; then
    # workspace 模式：使用 -p 指定包
    CARGO_CMD="$CARGO_CMD -p $PACKAGE"
fi

CARGO_CMD="$CARGO_CMD --lib --no-run --message-format=json"
if [ -n "$FEATURES" ]; then
    CARGO_CMD="$CARGO_CMD --features $FEATURES"
fi

# 执行编译
COMPILE_OUTPUT=$(eval "$CARGO_CMD" 2>&1 || true)

# 解析出 executable 路径（最后一个 profile.test=true 的 artifact）
# 注意：不能用 python - <<HEREDOC，heredoc 会占用 stdin，导致 cargo 输出读不到
PARSER_SCRIPT='
import sys, json
last_exe = None
for line in sys.stdin:
    line = line.strip()
    if not line.startswith("{"):
        continue
    try:
        obj = json.loads(line)
    except Exception:
        continue
    if obj.get("reason") != "compiler-artifact":
        continue
    exe = obj.get("executable")
    if not exe:
        continue
    profile = obj.get("profile", {})
    if profile.get("test") is True:
        last_exe = exe
print(last_exe or "")
'
BINARY=$(echo "$COMPILE_OUTPUT" | python -c "$PARSER_SCRIPT" 2>/dev/null || echo "")

if [ -z "$BINARY" ] || [ ! -f "$BINARY" ]; then
    echo "ERROR: Failed to locate compiled test binary."
    echo "Cargo output tail:"
    echo "$COMPILE_OUTPUT" | tail -20
    exit 1
fi

# Windows 路径转 Unix
if [[ "$BINARY" == *"\\"* ]]; then
    BINARY=$(echo "$BINARY" | sed 's|\\|/|g' | sed 's|^\([A-Z]\):|/\L\1|')
fi

echo "    Binary: $BINARY"
BINARY_SIZE=$(stat -c %s "$BINARY" 2>/dev/null || stat -f %z "$BINARY")
echo "    Size:   $(( BINARY_SIZE / 1024 / 1024 )) MB"
echo ""

# ─── Step 2: 推送到设备 ───
echo ">>> Step 2: Pushing to device..."
BINARY_NAME=$(basename "$BINARY")
DEVICE_BINARY="$DEVICE_DIR/$BINARY_NAME"

# Windows 路径格式供 hdc 使用（hdc 是 Windows 二进制，需要 D:\... 反斜杠格式）
# 注意：不能用 cmd.exe /c hdc 转发——在 Git Bash 下参数转义链会被吃掉，推送从未真正发生。
# 直接调用 hdc，并用 MSYS_NO_PATHCONV=1 防止设备端 /data/... 路径被 MSYS 转成 Windows 路径。
drive="${BINARY:1:1}"
drive_up=$(echo "$drive" | tr '[:lower:]' '[:upper:]')
rest="${BINARY:3}"
rest_win="${rest//\//\\}"
BINARY_WIN="${drive_up}:\\${rest_win}"

MSYS_NO_PATHCONV=1 hdc $HDC_ARGS file send "$BINARY_WIN" "$DEVICE_BINARY" 2>&1 | tr -d '\r' | grep -v "^$"
echo ""

# ─── Step 3: 在设备上执行 ───
echo ">>> Step 3: Running on device..."
echo ""

MSYS_NO_PATHCONV=1 hdc $HDC_ARGS shell "chmod +x $DEVICE_BINARY" 2>&1 | tr -d '\r'

# 捕获输出和退出码
# \$? 在双引号内保持字面量，由设备端 sh 求值（echo __EXIT_CODE__=<退出码>）
TEST_OUTPUT=$(MSYS_NO_PATHCONV=1 hdc $HDC_ARGS shell "$DEVICE_BINARY ${TEST_FILTER} --test-threads=1 2>&1; echo __EXIT_CODE__=\$?" 2>&1 | tr -d '\r')

# 提取退出码
EXIT_CODE=$(echo "$TEST_OUTPUT" | grep -oE "__EXIT_CODE__=[0-9]+" | tail -1 | cut -d= -f2)
# 打印除标记外的输出
echo "$TEST_OUTPUT" | grep -v "^__EXIT_CODE__="

echo ""
echo "=========================================="
if [ "$EXIT_CODE" = "0" ]; then
    echo "ALL TESTS PASSED"
    exit 0
else
    echo "TESTS FAILED (exit code: ${EXIT_CODE:-unknown})"
    exit 1
fi
