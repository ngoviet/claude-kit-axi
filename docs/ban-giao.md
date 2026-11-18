# Bàn giao: trạng thái 18/11/2026 (commit b965df8)

Đọc tệp này đầu tiên khi mở phiên mới ở dự án. Chi tiết nghiên cứu ở [nghien-cuu.md](nghien-cuu.md); bảng thay đổi và số đo ở [thay-doi.md](thay-doi.md).

## Bắt đầu nhanh

1. `git status`: cây làm việc phải sạch, `main` ở `b965df8` hoặc mới hơn. Chưa có remote.
2. `bash tools/check.sh`: phải in "mọi bước qua" (session-band 16/16, agents-panel 22/22, tsc sạch).
3. Đọc mục "Quy ước khi sửa mã" bên dưới trước khi đụng vào `plugins/`.
4. Việc kế tiếp nên làm: thử hai mod trong một phiên thật (mục "Việc còn mở").

## Đang có gì

| Thư mục | Nội dung |
| --- | --- |
| `plugins/session-band` 0.3.1-axi.1 | Thanh trên ô nhập: lượt, tok/s, chi phí lượt và phiên, đếm ngược cache, hạn mức 5h/7d, context. |
| `plugins/agents-panel` 2.0.0-axi.1 | Khung Agents (con cua) và dòng chi phí dưới mỗi hàng gọi Agent. Trước 18/11 tên là `savvy-progress`. |
| `shared/` | Mã dùng chung: `format.ts` (số, tiền, token, thời gian), `lang.ts` (`detectLang`). |
| `upstream/` | Mã gốc nguyên văn của `johnnyvizz/claude-kit` (commit `c871c153`, MIT). Không sửa. Dùng để diff và đo đối chứng; chủ chốt giữ lại (18/11). |
| `tools/check.sh` | Một lệnh kiểm cả repo. |
| `tools/sync_shared.py` | Chép `shared/*.ts` vào `plugins/<mod>/hooks/lib/`; `--check` chỉ báo bản lệch. |
| `tools/bench/` | `run.sh` đo trước/sau bằng `claude plugin test`. `upstream/savvy-progress` và `plugins/agents-panel` dùng chung `agents-panel.bench.test.tsx`; `run.sh` tự thay tên plugin và mã khung. |
| `tools/cache_split.py` | Đếm tỉ lệ ghi cache 5m/1h trong transcript. |
| `.folio/`, `.design-kit/` | Thư mục tạm, đã gitignore. `.folio/de-xuat-tinh-nang.html` là trang đề xuất ý tưởng A–G. |

### session-band

- Tuỳ chọn:
  - `language` (auto|en|vi, mặc định auto).
  - `cacheTtl` (1h|5m), `countdown` (minutes|seconds).
  - `limits` (on|off), `alerts` (on|off).
  - `budgetUsd` (số USD; để trống là không đặt).
  - `utcOffset` (`auto` hoặc số giờ).
- Lệnh:
  - `/session_data`: ẩn/hiện thanh; `demo <phút>` giả hạn cache; `width` in số cột và mức thanh.
  - `/token start [nhãn]`, `/token`, `/token stop`: đo một tác vụ.
  - `/spend [số ngày]`: chi phí theo ngày và dự án.
- Module trong `hooks/`:

| Tệp | Việc |
| --- | --- |
| `register.tsx` | Chỉ nối hook (~160 dòng). |
| `config.ts` | `CFG`, `applyOptions` và các ngưỡng. |
| `state.ts` | Giá trị đầu của `$.state`. |
| `strings.ts` | Chữ hiển thị (en, vi), `tr()`. |
| `icons.ts` | Màu và SVG. |
| `cache.ts` | Đếm ngược và báo cache sắp hết. |
| `limits.ts` | A: hạn mức và dự báo đầy. |
| `measure.ts` | B: `/token`. |
| `history.ts` | C: `/spend`. |
| `usage.ts` | Đọc số liệu phiên, D: ngưỡng cảnh báo. |
| `notify.ts` | E: thông báo hệ thống. |
| `band.tsx` | Vẽ thanh. |

- Test: `band.test.tsx` có 5, `features.test.tsx` có 11.

### agents-panel

- Tuỳ chọn:
  - `language` (auto|en|ru|he|vi).
  - `autoOpen` (any|off, mặc định any; giá trị `savvy` cũ được coi như any).
  - `subagentCacheTtl` (5m|1h).
  - `rowCost` (on|off).
- Lệnh: `/agents-info` (bật/tắt khung), `/agents-info open` (mở hoặc đưa khung lên trước). Mã khung là `agents-panel`.
- Module trong `hooks/`:

