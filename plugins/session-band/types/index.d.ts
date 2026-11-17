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

/** One rate-limit window of the plan, as the band draws it. */
export type Limit = {
  /** `five_hour`, `seven_day`, `spend_limit`. */
  kind: string
  /** 0..100, rounded to a whole percent. */
  percent: number
  /** When the window resets, ms since epoch; null when the engine did not say. */
  resetsAt: number | null
  /** Time until the window fills at the current pace, rounded to 10 minutes; null when it will not fill before the reset. */
  etaMs: number | null
}

/** A `/token start` measurement in progress. */
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
      measure: Measure | null
    }
  }
}
