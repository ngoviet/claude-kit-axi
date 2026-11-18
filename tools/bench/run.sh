#!/bin/bash
# Chạy bài đo trên một bản plugin: chép plugin sang thư mục tạm, thêm tệp bench, chạy
# `claude plugin test`, in các dòng BENCH. Không cài gì lên máy.
#   tools/bench/run.sh upstream/session-band
#   tools/bench/run.sh plugins/session-band
#   tools/bench/run.sh upstream/savvy-progress   # bản gốc của agents-panel
#   tools/bench/run.sh plugins/agents-panel
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
src="$repo/$1"
name="$(basename "$src")"

# agents-panel là savvy-progress đổi tên: hai bản dùng chung một bài đo, chỉ khác tên plugin
# và mã khung Agents.
bench="$name"
pane=""
case "$name" in
  savvy-progress) bench="agents-panel"; pane="savvy-agents" ;;
  agents-panel) pane="agents-panel" ;;
esac

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp -R "$src" "$tmp/$name"
rm -f "$tmp/$name"/hooks/*.test.ts "$tmp/$name"/hooks/*.test.tsx
out="$tmp/$name/hooks/$bench.bench.test.tsx"
cp "$here/$bench.bench.test.tsx" "$out"
if [ -n "$pane" ]; then
  sed -i "s/^const PLUGIN = '.*'/const PLUGIN = '$name'/; s/^const PANE = '.*'/const PANE = '$pane'/" "$out"
fi
claude plugin test "$tmp/$name" 2>&1 | grep -E "BENCH|pass|fail|error" || true
