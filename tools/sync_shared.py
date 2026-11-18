"""Chép mã dùng chung shared/*.ts vào plugins/<mod>/hooks/lib/ của từng mod.

Engine không cho mod import tệp nằm ngoài thư mục của nó, nên mỗi mod giữ một bản chép.
    py -3.12 tools/sync_shared.py          # chép
    py -3.12 tools/sync_shared.py --check  # chỉ kiểm; mã thoát 1 nếu có bản lệch
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODS = ["session-band", "agents-panel"]
HEADER = "// TỆP CHÉP TỰ ĐỘNG từ shared/{name}: sửa ở shared/ rồi chạy tools/sync_shared.py.\n"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    check = "--check" in sys.argv[1:]
    sources = sorted((ROOT / "shared").glob("*.ts"))
    if not sources:
        print("error: shared/ không có tệp .ts nào", file=sys.stderr)
        return 2
    names = {s.name for s in sources}
    stale = []
    for mod in MODS:
        lib = ROOT / "plugins" / mod / "hooks" / "lib"
        for src in sources:
            want = HEADER.format(name=src.name) + src.read_text(encoding="utf-8")
            dst = lib / src.name
            if dst.exists() and dst.read_text(encoding="utf-8") == want:
                continue
            stale.append(f"{mod}/hooks/lib/{src.name}")
            if not check:
                lib.mkdir(parents=True, exist_ok=True)
                dst.write_text(want, encoding="utf-8", newline="\n")
        # Tệp trong lib/ không còn bản gốc: chỉ báo, không xoá (xoá bằng tay).
        if lib.exists():
            for extra in sorted(p.name for p in lib.glob("*.ts") if p.name not in names):
                stale.append(f"{mod}/hooks/lib/{extra} (không còn trong shared/, xoá bằng tay)")
    print(f"sync_shared: {len(sources)} tệp × {len(MODS)} mod, {len(stale)} {'lệch' if check else 'đã chép'}")
    for s in stale:
        print(f"  {s}")
    if check and stale:
        print("help: chạy `py -3.12 tools/sync_shared.py` để chép lại")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
