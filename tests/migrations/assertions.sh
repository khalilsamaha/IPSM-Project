#!/usr/bin/env bash
# Sourced by the disposable migration tests. Only portable grep is required.
assert_redacted() {
  local log=$1 status=0
  grep -Fq -- 'IPSM_PREFLIGHT_REDACTION_SENTINEL' "$log" || status=$?
  case "$status" in
    1) ;; # Only a successful search with no match proves redaction.
    0) echo 'Preflight exposed a synthetic secret sentinel; refusing to print the report.' >&2; return 1 ;;
    *) echo 'Could not verify preflight redaction; refusing to print the report.' >&2; return 1 ;;
  esac
}

assert_migration_error() {
  local status=$1 expected=$2 log=$3
  # ON_ERROR_STOP uses exit 3 for a SQL error; connection/tool errors are not fixtures.
  if [[ $status != 3 ]] || ! grep -Fq -- "ERROR:  $expected" "$log"; then
    echo "Migration did not fail with the expected SQL error: $expected (exit $status)" >&2
    echo "Retained fixture log: $log" >&2
    return 1
  fi
}
