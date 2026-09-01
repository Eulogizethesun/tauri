## ADDED Requirements

### Requirement: Merge order validation
The merge operator SHALL validate both merge order strategies (main-then-pr68 vs direct-pr68) using `--no-commit` before committing, and SHALL select the strategy with fewer conflicts.

#### Scenario: Strategy comparison
- **WHEN** the operator runs `git merge harmony-contrib/main --no-commit` and `git merge harmony-contrib/feat/pr63-pluginized --no-commit`
- **THEN** the operator SHALL count conflicts in each strategy and select the one with fewer total conflicts

### Requirement: Modify/delete file preservation
For each file deleted by upstream but modified locally, the operator SHALL extract the local modifications into a `_legacy/` directory before accepting the deletion.

#### Scenario: Rust side preservation
- **WHEN** a file under `crates/ability/src/` is deleted by upstream (modify/delete conflict)
- **THEN** the operator SHALL copy the local version to `crates/ability/src/_legacy/<filename>` and accept the upstream deletion

#### Scenario: ArkTS side preservation
- **WHEN** a file under `native_ability/src/main/ets/` is deleted by upstream (modify/delete conflict)
- **THEN** the operator SHALL copy the local version to `native_ability/src/main/ets/_legacy/<filename>` and accept the upstream deletion

### Requirement: Legacy inventory
The operator SHALL create a `_legacy/README.md` file listing all preserved files with their original path, function summary, and target Phase for relocation.

#### Scenario: Legacy README created
- **WHEN** all modify/delete conflicts are resolved
- **THEN** `_legacy/README.md` SHALL contain a table with columns: original path, functionality summary, target Phase (A1/A2/A3)

### Requirement: ArkHelper.ets disposal
After merge, the operator SHALL check whether `ArkHelper.ets` is still referenced by any file. If unreferenced, the operator SHALL move local modifications to `_legacy/` and mark the file as deprecated.

#### Scenario: ArkHelper.ets deprecated
- **WHEN** `grep -r "ArkHelper" --include="*.ets"` returns no references after merge
- **THEN** the operator SHALL move local modifications to `_legacy/ArkHelper.ets.bak` and add deprecation comment

#### Scenario: ArkHelper.ets still referenced
- **WHEN** `grep -r "ArkHelper" --include="*.ets"` returns references after merge
- **THEN** the operator SHALL keep the file and add `// @deprecated - use BridgeHost.ets instead` comment

### Requirement: Compilation verification
After all conflicts are resolved, the merged code SHALL pass `cargo check --target aarch64-unknown-linux-ohos` with zero errors.

#### Scenario: OHOS cross-compile passes
- **WHEN** all merge conflicts are resolved and committed
- **THEN** `cargo check --target aarch64-unknown-linux-ohos` SHALL exit with code 0

### Requirement: Pre-merge rollback tag
Before starting the merge, the operator SHALL create a git tag `pre-bridge-merge` pointing to the current HEAD as a rollback point.

#### Scenario: Rollback tag created
- **WHEN** the merge operation begins
- **THEN** `git tag pre-bridge-merge` SHALL be created at the current HEAD commit
