// Số liệu phiên (chi phí, context, hạn mức) và cảnh báo theo ngưỡng (D).
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { BUDGET_STEPS, CFG, CONTEXT_REARM, CONTEXT_STEPS, LIMIT_STEPS } from './config'
import { span, usd } from './lib/format'
import { readLimits, sameLimits } from './limits'
import { notifyOs, projectOf } from './notify'
import { FIRED0, LIMITS0, STATS0 } from './state'
import { tr } from './strings'

const fired = atom({ plugin: 'session-band', key: 'fired' } as const, FIRED0)
const limits = atom({ plugin: 'session-band', key: 'limits' } as const, LIMITS0)
const stats = atom({ plugin: 'session-band', key: 'stats' } as const, STATS0)

type RawLimit = { kind: string; percentUsed: number; resetsAt?: string }

/**
 * Engine chỉ cập nhật hạn mức theo phản hồi API của chính phiên, nên phiên đang nghỉ giữ số
 * cũ trong khi phiên khác vẫn tiêu hạn mức (đo 21/11/2026: thanh 47%, máy chủ 49%). Trong
 * cùng một cửa sổ (cùng giờ reset) phần trăm chỉ tăng, nên số lớn nhất mọi phiên từng thấy
 * là số mới nhất: lưu nó vào `$.store` (sống qua các phiên) và hiện số lớn hơn. Cửa sổ mới
 * có giờ reset khác nên số cũ tự bị bỏ qua.
 */
async function newestLimits($: EngineInterface, raw: readonly RawLimit[]): Promise<RawLimit[]> {
  const out: RawLimit[] = []
  for (const r of raw) {
    if (!r.resetsAt) {
      out.push(r)
      continue
    }
    const key = `lim:${r.kind}`
    const seen = (await $.store.get(key).catch(() => undefined)) as RawLimit | undefined
    if (seen?.resetsAt === r.resetsAt && seen.percentUsed > r.percentUsed) {
      out.push({ ...r, percentUsed: seen.percentUsed })
      continue
    }
    if (seen?.resetsAt !== r.resetsAt || seen.percentUsed !== r.percentUsed) {
      await $.store.set(key, { resetsAt: r.resetsAt, percentUsed: r.percentUsed }).catch(() => undefined)
    }
    out.push(r)
  }
  return out
}

/**
 * Đọc lại số liệu phiên, ghi state chỉ khi có thay đổi (mỗi lần ghi là một lần vẽ lại mọi
 * chỗ đọc giá trị đó). Trả về phần chi phí tăng thêm từ lần trước, cho lịch sử.
 */
export async function refresh($: EngineInterface): Promise<number> {
  const { cost, context, rateLimits } = await $.session.usage()
  const total = cost?.usd ?? 0
  const s = await read($, stats)
  const ctx = context.percent ?? s.context

  const next = readLimits(await newestLimits($, rateLimits), await $.clock.now())
  if (!sameLimits(next, await read($, limits))) await update($, limits, () => next)

  const gained = Math.max(0, total - s.total)
  if (s.total === total && s.context === ctx && s.turnCost === total - s.costAtStart) return gained
  await update($, stats, p => ({ ...p, total, turnCost: total - p.costAtStart, context: context.percent ?? p.context }))
  return gained
}

/** Báo một lần cho mỗi khoá: toast, và `loud` thì thêm thông báo hệ thống. */
async function alertOnce($: EngineInterface, key: string, text: string, loud: boolean): Promise<void> {
  if ((await read($, fired)).includes(key)) return
  await update($, fired, list => [...list, key].slice(-100))
  $.ui.toast(`⚠ ${text}`, { timeoutMs: 15000 })
  if (loud) await notifyOs($, text, `session-band-${key.split(':')[0]}`, await projectOf($))
}

/** Xét mọi ngưỡng: context, hạn mức (và dự báo đầy), ngân sách phiên. */
export async function checkThresholds($: EngineInterface): Promise<void> {
  if (!CFG.isAlerting) return
  const t = tr()
  const s = await read($, stats)

  // Context tụt (sau /compact): mở lại các ngưỡng context.
  if (s.context < CONTEXT_REARM && (await read($, fired)).some(k => k.startsWith('ctx:'))) {
    await update($, fired, list => list.filter(k => !k.startsWith('ctx:')))
  }
  for (const step of CONTEXT_STEPS) {
    if (s.context >= step) await alertOnce($, `ctx:${step}`, t.contextHit(s.context), step === CONTEXT_STEPS[1])
  }

  // Khoá theo giờ reset: mỗi cửa sổ báo lại từ đầu.
  const now = await $.clock.now()
  for (const l of await read($, limits)) {
    const name = t.limitName(l.kind)
    const window = l.resetsAt ?? 'none'
    for (const step of LIMIT_STEPS) {
      if (l.percent >= step) {
        const reset = l.resetsAt === null ? '' : span(l.resetsAt - now)
        await alertOnce($, `lim:${l.kind}:${step}:${window}`, t.limitHit(name, l.percent, reset), step === LIMIT_STEPS[1])
      }
    }
    if (l.etaMs !== null) await alertOnce($, `eta:${l.kind}:${window}`, t.limitEta(name, span(l.etaMs)), false)
  }

  if (CFG.budgetUsd !== null) {
    const p = Math.floor((s.total / CFG.budgetUsd) * 100)
    for (const step of BUDGET_STEPS) {
      if (p >= step) await alertOnce($, `bud:${step}`, t.budgetHit(p, usd(s.total), usd(CFG.budgetUsd)), step === BUDGET_STEPS[1])
    }
  }
}
