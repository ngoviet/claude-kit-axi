# Bàn giao — trạng thái 17/11/2026 (cập nhật sau khi thêm tính năng A–F)

Đọc tệp này đầu tiên khi mở phiên mới ở dự án. Chi tiết nghiên cứu: [nghien-cuu.md](nghien-cuu.md); bảng thay đổi và số đo: [thay-doi.md](thay-doi.md).

## Đang có gì

- `upstream/`: mã gốc nguyên văn của `JohnnyVizz/claude-kit` (commit c871c153, MIT), kèm `SOURCE.txt`. Không sửa; dùng để so sánh và chạy test đối chứng.
- `plugins/session-band` 0.3.0-axi.1: thanh nằm trên ô nhập, hiện lượt, tok/s, chi phí, đếm ngược cache, hạn mức gói và context.
  - Tuỳ chọn: `language` (en|vi), `cacheTtl` (1h|5m), `countdown` (minutes|seconds), `limits` (on|off), `alerts` (on|off), `budgetUsd` (số USD, rỗng là không đặt), `utcOffset` (`auto` hoặc số giờ).
  - Lệnh: `/session_data` (ẩn/hiện, `demo <phút>`, `width`), `/token start [nhãn]` · `/token` · `/token stop`, `/spend [số ngày]`.
  - Test: 5 test trong `hooks/band.test.tsx` và 10 test trong `hooks/features.test.tsx`.
- `plugins/savvy-progress` 1.3.0-axi.1: khung Agents (hình cua), tính chi phí subagent, thêm một dòng chi phí dưới mỗi hàng gọi Agent.
  - Tuỳ chọn: `language`, `autoOpen`, `subagentCacheTtl` (5m|1h), `rowCost` (on|off).
  - Test: 30 test trong 5 tệp `hooks/*.test.ts(x)`; tính năng F nằm ở `row.test.tsx`.
- `tools/bench/`: `run.sh` đo trước/sau bằng `claude plugin test`. `tools/cache_split.py` đếm tỉ lệ ghi cache 5m/1h trong transcript.
- `.folio/` và `.design-kit/` nằm trong `.gitignore`. `.folio/de-xuat-tinh-nang.html` là trang đề xuất 7 ý tưởng A–G mà chủ đã dùng để chọn tính năng.

## Tính năng thêm ngày 17/11 (commit c5f0a25)

Chủ chọn A–F trên trang đề xuất, bỏ G. Bảng chi tiết nằm ở đầu [thay-doi.md](thay-doi.md).

| ID | Ở đâu | Tóm tắt |
| --- | --- | --- |
| A | session-band | Hạn mức 5h/7d lấy từ `$.session.usage().rateLimits`. Có "⚠2h20" khi tốc độ đốt sẽ làm đầy cửa sổ trước giờ reset; cửa sổ 7d tính theo tốc độ trung bình từ lúc cửa sổ mở, thời gian dài viết "1d9h". |
| B | session-band | `/token` cộng `usage` của mọi `turn.step`, kể cả subagent. USD là chênh lệch `cost.usd` của phiên. |
| C | session-band | `/spend` đọc `$.store`, khoá `day:YYYY-MM-DD`. Ghi khi lượt chính xong và khi `session.end`; giữ 120 ngày. |
| D | session-band | Toast một lần mỗi ngưỡng (danh sách đã báo ở atom `fired`). Ngưỡng cao gửi thêm thông báo hệ thống. |
| E | session-band | Thông báo cache: notifier macOS → `$.ui.notify` → PushNotification → toast. |
| F | savvy-progress | `ui.render` trên `ToolUse`, nối bằng `AgentRun.toolUseId`. |

## Đã cài trên PC1

- Chỉ session-band. Nạp qua `env.CLAUDE_CODE_PLUGIN_DIRS = "D:/code/claude-kit-axi/plugins/session-band"` trong `~/.claude/settings.json`.
  - Mod nạp thẳng từ thư mục này: **mọi phiên mở mới chạy ngay bản trong cây làm việc**, kể cả mã chưa commit.
- Tuỳ chọn ở `pluginConfigs.session-band.options`. Các tuỳ chọn mới (`limits`, `alerts`, `budgetUsd`, `utcOffset`) chưa ghi vào settings, nên đang chạy theo mặc định.
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

