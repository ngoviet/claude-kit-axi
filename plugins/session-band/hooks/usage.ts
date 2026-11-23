// Số liệu phiên (chi phí, context, hạn mức) và cảnh báo theo ngưỡng (D).
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { LimitReading } from '../types'

import { BUDGET_STEPS, CFG, CONTEXT_REARM, CONTEXT_STEPS, LIMIT_STEPS } from './config'
import { span, usd } from './lib/format'
import { readLimits, sameLimits } from './limits'
import type { RawLimit } from './limits'
import { notifyOs, projectOf } from './notify'
import { FIRED0, LIMITS0, SEEN0, STATS0 } from './state'
import { tr } from './strings'

const fired = atom({ plugin: 'session-band', key: 'fired' } as const, FIRED0)
const limits = atom({ plugin: 'session-band', key: 'limits' } as const, LIMITS0)
const stats = atom({ plugin: 'session-band', key: 'stats' } as const, STATS0)
const seen = atom({ plugin: 'session-band', key: 'seen' } as const, SEEN0)

/** Một số đọc hạn mức kèm lúc đọc (`at`, ms; 0 khi không biết số đó mới hay cũ). */
type Reading = RawLimit & { at?: number }

/**
 * Engine chỉ cập nhật hạn mức theo phản hồi API của chính phiên, nên phiên đang nghỉ giữ số
 * cũ trong khi phiên khác vẫn tiêu hạn mức (đo 21/11/2026: thanh 47%, máy chủ 49%). Phần trăm
 * lại có thể tụt ngay trong một cửa sổ khi Anthropic đặt lại hạn mức mà không đổi giờ reset
 * (23/11/2026: thanh kẹt 100%, máy chủ 85%), nên "số lớn nhất" không phải "số mới nhất".
 *
 * Vì vậy `$.store` khoá `lim:<kind>` giữ số đọc MỚI NHẤT của mọi phiên kèm lúc đọc, và
 * `seen` nhớ số engine của phiên này lần trước:
 * - Số engine đổi so với lần trước: đó là số máy chủ vừa trả, nên tin nó (kể cả khi thấp hơn)
 *   và ghi vào store.
 * - Số engine không đổi: có thể đã cũ, nên hiện số trong store nếu store được ghi sau lần
 *   engine phiên này đổi số gần nhất, và không ghi đè store.
 * - Lần đầu phiên thấy (vừa mở hoặc vừa nạp lại mod): số cao hơn store thì ghi; thấp hơn thì
 *   hiện số của store, trừ khi store không có lúc đọc (bản cũ lưu số lớn nhất) thì engine thắng.
 * Cửa sổ mới có giờ reset khác nên số cũ tự bị bỏ qua.
 */
async function newestLimits($: EngineInterface, raw: readonly RawLimit[]): Promise<RawLimit[]> {
  const now = await $.clock.now()
  const before = await read($, seen)
  const after: Record<string, LimitReading> = {}
  const out: RawLimit[] = []
  for (const r of raw) {
    if (!r.resetsAt) {
      out.push(r)
      continue
    }
    const key = `lim:${r.kind}`
    const mine = before[r.kind]
    const stored = (await $.store.get(key).catch(() => undefined)) as Reading | undefined
    const same = stored?.resetsAt === r.resetsAt ? stored : undefined
    const isNew = mine !== undefined && (mine.resetsAt !== r.resetsAt || mine.percentUsed !== r.percentUsed)
    const isFirst = mine === undefined
    let show = r.percentUsed
    let at = isNew ? now : (mine?.at ?? 0)
    let write = isNew || !same
    if (!isNew && same) {
      if (isFirst) {
        if (r.percentUsed > same.percentUsed || same.at === undefined) {
          write = true
          at = now
        } else show = same.percentUsed
      } else if ((same.at ?? 0) > at) show = same.percentUsed
    }
    if (write && (same?.percentUsed !== r.percentUsed || same.at === undefined || isNew)) {
      await $.store.set(key, { resetsAt: r.resetsAt, percentUsed: r.percentUsed, at: now }).catch(() => undefined)
      at = now
    }
    after[r.kind] = { resetsAt: r.resetsAt, percentUsed: r.percentUsed, at }
    out.push(show === r.percentUsed ? r : { ...r, percentUsed: show })
  }
  const changed =
    Object.keys(after).length !== Object.keys(before).length ||
    Object.entries(after).some(([k, v]) => {
      const b = before[k]
      return b === undefined || b.resetsAt !== v.resetsAt || b.percentUsed !== v.percentUsed || b.at !== v.at
    })
  if (changed) await update($, seen, () => after)
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

  // Khoá theo giờ reset: mỗi cửa sổ báo lại từ đầu. Hạn mức được đặt lại ngay trong cửa sổ
  // (phần trăm tụt dưới ngưỡng đã báo): mở lại ngưỡng đó, như context sau /compact.
  const now = await $.clock.now()
  const current = await read($, limits)
  const stale = (k: string) => {
    const [prefix, kind, step, window] = k.split(':')
    const l = current.find(x => x.kind === kind && String(x.resetsAt ?? 'none') === window)
    return prefix === 'lim' && l !== undefined && l.percent < Number(step)
  }
  if ((await read($, fired)).some(stale)) await update($, fired, list => list.filter(k => !stale(k)))
  for (const l of current) {
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
