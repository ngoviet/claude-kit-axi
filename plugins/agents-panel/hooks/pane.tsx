// Khung Agents: mở/đóng và vẽ (desktop bằng SVG, terminal bằng chữ).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, MatchedHook } from 'claude-code'

import type { AgentRun, Panel } from '../types'
import { PANE } from './config'
import { stopwatch, tokens, usdShort } from './lib/format'
import { modelName } from './pricing'
import { ctxOf, elapsed, progressOf, runModel, tick, totals } from './runs'
import { AGENTS0, PANEL0 } from './state'
import { isRtl, tr } from './strings'
import { AGENT_COLOR, AGENT_H, HEADER_H, LINE_H, agentSvg, compactSvg, finishedSvg, gridSvg, gridTiles, headerSvg } from './svg'

const agents = atom({ plugin: 'agents-panel', key: 'agents' } as const, AGENTS0)
const panel = atom({ plugin: 'agents-panel', key: 'panel' } as const, PANEL0)
const now = atom({ plugin: 'agents-panel', key: 'now' } as const, 0)

/** Mở khung, hoặc đưa nó lên trước nếu đang nằm sau tab khác. */
export async function openPane($: EngineInterface): Promise<void> {
  await tick($)
  await $.ui.open({ id: PANE, title: tr().pane })
}

/** Mở khung, hoặc đóng nếu đang mở; trả về true khi khung đang mở sau lệnh. */
export async function togglePane($: EngineInterface): Promise<boolean> {
  if ((await $.ui.panes()).some(p => p.id === PANE)) {
    await $.ui.close({ id: PANE })
    return false
  }
  await openPane($)
  return true
}

/** Tự mở khung một lần cho mỗi `key` trong phiên. */
export async function autoOpen($: EngineInterface, key: string): Promise<void> {
  if ((await read($, panel)).autoOpenedFor === key) return
  await update($, panel, prev => ({ ...prev, autoOpenedFor: key }))
  void $.ui.open({ id: PANE, title: tr().pane })
}

/** Mỗi giây khi có agent đang chạy: nhích mốc giờ để đồng hồ trong khung chạy. */
export async function tickRunning($: EngineInterface): Promise<void> {
  if ((await read($, agents)).some(a => a.status === 'running')) await tick($)
}

