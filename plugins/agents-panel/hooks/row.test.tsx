// F: dòng chi phí dưới hàng gọi Agent trong transcript.
import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'agents-panel'
const T0 = Date.parse('2026-11-17T08:00:00Z')
const row = (tool: string, id: string) => ({
  plugin: PLUGIN,
  surface: 'terminal',
  component: 'ToolUse',
  requestId: id,
  props: { tool_use_id: id, tool, input: {}, isRunning: false, isErrored: false, isInterrupted: false },
}) as never

const worker = async ($: Engine, on: On) => {
  const clock = mock.clock(on, { now: T0 })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    return {
      turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn',
      usage: { model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 2000, cache_read_input_tokens: 10_000, cache_creation_input_tokens: 0 },
    } as never
  })
  // Hàng gốc của engine.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Work', subagentType: 'general-purpose', provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
  return clock
}

const step = async ($: Engine) => {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) void _
}

test('the Agent row keeps the engine row and adds model, tokens, cost and time', async ($, on) => {
  const clock = await worker($, on)
  await clock.advance(90_000)
  await step($)
  const ui = await $.ui.mount(row('Agent', 't1'))
  expect(await ui.find({ type: 'Text', text: /^engine row$/ })).toBeDefined()
  const line = await ui.find({ type: 'Text', text: /13k tok/ })
  expect(line?.text).toMatch(/Opus 5\.5.*13k tok · ≈\$0\.05 · 1:30/)
  await ui.unmount()
})

test('other tools and agents with no request yet keep the engine row alone', async ($, on) => {
  await worker($, on)
  const fresh = await $.ui.mount(row('Agent', 't1'))
  expect(await fresh.find({ type: 'Text', text: /tok/ })).toBeUndefined()
  await fresh.unmount()

  await step($)
  const bash = await $.ui.mount(row('Bash', 't1'))
  expect(await bash.find({ type: 'Text', text: /tok/ })).toBeUndefined()
  await bash.unmount()
})

test('rowCost off draws nothing extra', { options: { rowCost: 'off' } }, async ($, on) => {
  await worker($, on)
  await step($)
  const ui = await $.ui.mount(row('Agent', 't1'))
  expect(await ui.find({ type: 'Text', text: /tok/ })).toBeUndefined()
  await ui.unmount()
})

// Không còn savvy-flow: khung Agents tự mở khi subagent đầu tiên chạy, trừ khi autoOpen: off.
const opens = async ($: Engine, on: On) => {
  let n = 0
  mock.clock(on, { now: T0 })
  on('ui.open', () => {
    n++
    return { value: { isPlaced: true } }
  })
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }))
  const spawn = (id: string) =>
    $.agent.spawn({ tool_use_id: id, prompt: 'p', description: 'Work', subagentType: 'general-purpose', provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
  await spawn('t1')
  await spawn('t2')
  return n
}

test('the panel opens once when the first subagent starts', async ($, on) => {
  expect(await opens($, on)).toBe(1)
})

test('autoOpen off leaves the panel closed', { options: { autoOpen: 'off' } }, async ($, on) => {
  expect(await opens($, on)).toBe(0)
})
