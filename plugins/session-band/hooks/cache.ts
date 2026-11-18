// Đếm ngược hạn cache prompt của luồng chính và báo khi sắp hết.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { CFG } from './config'
import { pad } from './lib/format'
import { notifyOs, projectOf } from './notify'
import { CACHE0 } from './state'
import { tr } from './strings'

const cache = atom({ plugin: 'session-band', key: 'cache' } as const, CACHE0)
const isBusy = atom({ plugin: 'session-band', key: 'isBusy' } as const, false)
const warned = atom({ plugin: 'session-band', key: 'warned' } as const, 0)

/** Lượt chính hiện tại. Biến module: reload thì mất, như biến trong `register` của bản gốc. */
export const turnRun = {
  /** Lượt đã gửi request nào chưa: lượt bị huỷ trước request đầu giữ nguyên hạn cache cũ. */
  hasRequested: false,
  /**
   * Lúc BẮT ĐẦU request gần nhất: tuổi mục cache tính từ lúc request ghi/đọc nó bắt đầu,
   * không phải lúc câu trả lời xong.
   */
  lastRequestAt: null as number | null,
}

/**
 * Số giây còn lại đem ghi vào state. Ngoài 10 phút cuối, chế độ `minutes` chỉ hiện số
 * phút, nên làm tròn lên phút: thanh vẽ lại khoảng 1 lần/phút thay vì 1 lần/giây.
 */
export const shownLeft = (left: number): number =>
  CFG.perSecond || left <= CFG.alertS ? left : Math.ceil(left / 60) * 60

/** Chữ đếm ngược: "54m", "09:58" hoặc "hết hạn". */
export const cacheText = (left: number): string =>
  left === 0 ? tr().expired
  : CFG.perSecond || left <= CFG.alertS ? `${pad(Math.floor(left / 60))}:${pad(left % 60)}`
  : `${Math.ceil(left / 60)}m`

/** Màu cảnh báo theo giây còn lại; null khi chưa tới ngưỡng. */
export const cacheLevel = (left: number): 'alert' | 'warn' | null =>
  left <= CFG.alertS ? 'alert' : left <= CFG.warnS ? 'warn' : null

/** Đặt hạn cache mới sau một câu trả lời của luồng chính. */
export async function restartCache($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const expiresAt = (turnRun.lastRequestAt ?? now) + CFG.ttlMs
  await update($, cache, () => ({ expiresAt, secondsLeft: shownLeft(Math.max(0, Math.floor((expiresAt - now) / 1000))) }))
  await update($, warned, () => 0)
}

// Bản dựng của notifier/build.sh (macOS): đăng thông báo dưới biểu tượng của Claude.
const NOTIFIER = 'notifier/Session Band.app/Contents/MacOS/session-band-notifier'
// Mã phiên Code cục bộ của desktop app, dạng mà liên kết claude:// nhận.
const HOST_SESSION = /^local_[A-Za-z0-9-]{1,64}$/

/**
 * Phiên này theo desktop app (bố cục macOS): mã và tiêu đề trên thanh bên. Null khi không
 * chạy trong desktop app; tiêu đề null khi không đọc được bản ghi.
 */
async function desktopSession($: EngineInterface) {
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

/** Báo cache sắp hết: notifier macOS, rồi thông báo của Claude Code, cuối cùng toast. */
async function notifyCacheExpiry($: EngineInterface, minutes: number): Promise<void> {
  const project = await projectOf($)
  const message = tr().cacheIn(minutes)

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
    // Lần chạy đầu phải chờ macOS hỏi có cho phép thông báo không.
    const ran = await $.process.run(argv, { timeoutMs: 60_000 }).catch(() => null)
    if (ran?.exitCode === 0) return
  }

  if (!(await notifyOs($, message, 'session-band-cache', project))) $.ui.toast(`⏳ ${project}: ${message}`, { timeoutMs: 30000 })
}

/** Mỗi giây: cập nhật số giây hiển thị và báo khi chạm một mốc phút. */
export async function tickCache($: EngineInterface): Promise<void> {
  // `cache` nằm trong $.state nên sống qua reload: không phải đọc state của mod "Cache"
  // khác như bản gốc (mod đó không có hợp đồng kiểu, làm hỏng kiểm kiểu).
  const c = await read($, cache)
  if (c.expiresAt === null) return

  const left = Math.max(0, Math.floor((c.expiresAt - (await $.clock.now())) / 1000))
  const shown = shownLeft(left)
  if (shown !== c.secondsLeft) await update($, cache, p => ({ ...p, secondsLeft: shown }))

  if (left === 0 || left > Math.max(...CFG.notifyMinutes) * 60) return
  const minutes = Math.min(...CFG.notifyMinutes.filter(m => left <= m * 60))
  const last = await read($, warned)
  if ((last !== 0 && last <= minutes) || (await read($, isBusy))) return

  await update($, warned, () => minutes)
  await notifyCacheExpiry($, Math.ceil(left / 60))
}
