// Test cho các tính năng thêm ở 0.3.0-axi.1: hạn mức gói (A), đo token (B), lịch sử chi phí
// (C), cảnh báo theo ngưỡng (D), thông báo qua $.ui.notify (E).
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'session-band'
const band = { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 4, bodyColumns: 140, scroll: { offset: 0, bodyRows: 4 }, view: {} }
const T0 = Date.parse('2026-11-17T08:00:00Z')
const H = 3_600_000

type World = {
  usd: number
  context: number
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; model: string } | null
}

async function session($: Engine, on: On, store: Record<string, unknown> = {}) {
  const clock = mock.clock(on, { now: T0 })
  // Kho trong bộ nhớ, dùng chung với test: test đọc được số mod ghi và ghi thay phiên khác.
  on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }) as never)
  on('store.set', (_, e) => {
    const { key, value } = e as { key: string; value: unknown }
    store[key] = value
    return { value: undefined } as never
  })
  on('store.delete', (_, e) => {
    delete store[(e as { key: string }).key]
    return { value: undefined } as never
  })
  on('store.keys', () => ({ value: Object.keys(store) }) as never)
  const w: World = { usd: 0, context: 10, rateLimits: [], usage: null }
  const toasts: string[] = []
  const notes: string[] = []
  on('session.start', async () => ({ cwd: 'D:\\code\\demo' }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.cwd', () => ({ value: 'D:\\code\\demo' }) as never)
  on('fs.exists', () => ({ value: false }) as never)
  on('session.usage', () => ({ value: { startedAt: T0, context: { percent: w.context }, rateLimits: w.rateLimits, cost: { usd: w.usd } } }) as never)
  on('ui.toast', (_, e) => {
    toasts.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('ui.notify', (_, e) => {
    notes.push((e as { text: string }).text)
    return { value: { isSent: true, channel: 'client' } } as never
  })
  on('tool.call', () => ({ result: { pushSent: false, localSent: true } }) as never)
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: w.usage } as never
  })
  await $.session.start({ source: 'startup', cwd: 'D:\\code\\demo', surface: 'terminal', isInteractive: true } as never)
  return { clock, w, toasts, notes }
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
const complete = ($: Engine) =>
  ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'answer', answer: 'ok', usage: null })
const turn = async ($: Engine) => {
  await turnStart($)
  await step($)
  await complete($)
}
const command = async ($: Engine, name: string, args: string) =>
  ((await $.command.run({ command: name, args } as never)) as { text: string }).text

test('A: the band shows the 5-hour limit, then a fill warning when the pace beats the reset', async ($, on) => {
  const { clock, w } = await session($, on)
  const resetsAt = new Date(T0 + 3 * H).toISOString()
  w.rateLimits = [{ kind: 'five_hour', percentUsed: 42, resetsAt }]
  await turn($)
  expect(await text($, /^42%$/)).toBeDefined()
  expect(await text($, /^⚠/)).toBeUndefined()

  // +10% trong 30 phút: còn 48% → ~2h24, trước giờ reset (còn 2h30).
  await clock.advance(30 * 60_000)
  w.rateLimits = [{ kind: 'five_hour', percentUsed: 52, resetsAt }]
  await turn($)
  expect(await text($, /^52%$/)).toBeDefined()
  expect(await text($, /^⚠2h20$/)).toBeDefined()
})

test('A: no fill warning when the window resets first', async ($, on) => {
  const { clock, w } = await session($, on)
  const resetsAt = new Date(T0 + 1 * H).toISOString()
  w.rateLimits = [{ kind: 'five_hour', percentUsed: 10, resetsAt }]
  await turn($)
  await clock.advance(20 * 60_000)
  w.rateLimits = [{ kind: 'five_hour', percentUsed: 12, resetsAt }]
  await turn($)
  expect(await text($, /^12%$/)).toBeDefined()
  expect(await text($, /^⚠/)).toBeUndefined()
})

test('A: the weekly window uses the average pace since it opened, so a burst does not alarm', async ($, on) => {
  const { clock, w } = await session($, on)
  // Cửa sổ tuần mở 3 ngày trước (reset sau 4 ngày).
  const resetsAt = new Date(T0 + 4 * 24 * H).toISOString()
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 16, resetsAt }]
  await turn($)
  // +10% trong 30 phút: tốc độ ngắn hạn sẽ báo đầy sau ~3h40, trung bình cả tuần thì không.
  await clock.advance(30 * 60_000)
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 26, resetsAt }]
  await turn($)
  expect(await text($, /^26%$/)).toBeDefined()
  expect(await text($, /^⚠/)).toBeUndefined()
})

