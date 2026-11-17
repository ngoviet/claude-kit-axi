// Đo session-band: số lần ghi `cache` (mỗi lần ghi = một lần vẽ lại thanh) và số lần
// hỏi $.session.usage trong một giờ đếm ngược cache sau một lượt có 30 request.
import { expect, mock, test } from 'claude-code/testing'

const T0 = Date.parse('2026-11-17T08:00:00Z')
const nowMs = () => (globalThis as { performance?: { now(): number } }).performance?.now() ?? Date.now()

test('bench: one turn of 30 requests, then the one-hour countdown', { timeoutMs: 120_000 }, async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let cacheWrites = 0
  let statsWrites = 0
  let usageCalls = 0
  on('state.set', async ($$, e, next) => {
    const ev = e as unknown as { plugin?: string; key?: string }
    if (ev.plugin === 'session-band' && ev.key === 'cache') cacheWrites++
    if (ev.plugin === 'session-band' && ev.key === 'stats') statsWrites++
    return next(e)
  })
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.usage', () => {
    usageCalls++
    return { value: { startedAt: T0, context: { percent: 12 }, rateLimits: [], cost: { usd: 1.5 } } } as never
  })
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })
  on('tool.call', () => ({ result: { pushSent: false, localSent: true } }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)

  await ($.turn.start as (e: unknown) => Promise<unknown>)({ text: 'x', turnId: 't' })
  for (let i = 0; i < 30; i++) {
    const s = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 't', index: i, model: 'claude-opus-5-5', messageCount: 1 })
    for await (const _ of s) void _
  }
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'answer', answer: 'ok', usage: null })
  const turnWrites = { cache: cacheWrites, stats: statsWrites, usage: usageCalls }

  const t0 = nowMs()
  for (let i = 0; i < 3600; i++) await clock.advance(1000)
  const ms = nowMs() - t0
  console.log(`BENCH session-band turn: stats writes ${turnWrites.stats}, usage calls ${turnWrites.usage}`)
  console.log(`BENCH session-band hour: cache writes ${cacheWrites - turnWrites.cache} (= band redraws), ${ms.toFixed(0)} ms for 3600 ticks`)
  expect(cacheWrites).toBeGreaterThan(0)
})
