// Tuỳ chọn của mod sau khi đọc và kiểm, cùng các ngưỡng cố định.
//
// Engine đòi mọi hàm nhận `$` khai báo ở cấp đầu tệp, nên các hàm đó không đọc được biến
// trong `register`. Tuỳ chọn vì vậy được ghi vào object CFG này một lần lúc `register`.
import type { Lang } from './lib/lang'

// --- Đo tốc độ (tok/s)
/** Câu trả lời ngắn hơn chừng này token phần lớn là lệnh gọi công cụ: thời gian không có nghĩa. */
export const MIN_TOKENS = 20
/** Câu trả lời đến trong một lần không đo được thời gian: bỏ qua. */
export const MIN_SECONDS = 0.5
export const MAX_SPEED = 1000

// --- D: ngưỡng cảnh báo, mỗi ngưỡng báo một lần
// (context: mỗi lần đầy lại; hạn mức: mỗi cửa sổ; ngân sách: mỗi phiên).
export const CONTEXT_STEPS = [70, 85] as const
export const LIMIT_STEPS = [80, 95] as const
export const BUDGET_STEPS = [75, 100] as const
/** Context tụt dưới mức này (sau /compact) thì các ngưỡng context được báo lại. */
export const CONTEXT_REARM = 50

// --- A: dự báo chạm trần hạn mức
/** Cần quan sát ít nhất chừng này trong một cửa sổ mới dự báo tốc độ đốt. */
export const ETA_MIN_SAMPLE_MS = 10 * 60_000
export const ETA_ROUND_MS = 10 * 60_000

// --- C: số ngày lịch sử chi phí giữ trong store.
export const HISTORY_DAYS = 120

export const CFG = {
  lang: 'en' as Lang,
  /** TTL cache của luồng chính, ms. */
  ttlMs: 60 * 60_000,
  /** Còn chừng này giây thì đếm ngược chuyển vàng / đỏ. */
  warnS: 20 * 60,
  alertS: 10 * 60,
  /** Còn chừng này phút thì báo cache sắp hết, mỗi mốc một lần sau mỗi câu trả lời. */
  notifyMinutes: [10, 5] as readonly number[],
  /** Đếm ngược từng giây (`seconds`) hay chỉ số phút ngoài 10 phút cuối (`minutes`). */
  perSecond: false,
  showLimits: true,
  isAlerting: true,
  budgetUsd: null as number | null,
  /** Lệch múi giờ (giờ) cho ngày của /spend; null là tin đồng hồ của môi trường. */
  offsetH: null as number | null,
}

/** Đọc tuỳ chọn vào CFG. `language: auto` thì dò thêm ở session.start (cần `$`). */
export const applyOptions = (options: Record<string, unknown>): void => {
  // Ngôn ngữ đặt cứng áp ngay, để thanh và lệnh đúng tiếng cả trước khi session.start chạy
  // xong (như bản trước khi chia module).
  CFG.lang = options.language === 'vi' ? 'vi' : 'en'
  // Cache luồng chính: Claude Code trên gói thuê bao ghi loại 1 giờ (đo trên PC1: ~99%
  // token ghi cache của luồng chính là 1h). Dùng API key ghi 5 phút thì chọn 5m.
  const isShort = options.cacheTtl === '5m'
  CFG.ttlMs = (isShort ? 5 : 60) * 60_000
  // 1h như bản gốc: vàng 20', đỏ 10', báo ở 10' và 5'. 5m: vàng 2', đỏ 1', báo ở 1'.
  CFG.warnS = isShort ? 2 * 60 : 20 * 60
  CFG.alertS = isShort ? 60 : 10 * 60
  CFG.notifyMinutes = isShort ? [1] : [10, 5]
  CFG.perSecond = options.countdown === 'seconds' || isShort
  CFG.showLimits = options.limits !== 'off'
  CFG.isAlerting = options.alerts !== 'off'
  const budget = Number(options.budgetUsd)
  CFG.budgetUsd = Number.isFinite(budget) && budget > 0 ? budget : null
  const raw = options.utcOffset
  const offset = Number(raw)
  CFG.offsetH = raw === undefined || raw === '' || raw === 'auto' || !Number.isFinite(offset) ? null : offset
}
