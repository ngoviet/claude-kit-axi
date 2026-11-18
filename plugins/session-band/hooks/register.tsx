// session-band (bản axi), dựa trên johnnyvizz/claude-kit plugins/session-band 0.2.0, MIT.
// Thay đổi so với bản gốc: docs/thay-doi.md.
//
// Tệp này chỉ nối các hook; mỗi phần nằm ở module riêng:
//   config.ts   tuỳ chọn và ngưỡng        state.ts    giá trị trong $.state
//   strings.ts  chữ hiển thị (en, vi)     icons.ts    màu và hình SVG
//   cache.ts    đếm ngược hạn cache        limits.ts   A: hạn mức gói
//   measure.ts  B: /token                  history.ts  C: /spend
//   usage.ts    số liệu phiên, D: ngưỡng   notify.ts   E: thông báo
//   band.tsx    vẽ thanh                   lib/        mã chép từ shared/
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { drawBand, lastDrawn, tierFor } from './band'
import { restartCache, shownLeft, tickCache, turnRun } from './cache'
import { CFG, HISTORY_DAYS, MAX_SPEED, MIN_SECONDS, MIN_TOKENS, applyOptions } from './config'
import { flushHistory, historyText, pending } from './history'
import { detectLang } from './lib/lang'
import { addUsage, tokenCommand } from './measure'
import { CACHE0, STATS0 } from './state'
import { LANGS, tr } from './strings'
import { checkThresholds, refresh } from './usage'

const cache = atom({ plugin: 'session-band', key: 'cache' } as const, CACHE0)
const isBusy = atom({ plugin: 'session-band', key: 'isBusy' } as const, false)
const isHidden = atom({ plugin: 'session-band', key: 'isHidden' } as const, false)
const stats = atom({ plugin: 'session-band', key: 'stats' } as const, STATS0)
const warned = atom({ plugin: 'session-band', key: 'warned' } as const, 0)

export const register: Register = (on, options) => {
  applyOptions(options)

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    CFG.lang = await detectLang($, options.language, LANGS)

    await $.command.register({
      name: 'session_data',
      description: 'Show or hide the session band; `demo <minutes>` previews the cache warning',
    })
    await $.command.register({
      name: 'token',
      description: 'Measure a task: `start [label]`, `stop`, or no argument for the running count',
    })
    await $.command.register({
      name: 'spend',
      description: 'Cost per day and per project: `/spend [days]` (default 7)',
    })
    $.clock.every(1000, async () => {
      await tickCache($)
    })
    return result
  })

  on('session.end', async ($, e, next) => {
    await flushHistory($).catch(() => undefined)
    return next(e)
  })

  // --- Lệnh

  on('command.run', { command: 'session_data' }, async ($, e) => {
    const t = tr()
    // `/session_data demo <phút>` giả hạn cache để xem trước cảnh báo; câu trả lời kế tiếp đặt lại.
    const demo = e.args.trim().match(/^demo\s+(\d+(?:\.\d+)?)$/)
    if (demo) {
      const seconds = Math.round(Number(demo[1]) * 60)
      const now = await $.clock.now()
      await update($, cache, () => ({ expiresAt: now + seconds * 1000, secondsLeft: shownLeft(seconds) }))
      await update($, warned, () => 0)
      await update($, isHidden, () => false)
      return { text: t.demo(demo[1] ?? '') }
    }
    if (e.args.trim() === 'width') {
      const columns = lastDrawn.columns
      return { text: columns === null ? t.noBand : t.width(columns, tierFor(columns)) }
    }
    const hidden = !(await read($, isHidden))
    await update($, isHidden, () => hidden)
    return { text: hidden ? t.hidden : t.shown }
  })

  on('command.run', { command: 'token' }, async ($, e) => ({ text: await tokenCommand($, e.args) }))

  on('command.run', { command: 'spend' }, async ($, e) => {
    await flushHistory($)
    const days = Math.min(HISTORY_DAYS, Math.max(1, Math.floor(Number(e.args.trim()) || 7)))
    return { text: await historyText($, days) }
  })

  // --- Lượt

  on('turn.start', async ($, e, next) => {
    // Lượt của subagent cũng phát turn.start: chỉ đếm lượt của luồng chính, nếu không số
    // lượt tăng theo subagent và chi phí lượt bị đặt lại giữa chừng.
    if (e.agentId !== undefined) return next(e)
    const total = (await $.session.usage()).cost?.usd ?? 0
    const s = await read($, stats)
    pending.usd += Math.max(0, total - s.total)
    await update($, stats, p => ({ ...p, turn: p.turn + 1, costAtStart: total, total, turnCost: 0 }))
    await update($, isBusy, () => true)
    turnRun.hasRequested = false
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      const result = yield* next(e)
      if (result.usage) await addUsage($, result.usage)
      return result
    }

    turnRun.lastRequestAt = await $.clock.now()
    turnRun.hasRequested = true
    // Đo từ phần tử đầu của câu trả lời (message_start): bỏ thời gian chờ token đầu, nhưng
    // phần suy nghĩ ẩn hoặc đến dồn cuối vẫn được tính vì output_tokens có đếm nó.
    let startedAt: number | null = null

    // Lặp tay thay vì `for await`: `usage` nằm ở giá trị trả về của generator, mà
    // `for await` làm mất giá trị đó.
    const it = next(e)[Symbol.asyncIterator]()
    let item = await it.next()
    while (!item.done) {
      const chunk = item.value
      if (startedAt === null) startedAt = await $.clock.now()
      if (chunk.kind === 'stop' && chunk.usage !== null) {
        const tokens = chunk.usage.output_tokens
        const seconds = ((await $.clock.now()) - startedAt) / 1000
        const speed = tokens / seconds
        if (tokens >= MIN_TOKENS && seconds >= MIN_SECONDS && speed <= MAX_SPEED) {
          const rounded = Math.round(speed)
          await update($, stats, s => (s.speed === rounded ? s : { ...s, speed: rounded }))
        }
      }
      yield chunk
      item = await it.next()
    }
    const result = item.value

    if (result?.usage) await addUsage($, result.usage)
    pending.usd += await refresh($)
    await checkThresholds($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    pending.usd += await refresh($)
    if (e.agentId === undefined) {
      await update($, isBusy, () => false)
      // Lượt bị huỷ trước request đầu giữ hạn cache cũ và không đặt lại `warned`, để
      // thông báo vừa bắn không lặp lại.
      if (turnRun.hasRequested) await restartCache($)
      await checkThresholds($)
      await flushHistory($).catch(() => undefined)
    }
    return result
  })

  // --- Vẽ

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => drawBand($, e, next))
}