| Tệp | Việc |
| --- | --- |
| `register.tsx` | Chỉ nối hook (~80 dòng). |
| `config.ts` | `CFG`, `applyOptions`, `PANE`. |
| `state.ts` | Giá trị đầu của `$.state`. |
| `strings.ts` | Chữ hiển thị (en, ru, he, vi), `tr()`, `isRtl()`. |
| `pricing.ts` | Bảng giá, `costOf`, `windowOf`, `modelName`. |
| `runs.ts` | Sổ subagent (`recordSpawn`, `recordRequest`, `recordEnd`) và số liệu suy ra. |
| `crab.ts` | Con cua pixel. |
| `svg.ts` | Hình vẽ khung trên desktop. |
| `pane.tsx` | Mở/đóng và vẽ khung (desktop và terminal). |
| `row.tsx` | F: dòng chi phí dưới hàng Agent. |

- Đã gỡ phần savvy-flow (18/11) vì skill savvy-flow không có trên máy: thanh tiến độ, công cụ `progress`/`step`, việc theo kế hoạch, trang phục theo hạng `savvy-*`.
- Test: `cost.test.ts` và `row.test.tsx`, tổng 22.

## Quy ước khi sửa mã

- **Mã dùng chung** chỉ sửa ở `shared/`, rồi chạy `py -3.12 tools/sync_shared.py`. Đừng sửa `hooks/lib/`: đầu mỗi tệp ở đó ghi "TỆP CHÉP TỰ ĐỘNG".
- **Tuỳ chọn** đọc một lần vào `CFG` trong `applyOptions` (`config.ts`). Tuỳ chọn tính được mà không cần `$` thì áp ngay ở đó. Chỉ việc cần `$` (như `language: auto`) mới để tới `session.start`. Reviewer tìm ra lỗi ở đúng chỗ này, test `a fixed language applies before session.start` giữ lại ca đó.
- **Chữ hiển thị** lấy qua `tr()`, thêm vào mọi ngôn ngữ trong `strings.ts`.
- **State:** giá trị đầu đặt ở `state.ts`; mỗi tệp gọi `read`/`update` tự khai `atom({ plugin, key }, …)` của nó (luật engine, xem dưới).
- **Hàm nhận `$`** viết dạng `export async function f($: EngineInterface, …)`. Hook nằm ở tệp khác thì bọc lại trong `register.tsx`: `on('ui.render', {...}, ($, e, next) => drawBand($, e, next))`.
- **Chú thích** viết bằng tiếng Việt; tên hàm và biến giữ tiếng Anh (chủ chốt 18/11).
- **Trước khi commit:** `bash tools/check.sh`, cập nhật `docs/thay-doi.md` (và tệp này nếu trạng thái đổi). Không thêm dòng ghi công Claude vào commit.

## Đã cài trên PC1

- Cả hai mod nạp qua `env.CLAUDE_CODE_PLUGIN_DIRS = "D:/code/claude-kit-axi/plugins/session-band;D:/code/claude-kit-axi/plugins/agents-panel"` trong `~/.claude/settings.json`. Windows phân cách bằng `;`.
  - Mod nạp thẳng từ thư mục này: **mọi phiên mở mới chạy ngay bản trong cây làm việc**, kể cả mã chưa commit.
- `pluginConfigs`: `session-band` đặt `language: "vi"`, `cacheTtl: "1h"`, `countdown: "minutes"`; `agents-panel` đặt `language: "vi"`. Các tuỳ chọn còn lại chạy theo mặc định.
- Kiểm mod đã nạp: `claude plugin list` (cả hai phải `✔ loaded`, kiểm 18/11).
- Gỡ: xoá đường dẫn khỏi biến và khoá trong `pluginConfigs`. Các bản sao lưu: `~/.claude/settings.json.bak-session-band-*`, `.bak-savvy-progress-*`, `.bak-agents-panel-*`.

## Kiểm trước khi commit

```bash
bash tools/check.sh
```

Lệnh này lần lượt chạy:
1. `sync_shared.py --check`.
2. validate, test và tsc cho từng mod.

tsc dùng một tsconfig tạm, trỏ tới tệp kiểu của skill `plugin-authoring` bản mới nhất trong `%TEMP%/claude/bundled-skills/` (engine chỉ đặt `.claude-plugin/types/` khi nạp mod). Nếu chưa có tệp đó thì nạp skill `plugin-authoring` một lần.

## Chủ đã chốt (đừng hỏi lại)

- 17/11: chọn tính năng A–F, bỏ G.
- 18/11:
  - Bỏ savvy-flow, đổi tên mod thành `agents-panel`.
  - Tái cấu trúc thành module; mã chung để ở `shared/` và chép sang từng mod bằng script.
  - Chú thích bằng tiếng Việt.
  - Giữ `upstream/`.
  - **Không** thêm nút git (Commit, Tạo PR) vào thanh, vì desktop app đã có sẵn.

## Sự thật đã kiểm, đừng tìm lại

### Engine và API

