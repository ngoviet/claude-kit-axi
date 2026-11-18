# claude-kit-axi

<!-- readme-axi type=tool -->

[![CI](https://github.com/ngoviet/claude-kit-axi/actions/workflows/ci.yml/badge.svg)](https://github.com/ngoviet/claude-kit-axi/actions/workflows/ci.yml)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-%E2%89%A52.1.287-d97757)](https://docs.anthropic.com/en/docs/claude-code)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**English** · [Tiếng Việt](README.vi.md)

Two mods for Claude Code, the terminal and the desktop app. **session-band** puts the session on one line above
the prompt: turn, output speed, cost of the turn and of the session, a countdown to when the prompt cache expires,
plan limits with a "fills in" forecast, and context fill. **agents-panel** is a live panel of every subagent with
its model, context, cost and time, plus a cost line under each Agent call. Optimized from
[johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) (MIT): bugs fixed, far fewer redraws, new
features, English and Vietnamese.

> 🇻🇳 Built and maintained by one person in Việt Nam — if it saves you time, please
> [support the project](#support-the-project).

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Development](#development)
- [Support the project](#support-the-project)
- [License](#license)

## Features

**session-band**, the band above the prompt:

- Turn number, output speed of the last answer (tok/s), cost of the turn and of the session.
- Prompt cache countdown from the start of the last request; the band turns amber, then red, before the cache
  expires, and a system notification says how many minutes are left (Windows and macOS).
- Plan limits: 5-hour and weekly use with a `⚠1d8h` forecast when the current pace fills the window before it
  resets. The weekly forecast uses the average pace since the window opened, so a burst of work does not raise a
  false alarm.
- One-time alerts: context at 70% and 85%, a plan limit at 80% and 95%, and a session budget you set.
- `/token`: measure one task (calls, input, cache write, cache read, output, USD).
- `/spend`: cost per day and per project, kept across sessions.
- Colors follow your Claude Code theme, light or dark. On a narrow window the band drops details instead of
  wrapping.

**agents-panel**, the Agents panel (`/agents-info`):

- Running and finished subagents with model, effort, context, estimated cost and time; a pixel crab walks while an
  agent works.
- A dim line under each Agent call in the transcript: model, tokens, cost, time.
- Opens by itself when the first subagent of the session starts.
- Cost estimates use current list prices and price subagent cache writes at the 5-minute rate, which is what
  subagents write.

## Requirements

- Claude Code 2.1.287 or later, in a terminal or the desktop app.
- Do not load these mods next to the original `session-band` or `savvy-progress` from johnnyvizz/claude-kit: the
  same band or panel would be drawn twice.

## Installation

Type at the prompt of a Claude Code session in a terminal, one line per mod:

```text
/plugin install session-band --marketplace ngoviet/claude-kit-axi
/plugin install agents-panel --marketplace ngoviet/claude-kit-axi
```

Answer `y` to add the marketplace, then pick a scope. The mods load in the next session.

To run a clone instead (for development, or to follow `main`), point Claude Code at the folders in
`~/.claude/settings.json`; separate folders with `;` on Windows and `:` on macOS and Linux:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/claude-kit-axi/plugins/session-band:/path/to/claude-kit-axi/plugins/agents-panel" } }
```

## Usage

The band appears after the first answer of a session; the panel opens with the first subagent. Commands:

| Command | What it does |
| --- | --- |
| `/session_data` | Hide or show the band. `/session_data demo 10` pretends the cache has 10 minutes left, to preview the colors and the warning. |
| `/token start [label]` · `/token` · `/token stop` | Measure a task: start, show the running count, stop and print the totals. |
| `/spend [days]` | Cost per day and the top projects, default 7 days. |
| `/agents-info` | Show or hide the Agents panel; `/agents-info open` brings it forward. |

## Options

Set them in `/config`, or under `pluginConfigs` in `~/.claude/settings.json`:

```json
{ "pluginConfigs": {
    "session-band": { "options": { "language": "auto", "budgetUsd": "5" } },
    "agents-panel": { "options": { "language": "auto", "autoOpen": "any" } }
} }
```

| Mod | Option | Values (default first) |
| --- | --- | --- |
| both | `language` | `auto` (Claude Code's language setting, then the system locale), `en`, `vi`; agents-panel also `ru`, `he` |
| session-band | `cacheTtl` | `1h` (subscription), `5m` (API key) |
| session-band | `countdown` | `minutes`, `seconds` |
| session-band | `limits` · `alerts` | `on`, `off` |
| session-band | `budgetUsd` | empty (no budget), or a USD amount |
| session-band | `utcOffset` | `auto`, or hours from UTC for the days of `/spend` |
| agents-panel | `autoOpen` | `any`, `off` |
| agents-panel | `subagentCacheTtl` | `5m`, `1h` |
| agents-panel | `rowCost` | `on`, `off` |

## How it works

Both are Claude Code mods: a hooks module that Claude Code runs, drawing with `ui.render` on the band above the
prompt (`AbovePrompt`), a pane and each tool call's row (`ToolUse`). session-band reads the session's own cost
ledger, context and rate limits, and times each answer from its first streamed item. agents-panel follows each
subagent from `agent.spawn` through every `turn.step` to `turn.complete`, and prices the tokens it reports with
the table in `plugins/agents-panel/hooks/pricing.ts`. Each mod's `hooks/register.tsx` only wires the hooks; every
part has its own module, listed at the top of that file.

What changed from the original, with before and after measurements: [docs/thay-doi.md](docs/thay-doi.md)
(Vietnamese).

## Project layout

```text
plugins/session-band/   the band above the prompt
plugins/agents-panel/   the Agents panel (savvy-progress in the original)
shared/                 code both mods use; tools/sync_shared.py copies it into each mod's hooks/lib/
upstream/               the original mods, verbatim (commit c871c153), for diffs and benchmarks
tools/check.sh          the repository check: shared code in sync, then validate, test and tsc per mod
tools/bench/            benchmarks that run on the original and on these mods
docs/                   research, change log with measurements, hand-over notes (Vietnamese)
```

## Development

```bash
bash tools/check.sh
```

runs before every commit and in CI: shared code in sync, then `claude plugin validate`, `claude plugin test` and
`tsc` for each mod (tsc is skipped where Claude Code's type files are not on disk). Edit shared code in `shared/`,
then `python3 tools/sync_shared.py`. Compare with the original: `bash tools/bench/run.sh upstream/savvy-progress`
and `bash tools/bench/run.sh plugins/agents-panel`. Code comments and docs are in Vietnamese.

<!-- support:start -->
## Support the project

<p align="center">
  <img src="https://raw.githubusercontent.com/ngoviet/.github/main/assets/support/banner-v2.svg" width="560" alt="Built and maintained by one person in Việt Nam">
</p>

<p align="center">Free and open source. Your support pays for new device support, faster fixes and every release.</p>

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

<p align="center"><b>Crypto wallet, BNB Smart Chain (BEP20) only:</b><br><code>0xcbf0402b232cb24b4d998f09a4884f87b5f74750</code></p>

<p align="center">🇻🇳 VietQR: scan with any Vietnamese banking app, transfer note <code>Ung ho claude-kit-axi</code>. Thank you for keeping this project alive!</p>
<!-- support:end -->

## License

[MIT](LICENSE) © Ngô Đức Việt. Based on [johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) © 2026
johnnyvizz (MIT). Not affiliated with Anthropic.
