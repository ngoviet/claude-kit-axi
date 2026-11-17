// session-band (bản axi) — dựa trên johnnyvizz/claude-kit plugins/session-band 0.2.0, MIT.
// Thay đổi so với bản gốc: xem docs/thay-doi.md.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cache, Limit, Measure, Stats } from '../types'

// Responses shorter than this are mostly tool-call stubs: their timing is noise.
const MIN_TOKENS = 20
// A response that arrived in one burst cannot be timed; such readings are dropped.
const MIN_SECONDS = 0.5
const MAX_SPEED = 1000

// Ngưỡng theo TTL, đặt lại trong register: 1h như bản gốc (vàng 20', đỏ 10', báo ở 10' và
// 5'); 5m thì vàng 2', đỏ 1', báo ở 1' — ngưỡng của 1h đều >= 5 phút nên sẽ báo ngay.
let CACHE_WARN_S = 20 * 60
let CACHE_ALERT_S = 10 * 60
// Minutes left at which the cache expiry is announced, once each per answer.
let CACHE_NOTIFY_MINUTES: readonly number[] = [10, 5]

// D: ngưỡng cảnh báo, mỗi ngưỡng báo một lần (context: mỗi lần đầy lại; hạn mức: mỗi cửa
// sổ; ngân sách: mỗi phiên).
const CONTEXT_STEPS = [70, 85] as const
const LIMIT_STEPS = [80, 95] as const
const BUDGET_STEPS = [75, 100] as const
// Context tụt dưới mức này (sau /compact): các ngưỡng context được báo lại lần sau.
const CONTEXT_REARM = 50
// A: cần ít nhất chừng này thời gian quan sát trong một cửa sổ mới dự báo tốc độ đốt.
const ETA_MIN_SAMPLE_MS = 10 * 60_000
const ETA_ROUND_MS = 10 * 60_000
// C: số ngày lịch sử giữ trong store.
const HISTORY_DAYS = 120

const SPEED = '#8b8cf8'
const MONEY = '#4caf6e'
const MUTED = '#8a8f8c'
const CONTEXT = '#5fa8d3'
const CACHE = '#4fb3a9'
const WARN = '#e2a94e'
const ALERT = '#e0846b'

// ---------------------------------------------------------------------------
// Chữ hiển thị: tiếng Anh như bản gốc, thêm tiếng Việt.