- `ModelUsage` của engine chỉ có 4 số token: không tách ghi cache 5m/1h, không có cờ fast mode. Vì vậy loại TTL phải là tuỳ chọn, và USD của `/token` lấy từ sổ chi phí của phiên thay vì tự nhân giá.
- Đo transcript PC1 trong 7 ngày: luồng chính ghi khoảng 99% cache loại 1h; subagent ghi 100% loại 5m.
- Tuổi cache tính từ lúc **bắt đầu** request ghi/đọc nó, không phải lúc trả lời xong.
- `turn.start`, `turn.step` và `turn.complete` có `agentId` khi là lượt của subagent.
- `usage` của một request nằm ở **giá trị trả về** của generator `turn.step` (`TurnStepResult.usage`, có `model`).
  - `for await` làm mất giá trị trả về này.
  - Muốn vừa xem từng chunk vừa lấy `usage` thì phải gọi `it.next()` bằng tay.
- `$.ui.notify` trả `isSent: true` cả khi kênh chỉ là `terminal_bell` (chỉ kêu chuông, không hiện chữ). Mod coi trường hợp đó là chưa báo.
- `$.store` là một tệp JSON riêng của mỗi plugin, giới hạn 4 MiB, còn nguyên qua các phiên. agents-panel không dùng `$.store`.
- Mod có thể gửi prompt bằng `$.prompt.submit({ text })` và chạy tiến trình bằng `$.process.run(argv)`. Đây là cách làm nút gọi Claude, nếu sau này cần.
- API 2.1.325 thêm trường bắt buộc `isCollapsed` vào props của `AbovePrompt`.

### Luật engine khi viết mod

`claude plugin validate` quét mã tĩnh và bắt các luật sau (kiểm 18/11):
- Mọi hàm nhận `$` phải khai báo ở cấp đầu tệp; hàm đặt bên trong `register` bị từ chối.
- Mod **không import được tệp nằm ngoài thư mục của nó** (lỗi "outside the plugin's folder"). Import trong thư mục, kể cả thư mục con `lib/`, thì được.
- Hàm nhận `$` mà import từ tệp khác phải là **`function` khai báo**; arrow gán vào `const` bị từ chối.
- `read`/`update` chỉ nhận atom tạo bằng `atom({ plugin, key }, …)` **ngay trong tệp đó**; atom import từ tệp khác bị từ chối. Cùng plugin + key thì là cùng một giá trị, dù khai ở tệp nào.

### Bộ test (`claude-code/testing`)

- Hook mock phải đăng ký trước lần gọi `$` đầu tiên.
- Mock `turn.step` phải trả lại đúng `turnId`/`index`.
- `turn.complete` của lượt bị huỷ cần `answer: ''`.
- Pane đã mount không vẽ lại khi tua `mock.clock`, nên phải mount lại.
- Mock `ui.toast` và `ui.notify` bằng `on(...)` để đếm số lần báo. `mock.store(on, {...})` cho dữ liệu store ban đầu.
- Lệnh chạy bằng `$.command.run({ command, args })`.
- `$.env.get` không mock thì ném lỗi. Vì vậy `detectLang` bắt lỗi và trả về tiếng Anh.

### Giá

Lấy từ skill `claude-api`, không đoán:
- Fable/Mythos 5.2: $8/$40, đọc cache $0,20.
- Opus 5.5: $4/$20, đọc cache $0,20.
- Sonnet 5.5: $2/$10, đọc cache $0,10.
- Haiku 5.5: $0,10/$0,50, đọc cache $0,01. Prompt trên 100K token thì $0,50/$2,50, đọc cache $0,05.
- Ghi cache = 1,25× giá input (loại 5m) hoặc 2× (loại 1h).

### Số đo

- Khung 20 agent trên desktop: bản gốc 116.874 ký tự SVG mỗi lần vẽ, agents-panel 55.383 (−53%).
- Thanh session-band: 3600 → 650 lần vẽ lại mỗi giờ cache.
- Thời gian JS mỗi lần vẽ chìm trong nhiễu của harness, chưa tách ra đo được.

## Việc còn mở

- **Chưa thử trong phiên thật.** Mở một phiên mới trên PC1 (hai mod tự nạp) và xem:
  - Thanh có hiện `5h …%` / `7d …%` với số thật của gói Max không. Nếu engine không trả `resetsAt` thì dự báo cửa sổ 7d quay về tốc độ ngắn hạn.
  - `/session_data demo 10` có bật thông báo Windows trong desktop app không.
  - Ngày trong `/spend` có đúng giờ Việt Nam không. Nếu môi trường của mod chạy UTC thì đặt `utcOffset: "7"`.
  - Khung Agents có tự mở khi subagent đầu tiên chạy không, và dòng chi phí F có hiện dưới hàng gọi Agent không.
- Ý tưởng G (tỉ lệ chi phí subagent / luồng chính trên thanh): chủ chưa chọn, còn trong trang đề xuất.
- Chưa push, chưa có remote. Muốn chia sẻ thì theo mục "Sharing a mod" của skill `plugin-authoring`, nhưng phải hỏi chủ trước: repo public hay private.
- Giá fast mode của Fable 5.2 chưa có trong bản skill đang có trên máy.
