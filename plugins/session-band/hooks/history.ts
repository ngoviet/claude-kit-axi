// C: lịch sử chi phí theo ngày và dự án trong $.store (sống qua các phiên).
import type { EngineInterface } from 'claude-code'

import { CFG, HISTORY_DAYS } from './config'
import { usd } from './lib/format'
import { projectOf } from './notify'
import { tr } from './strings'

type Day = { usd: number; projects: Record<string, number> }

/** Chi phí chưa ghi xuống store; ghi khi lượt chính xong và khi phiên kết thúc. */
export const pending = { usd: 0 }

/**
 * Khoá ngày theo giờ địa phương: `day:YYYY-MM-DD`. Môi trường của mod có thể chạy giờ UTC,
 * nên tuỳ chọn `utcOffset` cho lệch múi giờ; `auto` thì tin Date của môi trường.
 */
const dayKey = (now: number): string => {
  const shifted = CFG.offsetH === null ? now - new Date(now).getTimezoneOffset() * 60_000 : now + CFG.offsetH * 3_600_000
  return `day:${new Date(shifted).toISOString().slice(0, 10)}`
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000

/** Ghi phần chi phí đang chờ vào ngày hôm nay, rồi bỏ các ngày cũ hơn HISTORY_DAYS. */
export async function flushHistory($: EngineInterface): Promise<void> {
  if (pending.usd <= 0) return
  const amount = pending.usd
  pending.usd = 0
  const key = dayKey(await $.clock.now())
  const project = await projectOf($)
  const day = ((await $.store.get(key)) as Day | undefined) ?? { usd: 0, projects: {} }
  day.usd = round4(day.usd + amount)
  day.projects[project] = round4((day.projects[project] ?? 0) + amount)
  await $.store.set(key, day)

  const days = (await $.store.keys()).filter(k => k.startsWith('day:')).sort()
  for (const old of days.slice(0, Math.max(0, days.length - HISTORY_DAYS))) await $.store.delete(old)
}

/** Bảng của /spend: mỗi ngày một dòng có cột, tổng và 5 dự án tốn nhất. */
export async function historyText($: EngineInterface, n: number): Promise<string> {
  const t = tr()
  const now = await $.clock.now()
  const rows: [string, Day][] = []
  for (let i = n - 1; i >= 0; i--) {
    const key = dayKey(now - i * 86_400_000)
    const day = (await $.store.get(key)) as Day | undefined
    if (day) rows.push([key.slice(4), day])
  }
  if (rows.length === 0) return t.historyEmpty

  const total = rows.reduce((s, [, d]) => s + d.usd, 0)
  const byProject = new Map<string, number>()
  for (const [, d] of rows) for (const [p, v] of Object.entries(d.projects)) byProject.set(p, (byProject.get(p) ?? 0) + v)
  const top = [...byProject].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const peak = Math.max(...rows.map(([, d]) => d.usd))
  const bar = (v: number) => '█'.repeat(Math.max(1, Math.round((v / peak) * 20)))

  return [
    t.historyHead(n),
    ...rows.map(([date, d]) => `${date}  ${usd(d.usd).padStart(9)}  ${bar(d.usd)}`),
    `${t.historyTotal}: ${usd(total)}`,
    `${t.historyTop}: ${top.map(([p, v]) => `${p} ${usd(v)}`).join(' · ')}`,
  ].join('\n')
}
