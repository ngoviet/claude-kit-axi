// Sổ các subagent của phiên: ghi khi agent bắt đầu, sau mỗi request và khi xong.
import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { AgentRun } from '../types'
import { costOf, modelName, totalTokens, windowOf } from './pricing'
import type { Usage } from './pricing'
import { AGENTS0 } from './state'
import { effortWord } from './strings'

const agents = atom({ plugin: 'agents-panel', key: 'agents' } as const, AGENTS0)
const now = atom({ plugin: 'agents-panel', key: 'now' } as const, 0)

/** Giữ tối đa chừng này agent trong sổ. */
const MAX_RUNS = 200

/** So khớp mô tả bỏ hoa thường và dấu câu, để đếm lần chạy lại cùng một việc. */
const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** "Opus 5.5 · low", hoặc chỉ tên model khi chưa thấy effort. */
export const runModel = (a: AgentRun): string => (a.effort ? `${modelName(a.model)} · ${effortWord(a.effort)}` : modelName(a.model))

/** Thời gian đã chạy tính tới `at` (hoặc tới lúc xong). */
export const elapsed = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

/** Phần trăm context agent đang dùng. */
export const ctxOf = (a: AgentRun): number => (a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0)

/** Thanh tiến độ: đầy khi xong; null khi đang chạy (thanh hiện context, màu xám). */
export const progressOf = (a: AgentRun): number | null => (a.status === 'done' ? 1 : null)

/** Tổng chi phí, token và thời gian từ agent đầu tiên bắt đầu tới agent cuối cùng xong. */
export const totals = (list: AgentRun[], at: number) => ({
  cost: list.reduce((s, a) => s + a.costUsd, 0),
  tokens: list.reduce((s, a) => s + a.tokens, 0),
  time: list.length
    ? Math.max(...list.map(a => a.endedAt ?? Math.max(at, a.startedAt))) - Math.min(...list.map(a => a.startedAt))
    : 0,
})

/** Mốc giờ vẽ khung = bây giờ. */
export async function tick($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, now, () => at)
}

/** Một agent vừa được tạo. */
export async function recordSpawn(
  $: EngineInterface,
  spawn: { agentId?: string; toolUseId: string; type: string; description: string; model: string },
): Promise<void> {
  const at = await $.clock.now()
  await update($, agents, list => {
    const round = 1 + list.filter(a => spawn.description && norm(a.description) === norm(spawn.description)).length
    const run: AgentRun = {
      id: spawn.agentId ?? spawn.toolUseId,
      agentId: spawn.agentId,
      toolUseId: spawn.toolUseId,
      type: spawn.type,
      description: spawn.description,
      model: spawn.model,
      status: 'running',
      startedAt: at,
      contextTokens: 0,
      contextMax: windowOf(spawn.model),
      tokens: 0,
      costUsd: 0,
      steps: 0,
      round,
    }
    return [...list.filter(a => a.id !== run.id), run].slice(-MAX_RUNS)
  })
  await update($, now, () => at)
}

/** Một request model của agent: context hiện tại, token và chi phí cộng dồn. */
export async function recordRequest($: EngineInterface, agentId: string, model: string, effort: string | undefined, usage: Usage): Promise<void> {
  await update($, agents, list =>
    list.map((a): AgentRun =>
      a.agentId !== agentId
        ? a
        : {
            ...a,
            model,
            effort: effort ?? a.effort,
            status: 'running',
            endedAt: undefined,
            contextTokens: totalTokens(usage),
            contextMax: windowOf(model),
            tokens: a.tokens + totalTokens(usage),
            costUsd: a.costUsd + costOf(model, usage, true),
            steps: a.steps + 1,
          },
    ),
  )
}

/** Agent xong (hoặc lỗi). Agent chưa thấy request nào thì lấy tổng usage của cả lượt. */
export async function recordEnd($: EngineInterface, agentId: string, isAnswer: boolean, usage: (Usage & { model?: string }) | null): Promise<void> {
  const at = await $.clock.now()
  await update($, agents, list =>
    list.map((a): AgentRun => {
      if (a.agentId !== agentId) return a
      const ended: AgentRun = { ...a, status: isAnswer ? 'done' : 'failed', endedAt: at }
      if (a.steps > 0 || usage === null) return ended
      const model = usage.model || a.model
      return { ...ended, model, tokens: totalTokens(usage), costUsd: costOf(model, usage, false) }
    }),
  )
  await update($, now, () => at)
}
