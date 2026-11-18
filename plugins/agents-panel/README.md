# agents-panel

A Claude Code mod: a live panel of the session's subagents, and a cost line under each Agent call. Fork of the `savvy-progress` mod in johnnyvizz/claude-kit (MIT), renamed once the savvy-flow parts (progress bar above the prompt, the `progress` and `step` tools, planned tasks, tier costumes) were removed in 2.0.0-axi.1.

- **Agents panel** (`/agents-info` toggles it; `/agents-info open` opens it or brings it forward without toggling): running and finished subagents with model, effort, context, estimated cost and time. Working crabs walk; Explore agents wear a pirate hat. `prefers-reduced-motion` stops them.
- **Cost under each Agent call** (`rowCost`, default on): one dim line under the Agent tool call's row in the transcript with that subagent's model, tokens, estimated cost and time.

Cost is an estimate from token counts and a built-in per-model price table (`PRICES` in `hooks/register.tsx`), not a bill. Cache writes are priced at the 5-minute rate by default, which is what subagents write (`subagentCacheTtl: 1h` prices them at 2x input, as the original).

## Settings

`language`: `auto` (default), `en`, `ru`, `he` or `vi`. Hebrew draws the panel right to left. `auto` follows Claude Code's `language` setting, then the system locale, and falls back to English. For a mod loaded by hand, set it in `~/.claude/settings.json`:

```json
{ "pluginConfigs": { "agents-panel": { "options": { "language": "vi" } } } }
```

`autoOpen`: `any` (default) opens the panel once per session, when the first subagent starts; `off` leaves it to `/agents-info`. The old value `savvy` counts as `any`.

`subagentCacheTtl`: `5m` (default) or `1h`. `rowCost`: `on` (default) or `off`.

Install instructions are in the [repository README](../../README.md).
