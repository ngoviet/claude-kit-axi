# session-band

A Claude Code mod: one band above the prompt with the session at a glance.

- **Band**: turn number, output speed of the last response (tok/s), cost of the last turn and of the session, a countdown of the 1-hour prompt cache since the last answer, and context fill. The band gets an amber frame 20 minutes before the cache expires and a red one at 10. The row drops details as the window narrows instead of wrapping; `×` hides it for the rest of the session.
- **Cache warning**: at 10 and 5 minutes left, a system notification with Claude's icon, titled `<project> — <session title>`, saying how many minutes the cache has left. In the desktop app, clicking it opens the session. Nothing fires while a turn runs.

- **Plan limits** (`limits`, default on): the 5-hour window's use, and the weekly one when the band is wide, read from the rate limits Claude Code reports. Within a window the band shows the highest reading any session has seen (kept in the mod's store), since an idle session's own numbers go stale while others use the plan. When the current pace fills the window before it resets, `⚠1h20` says roughly when.
- **Threshold alerts** (`alerts`, default on): one toast per threshold — context at 70% and 85% (again after it drops below 50%), a plan limit at 80% and 95% and when its pace beats the reset, and the session cost at 75% and 100% of `budgetUsd` when set. The higher threshold of each also posts a system notification.
- **Task measurement**: `/token start [label]` … `/token stop` prints the calls and the four token counts of every model request in between (subagents included) and the USD from the session's cost ledger.
- **Cost history**: `/spend [days]` (default 7) shows the cost per day and the top projects, kept across sessions in the mod's store for 120 days. Set `utcOffset` (hours) when the runtime's clock runs in UTC.

## The notifier (macOS)

The warning is posted by a small helper app, built once on your Mac (needs Xcode's command line tools; the icon is taken from your installed Claude.app):

```bash
plugins/session-band/notifier/build.sh
```

It builds `notifier/Session Band.app` next to the script; on its first notification macOS asks whether to allow notifications from "Session Band". Build it in the folder the mod is loaded from, or copy the built app there. Without the helper (or on another OS) the mod sends Claude Code's notification (`$.ui.notify`: the desktop app or a terminal that shows notifications), then the PushNotification tool, which also reaches your phone over Remote Control but has no title or click-through; when you are already at the session that one is skipped and a toast says it instead.

## Settings

`language`: `auto` (default) follows Claude Code's `language` setting, then the system locale; `en` or `vi` forces one. `cacheTtl` (`1h`|`5m`), `countdown` (`minutes`|`seconds`), `limits`, `alerts`, `budgetUsd`, `utcOffset`: see above and `.claude-plugin/plugin.json`.

## Commands

- `/token start [label]`, `/token`, `/token stop`: measure a task.
- `/spend [days]`: cost per day and per project.
- `/session_data`: show or hide the band.
- `/session_data demo <minutes>`: pretend the cache has that many minutes left, to preview the colors and the warning; the next answer resets it.

## Install

Type at the prompt of a Claude Code session in a terminal:

```text
/plugin install session-band --marketplace ngoviet/claude-kit-axi
```

Answer `y` to add the marketplace, then pick a scope. More in the [repository README](../../README.md).
