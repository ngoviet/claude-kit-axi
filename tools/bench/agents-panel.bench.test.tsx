// Đo hiệu năng khung Agents của agents-panel (bản axi) và savvy-progress (bản gốc), cùng một bài;
// tools/bench/run.sh thay PLUGIN và PANE theo bản đang đo.
// Không phải test chức năng: in số ms ra log để so sánh trước/sau. Thanh tiến độ của
// savvy-flow đã gỡ khỏi bản axi (2.0.0-axi.1) nên không còn đo; agent dùng loại thường
// và Explore, là hai loại cả hai bản vẽ giống nhau.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'agents-panel'
const PANE = 'agents-panel'
const AGENTS = 20
const TICKS = 300
const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const
const TYPES = ['general-purpose', 'Explore']
const nowMs = () => (globalThis as { performance?: { now(): number } }).performance?.now() ?? Date.now()

async function crew($: Engine, on: On) {
  const clock = mock.clock(on, { now: Date.parse('2026-11-17T08:00:00Z') })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }) as never)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('settings.read', async () => ({ value: {} }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    const usage = { model: 'claude-opus-5-5', input_tokens: 2000, output_tokens: 800, cache_read_input_tokens: 40000, cache_creation_input_tokens: 6000 }
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage } as never
  })
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  for (let i = 0; i < AGENTS; i++) {
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `Task ${i + 1}`, subagentType: TYPES[i % TYPES.length], provider: 'engine', parentModel: 'claude-opus-5-5', background: true, fork: false } as never)
    const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 't', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId: `a${i + 1}` })
    for await (const _ of stream) void _
  }
  // Nửa số agent xong: bảng có cả hàng đang chạy (đồng hồ chạy mỗi giây) và hàng đã xong.
  for (let i = 0; i < AGENTS / 2; i++) {
    await ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId: `a${i + 1}`, reason: 'answer', answer: 'ok', usage: null })
  }
  return clock
}

for (const surface of ['desktop', 'terminal'] as const) {
  // Mỗi vòng: đồng hồ nhích 1 giây (như tick của mod) rồi vẽ lại cả bảng.
  test(`bench ${surface}: ${TICKS} one-second redraws of the pane with ${AGENTS} agents`, async ($, on) => {
    const clock = await crew($, on)
    let svgChars = 0
    const t0 = nowMs()
    for (let i = 0; i < TICKS; i++) {
      await clock.advance(1000)
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: pane })
      if (i === 0) svgChars = (await ui.findAll({ type: 'Svg' })).reduce((s, el) => s + String(el.props.source).length, 0)
      await ui.unmount()
    }
    const ms = nowMs() - t0
    console.log(`BENCH ${PLUGIN} pane ${surface}: ${(ms / TICKS).toFixed(2)} ms/redraw; SVG ${svgChars} chars per redraw`)
    expect(ms).toBeGreaterThan(0)
  })
}
