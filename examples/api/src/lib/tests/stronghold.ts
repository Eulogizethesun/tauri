import { skip, type TestCase } from '../test-runner';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

/** True when an error indicates the plugin/command is not available on this
 *  platform (not registered / not implemented). Use to skip — never pass. */
function isMissing(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e);
  return (
    m.includes('not found') ||
    m.includes('not implemented') ||
    m.includes('command not found') ||
    m.includes('not allowed by ACL') ||
    m.includes('not supported') ||
    m.includes('unsupported')
  );
}

/**
 * Stronghold (IOTA secret management) tests for @tauri-apps/plugin-stronghold.
 *
 * The plugin is registered OHOS-only in examples/api (pure-Rust plugin, no
 * bridge); on other platforms every case skips via the missing-plugin guard.
 *
 * Scope split: only the FAST in-memory operations — initialize (argon2 KDF
 * ≈0.7s), client/store CRUD and the BIP39 → SLIP10 → Ed25519 procedure
 * chain. Snapshot save()/load() runs upstream scrypt at work factor 19
 * (≈107s per call on device in a debug build — by-design password hardening,
 * not an OHOS regression), so it stays out of runAll: those flows are the
 * manual buttons in TestRunner ("Stronghold Manual Tests") and the cases in
 * doc/manual_tests.md §35. The equivalent full-lifecycle Rust E2E lives
 * in the plugin repo (tests/ohos_e2e.rs, verified on HAD-W32).
 */

async function importStronghold() {
  try {
    return await import('@tauri-apps/plugin-stronghold');
  } catch (e) {
    skip(`plugin-stronghold not available: ${e}`);
  }
}

/** Load a fresh stronghold (unique relative path — OHOS resolves it against
 *  AppData, exercising the plugin's CWD-is-root fix) and return it with a
 *  newly created client. */
async function freshStronghold(label: string) {
  const mod = await importStronghold();
  const snapshotPath = `stronghold-auto-${label}-${Date.now()}.hold`;
  let instance;
  try {
    instance = await mod.Stronghold.load(snapshotPath, 'autotest-password');
  } catch (e) {
    if (isMissing(e)) skip(`stronghold initialize not available: ${e}`);
    throw e;
  }
  // A fresh unique path has no snapshot on disk, so createClient is the right
  // call. Note upstream create_client never errors on an existing name — it
  // silently replaces the client with an empty one (reading persisted state
  // requires loadClient); harmless here because the path is unique per run.
  // The loadClient fallback only guards unexpected non-collision errors.
  let client;
  try {
    client = await instance.createClient('autotest-client');
  } catch {
    client = await instance.loadClient('autotest-client');
  }
  return { mod, instance, client, snapshotPath };
}

function bytesEqual(a: Uint8Array, b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export const strongholdTests: TestCase[] = [
  {
    name: '@tauri-apps/plugin-stronghold initialize + store round-trip',
    category: 'auto',
    timeout: 30000,
    async fn() {
      const { client } = await freshStronghold('store');
      const store = client.getStore();
      const payload = Array.from(new TextEncoder().encode('stronghold-autotest-value'));
      await store.insert('autotest-key', payload);
      const got = await store.get('autotest-key');
      assert(got !== null, 'store.get right after insert should not be null');
      assert(
        bytesEqual(got, payload),
        `store round-trip mismatch: got [${[...got].slice(0, 8)}…] want [${payload.slice(0, 8)}…]`,
      );
      const removed = await store.remove('autotest-key');
      assert(
        removed !== null && bytesEqual(removed, payload),
        'store.remove should return the removed value',
      );
      const after = await store.get('autotest-key');
      assert(after === null, `store.get after remove should be null, got ${String(after)}`);
      // No save() here on purpose — snapshot writes cost ~107s of scrypt.
    },
  },
  {
    name: '@tauri-apps/plugin-stronghold vault procedures (BIP39 → SLIP10 → Ed25519)',
    category: 'auto',
    timeout: 30000,
    async fn() {
      const { mod, client } = await freshStronghold('procedures');
      const vault = client.getVault('autotest-vault');
      const seedLoc = mod.Location.generic('autotest-vault', 'bip39-seed');
      const keyLoc = mod.Location.generic('autotest-vault', 'slip10-key');

      const seed = await vault.generateBIP39(seedLoc);
      assert(
        seed instanceof Uint8Array && seed.length > 0,
        `BIP39Generate should return a non-empty seed, got length ${seed.length}`,
      );
      // Empty chain derives the Ed25519 master key from the seed — same shape
      // as the plugin's on-device Rust E2E (tests/ohos_e2e.rs).
      const key = await vault.deriveSLIP10([], 'Seed', seedLoc, keyLoc);
      assert(
        key instanceof Uint8Array && key.length > 0,
        `SLIP10Derive should return key bytes, got length ${key.length}`,
      );
      const pubkey = await vault.getEd25519PublicKey(keyLoc);
      assert(pubkey.length === 32, `Ed25519 public key must be 32 bytes, got ${pubkey.length}`);
      const sig1 = await vault.signEd25519(keyLoc, 'autotest-message');
      assert(sig1.length === 64, `Ed25519 signature must be 64 bytes, got ${sig1.length}`);
      const sig2 = await vault.signEd25519(keyLoc, 'autotest-message');
      assert(bytesEqual(sig2, [...sig1]), 'signing the same message twice must be deterministic');
      const sig3 = await vault.signEd25519(keyLoc, 'autotest-message-2');
      assert(
        !bytesEqual(sig3, [...sig1]),
        'signing a different message must produce a different signature',
      );
      // Raw secret write (vault records are write-only by design — reading
      // them back requires a procedure, so resolve == pass).
      await vault.insert('autotest-record', Array.from(new TextEncoder().encode('top-secret')));
    },
  },
  {
    name: '@tauri-apps/plugin-stronghold snapshot round-trip (manual)',
    category: 'manual',
    async fn() {
      console.log('[stronghold manual] Use the "Stronghold Manual Tests" buttons in TestRunner:');
      console.log('[stronghold manual] 1. Snapshot Save — writes a store record and saves (~107s scrypt)');
      console.log('[stronghold manual] 2. Reload Verify — reloads the snapshot and reads the record back (~107s)');
      console.log('[stronghold manual] 3. Wrong Password — loading with a wrong password must be rejected (~107s)');
      console.log('[stronghold manual] Expect: save ✅, reload shows the same value, wrong password rejected with a decryption error');
    },
  },
];
