#!/usr/bin/env sh
# Run each test file in its own process to avoid memory issues.
# NODE_OPTIONS increases heap; maxWorkers=1 runs one suite at a time.
set -e
cd "$(dirname "$0")/.."
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
for f in __tests__/utils/*.test.ts; do
  [ -f "$f" ] || continue
  echo "> Running $f"
  npx jest "$f" --maxWorkers=1
done
