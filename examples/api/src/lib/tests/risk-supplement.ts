import type { TestCase } from '../test-runner';
import { platform } from '@tauri-apps/plugin-os';
import * as path from '@tauri-apps/api/path';
import * as fs from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';

// 三类「纯 Rust 复用、真机未跑」风险点补测（2026-09-04）：
//   fs watcher（notify inotify 后端）/ shell execute+spawn+stdin_write+kill
//   （std::process 子进程，命令注册此前从未在真机执行过）。
// （accelerator 触发链 host 注入用例 2026-09-07 曾入套件末位，2026-09-09
//   迁出——需 host 侧按键注入配合才能 PASS，不符自动套件自包含原则，验证
//   内容归档至 manual_tests.md「Menu」章 MenuBar Accelerator Ctrl+O 用例。）
// process exit/restart 有自杀性（杀掉测试进程本身），不进 runAll——由
// TestRunner 挂载阶段的 process phase 独立驱动（仅 VITE_PROCESS_TESTS 构建），
// 见 TestRunner.svelte onMount。
// 仅 OHOS 执行（其他平台 skip），避免污染 Windows 基线。
//
// 语义与套件其余用例一致：结果级断言（事件确实收到、stdout 内容、退出码），
// 非「不抛错」级。这三项此前在支持文档中标可用但零实测——本批给出真机定性，
// 失败也是有效结论（宁可漏报、不可虚报）。

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function requireOhos() {
  const p = await platform();
  if (p !== 'ohos') throw new Error(`skip: OHOS 风险点补测用例（当前平台 ${p}）`);
}

async function waitFor(cond: () => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (cond()) return true;
    await delay(200);
  }
  return cond();
}

export const riskSupplementTests: TestCase[] = [
  {
    // watchImmediate = 无 debouncer 的 RecommendedWatcher（notify 原生事件）。
    // 建目录 → watch → 写触发文件 → 断言收到含该路径的事件 → unwatch（资源释放）。
    name: 'fs watchImmediate: 文件创建事件 + unwatch',
    category: 'auto',
    timeout: 15000,
    fn: async () => {
      await requireOhos();
      const dir = await path.join(await path.appCacheDir(), 'fs-watch-test');
      await fs.mkdir(dir, { recursive: true });
      const events: { kind?: unknown; paths?: string[] }[] = [];
      const unwatch = await fs.watchImmediate(dir, (e) => events.push(e));
      try {
        await delay(300); // watcher 就绪
        // 注意 writeTextFile 而非 writeFile：writeFile 的数据走 invoke body，
        // OHOS/Android 移动路径 body 恒为 JSON（无 Raw 通道），字符串 body 会
        // 落进 write_file_inner 的错误分支（unexpected invoke body）——传
        // Uint8Array 或用 writeTextFile 才是移动端正确用法。
        await fs.writeTextFile(await path.join(dir, 'trigger.txt'), 'watch-me');
        const got = await waitFor(() => events.length > 0, 8000);
        assert(got, '8s 内未收到任何 watch 事件（inotify 在应用沙箱内不可用？）');
        const paths = events.flatMap((e) => e.paths ?? []);
        assert(
          paths.some((p) => p.includes('trigger.txt')),
          `事件路径不含触发文件: ${JSON.stringify(events)}`
        );
      } finally {
        unwatch();
      }
    },
  },
  {
    name: 'shell execute: sh -c echo（子进程执行 + stdout + 退出码）',
    category: 'auto',
    timeout: 15000,
    fn: async () => {
      await requireOhos();
      const out = await Command.create('sh', ['-c', 'echo shell-execute-ok']).execute();
      assert(
        out.code === 0,
        `退出码非 0: code=${out.code} signal=${out.signal} stderr=${JSON.stringify(out.stderr)}`
      );
      assert(
        String(out.stdout).includes('shell-execute-ok'),
        `stdout 缺标记: ${JSON.stringify(out.stdout)}`
      );
    },
  },
  {
    name: 'shell spawn + stdin_write + kill（交互式子进程全生命周期）',
    category: 'auto',
    timeout: 20000,
    fn: async () => {
      await requireOhos();
      const cmd = Command.create('sh', []);
      const stdout: string[] = [];
      let closed: { code: number | null; signal: number | null } | null = null;
      cmd.stdout.on('data', (line) => stdout.push(String(line)));
      cmd.on('close', (payload) => {
        closed = payload as { code: number | null; signal: number | null };
      });
      const child = await cmd.spawn();
      assert(
        typeof child.pid === 'number' && child.pid > 0,
        `spawn 返回异常 pid: ${JSON.stringify(child)}`
      );
      await child.write('echo shell-spawn-ok\n');
      const gotMarker = await waitFor(() => stdout.join('\n').includes('shell-spawn-ok'), 8000);
      assert(gotMarker, `8s 内 stdout 流未收到标记: ${JSON.stringify(stdout)}`);
      await child.kill();
      const gotClose = await waitFor(() => closed !== null, 8000);
      assert(gotClose, 'kill 后 8s 内未收到 close（Terminated）事件');
    },
  },
];