const dur = (ms: number): string => {
  const m = Math.max(0, Math.round(ms / 60_000))
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ''}`
}

const STRINGS = {
  en: {
    turn: 'Turn',
    expired: 'expired',
    cacheIn: (m: number) => `Prompt cache expires in ${m} min`,
    hidden: 'Session band hidden.',
    shown: 'Session band shown.',
    demo: (m: string) => `Cache demo: ${m} min left until the next answer resets it.`,
    noBand: 'Band not drawn yet.',
    width: (c: number, t: number) => `Band: ${c} columns, tier ${t}.`,
    limitName: (k: string) => (k === 'five_hour' ? '5-hour limit' : k === 'seven_day' ? 'weekly limit' : 'spend limit'),
    limitHit: (name: string, p: number, reset: string) => `${name} at ${p}%${reset ? `, resets in ${reset}` : ''}`,
    limitEta: (name: string, eta: string) => `At this pace the ${name} fills in ~${eta}, before it resets`,
    contextHit: (p: number) => `Context ${p}% full: consider /compact or a fresh session`,
    budgetHit: (p: number, spent: string, budget: string) => `Session cost ${spent} is ${p}% of the ${budget} budget`,
    measureStarted: (label: string) => `Measuring${label ? ` "${label}"` : ''}. Run /token stop when the task is done.`,
    measureAlready: (label: string) => `Already measuring${label ? ` "${label}"` : ''}; /token stop first.`,
    measureNone: 'Nothing is being measured. Start with /token start [label].',
    measureHead: (label: string, d: string) => `Task${label ? ` "${label}"` : ''} · ${d}`,
    measureLive: 'still running; /token stop ends it',
    measureNote: 'Tokens cover every model request of this session in the window, subagents included; USD is the session cost ledger (/cost), API list prices.',
    historyEmpty: 'No cost recorded yet.',
    historyHead: (n: number) => `Cost, last ${n} days`,
    historyTotal: 'Total',
    historyTop: 'Top projects',
  },
  vi: {
    turn: 'Lượt',
    expired: 'hết hạn',
    cacheIn: (m: number) => `Cache prompt hết hạn sau ${m} phút`,
    hidden: 'Đã ẩn thanh phiên.',
    shown: 'Đã hiện thanh phiên.',
    demo: (m: string) => `Thử cache: còn ${m} phút, câu trả lời kế tiếp sẽ đặt lại.`,
    noBand: 'Thanh chưa được vẽ.',
    width: (c: number, t: number) => `Thanh: ${c} cột, mức ${t}.`,
    limitName: (k: string) => (k === 'five_hour' ? 'hạn mức 5 giờ' : k === 'seven_day' ? 'hạn mức tuần' : 'hạn mức chi tiêu'),
    limitHit: (name: string, p: number, reset: string) => `Đã dùng ${p}% ${name}${reset ? `, reset sau ${reset}` : ''}`,
    limitEta: (name: string, eta: string) => `Theo tốc độ hiện tại, ${name} sẽ đầy sau ~${eta}, trước giờ reset`,
    contextHit: (p: number) => `Context đã đầy ${p}%: nên /compact hoặc mở phiên mới`,
    budgetHit: (p: number, spent: string, budget: string) => `Chi phí phiên ${spent}, bằng ${p}% ngân sách ${budget}`,
    measureStarted: (label: string) => `Bắt đầu đo${label ? ` "${label}"` : ''}. Xong việc thì chạy /token stop.`,
    measureAlready: (label: string) => `Đang đo${label ? ` "${label}"` : ''} rồi; chạy /token stop trước.`,
    measureNone: 'Chưa đo gì. Bắt đầu bằng /token start [nhãn].',
    measureHead: (label: string, d: string) => `Tác vụ${label ? ` "${label}"` : ''} · ${d}`,
    measureLive: 'đang đo; /token stop để kết thúc',
    measureNote: 'Token gồm mọi request model của phiên trong khung giờ, kể cả subagent; USD lấy từ sổ chi phí của phiên (/cost), giá API niêm yết.',
    historyEmpty: 'Chưa ghi nhận chi phí nào.',
    historyHead: (n: number) => `Chi phí ${n} ngày gần nhất`,
    historyTotal: 'Tổng',
    historyTop: 'Dự án tốn nhiều nhất',
  },
} as const
type Lang = keyof typeof STRINGS

const stats = atom({ plugin: 'session-band', key: 'stats' } as const, {
  turn: 0,
  speed: null,
  turnCost: null,
  total: 0,
  context: 0,
  costAtStart: 0,
} as Stats)

const cache = atom({ plugin: 'session-band', key: 'cache' } as const, {
  expiresAt: null,
  secondsLeft: null,
} as Cache)

// Closed with ×: stays hidden for the rest of the session.
const isHidden = atom({ plugin: 'session-band', key: 'isHidden' } as const, false)

// A turn is running: the cache stays warm, so no countdown warnings.
const isBusy = atom({ plugin: 'session-band', key: 'isBusy' } as const, false)

// The smallest CACHE_NOTIFY_MINUTES already announced since the last answer; 0 none.
const warned = atom({ plugin: 'session-band', key: 'warned' } as const, 0)

// A: các cửa sổ hạn mức của gói, chỉ ghi khi chữ hiển thị đổi.
const limits = atom({ plugin: 'session-band', key: 'limits' } as const, [] as Limit[])

// D: khoá các ngưỡng đã báo. Không ai đọc khi vẽ, nên ghi không làm thanh vẽ lại.
const fired = atom({ plugin: 'session-band', key: 'fired' } as const, [] as string[])

// B: phép đo đang chạy của /token.
const measure = atom({ plugin: 'session-band', key: 'measure' } as const, null as Measure | null)

// --- Hình vẽ: chuỗi SVG cố định dựng một lần; hình phụ thuộc số được nhớ theo số.

const ring = (color: string, glyph: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="2"/>${glyph}</svg>`

const SPEED_ICON = ring(
  SPEED,
  `<path d="M6.5 15a6 6 0 0 1 11 0" fill="none" stroke="${SPEED}" stroke-width="1.8" stroke-linecap="round"/><path d="M12 15l3-4" stroke="${SPEED}" stroke-width="1.8" stroke-linecap="round"/>`,
)

