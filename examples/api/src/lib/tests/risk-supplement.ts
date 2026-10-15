import { skipOnMobile, type TestCase } from '../test-runner';
import { platform } from '@tauri-apps/plugin-os';
import * as path from '@tauri-apps/api/path';
import * as fs from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';

// Follow-up tests for three "pure-Rust reuse, never run on device" risk points (2026-09-04):
//   fs watcher (notify's inotify backend) / shell execute+spawn+stdin_write+kill
//   (std::process children; these commands had never been exercised on a device before).
// (The accelerator trigger-chain host-injection case was appended to the suite on 2026-09-07 and moved out on 2026-09-09
//   — it needs host-side key injection to pass, which breaks the autotest suite's self-containment; the verification
//   content is archived in manual_tests.md's "Menu" chapter, MenuBar Accelerator Ctrl+O case.)
// process exit/restart is self-terminating (kills the test process itself), so it is excluded from runAll — the
// process phase drives it independently at TestRunner mount time (VITE_PROCESS_TESTS builds only),
// see TestRunner.svelte onMount.
// Runs on OHOS only (skipped elsewhere) to keep the Windows baseline unpolluted.
//
// Semantics match the rest of the suite: result-level assertions (the event was really received, stdout content, exit code),
// not just "does not throw". These three were marked supported in the docs with zero on-device testing — this batch gives an on-device verdict,
// and a failure is still a valid conclusion (prefer under-reporting to false reporting).

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
    // watchImmediate = a RecommendedWatcher with no debouncer (notify's native events).
    // mkdir → watch → write the trigger file → assert an event containing that path arrives → unwatch (resource release).
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
        await delay(300); // watcher ready
        // Note writeTextFile instead of writeFile: writeFile's payload travels in the invoke body,
        // and the OHOS/Android mobile path always carries the body as JSON (no Raw channel), so a string body falls into
        // write_file_inner's error branch (unexpected invoke body) — passing
        // a Uint8Array or using writeTextFile is the correct usage on mobile.
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
      await skipOnMobile('the phone app sandbox denies exec of system binaries (EACCES os error 13) — /bin/sh exists on device but the mobile-form sandbox policy refuses it; the same case passes on the 2in1 desktop form');
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
      await skipOnMobile('the phone app sandbox denies exec of system binaries (EACCES os error 13) — /bin/sh exists on device but the mobile-form sandbox policy refuses it; the same case passes on the 2in1 desktop form');
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
