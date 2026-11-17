import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'savvy-progress'
const pane = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

// One worker on `model`, known to the panel before any usage arrives; `request` is
// what each of its model requests reports.
const worker = async ($: Engine, on: On, model: string, request?: Usage) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.spawn', () => ({ model, agentId: 'a1' }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: request ? { model, ...request } : null } as never
  })
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Priced work', subagentType: 'general-purpose', provider: 'engine', parentModel: model, background: false, fork: false } as never)
}

// One model request of the worker, as `turn.step` reports it.
const step = async ($: Engine, model: string) => {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model, messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) void _
}

const shows = async ($: Engine, text: RegExp) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: pane })
  return ui.find({ type: 'Text', text })
}

// List prices in USD per million tokens (skill claude-api, 17/11/2026), cache writes at
// the 5-minute rate (1.25 × input), which is what subagents write: a turn of 1M input,
// 1M output, 2M cache read and 1M cache write costs input + output + 2 × read + 1.25 × input.
const TURN: Usage = { input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 2e6, cache_creation_input_tokens: 1e6 }
const PRICED: readonly (readonly [model: string, shown: string])[] = [
  ['claude-fable-5-2', '$58.4'], // 8 + 40 + 2 × 0.20 + 10 (bản gốc: giá Fable 5 → $82.0)
  ['claude-mythos-5-2', '$58.4'],
  ['claude-fable-5-1', '$73.0'], // 10 + 50 + 2 × 0.25 + 12.5
  ['claude-fable-5', '$74.5'], // 10 + 50 + 2 × 1 + 12.5
  ['claude-opus-5-5', '$29.4'], // 4 + 20 + 2 × 0.20 + 5
  ['claude-opus-5', '$37.3'], // 5 + 25 + 2 × 0.50 + 6.25
  ['claude-opus-4-8', '$37.3'],
  ['claude-sonnet-5-5', '$14.7'], // 2 + 10 + 2 × 0.10 + 2.5
  ['claude-sonnet-5', '$14.9'], // 2 + 10 + 2 × 0.20 + 2.5
  ['claude-sonnet-4-6', '$22.4'], // 3 + 15 + 2 × 0.30 + 3.75
  ['claude-haiku-5-5', '$0.74'], // 0.10 + 0.50 + 2 × 0.01 + 0.125
  ['claude-haiku-4-5', '$7.45'], // 1 + 5 + 2 × 0.10 + 1.25
]

for (const [model, shown] of PRICED) {
  test(`cost: a turn on ${model} shows ≈${shown}`, async ($, on) => {
    await worker($, on, model)
    await ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId: 'a1', reason: 'answer', answer: 'ok', usage: { model, ...TURN } })

    expect(await shows($, new RegExp(`≈\\${shown} `))).toBeDefined()
  })
}

// Tuỳ chọn 1h trả lại cách tính của bản gốc (ghi cache 2 × input).
test('cost: subagentCacheTtl 1h prices cache writes at 2x input, as the original', { options: { subagentCacheTtl: '1h' } }, async ($, on) => {
  await worker($, on, 'claude-opus-5-5')
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId: 'a1', reason: 'answer', answer: 'ok', usage: { model: 'claude-opus-5-5', ...TURN } })
  expect(await shows($, /≈\$32\.4 /)).toBeDefined() // 4 + 20 + 0.4 + 8
})

// Haiku 5.5 is priced by prompt length, per request: 120K of prompt is over the 100K line.
const LONG: Usage = { input_tokens: 20_000, output_tokens: 10_000, cache_read_input_tokens: 50_000, cache_creation_input_tokens: 50_000 }

test('cost: a Haiku 5.5 request over 100K prompt tokens pays the long-prompt prices', async ($, on) => {
  await worker($, on, 'claude-haiku-5-5', LONG)
  await step($, 'claude-haiku-5-5')
  // (20K × 0.50 + 10K × 2.50 + 50K × 0.05 + 50K × 0.625) / 1M = 0.06875; at the short-prompt prices it is ~0.014.
  expect(await shows($, /≈\$0\.07 /)).toBeDefined()
})

test('cost: Haiku 4.5 has one price whatever the prompt length', async ($, on) => {
  await worker($, on, 'claude-haiku-4-5', LONG)
  await step($, 'claude-haiku-4-5')
  // (20K × 1 + 10K × 5 + 50K × 0.10 + 50K × 1.25) / 1M = 0.1375
  expect(await shows($, /≈\$0\.14 /)).toBeDefined()
})

// The context bar: 130K tokens are 13% of Haiku 5.5's 1M window and 65% of Haiku 4.5's 200K.
for (const [model, percent] of [['claude-haiku-5-5', 13], ['claude-haiku-4-5', 65]] as const) {
  test(`context: ${model} fills to ${percent}% at 130K tokens`, async ($, on) => {
    await worker($, on, model, LONG)
    await step($, model)
    expect(await shows($, new RegExp(`ctx ${percent}%`))).toBeDefined()
  })
}
