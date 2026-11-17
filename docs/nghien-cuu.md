# Nghiên cứu hai mod `savvy-progress` và `session-band` (claude-kit)

> Ngày 17/11/2026 · nguồn: `github.com/JohnnyVizz/claude-kit` (MIT, © 2026 johnnyvizz), commit
> `c871c153` (13/10/2026), bản sao nguyên trạng ở `upstream/`. Máy đo: PC1, Claude Code **2.1.311**
> (mod yêu cầu ≥ 2.1.287 → đủ). Kiểu API đối chiếu: bản do Claude Code 2.1.325 viết (skill
> `plugin-authoring`).

## 0. Tóm tắt

- Ảnh "Turn 2 · 123 tok/s · $0.23 | $0.41" trên nhóm Facebook là **session-band**, không phải
  savvy-progress. savvy-progress là thanh tiến độ cho skill `/savvy-flow` + bảng Agents.
- Cả hai là **mod hook hàm** (function hooks) của Claude Code: một module TSX `hooks/register.tsx`
  đăng ký hook bằng `on(event, matcher?, hook)`, vẽ bằng phần tử `Box/Text/Button/Svg` mà bề mặt
  (terminal/desktop) cấp, lưu trạng thái trong `$.state` qua `atom/read/update`.
- Không có truy cập mạng, không gửi dữ liệu ra ngoài. Mức truy cập thật: đọc vài biến môi trường,
  đọc settings (chỉ trường `language`), đọc một tệp JSON của desktop app (chỉ macOS), chạy một tiến
  trình trợ giúp tự build (chỉ macOS), đăng ký 2 công cụ cho model, và **sửa prompt giao cho
  subagent `savvy-*`**.
- Lỗi/điểm yếu đáng kể tìm được (chi tiết §4–§6), tất cả đã có test tái hiện:
  1. Bảng giá thiếu **Fable 5.2 / Mythos 5.2** → tính theo giá Fable 5 (đắt hơn 25% input/output,
     đọc cache gấp 5).
  2. Ghi cache của subagent tính theo giá **1 giờ** (2× input); đo trên PC1 thì subagent ghi
     **100% loại 5 phút** (1,25×) → thổi phồng phần ghi cache 60%.
  3. session-band đếm cả **lượt của subagent** là "Turn" và đặt lại chi phí lượt giữa chừng.
  4. Đồng hồ cache 1 giờ bắt đầu từ lúc **trả lời xong**, nhưng tuổi cache tính từ lúc **request
     bắt đầu** → đồng hồ chậm đúng bằng thời gian sinh câu trả lời cuối.
  5. Bảng Agents sinh ~**250 nghìn ký tự SVG** mỗi lần vẽ (20 agent) và vẽ lại mỗi giây.
  6. session-band ghi state (= vẽ lại thanh) **3600 lần/giờ** chỉ để nhảy số giây.
  7. session-band gốc **không qua `tsc`** (đọc state của một mod "Cache" không khai báo).
  8. Tên dự án trong thông báo sai trên Windows (tách đường dẫn chỉ theo `/`).

## 1. Kiến trúc chung của một mod

```
plugins/<mod>/
  .claude-plugin/plugin.json   tên, phiên bản, "types", userConfig (tuỳ chọn hiện ở /config)
  hooks/hooks.json             { "modules": ["./register.tsx"] }
  hooks/register.tsx           export const register: Register = (on, options) => { ... }
  types/index.d.ts             hợp đồng $.state: interface PluginState { '<mod>': {...} }
```

- Mỗi hook có dạng `($, e, next)`: `$` là giao diện engine, `e` là input (đông cứng), `next(e)`
  chạy các plugin bên dưới rồi hành vi gốc của engine.
- `turn.step` là **hook luồng** (`async function*`): bọc stream câu trả lời, đọc từng chunk, phải
  `yield` lại chunk.
- Vẽ: `ui.render` với `{ component: 'AbovePrompt' }` (một hàng trên ô nhập) hoặc
  `{ component: 'Pane', requestId }` (bảng bên cạnh). Một lần `update($, atom, fn)` vẽ lại **mọi
  chỗ đã `read` atom đó** — đây là gốc của chi phí vẽ lại.
- Biến cấp module mất khi hot-reload; `$.state` còn (nên state phải nằm trong atom).

## 2. session-band (0.2.0, 371 dòng)

### Sự kiện hook

