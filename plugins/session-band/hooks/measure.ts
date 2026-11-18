// B: đo token và chi phí của một tác vụ (/token).
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Measure } from '../types'
import { int, span, usd } from './lib/format'
import { MEASURE0 } from './state'
import { tr } from './strings'

const measure = atom({ plugin: 'session-band', key: 'measure' } as const, MEASURE0)

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

/** Cộng usage của một request (luồng chính hay subagent) vào phép đo đang chạy. */
export async function addUsage($: EngineInterface, u: Usage): Promise<void> {
  if ((await read($, measure)) === null) return
  await update($, measure, p =>
    p === null
      ? p
      : {
          ...p,
          calls: p.calls + 1,
          input: p.input + u.input_tokens,
          output: p.output + u.output_tokens,
          cacheRead: p.cacheRead + u.cache_read_input_tokens,
          cacheWrite: p.cacheWrite + u.cache_creation_input_tokens,
        },
  )
}

/** Báo cáo: tiêu đề, 5 số token, USD (chênh lệch sổ chi phí của phiên) và ghi chú. */
const report = (m: Measure, now: number, usdNow: number, isLive: boolean): string => {
  const t = tr()
  return [
    t.measureHead(m.label, span(now - m.startedAt)) + (isLive ? ` (${t.measureLive})` : ''),
    `calls ${int(m.calls)} · input ${int(m.input)} · cache_write ${int(m.cacheWrite)} · cache_read ${int(m.cacheRead)} · output ${int(m.output)}`,
    `USD ${usd(usdNow - m.usdAtStart)}`,
    t.measureNote,
  ].join('\n')
}

/** Lệnh /token: `start [nhãn]`, `stop`, hoặc không đối số để xem số đang chạy. */
export async function tokenCommand($: EngineInterface, args: string): Promise<string> {
  const t = tr()
  const [verb = '', ...rest] = args.trim().split(/\s+/)
  const now = await $.clock.now()
  const usdNow = (await $.session.usage()).cost?.usd ?? 0
  const m = await read($, measure)

  if (verb === 'start') {
    if (m !== null) return t.measureAlready(m.label)
    const label = rest.join(' ').slice(0, 80)
    await update($, measure, () => ({ label, startedAt: now, usdAtStart: usdNow, calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }))
    return t.measureStarted(label)
  }
  if (m === null) return t.measureNone
  if (verb === 'stop') {
    await update($, measure, () => null)
    return report(m, now, usdNow, false)
  }
  return report(m, now, usdNow, true)
}
