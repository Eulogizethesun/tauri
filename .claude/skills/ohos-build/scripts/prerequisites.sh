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

    # ─── 5. sibling checkouts（[patch.crates-io] path 依赖 + examples path 依赖存在性）───
    # Cargo 在依赖解析阶段校验 [patch.crates-io] 的每一项——即使被 patch 的
    # crate 不在本次构建图里——且会加载 workspace 每个 member 的 path 依赖
    # （examples/api 是 member），所以缺一个 sibling 检出就会以与所编代码无关的
    # 解析错误失败。提前检查并给出获取提示。path 条目有两处来源，都扫：
    #   a. workspace 根 Cargo.toml（wry/tao/muda/tray-icon/openharmony-ability/
    #      cargo-mobile2/window-vibrancy 的 [patch.crates-io] 条目）
    #   b. examples/api/src-tauri/Cargo.toml 的直接 path 依赖（plugins-workspace
    #      各插件、sentry-tauri、muda/tray-icon/openharmony-ability）
    # 同一顶层仓的多条 entry 只查一次（plugins-workspace 有 ~30 条）。
    # （stronghold-runtime 经 .cargo/config.toml 的 Artifactory 源替换解析，
    # 无需本地检出。）
    # 分支选择与 CI（.github/workflows/ohos-pr-review.yml 的 sibling checkout
    # 步骤）一致：联动 PR 集共享 fork owner 与分支名，优先 PR head 的
    # owner/ref，否则用 fork 的 ohdev 分支——fork 的默认分支（dev/v2/master）
    # 不带 OHOS 适配或 OHOS-only 插件。
    local parent manifest rel top target seen missing
    parent="$(dirname "$PROJECT_ROOT")"
    seen=""
    missing=""
    # 本 workspace 的 path 条目不含空格，按词拆分遍历安全。
    for manifest in "$PROJECT_ROOT/Cargo.toml" "$SRC_TAURI/Cargo.toml"; do
        for rel in $(grep -oE 'path = "\.\./[^"]+"' "$manifest" \
            | sed -e 's/^path = "//' -e 's/"$//'); do
            top="$(printf '%s' "$rel" | sed -e 's|^\(\.\./\)*||' | cut -d/ -f1)"
            case " $seen " in
                *" $top "*) continue ;;
            esac
            seen="$seen $top"
            target="$(cd "$(dirname "$manifest")/$rel" 2>/dev/null && pwd)"
            # target 为空 = 路径解析失败（检出缺失）；解析成功即存在——仓库内
            # 的 ../ 逃逸（如 src-tauri 的 ../../../crates/tauri）随本检出必然
            # 存在，自然不会进 missing，无需特判。
            if [ -z "$target" ]; then
                missing="$missing $top"
            fi
        done
    done
    if [ -n "$missing" ]; then
        echo "" >&2
        echo "ERROR: sibling checkout(s) required for cargo dependency" >&2
        echo "resolution are missing — cargo validates [patch.crates-io] path" >&2
        echo "entries during resolution even when the patched crate is not part" >&2
        echo "of the build graph, and loads every workspace member's path" >&2
        echo "dependencies (examples/api is a member):" >&2
        for top in $missing; do
            echo "  - $top" >&2
        done
        echo "" >&2
        echo "Clone the missing repositories next to this one, under:" >&2
        echo "  $parent" >&2
        echo "" >&2
        echo "Branch selection (same as CI, ohos-pr-review.yml): a coordinated" >&2
        echo "PR set shares the fork owner and branch name, so prefer the PR" >&2
        echo "head's owner/ref; otherwise use the forks' 'ohdev' branch — the" >&2
        echo "default branches (dev/v2/master) do NOT carry the OHOS" >&2
        echo "adaptation or the OHOS-only plugins:" >&2
        for top in $missing; do
            echo "  git clone --depth 1 --branch ohdev https://github.com/Eulogizethesun/${top}.git" >&2
        done
        return 1
    fi
    echo ">>> [prereq] Sibling checkouts present."
}