| Sự kiện | Việc làm |
| --- | --- |
| `session.start` | đăng ký lệnh `/session_data`; `$.clock.every(1000)` đếm ngược cache và bắn thông báo ở 10 và 5 phút |
| `command.run` `session_data` | ẩn/hiện; `demo <phút>` giả hạn cache; `width` (gỡ lỗi) |
| `turn.start` | tăng `turn`, chụp `costAtStart` = tổng chi phí phiên, `isBusy = true` |
| `turn.step` (chỉ luồng chính) | đo tok/s; sau mỗi request gọi `refresh` (đọc `$.session.usage()`) |
| `turn.complete` | `refresh`; nếu luồng chính: hạn cache = bây giờ + 60 phút, `isBusy = false` |
| `ui.render` `AbovePrompt` | vẽ hàng: Lượt · tok/s · $lượt \| $phiên · đồng hồ cache · % context · × |

State (`types/index.d.ts`): `stats {turn, speed, turnCost, total, context, costAtStart}`,
`cache {expiresAt, secondsLeft}`, `isHidden`, `isBusy`, `warned`.

### Cách tính

- **tok/s** = `usage.output_tokens` của chunk `stop` ÷ (thời điểm chunk `stop` − thời điểm chunk
  **đầu tiên** của stream). Chunk đầu là phong bì `message_start`, nên **không tính thời gian chờ
  token đầu (TTFT)** nhưng có tính thinking ẩn (output_tokens đếm cả thinking). Bỏ số đo khi
  < 20 token, < 0,5 s hoặc > 1000 tok/s. Chỉ luồng chính; giá trị là của **request cuối** (không
  phải trung bình lượt). Lưu ý: "tok/s" bao gồm thời gian công cụ server (advisor, web search) nằm
  trong cùng request, nên có thể thấp giả.
- **Chi phí** không tự tính: lấy `$.session.usage().cost.usd` — sổ cái của engine, giống `/cost`
  (engine biết giá và tách cache 5m/1h). Chi phí lượt = tổng hiện tại − tổng lúc `turn.start`.
  Vì là sổ cái phiên, nó **gồm cả subagent và lệnh `$.model` của mod khác** chạy trong khung đó.
  Trên gói thuê bao (Max) đây là **giá API quy đổi**, không phải tiền thật bị trừ.
- **Đếm ngược cache**: giả định TTL 1 giờ (đúng với luồng chính trên gói thuê bao — đo §6), mốc
  là `turn.complete`. Viền vàng ở 20 phút, đỏ ở 10 phút; thông báo ở 10 và 5 phút, không bắn khi
  đang có lượt chạy.
- **Context %**: `usage().context.percent` của engine.

### Truy cập (quyền)

- `$.env.get`: `CLAUDE_CODE_HOST_SESSION_ID`, `HOME`, `CLAUDE_CODE_ACCOUNT_UUID`,
  `CLAUDE_CODE_ORGANIZATION_UUID` — chỉ để dựng đường dẫn tệp bản ghi phiên của desktop app
  **trên macOS** (`~/Library/Application Support/Claude/claude-code-sessions/<acc>/<org>/<id>.json`)
  và lấy trường `title`.
- `$.fs.exists/read`: tệp notifier trong thư mục plugin; tệp bản ghi phiên ở trên.
- `$.process.run`: chạy `notifier/Session Band.app/.../session-band-notifier` (Swift, build tại
  máy bằng `build.sh`, không có binary trong repo) với argv mảng (không qua shell).
- `$.tool.call('PushNotification')`: gửi thông báo qua Remote Control khi không có notifier.

### Rủi ro bảo mật

Thấp. Không mạng; tham số `process.run` là mảng cố định, phần duy nhất lấy từ ngoài là `title`
phiên (đi vào tham số `-title`, không qua shell); UUID tài khoản/tổ chức chỉ dùng tạo đường dẫn
cục bộ. Trên Windows nhánh notifier không bao giờ chạy (tệp `.app` không tồn tại). Đáng chú ý duy
nhất: mod đọc được env và settings nghĩa là **nếu ai sửa mã** thì có thể đọc biến khác — nên chỉ
cài từ bản đã đọc (đó là lý do giữ bản sao `upstream/` và đọc hết trước khi chạy).

### Điểm yếu

1. **Đếm lượt subagent** (lỗi): `turn.start` có `agentId` cho lượt subagent; bản gốc không lọc →
   "Turn" tăng theo mỗi subagent, `costAtStart` bị đặt lại khi subagent bắt đầu, chi phí lượt
   báo thấp. (Test `band.test.tsx` fail trên bản gốc.)