const MONEY_ICON = ring(
  MONEY,
  `<text x="12" y="16.5" text-anchor="middle" font-family="-apple-system,'Segoe UI',sans-serif" font-size="13" font-weight="600" fill="${MONEY}">$</text>`,
)

// An hourglass: the prompt cache running out. Three colors only, so built up front.
const CACHE_ICON: Record<string, string> = Object.fromEntries(
  [CACHE, WARN, ALERT].map(color => [
    color,
    ring(
      color,
      `<g fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M8.5 6.5h7M8.5 17.5h7"/><path d="M9.5 6.5c0 3 5 3.5 5 5.5s-5 2.5-5 5.5M14.5 6.5c0 3-5 3.5-5 5.5s5 2.5 5 5.5"/></g>`,
    ),
  ]),
)

// Memo theo phần trăm nguyên (0..100): tối đa 101 chuỗi mỗi loại.
const memo = <T,>(build: (n: number) => T) => {
  const seen = new Map<number, T>()
  return (n: number): T => {
    const key = Math.max(0, Math.min(100, Math.round(n)))
    let v = seen.get(key)
    if (v === undefined) seen.set(key, (v = build(key)))
    return v
  }
}

// The ring itself fills with the context, around a page of lines.
const contextIcon = memo(percent => {
  const c = 2 * Math.PI * 10
  const filled = (percent / 100) * c
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="none" stroke="${MUTED}" stroke-opacity="0.35" stroke-width="2"/><circle cx="12" cy="12" r="10" fill="none" stroke="${CONTEXT}" stroke-width="2" stroke-linecap="round" stroke-dasharray="${filled.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 12 12)"/><path d="M8.5 9h7M8.5 12h7M8.5 15h4.5" stroke="${CONTEXT}" stroke-width="1.6" stroke-linecap="round"/></svg>`
})

const contextBar = memo(percent => {
  const color = percent >= 85 ? ALERT : percent >= 65 ? WARN : MONEY
  const w = Math.round((percent / 100) * 80)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 6" width="80" height="6"><rect width="80" height="6" rx="3" fill="${MUTED}" fill-opacity="0.3"/><rect width="${w}" height="6" rx="3" fill="${color}"/></svg>`
})

function pad(n: number) {
  return String(n).padStart(2, '0')
}
const usd = (n: number) => `$${n.toFixed(2)}`

// Density by the band's width in cells, so the row shrinks instead of wrapping:
// 0 full; 1 no context bar; 2 compact turn/speed; 3 turn cost only, smaller icons;
// 4 no speed. Thresholds are minimum bodyColumns for each tier.
const TIER_MIN = [78, 64, 52, 40] as const
const GAPS = [3, 2, 2, 1, 1] as const
const tierFor = (columns: number) => {
  const i = TIER_MIN.findIndex(min => columns >= min)
  return i === -1 ? TIER_MIN.length : i
}
// A: cột thêm cần cho hạn mức; thiếu thì bỏ hạn mức trước khi hạ mức thanh.
const LIMIT_COLUMNS = 12

// Last measured width, for `/session_data width` while tuning TIER_MIN; debug only.
let lastColumns: number | null = null

// Giây còn lại được ghi vào state chỉ khi chữ hiển thị đổi: ngoài 10 phút cuối, chế độ
// `minutes` chỉ hiện số phút, nên thanh vẽ lại ~1 lần/phút thay vì 1 lần/giây.
const shownLeft = (left: number, perSecond: boolean): number =>
  perSecond || left <= CACHE_ALERT_S ? left : Math.ceil(left / 60) * 60

const cacheText = (left: number, perSecond: boolean, expired: string): string =>
  left === 0 ? expired
  : perSecond || left <= CACHE_ALERT_S ? `${pad(Math.floor(left / 60))}:${pad(left % 60)}`
  : `${Math.ceil(left / 60)}m`

// ---------------------------------------------------------------------------
// A: hạn mức gói và dự báo chạm trần.

const LIMIT_LABEL: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: '$' }

// Mốc đầu tiên thấy được của mỗi cửa sổ (theo giờ reset): tốc độ đốt = phần trăm tăng
// thêm chia thời gian đã trôi. Biến module: mất khi reload thì chỉ đo lại từ đầu.
const firstSeen = new Map<string, { resetsAt: number | null; percent: number; at: number }>()

