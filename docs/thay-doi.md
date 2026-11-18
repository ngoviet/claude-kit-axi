# Thay đổi so với bản gốc (claude-kit `c871c153`)

So sánh đầy đủ: `git diff --no-index upstream/session-band plugins/session-band` và `git diff --no-index upstream/savvy-progress plugins/agents-panel`.

## session-band `0.2.0` → `0.2.0-axi.1`

| # | Loại | Thay đổi | Kiểm |
| --- | --- | --- | --- |
| 1 | Sửa lỗi | `turn.start` của subagent (có `agentId`) không còn tăng "Lượt" và không đặt lại chi phí lượt | test `band.test.tsx` #1 (fail trên gốc) |
| 2 | Sửa lỗi | Hạn cache = **lúc bắt đầu request cuối của luồng chính** + TTL (gốc: lúc trả lời xong + TTL) | test #2 (gốc hiện 60m, đúng là 56m) |
| 3 | Hiệu năng | Tuỳ chọn `countdown`: mặc định `minutes` hiện "54m", chỉ đếm `mm:ss` trong 10 phút cuối; state chỉ ghi khi chữ hiển thị đổi → **3600 → 650** lần vẽ lại/giờ (−82%). `seconds` giữ kiểu gốc | test #3, bench |
| 4 | Hiệu năng | `refresh` và đo tok/s chỉ ghi `stats` khi số đổi → **32 → 2** lần ghi cho một lượt 30 request | bench |
| 5 | Hiệu năng | Biểu tượng SVG dựng sẵn (đồng hồ cát 3 màu) hoặc nhớ theo % nguyên (vòng context, thanh context) | — |
| 6 | Đơn giản hoá | Bỏ đọc state của mod `Cache` (không khai báo, làm `tsc` lỗi 4 chỗ); `$.state` của chính mod đã sống qua reload | `tsc` sạch |
| 7 | Tuỳ chọn | `cacheTtl`: `1h` (mặc định, đúng gói thuê bao; ngưỡng như gốc: vàng 20', đỏ 10', báo 10' và 5') / `5m` (phiên API key; vàng 2', đỏ 1', báo 1', luôn đếm `mm:ss`) | test #3 |
| 7b | Giữ hành vi | Lượt chính kết thúc mà chưa gửi request nào (huỷ sớm) giữ hạn cache cũ và không đặt lại cờ đã báo, nên không báo lặp (lỗi do reviewer tìm ra trong bản nháp axi, đã sửa) | test #4 |
| 8 | Windows | Tên dự án trong thông báo tách theo cả `\` và `/` | — |
| 9 | Ngôn ngữ | Tuỳ chọn `language`: `en` (gốc) / `vi` | — |
| 10 | Bỏ | Thư mục `notifier/*.app` (sản phẩm build) không đưa vào repo; mã Swift giữ nguyên | — |

## session-band `0.2.0-axi.1` → `0.3.0-axi.1` (tính năng mới, 17/11/2026)

| ID | Tính năng | Cách làm | Kiểm |
| --- | --- | --- | --- |
| A | Hạn mức gói 5h / 7d trên thanh, kèm "⚠1h20" khi tốc độ đốt hiện tại làm đầy cửa sổ trước giờ reset | `$.session.usage().rateLimits`; cửa sổ 5h: tốc độ = % tăng từ mốc đầu mod thấy (≥ 10 phút quan sát); cửa sổ 7d: tốc độ trung bình từ lúc cửa sổ mở (giờ reset − 7 ngày), để một đợt chạy dồn không bị nhân thành cả tuần (sửa 18/11); dự báo làm tròn 10 phút, từ 24 giờ trở lên viết dạng "1d9h"; chỉ ghi state khi chữ đổi; cần ≥ 76 cột, thiếu thì bỏ hạn mức trước. Tuỳ chọn `limits` | `features.test.tsx` A×5 |
| B | `/token start [nhãn]`, `/token`, `/token stop`: 5 số token (calls · input · cache_write · cache_read · output) + USD của một tác vụ | token cộng từ `usage` của mọi `turn.step` (kể cả subagent); USD = chênh lệch sổ chi phí của phiên (`/cost`), nên không phụ thuộc giả định TTL ghi cache | test B |
| C | `/spend [ngày]`: chi phí theo ngày và 5 dự án tốn nhất, qua nhiều phiên | `$.store` khoá `day:YYYY-MM-DD`, ghi khi lượt chính xong và khi phiên kết thúc, giữ 120 ngày. Tuỳ chọn `utcOffset` (mặc định `auto`) | test C |
| D | Cảnh báo theo ngưỡng, mỗi ngưỡng một lần: context 70/85% (báo lại sau khi tụt dưới 50%), hạn mức 80/95% và dự báo đầy (mỗi cửa sổ), ngân sách phiên 75/100% | toast; ngưỡng cao gửi thêm thông báo hệ thống. Tuỳ chọn `alerts`, `budgetUsd` | test D×2 |
| E | Thông báo cache sắp hết trên Windows / mọi hệ | sau notifier macOS: `$.ui.notify` (bỏ qua kênh chỉ kêu chuông) → `PushNotification` → toast | test E + 4 test cũ |

## session-band: biểu tượng trên terminal (18/11/2026)

- Lỗi có từ bản gốc: thanh chọn vẽ biểu tượng bằng `'Svg' in ui`, mà bảng phần tử của terminal cũng có `Svg` và vẽ nó thành hộp rỗng (mất cả hình lẫn `alt`). Trên terminal các ký hiệu dự phòng ⚡ $ ⧗ vì thế không bao giờ hiện. Nay chỉ dùng Svg khi `e.surface !== 'terminal'`, như khung của agents-panel.
- Tìm ra khi chạy thử lệnh `design-kit check-mod` (đang làm ở repo design-kit, phép kiểm `svg-terminal`).
- Test `icons: text symbols on the terminal, Svg on the desktop` (`band.test.tsx`): hỏng trên bản cũ, qua trên bản mới. session-band 17/17.

## Đổi tên savvy-progress → agents-panel (18/11/2026)

Bỏ savvy-flow xong, mod chỉ còn khung Agents và dòng chi phí dưới hàng Agent, nên đổi tên cho khớp. Bản gốc vẫn ở `upstream/savvy-progress`: so sánh bằng `git diff --no-index upstream/savvy-progress plugins/agents-panel`.

- Thư mục `plugins/agents-panel`, `name` trong plugin.json, khoá `$.state` (`agents-panel`), mã khung `savvy-agents` → `agents-panel`. Lệnh `/agents-info` giữ nguyên.
- `tools/sync_shared.py`, `tools/check.sh`, bài đo (`tools/bench/agents-panel.bench.test.tsx`; `run.sh` thay tên plugin và mã khung khi đo bản gốc).
- PC1: đường dẫn trong `CLAUDE_CODE_PLUGIN_DIRS` và khoá `pluginConfigs` đổi theo (có sao lưu).
- Các mục bên dưới giữ tên savvy-progress vì đó là tên lúc thay đổi được làm.

## Tái cấu trúc cả repo (18/11/2026): session-band `0.3.1-axi.1`, savvy-progress `2.0.0-axi.1`

Hành vi giữ nguyên, trừ một điểm: `language` của session-band nhận `auto` và lấy làm mặc định, như savvy-progress. Ngôn ngữ đặt cứng vẫn áp ngay lúc `register` như trước; `auto` dò ở `session.start`.

Reviewer độc lập (phiên sạch) đã so bản trước và sau, cùng kịch bản qua `claude plugin test`: session-band 1.004 ảnh chụp cây vẽ, savvy-progress 2.086 ảnh chụp, lệch 0 sau khi trừ phần gỡ savvy-flow. Hàm định dạng so ngẫu nhiên 200.000 mẫu mỗi hàm, lệch 0. Lệch duy nhất tìm được (ngôn ngữ đặt cứng chỉ áp sau `session.start`) đã sửa.

- **Chia module.** Mỗi mod tách `register.tsx` (767 và ~815 dòng) thành các module theo việc; `register.tsx` chỉ còn nối hook (~160 và ~85 dòng).
  - session-band: `config`, `strings`, `state`, `icons`, `cache`, `limits`, `history`, `measure`, `usage`, `notify`, `band`.
  - savvy-progress: `config`, `strings`, `state`, `pricing`, `runs`, `crab`, `svg`, `pane`, `row`.
- **Mã dùng chung** ở `shared/` (`format.ts`: `pad`, `usd`, `usdShort`, `int`, `tokens`, `span`, `stopwatch`; `lang.ts`: `detectLang`). Engine không cho mod import ngoài thư mục của nó, nên `tools/sync_shared.py` chép vào `hooks/lib/` của từng mod; `--check` báo bản lệch.
- **Đặt tên thống nhất**: tuỳ chọn đọc một lần vào `CFG` ở `config.ts` (`applyOptions`), chữ qua `tr()`, giá trị đầu của `$.state` ở `state.ts`.
- **Chú thích** viết lại toàn bộ bằng tiếng Việt (tên hàm, biến giữ tiếng Anh).
- **`tools/check.sh`**: một lệnh kiểm cả repo (đồng bộ mã chung, validate, test, tsc từng mod).
- **Bài đo savvy-progress** bỏ phần thanh flow; khung 20 agent trên desktop: bản gốc 116.874 ký tự SVG mỗi lần vẽ, bản axi 55.383 (−53%).
- Kiểm: `bash tools/check.sh` qua hết (session-band 16/16 gồm test ngôn ngữ đặt cứng, savvy-progress 22/22, tsc sạch).

## savvy-progress `1.3.0-axi.1` → `2.0.0-axi.1` (bỏ savvy-flow, 18/11/2026)

Skill savvy-flow không có trong repo và không cài trên PC1, nên mọi phần dành cho nó là mã chết. Đã gỡ:

- Thanh tiến độ phía trên ô nhập (`AbovePrompt`), atom `flow`, kiểu `Flow`/`Phase`/`PlannedTask`.
- Công cụ `mcp__savvy-progress__progress` và `mcp__savvy-progress__step`, dòng nhắc báo bước chèn vào brief của worker `savvy-*`, các trường `stepDone/stepTotal/stepNote`.
- Danh sách việc "Kế hoạch" trong khung Agents; trang phục và màu theo hạng `savvy-*` (fable, heavy, careful, medium, light). Còn trang phục Explore và con cua thường.
- `autoOpen`: mặc định `savvy` → `any`; giá trị mới là `any|off`, `savvy` cũ được coi như `any`.
- Test: bỏ `band.test.tsx`, `caller.test.ts`, `register.test.ts` (toàn kiểm flow); thêm 2 test tự mở khung. `register.tsx` 1378 → ~815 dòng. Kiểm: validate, tsc sạch, 22/22 test.

## savvy-progress `1.2.1-axi.1` → `1.3.0-axi.1` (tính năng mới, 17/11/2026)

| ID | Tính năng | Cách làm | Kiểm |
| --- | --- | --- | --- |
| F | Dưới mỗi hàng gọi Agent trong transcript: model · token · ≈chi phí · thời gian của đúng subagent đó | `ui.render` trên `ToolUse` (giữ hàng gốc bằng `next(e)`), nối qua `AgentRun.toolUseId`; không đọc atom `now` nên không vẽ lại mỗi giây. Tuỳ chọn `rowCost` | `row.test.tsx` ×3 |

## savvy-progress `1.2.1` → `1.2.1-axi.1`

| # | Loại | Thay đổi | Kiểm |
| --- | --- | --- | --- |
| 1 | Sửa lỗi | Thêm giá **Fable 5.2 / Mythos 5.2**: $8 / $40, đọc cache $0,20 (gốc rơi vào giá Fable 5: $10 / $50 / $1) | test `cost.test.ts` |
| 2 | Sửa lỗi | Ghi cache subagent tính **1,25× input (5 phút)**, theo số đo PC1: subagent ghi 100% loại 5m. Tuỳ chọn `subagentCacheTtl: 1h` trả về 2× như gốc | test giá + test tuỳ chọn 1h |
| 3 | Đơn giản hoá | Bảng `PRICES` còn 3 cột (in, out, đọc); giá ghi suy ra từ input × hệ số TTL, khỏi chép tay cột thứ 4 | — |
| 4 | Hiệu năng | Pixel con cua liền nhau cùng màu gộp thành một `rect` (hình y hệt vì `crispEdges`) | bench SVG |
| 5 | Hiệu năng | Thân con cua dựng một lần cho mỗi (trang phục, đang đi); mỗi lần vẽ chỉ bọc `transform` | — |
| 6 | Hiệu năng | CSS hoạt ảnh con cua (~2 nghìn ký tự) chỉ chèn vào SVG có con cua đang đi | bench SVG |
| 7 | Hiệu năng | Hàng agent đã xong dựng SVG một lần (nhớ theo dữ liệu hàng + bề rộng + ngôn ngữ) | — |
| 8 | Hiệu năng | Thanh tiến độ nhớ SVG lần cuối theo (flow, bề rộng, đang chạy, ngôn ngữ): request của worker không còn chạy lại vòng dither | — |
| 9 | Ngôn ngữ | Thêm `vi` (tự nhận khi `language` của Claude Code là `vi`/`Vietnamese`/`tiếng Việt`) | — |

Kết quả đo (bảng Agents 20 agent, desktop): SVG mỗi lần vẽ **249.587 → 103.923 ký tự (−58%)**.

## Đo trước/sau

Chạy: `bash tools/bench/run.sh upstream/<mod>` và `bash tools/bench/run.sh plugins/<mod>` (chép
plugin sang thư mục tạm, thêm tệp bench, chạy `claude plugin test`; không cài gì).

| Chỉ số | Gốc | axi |
| --- | ---: | ---: |
| savvy-progress: ký tự SVG mỗi lần vẽ bảng (20 agent, 10 đang chạy) | 249.587 | 103.923 |
| savvy-progress: ms mỗi lần vẽ bảng (gồm harness) | 4,7–5,4 | 4,0–6,2 (trong nhiễu) |
| session-band: lần vẽ lại thanh trong 1 giờ đếm ngược cache | 3.600 | 650 |
| session-band: lần ghi `stats` cho 1 lượt 30 request | 32 | 2 |
| session-band: ms cho 3.600 tick (gồm harness) | 3.098 | 1.511–2.191 |

Thời gian mỗi lần vẽ đo qua harness (`$.ui.mount` ~4–6 ms) nên không tách được phần của mod; hai
chỉ số có ý nghĩa là kích thước SVG và số lần vẽ lại.

## Kiểm tra

- `claude plugin validate plugins/<mod>`: qua cả hai.
- `claude plugin test plugins/savvy-progress`: 27/27 (24 test gốc đã chỉnh số theo giá mới + 3 mới).
- `claude plugin test plugins/session-band`: 5/5 (gốc không có test; chạy trên bản gốc thì 4 fail,
  còn test #4 qua vì nó canh một hồi quy của bản nháp axi chứ không phải lỗi gốc).
- Review độc lập (agent `reviewer-sach`): so 228 SVG / 232 con cua của hai bản tô ra lưới điểm
  ảnh, 0 khác biệt (số `rect` 18.610 → 6.364); khoá memo đủ; giá khớp skill `claude-api`. Hai
  phát hiện ở session-band (#7, #7b) đã sửa.
- `tsc` (TypeScript 6.0.3, tsconfig theo tệp kiểu của engine): sạch cả hai; bản gốc session-band
  lỗi 4 chỗ.