2. **Mốc đếm ngược sai** (lỗi nhỏ): tuổi mục cache tính từ lúc request ghi/đọc nó **bắt đầu**
   (skill `claude-api`, prompt-caching.md "Choosing the TTL"). Câu trả lời cuối dài 4 phút thì
   đồng hồ hiện thừa 4 phút — đúng ở chỗ nguy hiểm nhất (sắp hết hạn).
3. **Vẽ lại mỗi giây**: tick 1 s ghi `cache.secondsLeft` → thanh vẽ lại 3600 lần/giờ suốt thời
   gian có đồng hồ, kể cả khi chỉ còn cần biết "còn ~40 phút".
4. **Ghi state thừa**: `refresh` sau mỗi request luôn `update` dù số không đổi; 32 lần ghi cho một
   lượt 30 request.
5. Dựng lại chuỗi SVG biểu tượng mỗi lần vẽ (`cacheIcon`, `contextIcon`, `contextBar`).
6. Đọc state của mod `Cache` (mod khác, không khai báo) → `tsc` báo 4 lỗi; `claude plugin validate`
   vẫn qua.
7. Windows: tên dự án trong thông báo = cả đường dẫn (tách theo `/`).
8. Chữ cố định tiếng Anh.

## 3. savvy-progress (1.2.1, 1271 dòng)

### Sự kiện hook

| Sự kiện | Việc làm |
| --- | --- |
| `session.start` | chọn ngôn ngữ; đăng ký công cụ `progress` (luồng chính báo kế hoạch) và `step` (worker báo bước, `isDeferred: false`); lệnh `/agents-info`; tick 1 s cập nhật `now` khi có agent chạy |
| `tool.call` `progress` | gộp input vào `flow` (giới hạn 200 task, tiêu đề 120 ký tự); chặn gọi từ subagent |
| `tool.call` `step` | cập nhật `stepDone/stepTotal/stepNote` của agent gọi |
| `tool.call` `Agent` | với `savvy-*`: tăng/giảm `running` (lớp mờ trên thanh) |
| `agent.spawn` | **chèn thêm đoạn `STEP_BRIEF` vào prompt** của worker `savvy-*`; thêm hàng `AgentRun`; tự mở bảng |
| `turn.step` (subagent) | sau mỗi request: context, tổng token, **chi phí ước tính** cộng dồn |
| `turn.complete` (subagent) | trạng thái done/failed; nếu chưa thấy step nào thì dùng tổng của lượt |
| `ui.render` `Pane` | bảng Agents: desktop = mỗi hàng một SVG (cua pixel, thanh, số liệu) trên nền lưới chấm; terminal = chữ |
| `ui.render` `AbovePrompt` | thanh tiến độ: desktop = một SVG (chấm dither nhấp nháy, viên thuốc nhãn, cua), terminal = `█░` |

State: `flow`, `agents` (tối đa 200), `panel {isCompact, isDoneCollapsed, autoOpenedFor}`, `now`.

### Cách tính chi phí (ước tính)

`costOf = (input·giáIn + output·giáOut + cacheRead·giáĐọc + cacheWrite·giáGhi) / 1e6`, bảng
`PRICES` theo regex tên model (dòng đầu khớp thắng), Haiku 5.5 có giá prompt dài (> 100K token mỗi
request). Engine chỉ đưa **4 số token** (`ModelUsage`: input, output, cache_read,
cache_creation) — **không tách 5 phút/1 giờ, không có cờ fast mode hay inference_geo** — nên mod
buộc phải đoán loại ghi cache; bản gốc chọn 1 giờ cho mọi request.

Context window: 200K cho Haiku 4 / Claude 3, còn lại 1M (khớp bảng model của skill `claude-api`).

### Truy cập (quyền)

- `$.settings.read()` (chỉ dùng trường `language`), `$.env.get` `LC_ALL/LC_MESSAGES/LANG`.
- Đăng ký 2 công cụ model gọi được: `mcp__savvy-progress__progress`, `mcp__savvy-progress__step`.
- **Sửa prompt subagent**: worker `savvy-*` nhận thêm một đoạn yêu cầu gọi `step`. Vô hại về nội
  dung nhưng là một dạng chèn prompt; chỉ áp cho `savvy-*`.
- Công cụ `step` không hoãn (`isDeferred: false`) nên **nằm trong danh sách công cụ của mọi
  agent** (kể cả không phải savvy): tốn vài trăm token mỗi request (được cache).

### Rủi ro bảo mật