const readLimits = (raw: readonly { kind: string; percentUsed: number; resetsAt?: string }[], now: number): Limit[] =>
  raw.map(r => {
    const parsed = r.resetsAt ? Date.parse(r.resetsAt) : NaN
    const resetsAt = Number.isFinite(parsed) ? parsed : null
    const base = firstSeen.get(r.kind)
    if (!base || base.resetsAt !== resetsAt || r.percentUsed < base.percent) {
      firstSeen.set(r.kind, { resetsAt, percent: r.percentUsed, at: now })
    }
    const b = firstSeen.get(r.kind)!
    let etaMs: number | null = null
    const span = now - b.at
    const gained = r.percentUsed - b.percent
    if (span >= ETA_MIN_SAMPLE_MS && gained > 0 && r.percentUsed < 100) {
      const eta = ((100 - r.percentUsed) / gained) * span
      const untilReset = resetsAt === null ? Infinity : resetsAt - now
      if (eta < untilReset) etaMs = Math.max(ETA_ROUND_MS, Math.round(eta / ETA_ROUND_MS) * ETA_ROUND_MS)
    }
    return { kind: r.kind, percent: Math.round(r.percentUsed), resetsAt, etaMs }
  })

const sameLimits = (a: Limit[], b: Limit[]) =>
  a.length === b.length &&
  a.every((x, i) => x.kind === b[i]!.kind && x.percent === b[i]!.percent && x.etaMs === b[i]!.etaMs && x.resetsAt === b[i]!.resetsAt)

const limitColor = (l: Limit) => (l.percent >= LIMIT_STEPS[1] ? ALERT : l.percent >= LIMIT_STEPS[0] || l.etaMs !== null ? WARN : undefined)

// ---------------------------------------------------------------------------
// C: lịch sử chi phí theo ngày/dự án trong $.store (sống qua các phiên).

type Day = { usd: number; projects: Record<string, number> }

// Ngày theo giờ địa phương. Môi trường của mod có thể chạy giờ UTC, nên lệch múi giờ
// lấy từ tuỳ chọn `utcOffset` (giờ), `auto` thì tin Date của môi trường.
const dayKey = (now: number, offsetH: number | null): string => {
  const shifted = offsetH === null ? now - new Date(now).getTimezoneOffset() * 60_000 : now + offsetH * 3_600_000
  return `day:${new Date(shifted).toISOString().slice(0, 10)}`
}

const projectOf = async ($: EngineInterface) =>
  (await $.session.cwd()).split(/[\\/]/).filter(Boolean).pop() ?? 'session'

const r2 = (n: number) => Math.round(n * 10_000) / 10_000

const flushHistory = async ($: EngineInterface, pending: { usd: number }, offsetH: number | null) => {
  if (pending.usd <= 0) return
  const amount = pending.usd
  pending.usd = 0
  const key = dayKey(await $.clock.now(), offsetH)
  const project = await projectOf($)
  const day = ((await $.store.get(key)) as Day | undefined) ?? { usd: 0, projects: {} }
  day.usd = r2(day.usd + amount)
  day.projects[project] = r2((day.projects[project] ?? 0) + amount)
  await $.store.set(key, day)

  const days = (await $.store.keys()).filter(k => k.startsWith('day:')).sort()
  for (const old of days.slice(0, Math.max(0, days.length - HISTORY_DAYS))) await $.store.delete(old)
}