test('A: a weekly fill warning reads in days and hours', async ($, on) => {
  const { w } = await session($, on)
  // Mở 2 ngày trước, đã 60%: 30%/ngày, còn 40% → 32 giờ, trước giờ reset (còn 5 ngày).
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 60, resetsAt: new Date(T0 + 5 * 24 * H).toISOString() }]
  await turn($)
  expect(await text($, /^⚠1d8h$/)).toBeDefined()
})

test('A: an idle session shows the newest reading another session saw in the same window', async ($, on) => {
  // Engine chỉ cập nhật hạn mức theo phản hồi API của chính phiên: phiên này còn 47% trong
  // khi phiên khác đã thấy 49% (đo thật 21/11/2026: thanh 47%, máy chủ 49%).
  const resetsAt = new Date(T0 + 4 * 24 * H).toISOString()
  const store: Record<string, unknown> = {}
  const { clock, w } = await session($, on, store)
  await clock.advance(60_000)
  store['lim:seven_day'] = { resetsAt, percentUsed: 49, at: T0 + 30_000 }
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 47, resetsAt }]
  await turn($)
  expect(await text($, /^49%$/)).toBeDefined()
  expect(await text($, /^47%$/)).toBeUndefined()
})

test('A: a newer reading is shared, and a new window ignores the old one', async ($, on) => {
  const store: Record<string, unknown> = { 'lim:five_hour': { resetsAt: new Date(T0 - H).toISOString(), percentUsed: 90 } }
  const resetsAt = new Date(T0 + 4 * 24 * H).toISOString()
  const { w } = await session($, on, store)
  w.rateLimits = [
    { kind: 'five_hour', percentUsed: 5, resetsAt: new Date(T0 + 4 * H).toISOString() },
    { kind: 'seven_day', percentUsed: 52, resetsAt },
  ]
  await turn($)
  expect(await text($, /^5%$/)).toBeDefined()
  expect(await text($, /^90%$/)).toBeUndefined()
  expect((store['lim:seven_day'] as { percentUsed: number }).percentUsed).toBe(52)
})

test('A: a reset inside the same window lowers the band and is stored', async ($, on) => {
  // Anthropic đặt lại hạn mức tuần mà không đổi giờ reset (gặp 23/11/2026: thanh kẹt 100%,
  // máy chủ 85%). Phiên thấy số tụt từ chính engine phải tin số đó và ghi đè số lớn hơn đã lưu.
  const resetsAt = new Date(T0 + 3 * 24 * H).toISOString()
  const store: Record<string, unknown> = {}
  const { clock, w } = await session($, on, store)
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 100, resetsAt }]
  await turn($)
  expect(await text($, /^100%$/)).toBeDefined()
  await clock.advance(10 * 60_000)
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 85, resetsAt }]
  await turn($)
  expect(await text($, /^85%$/)).toBeDefined()
  expect((store['lim:seven_day'] as { percentUsed: number }).percentUsed).toBe(85)
})

test('A: an idle session still holding the old number follows a newer lower reading', async ($, on) => {
  const resetsAt = new Date(T0 + 3 * 24 * H).toISOString()
  const store: Record<string, unknown> = {}
  const { clock, w } = await session($, on, store)
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 100, resetsAt }]
  await turn($)
  // Phiên khác thấy reset và ghi 85% sau đó; engine phiên này vẫn giữ 100%.
  await clock.advance(10 * 60_000)
  store['lim:seven_day'] = { resetsAt, percentUsed: 85, at: clock.now() }
  await clock.advance(60_000)
  await turn($)
  expect(await text($, /^85%$/)).toBeDefined()
  expect((store['lim:seven_day'] as { percentUsed: number }).percentUsed).toBe(85)
})

test('A: a new session after a reset trusts its engine over a reading from before it started', async ($, on) => {
  // Phiên A thấy 100% rồi đóng; hạn mức được đặt lại; phiên mới mở thấy 85% từ máy chủ.
  const resetsAt = new Date(T0 + 3 * 24 * H).toISOString()
  const store: Record<string, unknown> = { 'lim:seven_day': { resetsAt, percentUsed: 100, at: T0 - H } }
  const { w } = await session($, on, store)
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 85, resetsAt }]
  await turn($)
  expect(await text($, /^85%$/)).toBeDefined()
  expect((store['lim:seven_day'] as { percentUsed: number }).percentUsed).toBe(85)
  await turn($)
  expect(await text($, /^85%$/)).toBeDefined()
})

