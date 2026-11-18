// A: hạn mức của gói (5 giờ, 7 ngày, chi tiêu) và dự báo lúc chạm trần.
import type { Limit } from '../types'
import { ETA_MIN_SAMPLE_MS, ETA_ROUND_MS, LIMIT_STEPS } from './config'
import { ALERT, WARN } from './icons'

/** Nhãn ngắn trên thanh. */
export const LIMIT_LABEL: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: '$' }

/**
 * Cửa sổ dài dự báo theo tốc độ trung bình từ lúc cửa sổ mở (giờ reset − độ dài), không
 * theo vài phút gần nhất: một đợt chạy dồn không bị nhân lên thành cả tuần, và đêm hay lúc
 * nghỉ được tính vào. Cửa sổ 5 giờ vẫn dùng tốc độ ngắn hạn vì trong vài giờ người ta
 * thường làm liên tục.
 */
const WINDOW_AVG_MS: Record<string, number> = { seven_day: 7 * 24 * 3_600_000 }

/**
 * Mốc đầu tiên mod thấy của mỗi cửa sổ (theo giờ reset). Biến module: reload thì mất, chỉ
 * phải đo lại từ đầu.
 */
const firstSeen = new Map<string, { resetsAt: number | null; percent: number; at: number }>()

type RawLimit = { kind: string; percentUsed: number; resetsAt?: string }

/** Đổi `rateLimits` của engine thành dữ liệu thanh vẽ, kèm dự báo chạm trần. */
export const readLimits = (raw: readonly RawLimit[], now: number): Limit[] =>
  raw.map(r => {
    const parsed = r.resetsAt ? Date.parse(r.resetsAt) : NaN
    const resetsAt = Number.isFinite(parsed) ? parsed : null
    const prev = firstSeen.get(r.kind)
    // Cửa sổ mới (giờ reset đổi) hoặc phần trăm tụt: đo lại từ đây.
    if (!prev || prev.resetsAt !== resetsAt || r.percentUsed < prev.percent) {
      firstSeen.set(r.kind, { resetsAt, percent: r.percentUsed, at: now })
    }
    const base = firstSeen.get(r.kind)!
    const length = WINDOW_AVG_MS[r.kind]
    const opened = length !== undefined && resetsAt !== null ? resetsAt - length : null
    // Cửa sổ dài: tính từ lúc cửa sổ mở với 0%. Còn lại: từ mốc đầu tiên mod thấy.
    // `opened <= now` phòng khi engine trả giờ reset xa hơn độ dài cửa sổ.
    const fromOpen = opened !== null && opened <= now
    const span = fromOpen ? now - opened : now - base.at
    const gained = fromOpen ? r.percentUsed : r.percentUsed - base.percent

    let etaMs: number | null = null
    if (span >= ETA_MIN_SAMPLE_MS && gained > 0 && r.percentUsed < 100) {
      const eta = ((100 - r.percentUsed) / gained) * span
      const untilReset = resetsAt === null ? Infinity : resetsAt - now
      if (eta < untilReset) etaMs = Math.max(ETA_ROUND_MS, Math.round(eta / ETA_ROUND_MS) * ETA_ROUND_MS)
    }
    return { kind: r.kind, percent: Math.round(r.percentUsed), resetsAt, etaMs }
  })

/** Hai danh sách vẽ ra giống nhau: khỏi ghi state, khỏi vẽ lại. */
export const sameLimits = (a: Limit[], b: Limit[]): boolean =>
  a.length === b.length &&
  a.every((x, i) => x.kind === b[i]!.kind && x.percent === b[i]!.percent && x.etaMs === b[i]!.etaMs && x.resetsAt === b[i]!.resetsAt)

/** Đỏ từ ngưỡng cao; vàng từ ngưỡng thấp hoặc khi có dự báo đầy. */
export const limitColor = (l: Limit): string | undefined =>
  l.percent >= LIMIT_STEPS[1] ? ALERT : l.percent >= LIMIT_STEPS[0] || l.etaMs !== null ? WARN : undefined
