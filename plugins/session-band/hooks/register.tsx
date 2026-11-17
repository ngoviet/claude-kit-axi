// session-band (bản axi) — dựa trên johnnyvizz/claude-kit plugins/session-band 0.2.0, MIT.
// Thay đổi so với bản gốc: xem docs/thay-doi.md.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cache, Stats } from '../types'

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

const SPEED = '#8b8cf8'
const MONEY = '#4caf6e'
const MUTED = '#8a8f8c'
const CONTEXT = '#5fa8d3'
const CACHE = '#4fb3a9'
const WARN = '#e2a94e'
const ALERT = '#e0846b'

// ---------------------------------------------------------------------------
// Chữ hiển thị: tiếng Anh như bản gốc, thêm tiếng Việt.

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

const pad = (n: number) => String(n).padStart(2, '0')
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

// Ghi chỉ khi có thay đổi: một lần ghi là một lần vẽ lại mọi chỗ đọc giá trị đó.
const refresh = async ($: EngineInterface) => {
  const { cost, context } = await $.session.usage()
  const total = cost?.usd ?? 0
  const s = await read($, stats)
  const ctx = context.percent ?? s.context
  if (s.total === total && s.context === ctx && s.turnCost === total - s.costAtStart) return
  await update($, stats, p => ({ ...p, total, turnCost: total - p.costAtStart, context: context.percent ?? p.context }))
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

// The notifier's system notification (macOS), else Claude Code's own notification,
// else a toast. The notifier is only looked for on macOS-style paths.
const notifyCacheExpiry = async ($: EngineInterface, minutes: number, lang: Lang) => {
  // Windows dùng `\`: tách cả hai loại gạch để lấy đúng tên thư mục dự án.
  const project = (await $.session.cwd()).split(/[\\/]/).filter(Boolean).pop() ?? 'session'
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

  const text = `${project}: ${message}`
  const sent = await $.tool
    .call({ tool: 'PushNotification', message: text, status: 'proactive' })
    .catch(() => null)
  const isDelivered =
    sent !== null &&
    sent.deny === undefined &&
    sent.isError !== true &&
    (sent.result.pushSent === true || sent.result.localSent === true)

  if (!isDelivered) $.ui.toast(`⏳ ${text}`, { timeoutMs: 30000 })
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
  // Lượt chính đã gửi request nào chưa: lượt bị huỷ trước request đầu giữ hạn cache cũ
  // và không đặt lại `warned`, để thông báo vừa bắn không lặp lại.
  let requestedThisTurn = false

  // Thời điểm BẮT ĐẦU request gần nhất của luồng chính: tuổi của mục cache tính từ lúc
  // request ghi/đọc nó bắt đầu, không phải lúc câu trả lời xong.
  let lastRequestAt: number | null = null

  on('session.start', async ($, e, next) => {
    const result = await next(e)

    await $.command.register({
      name: 'session_data',
      description: 'Show or hide the session band; `demo <minutes>` previews the cache warning',
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

  on('turn.start', async ($, e, next) => {
    // Lượt của subagent cũng phát turn.start: chỉ lượt của luồng chính được đếm, nếu
    // không số lượt tăng theo subagent và chi phí lượt bị đặt lại giữa chừng.
    if (e.agentId !== undefined) return next(e)
    const total = (await $.session.usage()).cost?.usd ?? 0
    await update($, stats, s => ({ ...s, turn: s.turn + 1, costAtStart: total, total, turnCost: 0 }))
    await update($, isBusy, () => true)
    requestedThisTurn = false

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)

    lastRequestAt = await $.clock.now()
    requestedThisTurn = true
    // Measured from the response's first item (its envelope, message_start), so
    // time-to-first-token is excluded but thinking that streams hidden or in one
    // late burst is still timed: output_tokens counts it.
    let startedAt: number | null = null

    for await (const chunk of next(e)) {
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
    }

    await refresh($)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)

    if (e.agentId === undefined) {
      await update($, isBusy, () => false)
      if (requestedThisTurn) {
        const now = await $.clock.now()
        const expiresAt = (lastRequestAt ?? now) + ttlMs
        await update($, cache, () => ({ expiresAt, secondsLeft: shownLeft(Math.max(0, Math.floor((expiresAt - now) / 1000)), perSecond) }))
        await update($, warned, () => 0)
      }
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
    const tier = tierFor(e.props.bodyColumns)
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
