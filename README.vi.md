# claude-kit-axi

<!-- readme-axi type=tool -->

[![CI](https://github.com/ngoviet/claude-kit-axi/actions/workflows/ci.yml/badge.svg)](https://github.com/ngoviet/claude-kit-axi/actions/workflows/ci.yml)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-%E2%89%A52.1.287-d97757)](https://docs.anthropic.com/en/docs/claude-code)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[English](README.md) · **Tiếng Việt**

> **Đã lưu trữ.** Hai mod đã được viết lại thành một mod **session-meter** ở [ngoviet/claude-meter-axi](https://github.com/ngoviet/claude-meter-axi). Repo này chỉ đọc, không còn bảo trì.

Hai mod cho Claude Code, chạy cả trong terminal lẫn desktop app. **session-band** gom phiên làm việc vào một dòng
phía trên ô nhập: lượt, tốc độ trả lời, chi phí lượt và chi phí phiên, đếm ngược tới lúc cache prompt hết hạn, hạn
mức gói kèm dự báo lúc đầy, và mức đầy context. **agents-panel** là khung theo dõi mọi subagent với model, context,
chi phí và thời gian, kèm một dòng chi phí dưới mỗi lần gọi Agent. Tối ưu từ
[johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) (MIT): sửa lỗi, vẽ lại ít hơn nhiều, thêm tính
năng, có tiếng Anh và tiếng Việt.

> 🇻🇳 Một người Việt tự xây dựng và duy trì. Nếu dự án giúp bạn tiết kiệm thời gian, hãy
> [ủng hộ dự án](#ủng-hộ-dự-án).

## Mục lục

- [Tính năng](#tính-năng)
- [Yêu cầu](#yêu-cầu)
- [Cài đặt](#cài-đặt)
- [Cách dùng](#cách-dùng)
- [Tuỳ chọn](#tuỳ-chọn)
- [Cách hoạt động](#cách-hoạt-động)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Phát triển](#phát-triển)
- [Ủng hộ dự án](#ủng-hộ-dự-án)
- [Giấy phép](#giấy-phép)

## Tính năng

**session-band**, thanh phía trên ô nhập:

- Số lượt, tốc độ trả lời gần nhất (tok/s), chi phí lượt và chi phí phiên.
- Đếm ngược hạn cache prompt tính từ lúc bắt đầu request gần nhất. Trước khi cache hết hạn, thanh chuyển vàng rồi
  đỏ, và một thông báo hệ thống báo còn mấy phút (Windows và macOS).
- Hạn mức gói: mức dùng 5 giờ và tuần, kèm dự báo `⚠1d8h` khi tốc độ hiện tại làm đầy cửa sổ trước giờ reset. Dự
  báo tuần dùng tốc độ trung bình từ lúc cửa sổ mở, nên một đợt chạy dồn không gây báo động nhầm.
- Cảnh báo mỗi ngưỡng một lần: context 70% và 85%, hạn mức gói 80% và 95%, và ngân sách phiên do bạn đặt.
- `/token`: đo một tác vụ (calls, input, ghi cache, đọc cache, output, USD).
- `/spend`: chi phí theo ngày và theo dự án, giữ qua các phiên.
- Màu theo theme sáng hoặc tối của Claude Code. Khi cửa sổ hẹp, thanh bỏ bớt chi tiết thay vì xuống dòng.

**agents-panel**, khung Agents (`/agents-info`):

- Các subagent đang chạy và đã xong, kèm model, effort, context, chi phí ước tính và thời gian; con cua pixel bước
  đi khi agent đang làm.
- Một dòng mờ dưới mỗi lần gọi Agent trong transcript: model, token, chi phí, thời gian.
- Tự mở khi subagent đầu tiên của phiên chạy.
- Chi phí ước tính theo giá niêm yết hiện hành, ghi cache của subagent tính theo giá loại 5 phút, đúng loại
  subagent ghi.

## Yêu cầu

- Claude Code 2.1.287 trở lên, trong terminal hoặc desktop app.
- Đừng nạp cùng lúc với `session-band` hay `savvy-progress` bản gốc của johnnyvizz/claude-kit: thanh hoặc khung sẽ
  bị vẽ hai lần.

## Cài đặt

Gõ ở ô nhập của một phiên Claude Code trong terminal, mỗi mod một dòng:

```text
/plugin install session-band --marketplace ngoviet/claude-kit-axi
/plugin install agents-panel --marketplace ngoviet/claude-kit-axi
```

Trả lời `y` để thêm marketplace, rồi chọn phạm vi. Mod nạp từ phiên kế tiếp.

Muốn chạy thẳng từ bản clone (để phát triển, hoặc theo sát `main`), trỏ Claude Code tới các thư mục trong
`~/.claude/settings.json`; Windows phân cách bằng `;`, macOS và Linux bằng `:`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/claude-kit-axi/plugins/session-band:/path/to/claude-kit-axi/plugins/agents-panel" } }
```

## Cách dùng

Thanh hiện sau câu trả lời đầu tiên của phiên; khung Agents mở khi có subagent đầu tiên. Các lệnh:

| Lệnh | Việc |
| --- | --- |
| `/session_data` | Ẩn hoặc hiện thanh. `/session_data demo 10` giả như cache còn 10 phút, để xem trước màu và cảnh báo. |
| `/token start [nhãn]` · `/token` · `/token stop` | Đo một tác vụ: bắt đầu, xem số đang chạy, dừng và in tổng. |
| `/spend [số ngày]` | Chi phí theo ngày và các dự án tốn nhất, mặc định 7 ngày. |
| `/agents-info` | Ẩn hoặc hiện khung Agents; `/agents-info open` đưa khung lên trước. |

## Tuỳ chọn

Đặt trong `/config`, hoặc dưới `pluginConfigs` trong `~/.claude/settings.json`:

```json
{ "pluginConfigs": {
    "session-band": { "options": { "language": "vi", "budgetUsd": "5" } },
    "agents-panel": { "options": { "language": "vi", "autoOpen": "any" } }
} }
```

| Mod | Tuỳ chọn | Giá trị (mặc định đứng đầu) |
| --- | --- | --- |
| cả hai | `language` | `auto` (theo cài đặt ngôn ngữ của Claude Code, rồi locale), `en`, `vi`; agents-panel có thêm `ru`, `he` |
| session-band | `cacheTtl` | `1h` (gói thuê bao), `5m` (API key) |
| session-band | `countdown` | `minutes`, `seconds` |
| session-band | `limits` · `alerts` | `on`, `off` |
| session-band | `budgetUsd` | để trống (không đặt ngân sách), hoặc số USD |
| session-band | `utcOffset` | `auto`, hoặc số giờ lệch UTC cho ngày của `/spend` |
| agents-panel | `autoOpen` | `any`, `off` |
| agents-panel | `subagentCacheTtl` | `5m`, `1h` |
| agents-panel | `rowCost` | `on`, `off` |

## Cách hoạt động

Cả hai là mod của Claude Code: một module hook do Claude Code chạy, vẽ bằng `ui.render` lên thanh trên ô nhập
(`AbovePrompt`), lên một pane và lên hàng của từng lệnh gọi công cụ (`ToolUse`). session-band đọc sổ chi phí,
context và hạn mức của chính phiên (số hạn mức mới nhất dùng chung giữa các phiên qua store của mod), và đo
thời gian mỗi câu trả lời từ phần tử stream đầu tiên. agents-panel theo mỗi subagent từ `agent.spawn` qua từng
`turn.step` tới `turn.complete`, rồi tính giá số token nó báo theo bảng trong `plugins/agents-panel/hooks/pricing.ts`. `hooks/register.tsx` của mỗi mod chỉ nối các hook; mỗi phần có module
riêng, liệt kê ở đầu tệp đó.

Những gì đã đổi so với bản gốc, kèm số đo trước và sau: [docs/thay-doi.md](docs/thay-doi.md).

## Cấu trúc dự án

```text
plugins/session-band/   thanh phía trên ô nhập
plugins/agents-panel/   khung Agents (bản gốc tên savvy-progress)
shared/                 mã hai mod dùng chung; tools/sync_shared.py chép vào hooks/lib/ của từng mod
upstream/               hai mod gốc, nguyên văn (commit c871c153), để so sánh và đo đối chứng
tools/check.sh          lệnh kiểm cả repo: mã chung đã đồng bộ, rồi validate, test và tsc từng mod
tools/bench/            bài đo chạy được trên bản gốc và trên hai mod này
docs/                   nghiên cứu, nhật ký thay đổi kèm số đo, ghi chú bàn giao
```

## Phát triển

```bash
bash tools/check.sh
```

chạy trước mỗi commit và trong CI: kiểm mã chung đã đồng bộ, rồi `claude plugin validate`, `claude plugin test` và
`tsc` cho từng mod (tsc tự bỏ qua khi máy không có tệp kiểu của Claude Code). Job CI thứ hai kiểm giao diện của cả
hai mod bằng [`design-kit check-mod --strict`](https://github.com/ngoviet/design-kit) (tràn dòng, chữ bị cắt, tương
phản trên nền tối và sáng, cỡ chữ, luật engine, trên terminal và desktop ở 40–200 cột); ảnh chụp nằm ở artifact
`check-mod-shots` của lượt chạy. Sửa mã chung ở `shared/`, rồi chạy
`python3 tools/sync_shared.py`. So với bản gốc: `bash tools/bench/run.sh upstream/savvy-progress` và
`bash tools/bench/run.sh plugins/agents-panel`. Chú thích trong mã và tài liệu viết bằng tiếng Việt.

<!-- support:start -->
## Ủng hộ dự án

<p align="center">
  <img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/banner-v2.svg" width="560" alt="Built and maintained by one person in Việt Nam">
</p>

<p align="center">Một người Việt tự xây dựng và duy trì, miễn phí và mã nguồn mở. Sự ủng hộ của bạn giúp hỗ trợ thêm thiết bị, sửa lỗi nhanh hơn và ra bản mới đều đặn.</p>

<p align="center">
  <a href="https://buymeacoffee.com/ngoviet"><img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/btn-coffee.svg" height="56" alt="Buy me a coffee"></a>
  &nbsp;
  <a href="https://github.com/sponsors/ngoviet"><img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/btn-sponsors.svg" height="56" alt="GitHub Sponsors"></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/vietqr-card.svg" width="300" alt="VietQR — MB Bank — NGO DUC VIET — 911051212">
  &nbsp;
  <img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/crypto-card.svg" width="300" alt="Crypto — BNB Smart Chain (BEP20) — 0xcbf0402b232cb24b4d998f09a4884f87b5f74750">
</p>

<p align="center"><b>Ví tiền mã hoá, chỉ gửi qua mạng BNB Smart Chain (BEP20):</b><br><code>0xcbf0402b232cb24b4d998f09a4884f87b5f74750</code></p>

<p align="center">🇻🇳 VietQR: quét bằng app ngân hàng bất kỳ, nội dung <code>Ung ho claude-kit-axi</code>. Cảm ơn bạn đã giúp dự án tiếp tục phát triển!</p>
<!-- support:end -->

## Giấy phép

[MIT](LICENSE) © Ngô Đức Việt. Dựa trên [johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) © 2026
johnnyvizz (MIT). Không liên kết với Anthropic.
