export type Stats = {
  turn: number
  speed: number | null
  turnCost: number | null
  total: number
  context: number
  costAtStart: number
}

export type Cache = {
  expiresAt: number | null
  secondsLeft: number | null
}

/** Một cửa sổ hạn mức của gói, như thanh vẽ ra. */
export type Limit = {
  /** `five_hour`, `seven_day`, `spend_limit`. */
  kind: string
  /** 0..100, làm tròn tới phần trăm nguyên. */
  percent: number
  /** Lúc cửa sổ reset, ms tính từ epoch; null khi engine không báo. */
  resetsAt: number | null
  /** Thời gian tới lúc cửa sổ đầy theo tốc độ hiện tại, làm tròn 10 phút; null khi nó không đầy trước giờ reset. */
  etaMs: number | null
}

/** Số hạn mức engine của phiên đã trả, và lúc nó đổi lần cuối (ms; 0 khi chưa biết). */
export type LimitReading = {
  resetsAt: string
  percentUsed: number
  at: number
}

/** Một phép đo `/token start` đang chạy. */
export type Measure = {
  label: string
  startedAt: number
  usdAtStart: number
  calls: number
  input: number
  cacheWrite: number
  cacheRead: number
  output: number
}

declare module 'claude-code' {
  interface PluginState {
    'session-band': {
      stats: Stats
      cache: Cache
      isHidden: boolean
      isBusy: boolean
      warned: number
      limits: Limit[]
      fired: string[]
      seen: Record<string, LimitReading>
      measure: Measure | null
    }
  }
}