const historyText = async ($: EngineInterface, n: number, offsetH: number | null, lang: Lang) => {
  const t = STRINGS[lang]
  const now = await $.clock.now()
  const rows: [string, Day][] = []
  for (let i = n - 1; i >= 0; i--) {
    const key = dayKey(now - i * 86_400_000, offsetH)
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

// ---------------------------------------------------------------------------
// B: đo token một tác vụ.

const fmtInt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const measureText = (m: Measure, now: number, usdNow: number, lang: Lang, isLive: boolean) => {
  const t = STRINGS[lang]
  const cost = usdNow - m.usdAtStart
  return [
    t.measureHead(m.label, dur(now - m.startedAt)) + (isLive ? ` (${t.measureLive})` : ''),
    `calls ${fmtInt(m.calls)} · input ${fmtInt(m.input)} · cache_write ${fmtInt(m.cacheWrite)} · cache_read ${fmtInt(m.cacheRead)} · output ${fmtInt(m.output)}`,
    `USD ${usd(cost)}`,
    t.measureNote,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Ghi chỉ khi có thay đổi: một lần ghi là một lần vẽ lại mọi chỗ đọc giá trị đó.
// Trả về phần chi phí tăng thêm từ lần trước (cho lịch sử).
const refresh = async ($: EngineInterface): Promise<number> => {
  const { cost, context, rateLimits } = await $.session.usage()
  const total = cost?.usd ?? 0
  const s = await read($, stats)
  const ctx = context.percent ?? s.context

  const next = readLimits(rateLimits, await $.clock.now())
  if (!sameLimits(next, await read($, limits))) await update($, limits, () => next)

  const gained = Math.max(0, total - s.total)
  if (s.total === total && s.context === ctx && s.turnCost === total - s.costAtStart) return gained
  await update($, stats, p => ({ ...p, total, turnCost: total - p.costAtStart, context: context.percent ?? p.context }))
  return gained
}

// Built by notifier/build.sh (macOS): posts the warning under Claude's icon.
const NOTIFIER = 'notifier/Session Band.app/Contents/MacOS/session-band-notifier'
// The desktop app's id for a local Code session, as its claude:// links take it.
const HOST_SESSION = /^local_[A-Za-z0-9-]{1,64}$/

// This session as the desktop app knows it (macOS layout): its id and sidebar title.
// Null outside the desktop app; the title null when its record cannot be read.
const desktopSession = async ($: EngineInterface) => {
  const id = await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')
  if (id === undefined || !HOST_SESSION.test(id)) return null

  const home = await $.env.get('HOME')
  const account = await $.env.get('CLAUDE_CODE_ACCOUNT_UUID')
  const org = await $.env.get('CLAUDE_CODE_ORGANIZATION_UUID')
  const record = `${home}/Library/Application Support/Claude/claude-code-sessions/${account}/${org}/${id}.json`
  const title = await $.fs.read(record).then(
    text => (JSON.parse(text) as { title?: unknown }).title,
    () => undefined,
  )

  return { id, title: typeof title === 'string' && title.trim() !== '' ? title.trim() : null }
}

// E: thông báo hệ thống qua kênh của Claude Code ($.ui.notify: desktop app, terminal hỗ
// trợ thông báo), rồi PushNotification, cuối cùng toast. Trả về đã gửi được chưa.
const notifyOs = async ($: EngineInterface, text: string, key: string, title?: string): Promise<boolean> => {
  const sent = await $.ui.notify(text, { key, ...(title ? { title } : {}) }).catch(() => null)
  // `terminal_bell` chỉ kêu, không hiện chữ: coi như chưa báo.
  if (sent?.isSent === true && sent.channel !== 'terminal_bell') return true

  const pushed = await $.tool
    .call({ tool: 'PushNotification', message: title ? `${title}: ${text}` : text, status: 'proactive' })
    .catch(() => null)
  return (
    pushed !== null &&
    pushed.deny === undefined &&
    pushed.isError !== true &&
    (pushed.result.pushSent === true || pushed.result.localSent === true)
  )
}

// The notifier's system notification (macOS), else Claude Code's own notification,
// else a toast. The notifier is only looked for on macOS-style paths.
const notifyCacheExpiry = async ($: EngineInterface, minutes: number, lang: Lang) => {
  // Windows dùng `\`: tách cả hai loại gạch để lấy đúng tên thư mục dự án.
  const project = await projectOf($)
  const message = STRINGS[lang].cacheIn(minutes)

  const notifier = `${$.plugin.root}/${NOTIFIER}`
  if (await $.fs.exists(notifier)) {
    const session = await desktopSession($)
    const argv = [
      notifier,
      '-title',
      session?.title ? `${project} — ${session.title}` : project,
      '-message',
      message,
      '-group',
      `session-band-${session?.id ?? (await $.session.id())}`,
      ...(session ? ['-open', `claude://code/continue?session=${session.id}`] : []),
    ]
    // The first run waits while macOS asks whether to allow its notifications.
    const ran = await $.process.run(argv, { timeoutMs: 60_000 }).catch(() => null)
    if (ran?.exitCode === 0) return
  }

  if (!(await notifyOs($, message, 'session-band-cache', project))) $.ui.toast(`⏳ ${project}: ${message}`, { timeoutMs: 30000 })
}

// Tuỳ chọn đã đọc trong register; các hàm nhận `$` phải nằm ở cấp đầu tệp nên đọc từ đây.
const CFG = { lang: 'en' as Lang, isAlerting: true, budgetUsd: null as number | null }

// D: báo một lần cho mỗi khoá. `loud` thì gửi cả thông báo hệ thống.
const alertOnce = async ($: EngineInterface, key: string, text: string, loud: boolean) => {
  const seen = await read($, fired)
  if (seen.includes(key)) return
  await update($, fired, list => [...list, key].slice(-100))
  $.ui.toast(`⚠ ${text}`, { timeoutMs: 15000 })
  if (loud) await notifyOs($, text, `session-band-${key.split(':')[0]}`, await projectOf($))
}

const checkThresholds = async ($: EngineInterface) => {
  if (!CFG.isAlerting) return
  const s = await read($, stats)

  if (s.context < CONTEXT_REARM) {
    const seen = await read($, fired)
    if (seen.some(k => k.startsWith('ctx:'))) await update($, fired, list => list.filter(k => !k.startsWith('ctx:')))
  }
  for (const step of CONTEXT_STEPS) {
    if (s.context >= step) await alertOnce($, `ctx:${step}`, STRINGS[CFG.lang].contextHit(s.context), step === CONTEXT_STEPS[1])
  }

  const now = await $.clock.now()
  for (const l of await read($, limits)) {
    const name = STRINGS[CFG.lang].limitName(l.kind)
    const window = l.resetsAt ?? 'none'
    for (const step of LIMIT_STEPS) {
      if (l.percent >= step) {
        await alertOnce($, `lim:${l.kind}:${step}:${window}`, STRINGS[CFG.lang].limitHit(name, l.percent, l.resetsAt === null ? '' : dur(l.resetsAt - now)), step === LIMIT_STEPS[1])
      }
    }
    if (l.etaMs !== null) await alertOnce($, `eta:${l.kind}:${window}`, STRINGS[CFG.lang].limitEta(name, dur(l.etaMs)), false)
  }

  if (CFG.budgetUsd !== null) {
    const p = Math.floor((s.total / CFG.budgetUsd) * 100)
    for (const step of BUDGET_STEPS) {
      if (p >= step) await alertOnce($, `bud:${step}`, STRINGS[CFG.lang].budgetHit(p, usd(s.total), usd(CFG.budgetUsd)), step === BUDGET_STEPS[1])
    }
  }
}

// B: cộng usage của một request vào phép đo đang chạy.
const addUsage = async ($: EngineInterface, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }) => {
  const m = await read($, measure)
  if (m === null) return
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

export const register: Register = (on, options) => {
  const lang: Lang = options.language === 'vi' ? 'vi' : 'en'
  const t = STRINGS[lang]
  // Cache của luồng chính: Claude Code trên gói thuê bao ghi loại 1 giờ (đo trên PC1:
  // ~99% token ghi cache luồng chính là 1h). Người dùng API key ghi 5 phút thì chọn 5m.
  const isShort = options.cacheTtl === '5m'
  const ttlMs = (isShort ? 5 : 60) * 60 * 1000
  CACHE_WARN_S = isShort ? 2 * 60 : 20 * 60
  CACHE_ALERT_S = isShort ? 60 : 10 * 60
  CACHE_NOTIFY_MINUTES = isShort ? [1] : [10, 5]
  const perSecond = options.countdown === 'seconds' || isShort
  const showLimits = options.limits !== 'off'
  const isAlerting = options.alerts !== 'off'
  const budget = Number(options.budgetUsd)
  CFG.lang = lang
  CFG.isAlerting = isAlerting
  CFG.budgetUsd = Number.isFinite(budget) && budget > 0 ? budget : null
  const offset = Number(options.utcOffset)
  const offsetH = options.utcOffset === undefined || options.utcOffset === '' || options.utcOffset === 'auto' || !Number.isFinite(offset) ? null : offset
  // Lượt chính đã gửi request nào chưa: lượt bị huỷ trước request đầu giữ hạn cache cũ
  // và không đặt lại `warned`, để thông báo vừa bắn không lặp lại.
  let requestedThisTurn = false

  // Thời điểm BẮT ĐẦU request gần nhất của luồng chính: tuổi của mục cache tính từ lúc
  // request ghi/đọc nó bắt đầu, không phải lúc câu trả lời xong.
  let lastRequestAt: number | null = null

  // C: chi phí chưa ghi xuống store; ghi khi lượt chính xong và khi phiên kết thúc.
  const pending = { usd: 0 }

  on('session.start', async ($, e, next) => {
    const result = await next(e)

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
      // `cache` nằm trong $.state nên sống qua reload: không cần đọc state của mod
      // "Cache" khác như bản gốc (mod đó không có hợp đồng, làm hỏng kiểm kiểu).
      const c = await read($, cache)
      const expiresAt = c.expiresAt
      if (expiresAt === null) return

      const left = Math.max(0, Math.floor((expiresAt - (await $.clock.now())) / 1000))
      const shown = shownLeft(left, perSecond)
      if (shown !== c.secondsLeft) await update($, cache, p => ({ ...p, secondsLeft: shown }))

      if (left === 0 || left > Math.max(...CACHE_NOTIFY_MINUTES) * 60) return
      const minutes = Math.min(...CACHE_NOTIFY_MINUTES.filter(m => left <= m * 60))
      const last = await read($, warned)
      if ((last !== 0 && last <= minutes) || (await read($, isBusy))) return

      await update($, warned, () => minutes)
      await notifyCacheExpiry($, Math.ceil(left / 60), lang)
    })

    return result
  })

  on('session.end', async ($, e, next) => {
    await flushHistory($, pending, offsetH).catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'session_data' }, async ($, e) => {
    // `/session_data demo <minutes>` fakes the cache deadline to preview the warnings;
    // the next answer resets it.
    const demo = e.args.trim().match(/^demo\s+(\d+(?:\.\d+)?)$/)
    if (demo) {
      const seconds = Math.round(Number(demo[1]) * 60)
      const now = await $.clock.now()
      await update($, cache, () => ({ expiresAt: now + seconds * 1000, secondsLeft: shownLeft(seconds, perSecond) }))
      await update($, warned, () => 0)
      await update($, isHidden, () => false)

      return { text: t.demo(demo[1] ?? '') }
    }

    if (e.args.trim() === 'width') {
      const columns = lastColumns
      return { text: columns === null ? t.noBand : t.width(columns, tierFor(columns)) }
    }

    const hidden = !(await read($, isHidden))
    await update($, isHidden, () => hidden)

    return { text: hidden ? t.hidden : t.shown }
  })

  on('command.run', { command: 'token' }, async ($, e) => {
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    const now = await $.clock.now()
    const usdNow = (await $.session.usage()).cost?.usd ?? 0
    const m = await read($, measure)

    if (verb === 'start') {
      if (m !== null) return { text: t.measureAlready(m.label) }
      const label = rest.join(' ').slice(0, 80)
      await update($, measure, () => ({ label, startedAt: now, usdAtStart: usdNow, calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }))
      return { text: t.measureStarted(label) }
    }
    if (m === null) return { text: t.measureNone }
    if (verb === 'stop') {
      await update($, measure, () => null)
      return { text: measureText(m, now, usdNow, lang, false) }
    }
    return { text: measureText(m, now, usdNow, lang, true) }
  })

  on('command.run', { command: 'spend' }, async ($, e) => {
    await flushHistory($, pending, offsetH)
    const n = Math.min(HISTORY_DAYS, Math.max(1, Math.floor(Number(e.args.trim()) || 7)))
    return { text: await historyText($, n, offsetH, lang) }
  })

  on('turn.start', async ($, e, next) => {
    // Lượt của subagent cũng phát turn.start: chỉ lượt của luồng chính được đếm, nếu
    // không số lượt tăng theo subagent và chi phí lượt bị đặt lại giữa chừng.
    if (e.agentId !== undefined) return next(e)
    const total = (await $.session.usage()).cost?.usd ?? 0
    const s = await read($, stats)
    pending.usd += Math.max(0, total - s.total)
    await update($, stats, p => ({ ...p, turn: p.turn + 1, costAtStart: total, total, turnCost: 0 }))
    await update($, isBusy, () => true)
    requestedThisTurn = false

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      const result = yield* next(e)
      if (result.usage) await addUsage($, result.usage)
      return result
    }

    lastRequestAt = await $.clock.now()
    requestedThisTurn = true
    // Measured from the response's first item (its envelope, message_start), so
    // time-to-first-token is excluded but thinking that streams hidden or in one
    // late burst is still timed: output_tokens counts it.
    let startedAt: number | null = null

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
      if (requestedThisTurn) {
        const now = await $.clock.now()
        const expiresAt = (lastRequestAt ?? now) + ttlMs
        await update($, cache, () => ({ expiresAt, secondsLeft: shownLeft(Math.max(0, Math.floor((expiresAt - now) / 1000)), perSecond) }))
        await update($, warned, () => 0)
      }
      await checkThresholds($)
      await flushHistory($, pending, offsetH).catch(() => undefined)
    }

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, stats)
    if (e.props.hasSurvey || s.turn === 0 || (await read($, isHidden))) return next(e)

    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const Svg = 'Svg' in ui ? ui.Svg : null
    const speed = s.speed === null ? '—' : `${s.speed} tok/s`
    const turnCost = s.turnCost === null ? '—' : usd(s.turnCost)

    const { secondsLeft } = await read($, cache)
    const level =
      e.props.isWorking || secondsLeft === null
        ? null
        : secondsLeft <= CACHE_ALERT_S
          ? ALERT
          : secondsLeft <= CACHE_WARN_S
            ? WARN
            : null
    const cacheColor = level ?? CACHE
    const cacheLabel = e.props.isWorking ? '…' : secondsLeft === null ? '—' : cacheText(secondsLeft, perSecond, t.expired)

    lastColumns = e.props.bodyColumns
    // A: hạn mức chỉ hiện khi còn đủ chỗ sau khi dành chỗ cho phần gốc của thanh.
    const all = showLimits ? await read($, limits) : []
    const hasRoom = all.length > 0 && e.props.bodyColumns >= TIER_MIN[1] + LIMIT_COLUMNS
    const tier = tierFor(e.props.bodyColumns - (hasRoom ? LIMIT_COLUMNS : 0))
    const shownLimits = hasRoom ? all.filter(l => tier === 0 || l.kind === 'five_hour') : []
    const icon = tier >= 3 ? 18 : 22

    return (
      <Box
        flexDirection="row"
        alignItems="center"
        columnGap={GAPS[tier]}
        flexWrap="nowrap"
        overflow="hidden"
        paddingX={1}
        {...(level ? { borderStyle: 'round', borderColor: level } : {})}
      >
        {tier <= 2 ? (
          <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
            {tier <= 1 ? <Text dimColor>{t.turn}</Text> : <Text dimColor>#</Text>}
            <Text bold>{String(s.turn)}</Text>
          </Box>
        ) : null}
        {tier <= 3 ? (
          <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
            {Svg ? <Svg source={SPEED_ICON} alt="speed" width={icon} height={icon} /> : <Text color={SPEED}>⚡</Text>}
            <Text bold wrap="truncate-end">{tier <= 1 || s.speed === null ? speed : `${s.speed}/s`}</Text>
          </Box>
        ) : null}
        <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
          {Svg ? <Svg source={MONEY_ICON} alt="cost" width={icon} height={icon} /> : <Text color={MONEY}>$</Text>}
          <Text bold color={MONEY}>{turnCost}</Text>
          {tier <= 2 ? <Text dimColor>|</Text> : null}
          {tier <= 2 ? <Text bold>{usd(s.total)}</Text> : null}
        </Box>
        <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
          {Svg ? <Svg source={CACHE_ICON[cacheColor] ?? ''} alt="cache" width={icon} height={icon} /> : <Text color={cacheColor}>⧗</Text>}
          <Text bold color={level ?? undefined}>{cacheLabel}</Text>
        </Box>
        {shownLimits.map(l => (
          <Box key={l.kind} flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
            <Text dimColor>{LIMIT_LABEL[l.kind] ?? l.kind}</Text>
            <Text bold color={limitColor(l)}>{`${l.percent}%`}</Text>
            {l.etaMs !== null ? <Text color={WARN}>{`⚠${dur(l.etaMs)}`}</Text> : null}
          </Box>
        ))}
        <Box flexGrow={1} flexShrink={1} />
        <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
          {Svg ? <Svg source={contextIcon(s.context)} alt="context" width={icon} height={icon} /> : null}
          {Svg && tier === 0 ? (
            <Svg source={contextBar(s.context)} alt={`context ${s.context}%`} width={80} height={6} />
          ) : null}
          <Text bold>{`${s.context}%`}</Text>
        </Box>
        <Button key="hide" label="×" role="dismiss" plain dimColor onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })
}
