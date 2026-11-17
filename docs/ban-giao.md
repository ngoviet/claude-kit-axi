# Bàn giao — trạng thái 17/11/2026

Đọc tệp này đầu tiên khi mở phiên mới ở dự án. Chi tiết nghiên cứu: [nghien-cuu.md](nghien-cuu.md); bảng thay đổi và số đo: [thay-doi.md](thay-doi.md).

## Đang có gì

- `upstream/`: mã gốc nguyên văn của `JohnnyVizz/claude-kit` (commit c871c153, MIT), kèm `SOURCE.txt`. Không sửa; dùng để so sánh và chạy test đối chứng.
- `plugins/session-band` 0.2.0-axi.1: thanh nằm trên ô nhập, hiện lượt, tok/s, chi phí, đếm ngược cache và context.
  - Tuỳ chọn: `language` (en|vi), `cacheTtl` (1h|5m), `countdown` (minutes|seconds).
  - Có 5 test trong `hooks/band.test.tsx`.
- `plugins/savvy-progress` 1.2.1-axi.1: khung Agents (hình cua), tính chi phí subagent.
  - Có tuỳ chọn `subagentCacheTtl` (5m|1h) và thêm tiếng Việt.
  - Test ở `hooks/cost.test.ts`.
- `tools/bench/`: `run.sh` đo trước/sau bằng `claude plugin test`. `tools/cache_split.py` đếm tỉ lệ ghi cache 5m/1h trong transcript.

## Đã cài trên PC1

- Chỉ session-band. Nạp qua `env.CLAUDE_CODE_PLUGIN_DIRS = "D:/code/claude-kit-axi/plugins/session-band"` trong `~/.claude/settings.json`.
- Tuỳ chọn ở `pluginConfigs.session-band.options`.
- Sửa mã thì mod tự nạp lại ở phiên mới; kiểm bằng `claude plugin list`.
- Nạp thêm savvy-progress: nối thêm đường dẫn vào cùng biến, Windows phân cách bằng `;`. Cần chủ đồng ý trước.
- Gỡ: xoá hai khoá trên (bản sao lưu ở `~/.claude/settings.json.bak-session-band-*`).

## Kiểm trước khi commit

```bash
claude plugin validate plugins/session-band
claude plugin test plugins/session-band
claude plugin validate plugins/savvy-progress
claude plugin test plugins/savvy-progress
```

## Sự thật đã kiểm, đừng tìm lại

- `ModelUsage` của engine chỉ có 4 số token: không tách ghi cache 5m/1h, không có cờ fast mode. Vì vậy loại TTL phải là tuỳ chọn.
- Đo transcript PC1 trong 7 ngày: luồng chính ghi khoảng 99% cache loại 1h; subagent 100% loại 5m.
- Tuổi cache tính từ lúc **bắt đầu** request ghi/đọc nó, không phải lúc trả lời xong.
- `turn.start`, `turn.step` và `turn.complete` có `agentId` khi là lượt subagent.
- Bộ test (`claude-code/testing`):
  - Hook mock phải đăng ký trước lần gọi `$` đầu tiên.
  - Mock `turn.step` phải trả lại đúng `turnId`/`index`.
  - `turn.complete` bị huỷ cần `answer: ''`.
  - Pane đã mount không vẽ lại khi tua `mock.clock`, nên phải mount lại.
- Giá lấy từ skill `claude-api`, không đoán:
  - Fable/Mythos 5.2: $8/$40, đọc cache $0,20.
  - Opus 5.5: $4/$20, đọc cache $0,20.
  - Sonnet 5.5: $2/$10, đọc cache $0,10.
  - Haiku 5.5: $0,10/$0,50, đọc cache $0,01; prompt trên 100K token thì $0,50/$2,50, đọc cache $0,05.
  - Ghi cache = 1,25× giá input (loại 5m) hoặc 2× (loại 1h).

## Việc còn mở

- Chưa push và chưa có remote. Muốn chia sẻ thì làm theo mục "Sharing a mod" của skill `plugin-authoring`, nhưng phải hỏi chủ public hay private trước.
- savvy-progress chưa cài lên máy.
- Thời gian JS mỗi lần vẽ chìm trong nhiễu của harness, chưa tách ra đo được. Mới đo được số ký tự SVG (−58%) và số lần vẽ lại (thanh: 3600 → 650 lần mỗi giờ cache).
- Giá fast mode của Fable 5.2 chưa có trong skill bản đang có trên máy.
