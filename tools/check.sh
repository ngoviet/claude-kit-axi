#!/bin/bash
# Kiểm cả repo trước khi commit: mã chung đã đồng bộ, rồi với từng mod chạy validate, test
# và tsc. Mã thoát 0 khi mọi bước qua, 1 khi có bước hỏng.
#   bash tools/check.sh
set -uo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"
fail=0
step() { printf '\n== %s\n' "$1"; }

step "mã chung (shared/ → hooks/lib/)"
py -3.12 tools/sync_shared.py --check || fail=1

# tsc cần tệp kiểu của engine. Engine chỉ đặt .claude-plugin/types/ khi nạp mod, nên lấy tệp
# của skill plugin-authoring bản mới nhất trong thư mục tạm của Claude.
tmp_root="${TEMP:-${TMPDIR:-/tmp}}/claude/bundled-skills"
types="$(ls -d "$tmp_root"/*/*/plugin-authoring/types 2>/dev/null | sort -V | tail -1)"
win() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

for mod in session-band agents-panel; do
  step "$mod: validate"
  claude plugin validate "plugins/$mod" 2>&1 | grep -E "✔|✘|Error" || fail=1
  claude plugin validate "plugins/$mod" >/dev/null 2>&1 || fail=1

  step "$mod: test"
  out="$(claude plugin test "plugins/$mod" 2>&1)"
  printf '%s\n' "$out" | grep -E "^ *[0-9]+ (pass|fail)|^\(fail\)"
  printf '%s\n' "$out" | grep -qE "^ *0 fail" || fail=1

  step "$mod: tsc"
  if [ -z "$types" ]; then
    echo "bỏ qua: chưa có tệp kiểu (nạp skill plugin-authoring một lần để engine ghi ra)"
    continue
  fi
  cfg="$(mktemp -d)/tsconfig.json"
  cat >"$cfg" <<JSON
{ "compilerOptions": { "target": "es2023", "lib": ["es2023"], "types": [], "module": "esnext", "moduleResolution": "bundler", "strict": true, "noUncheckedIndexedAccess": true, "noEmit": true, "skipLibCheck": true, "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment" },
  "include": ["$(win "$types")/*.d.ts", "$(win "$repo/plugins/$mod/hooks")", "$(win "$repo/plugins/$mod/types")"] }
JSON
  if npx -y -p typescript@6.0.3 tsc -p "$(win "$cfg")"; then echo "sạch"; else fail=1; fi
done

printf '\n== kết quả: %s\n' "$([ $fail -eq 0 ] && echo 'mọi bước qua' || echo 'có bước hỏng')"
exit $fail