test('A: an old stored number without a reading time loses to the engine', async ($, on) => {
  // Bản trước lưu số lớn nhất mà không ghi lúc đọc: phiên mới phải tự lành.
  const resetsAt = new Date(T0 + 3 * 24 * H).toISOString()
  const store: Record<string, unknown> = { 'lim:seven_day': { resetsAt, percentUsed: 100 } }
  const { w } = await session($, on, store)
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 85, resetsAt }]
  await turn($)
  expect(await text($, /^85%$/)).toBeDefined()
})

test('D: a limit alert fires again after a reset inside the same window', async ($, on) => {
  const resetsAt = new Date(T0 + 3 * 24 * H).toISOString()
  const { clock, w, toasts } = await session($, on)
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 81, resetsAt }]
  await turn($)
  await clock.advance(10 * 60_000)
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 20, resetsAt }]
  await turn($)
  await clock.advance(10 * 60_000)
  w.rateLimits = [{ kind: 'seven_day', percentUsed: 82, resetsAt }]
  await turn($)
  expect(toasts.filter(t => t.includes('82%')).length).toBe(1)
})

test('A: limits off hides them', { options: { limits: 'off' } }, async ($, on) => {
  const { w } = await session($, on)
  w.rateLimits = [{ kind: 'five_hour', percentUsed: 42 }]
  await turn($)
  expect(await text($, /^42%$/)).toBeUndefined()
})

test('D: each threshold alerts once; the high one also notifies the system', async ($, on) => {
  const { w, toasts, notes } = await session($, on)
  w.context = 72
  await turn($)
  await turn($)
  expect(toasts.filter(t => /Context/.test(t)).length).toBe(1)
  expect(notes.length).toBe(0)

  w.context = 90
  await turn($)
  expect(toasts.filter(t => /Context/.test(t)).length).toBe(2)
  expect(notes.length).toBe(1)

  // Sau /compact context tụt: lần đầy sau được báo lại.
  w.context = 20
  await turn($)
  w.context = 72
  await turn($)
  expect(toasts.filter(t => /Context/.test(t)).length).toBe(3)
})

test('D: the session budget alerts at 75% and 100%', { options: { budgetUsd: '2' } }, async ($, on) => {
  const { w, toasts } = await session($, on)
  w.usd = 1.6
  await turn($)
  expect(toasts.filter(t => /budget/.test(t)).length).toBe(1)
  w.usd = 2.1
  await turn($)
  await turn($)
  expect(toasts.filter(t => /budget/.test(t)).length).toBe(2)
})

test('E: the cache warning goes through $.ui.notify before PushNotification', async ($, on) => {
  const { clock, notes } = await session($, on)
  await turn($)
  await clock.advance(50 * 60_000 + 1_000)
  expect(notes.length).toBe(1)
  expect(notes[0]).toMatch(/10 min/)
})

test('B: /token sums every request, subagents included, and USD from the ledger', async ($, on) => {
  const { w } = await session($, on)
  expect(await command($, 'token', 'stop')).toMatch(/Nothing is being measured/)
  w.usd = 1
  expect(await command($, 'token', 'start fix bug')).toMatch(/"fix bug"/)

  w.usage = { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 50, model: 'claude-opus-5-5' }
  await turnStart($)
  await step($)
  await step($, 'a1')
  await complete($)
  w.usd = 1.75

  const out = await command($, 'token', 'stop')
  expect(out).toMatch(/calls 2 · input 20 · cache_write 100 · cache_read 2\.000 · output 200/)
  expect(out).toMatch(/USD \$0\.75/)
  expect(await command($, 'token', '')).toMatch(/Nothing is being measured/)
})

test('C: /spend keeps cost per day and project across sessions', { options: { utcOffset: '7' } }, async ($, on) => {
  const earlier = { 'day:2026-11-16': { usd: 3, projects: { other: 3 } } }
  const { w } = await session($, on, earlier)
  w.usd = 0.5
  await turn($)
  w.usd = 1.25
  await turn($)

  const out = await command($, 'spend', '')
  expect(out).toMatch(/2026-11-16 +\$3\.00/)
  expect(out).toMatch(/2026-11-17 +\$1\.25/)
  expect(out).toMatch(/Total: \$4\.25/)
  expect(out).toMatch(/other \$3\.00 · demo \$1\.25/)
})

// Ngôn ngữ đặt cứng áp ngay lúc register: thanh đúng tiếng cả khi session.start chưa chạy
// (vd mod vừa nạp lại giữa phiên). Reviewer tìm ra lệch này khi chia module, 18/11/2026.
test('a fixed language applies before session.start', { options: { language: 'vi' } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  on('session.usage', () => ({ value: { startedAt: T0, context: { percent: 10 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('turn.start', () => ({ turnId: 't' }) as never)
  await turnStart($)
  expect(await text($, /^Lượt$/)).toBeDefined()
})