Kiểm kiểu bằng tsc: engine chỉ đặt `.claude-plugin/types/` khi nạp mod (thư mục này bị gitignore), nên phải dựng tsconfig bên ngoài mod.
- Lấy mẫu tsconfig ở đầu tệp `types/claude-code.d.ts` của skill `plugin-authoring`.
- `include` gồm tệp `.d.ts` đó, cùng `hooks/` và `types/` của mod.
- Chạy `npx -p typescript@6.0.3 tsc -p <tsconfig>`. Kết quả 17/11: sạch cả hai mod.

## Sự thật đã kiểm, đừng tìm lại

- `ModelUsage` của engine chỉ có 4 số token: không tách ghi cache 5m/1h, không có cờ fast mode. Vì vậy loại TTL phải là tuỳ chọn, và USD của `/token` lấy từ sổ chi phí thay vì tự nhân giá.
- Đo transcript PC1 trong 7 ngày: luồng chính ghi khoảng 99% cache loại 1h; subagent 100% loại 5m.
- Tuổi cache tính từ lúc **bắt đầu** request ghi/đọc nó, không phải lúc trả lời xong.
- `turn.start`, `turn.step` và `turn.complete` có `agentId` khi là lượt subagent.
- `usage` của một request nằm ở **giá trị trả về** của generator `turn.step` (`TurnStepResult.usage`, có `model`).
  - `for await` làm mất giá trị trả về này.
  - Muốn vừa xem từng chunk vừa lấy `usage` thì phải gọi `it.next()` thủ công.
- `claude plugin validate` đòi mọi hàm nhận `$` khai báo ở cấp đầu tệp. Hàm đặt trong `register` bị từ chối, nên tuỳ chọn được đưa vào object `CFG` ở cấp module.
- `$.ui.notify` trả `isSent: true` cả khi kênh chỉ là `terminal_bell` (chỉ kêu chuông, không hiện chữ). Mod coi trường hợp đó là chưa báo.
- `$.store` là một tệp JSON riêng của mỗi plugin, giới hạn 4 MiB, còn nguyên qua các phiên.
- API 2.1.325 thêm trường bắt buộc `isCollapsed` vào props của `AbovePrompt`; các test đã được bổ sung.
- Bộ test (`claude-code/testing`):
  - Hook mock phải đăng ký trước lần gọi `$` đầu tiên.
  - Mock `turn.step` phải trả lại đúng `turnId`/`index`.
  - `turn.complete` bị huỷ cần `answer: ''`.
  - Pane đã mount không vẽ lại khi tua `mock.clock`, nên phải mount lại.
  - Mock `ui.toast` và `ui.notify` bằng `on(...)` để đếm số lần báo; `mock.store(on, {...})` cho dữ liệu store ban đầu.
  - Lệnh chạy bằng `$.command.run({ command, args })`.
- Giá lấy từ skill `claude-api`, không đoán:
  - Fable/Mythos 5.2: $8/$40, đọc cache $0,20.
  - Opus 5.5: $4/$20, đọc cache $0,20.
  - Sonnet 5.5: $2/$10, đọc cache $0,10.
  - Haiku 5.5: $0,10/$0,50, đọc cache $0,01; prompt trên 100K token thì $0,50/$2,50, đọc cache $0,05.
  - Ghi cache = 1,25× giá input (loại 5m) hoặc 2× (loại 1h).

## Việc còn mở

- **Chưa thử A–F trong phiên thật.** Mở một phiên mới trên PC1 (session-band tự nạp) và xem ba điểm:
  - `rateLimits` có số thật trên gói Max không (thanh hiện "5h …%").
  - `$.ui.notify` có bật thông báo Windows trong desktop app không. Thử bằng `/session_data demo 10`.
  - Ngày trong `/spend` có đúng giờ Việt Nam không. Nếu môi trường mod chạy UTC thì đặt `utcOffset: "7"`.
- F chỉ chạy khi savvy-progress được cài, mà mod này chưa cài lên máy (cần chủ đồng ý).
- Ý tưởng G (tỉ lệ chi phí subagent / luồng chính trên thanh) chủ chưa chọn; còn trong trang đề xuất.
- Chưa push và chưa có remote. Muốn chia sẻ thì làm theo mục "Sharing a mod" của skill `plugin-authoring`, nhưng phải hỏi chủ public hay private trước.
- Thời gian JS mỗi lần vẽ chìm trong nhiễu của harness, chưa tách ra đo được. Mới đo được số ký tự SVG (−58%) và số lần vẽ lại (thanh: 3600 → 650 lần mỗi giờ cache).
- Giá fast mode của Fable 5.2 chưa có trong skill bản đang có trên máy.
