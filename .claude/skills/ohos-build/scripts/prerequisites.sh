#!/bin/bash
# prerequisites.sh — cargo tauri ohos build/run 之前的开发期前置准备
#
# 这些是 CLI 不做、beforeBuildCommand 不覆盖的 monorepo 前置：
#   1. 前端依赖 (pnpm install)
#   2. @tauri-apps/api dist (pnpm build:api)
#   3. 插件 dist-js (plugins-workspace pnpm build)
#   4. ACL 权限一致性检查
#
# 前端构建 (pnpm build) 不在此处 —— 由 tauri.conf.json 的 beforeBuildCommand 触发，
# CLI 会继承当前环境变量（如 VITE_AUTOTEST），故只需在调用前 export。
#
# 被 build-ohos.sh 和 run-tests.sh source。不直接执行。
# 依赖调用方先 source env.sh（提供 PROJECT_ROOT / SCRIPT_DIR）。

API_DIR="$PROJECT_ROOT/examples/api"
SRC_TAURI="$API_DIR/src-tauri"
PLUGINS_DIR="$(dirname "$PROJECT_ROOT")/plugins-workspace"

ohos_prerequisites() {
    # ─── 1. 安装前端依赖 ───
    if [ ! -d "$API_DIR/node_modules" ]; then
        echo ">>> [prereq] Installing frontend dependencies..."
        (cd "$API_DIR" && pnpm install)
    else
        echo ">>> [prereq] Frontend dependencies present, skipping."
    fi

    # ─── 2. 构建 @tauri-apps/api ───
    if [ ! -d "$PROJECT_ROOT/packages/api/dist" ] || [ ! -f "$PROJECT_ROOT/crates/tauri/scripts/bundle.global.js" ]; then
        echo ""
        echo ">>> [prereq] Building @tauri-apps/api..."
        (cd "$PROJECT_ROOT" && pnpm build:api)
    else
        echo ">>> [prereq] @tauri-apps/api dist present, skipping."
    fi

    # ─── 3. 构建插件 dist-js（防止过期产物导致测试失败）───
    if [ -d "$PLUGINS_DIR" ]; then
        echo ""
        echo ">>> [prereq] Building plugins dist-js..."
        # 复刻 plugins-workspace 根 package.json 的 build 命令，但去掉 --parallel、
        # 改用 --workspace-concurrency=4 限流：unbounded 并行会一次拉起 ~33 个
        # rollup，2026-09-09 实测在内存充裕（16GB 空闲）时仍整批停摆——进程全部
        # 闲置、40 分钟零进展、产物只写了 8/33 个包。限流后单批可靠完成。
        (cd "$PLUGINS_DIR" && pnpm run -r --workspace-concurrency=4 \
            --filter '!plugins-workspace' \
            --filter '!./plugins/*/examples/**' \
            --filter '!./examples/*' \
            build 2>&1 | tail -3) || echo "    WARNING: plugins build failed, using existing dist-js"
    fi

    # ─── 4. ACL permission consistency check ───
    echo ""
    echo ">>> [prereq] Checking ACL permission consistency..."
    bash "$SCRIPT_DIR/../../acl-check/scripts/clean-stale-acl.sh" "$SRC_TAURI"
}