/** Thanh chữ cho terminal. */
const textBar = (pct: number, width: number): string => {
  const filled = Math.round((width * pct) / 100)
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

const STATUS_GLYPH: Record<string, string> = { running: '●', done: '✓', failed: '✗' }

type PaneHook = MatchedHook<'ui.render', { component: 'Pane'; requestId: typeof PANE }>

/** Hook `ui.render` của khung Agents. */
export async function drawPane($: Parameters<PaneHook>[0], e: Parameters<PaneHook>[1]): Promise<Awaited<ReturnType<PaneHook>>> {
  const s = tr()
  const ui = $.ui.resolve(e)
  const { Box, Text, Button } = ui
  const list = await read($, agents)
  const p: Panel = await read($, panel)
  const at = Math.max(await read($, now), ...list.map(a => a.startedAt), 0)

  const running = list.filter(a => a.status === 'running').reverse()
  const finished = list.filter(a => a.status !== 'running').reverse()
  const t = totals(list, at)
  const isEmpty = list.length === 0
  const summary = `≈${usdShort(t.cost)}, ${tokens(t.tokens)} ${s.tokensWord}, ${stopwatch(t.time)}`

  const toggleCompact = (
    <Button
      key="compact"
      label={p.isCompact ? s.expand : s.collapse}
      plain
      onPress={() => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact }))}
    />
  )
  const toggleDone = (
    <Button
      key="done"
      label={`${p.isDoneCollapsed ? (isRtl() ? '◂' : '▸') : '▾'} ${s.finished} · ${finished.length}`}
      plain
      onPress={() => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed }))}
    />
  )

  // --- Desktop: mỗi hàng một SVG, đặt trên lưới chấm.
  if (e.surface === 'desktop' && 'Svg' in ui) {
    const { Svg } = ui
    const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
    // Tiếng Do Thái: cột bám mép phải, tiêu đề mục và nút căn phải.
    const align = isRtl() ? 'flex-end' : undefined
    if (p.isCompact) {
      return (
        <Box flexDirection="column" gap={1} alignItems={align}>
          <Svg source={compactSvg(W, list, t)} alt={`${list.length} ${s.agentsCount}, ${summary}`} width={W} height={32} />
          {toggleCompact}
        </Box>
      )
    }
    const shownDone = p.isDoneCollapsed ? 0 : finished.length
    const lines = 1 + (isEmpty ? 1 : 0) + (running.length > 0 ? 1 : 0) + (finished.length > 0 ? 1 : 0)
    const gridH = HEADER_H + lines * LINE_H + (running.length + shownDone) * AGENT_H
    const agentRow = (a: AgentRun, source: string, state: string) => (
      <Svg key={a.id} source={source} alt={`${a.description}: ${modelName(a.model)}, ${state}`} width={W} height={AGENT_H} />
    )
    return (
      <Box flexDirection="column">
        {/* Lưới quyết định chiều cao khung; nội dung đặt đè lên, vì Box absolute vẽ đè các anh em đứng trước. */}
        {gridTiles(gridH).map((tileH, i) => (
          <Svg key={`grid-${i}`} source={gridSvg(W, tileH)} alt="dotted grid" width={W} height={tileH} />
        ))}
        <Box flexDirection="column" position="absolute" top={0} left={0} right={0} alignItems={align}>
          <Svg source={headerSvg(W, t)} alt={summary} width={W} height={HEADER_H} />
          {toggleCompact}
          {isEmpty && <Text dimColor>{s.empty}</Text>}
          {running.length > 0 && <Text dimColor>{`${s.running} · ${running.length}`}</Text>}
          {running.map(a => agentRow(a, agentSvg(W, a, at), s.isRunning))}
          {finished.length > 0 && toggleDone}
          {!p.isDoneCollapsed && finished.map(a => agentRow(a, finishedSvg(W, a), s.isFinished))}
        </Box>
      </Box>
    )
  }

  // --- Terminal: cùng nội dung, bằng các dòng chữ.
  const cols = Math.max(24, e.props.bodyColumns || 40)
  const barW = Math.max(6, Math.min(20, cols - 34))
  const row = (a: AgentRun) => {
    const ctx = ctxOf(a)
    const progress = progressOf(a)
    return (
      <Box key={a.id} flexDirection="column" marginBottom={1}>
        <Box flexDirection="row" gap={1}>
          <Text color={AGENT_COLOR}>▣</Text>
          <Text bold wrap="truncate-end">
            {a.description || a.type}
          </Text>
          <Text color={a.status === 'failed' ? 'red' : a.status === 'done' ? 'green' : AGENT_COLOR}>{STATUS_GLYPH[a.status]}</Text>
        </Box>
        <Text dimColor wrap="truncate-end">
          {'  '}
          {a.type} · {runModel(a)}
          {a.round > 1 ? ` · ${s.round} ${a.round}` : ''}
        </Text>
        <Text wrap="truncate-end">
          {'  '}
          {progress === null ? <Text dimColor>{textBar(ctx, barW)}</Text> : <Text color={AGENT_COLOR}>{textBar(progress * 100, barW)}</Text>}
          <Text dimColor>
            {' '}
            {s.ctx} {ctx}% · {tokens(a.contextTokens)} ≈{usdShort(a.costUsd)} {stopwatch(elapsed(a, at))}
          </Text>
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="flex-end">
        {toggleCompact}
      </Box>
      <Text dimColor>
        ≈{usdShort(t.cost)} · {tokens(t.tokens)} {s.tokensWord} · {stopwatch(t.time)}
      </Text>
      {p.isCompact ? (
        <Text wrap="truncate-end">
          {[...running, ...finished].map(a => (
            <Text key={a.id} color={AGENT_COLOR}>
              {STATUS_GLYPH[a.status]}{' '}
            </Text>
          ))}
        </Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {isEmpty && <Text dimColor>{s.empty}</Text>}
          {running.length > 0 && <Text dimColor>{s.running} · {running.length}</Text>}
          {running.map(row)}
          {finished.length > 0 && toggleDone}
          {!p.isDoneCollapsed && finished.map(row)}
        </Box>
      )}
    </Box>
  )
}