Thấp, và tác giả đã chặn khá kỹ: subagent không gọi được `progress` (không giả mạo/xoá flow), input
công cụ bị kẹp giới hạn, chuỗi vào SVG được escape (`xml()`), tier lạ bị lọc trước khi làm khoá
bảng (chặn `__proto__`/`constructor` — có test). Không mạng, không tệp, không tiến trình.

### Điểm yếu

1. **Giá Fable 5.2 / Mythos 5.2 sai** (lỗi): regex `fable|mythos` bắt `fable-5-2` với giá Fable 5
   `[10, 50, 1, 20]`; giá đúng $8 / $40, đọc cache $0,20, ghi 5m $10 / 1h $16 (skill `claude-api`
   models.md). PC1 dùng Fable 5.2 nhiều (7.355 request luồng chính + 1.276 request subagent trong
   7 ngày) nên sai số này thực tế.
2. **Ghi cache subagent tính giá 1 giờ** (sai theo dữ liệu PC1, §6): thổi phồng phần ghi cache
   60% (2 ÷ 1,25).
3. **SVG khổng lồ**: mỗi pixel của con cua là một `<rect>`; CSS hoạt ảnh (~2 nghìn ký tự) chèn vào
   **mọi** hàng kể cả hàng tĩnh; mỗi giây dựng lại toàn bộ (kể cả hàng đã xong). 20 agent → ~250
   nghìn ký tự SVG mỗi lần vẽ, mỗi giây; desktop phải phân tích lại từng ấy.
4. Thanh tiến độ (AbovePrompt) đọc `agents` → vẽ lại sau mỗi request của mỗi worker, mỗi lần chạy
   lại vòng dither (tới vài nghìn lần `Math.sin`) dù flow không đổi.
5. Không có tiếng Việt (có en/ru/he).

## 4. Số đo trên PC1 làm căn cứ

**Loại ghi cache theo luồng** (transcript `~/.claude/projects/**/*.jsonl` sửa trong 7 ngày, khử
trùng lặp theo `requestId`; script `tools/cache_split.py`):

| Luồng | Model | Request | Ghi 5m (token) | Ghi 1h (token) | Tỉ lệ 1h |
| --- | --- | ---: | ---: | ---: | ---: |
| chính | claude-opus-5-5 | 37.965 | 2.215.536 | 207.912.603 | 98,9% |
| chính | claude-fable-5-2 | 7.355 | 0 | 56.339.844 | 100% |
| chính | các model khác | ~2.400 | 0 | ~22 triệu | 100% |
| subagent | claude-opus-5-5 | 10.694 | 47.462.175 | 0 | 0% |
| subagent | claude-fable-5-2 | 1.276 | 9.075.231 | 0 | 0% |
| subagent | sonnet-5-5 / fable-5-1 / haiku / opus-4-8 | 1.772 | 9.312.970 | 0 | 0% |

→ Luồng chính trên gói Max ghi cache 1 giờ (đồng hồ 60 phút của session-band đúng loại);
subagent ghi 5 phút (giá ghi 1,25× chứ không phải 2×).

## 5. Rủi ro khi cài

- Cả hai mod chạy trong môi trường hook riêng (không DOM/Node), nhưng có quyền đọc env/settings và
  sửa prompt subagent: chỉ cài từ mã đã đọc. Bản `plugins/` trong dự án này đã đọc hết từng dòng.
- Bản axi **giữ nguyên tên plugin** (`savvy-progress`, `session-band`) để tương thích với skill
  `savvy-flow` (gọi `mcp__savvy-progress__progress`) — **không cài cùng lúc với bản gốc**.
- API mod đang "EARLY ACCESS" (theo tệp kiểu), có thể đổi giữa các bản Claude Code.

## 6. Việc không làm được / chưa kiểm

- Không đo được thời gian JS thuần của mỗi lần vẽ: harness `claude plugin test` tốn ~4–6 ms mỗi
  lần mount, lớn hơn chênh lệch giữa hai bản (số đo nằm trong nhiễu). Chỉ số đo được và có ý nghĩa
  là **kích thước SVG** và **số lần ghi state (= số lần vẽ lại)**.
- Chưa chạy trong phiên Claude Code thật (chưa cài lên máy, chờ chủ đồng ý).
- Thông báo cache trên Windows: không có notifier gốc; rơi về `PushNotification`/toast (chưa thử).
- Không xác định được loại cache theo từng request từ trong mod (engine không đưa
  `cache_creation`), nên giá ghi cache subagent vẫn là giả định (đã kiểm bằng dữ liệu, có tuỳ chọn).
