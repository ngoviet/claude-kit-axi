# savvy-progress-axi

Nghiên cứu và bản tối ưu của hai mod Claude Code trong
[johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) (MIT):

- **session-band**: thanh phía trên ô nhập — lượt, tok/s, chi phí lượt | phiên, đếm ngược cache
  prompt, mức đầy context; báo trước khi cache hết hạn.
- **savvy-progress**: thanh tiến độ cho `/savvy-flow` và bảng Agents (`/agents-info`).

| Thư mục | Nội dung |
| --- | --- |
| `upstream/` | bản gốc nguyên trạng (commit `c871c153`) + LICENSE gốc |
| `plugins/` | bản axi (đã sửa lỗi, tối ưu) |
| `docs/nghien-cuu.md` | báo cáo nghiên cứu: kiến trúc, cách tính, quyền, rủi ro, điểm yếu, số đo |
| `docs/thay-doi.md` | danh sách thay đổi so với bản gốc + bảng đo trước/sau |
| `tools/bench/` | bài đo chạy được trên cả bản gốc và bản axi |
| `tools/cache_split.py` | đo tỉ lệ ghi cache 5 phút/1 giờ trong transcript (luồng chính / subagent) |

## Dùng thử (chưa cài lên PC1 — chờ chủ đồng ý)

Cần Claude Code ≥ 2.1.287 (PC1: 2.1.311). **Không** nạp cùng lúc với bản gốc (trùng tên plugin).

Một phiên:

```bash
claude --plugin-dir D:/code/savvy-progress-axi/plugins/session-band
```

Mọi phiên (kể cả desktop app): thêm vào `env` trong `~/.claude/settings.json`, nhiều thư mục cách
nhau bằng dấu phân cách danh sách đường dẫn của hệ: `;` trên Windows, `:` trên macOS/Linux (README
gốc chỉ ghi `:`), nối thêm nếu biến đã có. PC1 đã cài session-band theo cách này ngày 17/11/2026:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "D:/code/savvy-progress-axi/plugins/session-band" } }
```

Tuỳ chọn (trong `/config`, hoặc `pluginConfigs` của settings):

```json
{ "pluginConfigs": {
    "session-band": { "options": { "language": "vi", "cacheTtl": "1h", "countdown": "minutes" } },
    "savvy-progress": { "options": { "language": "vi", "subagentCacheTtl": "5m" } }
} }
```

## Kiểm

```bash
claude plugin validate plugins/session-band
```

```bash
claude plugin test plugins/savvy-progress
```

```bash
bash tools/bench/run.sh upstream/session-band
```

## Giấy phép

MIT. Mã gốc © 2026 johnnyvizz; phần sửa đổi © 2026 Ngô Đức Việt. Xem `LICENSE`.
