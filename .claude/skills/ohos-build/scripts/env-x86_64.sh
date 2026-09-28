#!/bin/bash
# env-x86_64.sh — x86_64-unknown-linux-ohos 构建环境 overlay
#
# 必须在 env.sh 之后 source（复用其 OHOS_CLANG / OHOS_SYSROOT / OHOS_AR
# 及 DEVECO_HOME / OHOS_NDK_HOME / PATH 配置）：
#
#   source env.sh && source env-x86_64.sh
#
# 用途：DevEco Studio 2in1 模拟器（x86_64 ABI）上的构建。
# env.sh 的 aarch64 变量保持不变，两套变量按 cargo target 各自生效，可共存。
# 另需 export SODIUM_LIB_DIR 指向 x86_64 预编译 libsodium（见
# D:\xuqiu\tauri-3.0\libsodium-ohos-x86_64\lib）。

if [ -z "$OHOS_CLANG" ] || [ -z "$OHOS_SYSROOT" ]; then
    echo "ERROR: source env.sh first (OHOS_CLANG/OHOS_SYSROOT not set)"
    exit 1
fi

export CC_x86_64_unknown_linux_ohos="$OHOS_CLANG"
export CFLAGS_x86_64_unknown_linux_ohos="--target=x86_64-linux-ohos --sysroot=$OHOS_SYSROOT -D__MUSL__"
export AR_x86_64_unknown_linux_ohos="$OHOS_AR"

export CARGO_TARGET_X86_64_UNKNOWN_LINUX_OHOS_LINKER="$OHOS_CLANG"
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_OHOS_RUSTFLAGS="-C link-arg=--target=x86_64-linux-ohos -C link-arg=--sysroot=$OHOS_SYSROOT -C link-arg=-D__MUSL__"
