import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const sentinel = "IPSM_PREFLIGHT_REDACTION_SENTINEL";
const helper = path.resolve("tests/migrations/assertions.sh");
let directory: string;
let log: string;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "ipsm-shell-assertions-"));
  log = path.join(directory, "report.log");
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function run(command: string, args: string[] = []) {
  return spawnSync("bash", ["-c", 'set -euo pipefail; source "$1"; shift; ' + command, "test", helper, ...args], { encoding: "utf8" });
}

describe("migration shell assertions", () => {
  it("accepts a report without the synthetic secret", () => {
    writeFileSync(log, "safe schema metadata\n");
    expect(run('assert_redacted "$1"', [log]).status).toBe(0);
  });

  it("fails without printing the report when the sentinel appears", () => {
    writeFileSync(log, sentinel);
    const result = run('assert_redacted "$1"', [log]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(sentinel);
  });

  it("fails when the report cannot be read", () => {
    expect(run('assert_redacted "$1"', [log]).status).toBe(1);
  });

  it.each([2, 127])("fails closed when grep exits %i", (status) => {
    expect(run(`grep() { return ${status}; }; assert_redacted "$1"`, [log]).status).toBe(1);
  });

  it("requires the expected literal SQL error, including regex metacharacters", () => {
    writeFileSync(log, "psql:fixture.sql:21: ERROR:  Expected payment(s) [guard]\n");
    expect(run('assert_migration_error 3 "$1" "$2"', ["Expected payment(s) [guard]", log]).status).toBe(0);
  });

  it.each([0, 1, 2, 127])("rejects non-SQL exit %i even with a matching message", (status) => {
    writeFileSync(log, "ERROR:  Expected fixture error\n");
    expect(run('assert_migration_error "$1" "Expected fixture error" "$2"', [String(status), log]).status).toBe(1);
  });

  it.each(["ERROR:  Unexpected failure", "CONTEXT: Expected fixture error"])("rejects unexpected output: %s", (output) => {
    writeFileSync(log, output);
    expect(run('assert_migration_error 3 "Expected fixture error" "$1"', [log]).status).toBe(1);
  });

  it("rejects missing error logs and search failures", () => {
    expect(run('assert_migration_error 3 "Expected fixture error" "$1"', [log]).status).toBe(1);
    expect(run('grep() { return 127; }; assert_migration_error 3 "Expected fixture error" "$1"', [log]).status).toBe(1);
  });
});
