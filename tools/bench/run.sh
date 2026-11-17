#!/bin/bash
# Chạy bài đo trên một bản plugin: chép plugin sang thư mục tạm, thêm tệp bench, chạy
# `claude plugin test`, in các dòng BENCH. Không cài gì lên máy.
#   tools/bench/run.sh upstream/savvy-progress
#   tools/bench/run.sh plugins/savvy-progress
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
src="$repo/$1"
name="$(basename "$src")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp -R "$src" "$tmp/$name"
rm -f "$tmp/$name"/hooks/*.test.ts "$tmp/$name"/hooks/*.test.tsx
cp "$here/$name.bench.test.tsx" "$tmp/$name/hooks/"
claude plugin test "$tmp/$name" 2>&1 | grep -E "BENCH|pass|fail|error" || true
