// Test cho các thay đổi của bản axi so với session-band gốc.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'session-band'
const band = { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 4, bodyColumns: 120, scroll: { offset: 0, bodyRows: 4 }, view: {} }
const T0 = Date.parse('2026-11-17T08:00:00Z')

async function session($: Engine, on: On) {
  const clock = mock.clock(on, { now: T0 })
  let usd = 0
  on('session.start', async () => ({ cwd: 'D:\\code\\demo' }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.cwd', () => ({ value: 'D:\\code\\demo' }) as never)
  on('fs.exists', () => ({ value: false }) as never)
  on('session.usage', () => ({ value: { startedAt: T0, context: { percent: 12 }, rateLimits: [], cost: { usd } } }) as never)
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })
  await $.session.start({ source: 'startup', cwd: 'D:\\code\\demo', surface: 'terminal', isInteractive: true } as never)
  return { clock, spend: (n: number) => (usd += n) }
}

const text = async ($: Engine, re: RegExp) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band })
  const found = await ui.find({ type: 'Text', text: re })
  await ui.unmount()
  return found
}

const turnStart = ($: Engine, agentId?: string) =>
  ($.turn.start as (e: unknown) => Promise<unknown>)({ text: 'x', turnId: 't', ...(agentId ? { agentId } : {}) })
const step = async ($: Engine, agentId?: string) => {
  const s = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 't', index: 0, model: 'claude-opus-5-5', messageCount: 1, ...(agentId ? { agentId } : {}) })
  for await (const _ of s) void _
}
const complete = ($: Engine, agentId?: string) =>
  ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'answer', answer: 'ok', usage: null, ...(agentId ? { agentId } : {}) })

test('a subagent turn neither counts as a turn nor resets the turn cost', async ($, on) => {
  const { spend } = await session($, on)
  await turnStart($)
  spend(0.3)
  await turnStart($, 'a1') // bản gốc: Turn 2 và chi phí lượt về 0 tại đây
  spend(0.2)
  await step($)
  expect(await text($, /^1$/)).toBeDefined()
  expect(await text($, /^\$0\.50$/)).toBeDefined()
})

test('the cache countdown starts at the last request, not at the answer', async ($, on) => {
  const { clock } = await session($, on)
  await turnStart($)
  await step($) // request bắt đầu ở T0
  await clock.advance(4 * 60_000) // câu trả lời dài 4 phút
  await complete($)
  // 60 phút tính từ đầu request: còn 56 phút, không phải 60.
  expect(await text($, /^56m$/)).toBeDefined()
})

const countPushes = (on: On) => {
  const pushes: number[] = []
  on('tool.call', () => {
    pushes.push(1)
    return { result: { pushSent: false, localSent: true } } as never
  })
  return pushes
}

test('cacheTtl 5m does not announce the expiry right after each answer', { options: { cacheTtl: '5m' } }, async ($, on) => {
  const pushes = countPushes(on)
  const { clock } = await session($, on)
  for (let i = 0; i < 2; i++) {
    await turnStart($)
    await step($)
    await clock.advance(20_000)
    await complete($)
    await clock.advance(3_000)
  }
  expect(pushes.length).toBe(0)
  await clock.advance(4 * 60_000) // còn dưới 1 phút: báo đúng một lần
  expect(pushes.length).toBe(1)
})

test('a main turn with no request keeps the deadline and does not repeat a warning', async ($, on) => {
  const pushes = countPushes(on)
  const { clock } = await session($, on)
  await turnStart($)
  await step($)
  await complete($)
  await clock.advance(55 * 60_000 + 1_000) // đã báo 10' và 5'
  const before = pushes.length
  await turnStart($)
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'aborted', answer: '', usage: null })
  await clock.advance(3_000)
  expect(pushes.length).toBe(before)
  expect(before).toBe(2)
})

test('the countdown shows minutes, then mm:ss in the last ten minutes', async ($, on) => {
  const { clock } = await session($, on)
  await turnStart($)
  await step($)
  await complete($)
  await clock.advance(30_000)
  expect(await text($, /^60m$/)).toBeDefined()
  await clock.advance(50 * 60_000)
  expect(await text($, /^09:30$/)).toBeDefined()
})
