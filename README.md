# claude-kit-axi

Nghiên cứu và bản tối ưu của hai mod Claude Code trong
[johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) (MIT):

- **session-band**: thanh phía trên ô nhập — lượt, tok/s, chi phí lượt | phiên, đếm ngược cache
  prompt, mức đầy context; báo trước khi cache hết hạn.
- **agents-panel** (bản gốc tên savvy-progress): bảng Agents (`/agents-info`) và dòng chi phí dưới mỗi lần gọi Agent (đã bỏ phần savvy-flow).

Tính năng thêm của bản axi (17/11/2026): hạn mức gói 5h/7d và dự báo chạm trần, cảnh báo theo
ngưỡng, thông báo cache trên Windows, `/token` đo một tác vụ, `/spend` lịch sử chi phí, chi phí dưới
mỗi hàng Agent — chi tiết ở `docs/thay-doi.md`.

| Thư mục | Nội dung |
| --- | --- |
| `upstream/` | bản gốc nguyên trạng (commit `c871c153`) + LICENSE gốc |
| `plugins/` | bản axi (đã sửa lỗi, tối ưu); mỗi mod chia thành các module nhỏ trong `hooks/`, `register.tsx` chỉ nối hook |
| `shared/` | mã dùng chung hai mod (định dạng số/tiền/thời gian, chọn ngôn ngữ); `tools/sync_shared.py` chép vào `hooks/lib/` của từng mod |
| `docs/nghien-cuu.md` | báo cáo nghiên cứu: kiến trúc, cách tính, quyền, rủi ro, điểm yếu, số đo |
| `docs/thay-doi.md` | danh sách thay đổi so với bản gốc + bảng đo trước/sau |
| `tools/check.sh` | kiểm cả repo: mã chung đồng bộ, rồi validate + test + tsc từng mod |
| `tools/bench/` | bài đo chạy được trên cả bản gốc và bản axi |
| `tools/cache_split.py` | đo tỉ lệ ghi cache 5 phút/1 giờ trong transcript (luồng chính / subagent) |

## Cài

Cần Claude Code ≥ 2.1.287 (PC1: 2.1.311). **Không** nạp cùng lúc với bản gốc (trùng tên plugin).

Một phiên:

```bash
claude --plugin-dir D:/code/claude-kit-axi/plugins/session-band
```

Mọi phiên (kể cả desktop app): thêm vào `env` trong `~/.claude/settings.json`, nhiều thư mục cách
nhau bằng dấu phân cách danh sách đường dẫn của hệ: `;` trên Windows, `:` trên macOS/Linux (README
gốc chỉ ghi `:`), nối thêm nếu biến đã có. PC1 đã cài cả hai mod theo cách này (session-band 17/11,
agents-panel 18/11/2026):

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "D:/code/claude-kit-axi/plugins/session-band;D:/code/claude-kit-axi/plugins/agents-panel" } }
```

Tuỳ chọn (trong `/config`, hoặc `pluginConfigs` của settings):

```json
{ "pluginConfigs": {
    "session-band": { "options": { "language": "vi", "cacheTtl": "1h", "countdown": "minutes",
                      "limits": "on", "alerts": "on", "budgetUsd": "", "utcOffset": "auto" } },
    "agents-panel": { "options": { "language": "vi", "autoOpen": "any", "subagentCacheTtl": "5m", "rowCost": "on" } }
} }
```

`language` của cả hai mod nhận `auto` (mặc định: theo cài đặt ngôn ngữ của Claude Code, rồi locale).

## Kiểm

Sửa mã chung thì sửa ở `shared/` rồi chạy `py -3.12 tools/sync_shared.py`. Trước khi commit:

```bash
bash tools/check.sh
```

Đo hiệu năng trước/sau:

```bash
bash tools/bench/run.sh upstream/session-band
```

## Giấy phép

MIT. Mã gốc © 2026 johnnyvizz; phần sửa đổi © 2026 Ngô Đức Việt. Xem `LICENSE`.
