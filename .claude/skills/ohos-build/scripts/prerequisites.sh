#!/bin/bash
# prerequisites.sh — cargo tauri ohos build/run 之前的开发期前置准备
#
# 这些是 CLI 不做、beforeBuildCommand 不覆盖的 monorepo 前置：
#   1. 前端依赖 (pnpm install)
#   2. @tauri-apps/api dist (pnpm build:api)
#   3. 插件 dist-js (plugins-workspace pnpm build)
#   4. ACL 权限一致性检查
#   5. sibling 检出存在性检查（[patch.crates-io] path 依赖 + plugins-workspace）
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

    # ─── 5. sibling checkouts（[patch.crates-io] path 依赖存在性）───
    # Cargo 在依赖解析阶段校验 [patch.crates-io] 的每一项——即使被 patch 的
    # crate 不在本次构建图里——所以缺一个 sibling 检出就会以与所编代码无关的
    # 解析错误失败。提前检查并给出获取提示。（examples/api/src-tauri 另有直连
    # plugins-workspace 的 path 依赖，一并检查；stronghold-runtime 经
    # .cargo/config.toml 的 Artifactory 源替换解析，无需本地检出。）
    local parent rel target name missing
    parent="$(dirname "$PROJECT_ROOT")"
    missing=""
    # 本 workspace 的 path 条目不含空格，按词拆分遍历安全。
    for rel in $(awk '/^\[patch\.crates-io\]/{f=1;next} /^\[/{f=0} f' \
        "$PROJECT_ROOT/Cargo.toml" \
        | grep -oE 'path = "\.\./[^"]+"' \
        | sed -e 's/^path = "//' -e 's/"$//') ../plugins-workspace; do
        target="$parent/${rel#../}"
        if [ ! -d "$target" ]; then
            missing="$missing $rel"
        fi
    done
    if [ -n "$missing" ]; then
        echo "" >&2
        echo "ERROR: sibling checkout(s) required for cargo dependency" >&2
        echo "resolution are missing ([patch.crates-io] path entries are" >&2
        echo "validated during resolution even when the patched crate is not" >&2
        echo "part of the build):" >&2
        for rel in $missing; do
            echo "  - $rel" >&2
        done
        echo "" >&2
        echo "Clone the missing repositories next to this one, under:" >&2
        echo "  $parent" >&2
        for name in $(printf '%s\n' $missing | sed 's|^\.\./||' | cut -d/ -f1 | sort -u); do
            echo "  git clone https://github.com/Eulogizethesun/${name}.git" >&2
        done
        echo "" >&2
        echo "Branch note: plugins-workspace is used from its v2 branch." >&2
        return 1
    fi
    echo ">>> [prereq] Sibling checkouts present."
}
