// Hình vẽ của khung Agents trên desktop: mỗi hàng là một SVG.
import type { AgentRun } from '../types'
import { CFG } from './config'
import { CRAB_BOX, CRAB_CSS, CRAB_SCALE, costumeOf, crab } from './crab'
import { stopwatch, tokens, usdShort } from './lib/format'
import { ctxOf, elapsed, progressOf, runModel } from './runs'
import type { totals } from './runs'
import { isRtl, tr } from './strings'

type Totals = ReturnType<typeof totals>

/** Màu của hàng agent (bản gốc tô theo hạng savvy-*, đã bỏ cùng savvy-flow). */
export const AGENT_COLOR = '#888780'
export const HEADER_H = 44
export const AGENT_H = 66
/** Một hàng Text hay Button trên desktop cao khoảng 20px; lưới nền tính dư. */
export const LINE_H = 24

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

const PANE_CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#9a9a96}.k{fill:#ecebe8}.ln{stroke:#e4e4e1}.tile{fill:#f4f3f0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#7d7d79}.k{fill:#2c2c2b}.ln{stroke:#333331}.tile{fill:#262625}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`

// --- Chữ trong SVG

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

/**
 * Chữ CJK, dạng toàn khổ và emoji rộng khoảng 1em; tính 0,56em thì tiêu đề tiếng Trung chỉ
 * được nửa chỗ và bị vẽ đè.
 */
const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏！-｠￠-￦\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u

/** Bề rộng ước chừng của một ký tự font giao diện hệ thống, tính theo em. */
const charEm = (ch: string): number =>
  WIDE.test(ch) ? 1 : /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-ZА-ЯЁmwшщжюМШЩЖЮ@%]/.test(ch) ? 0.72 : 0.56

const textWidth = (s: string, size: number): number => [...s].reduce((w, ch) => w + charEm(ch) * size, 0)

/** Cắt `s` cho vừa `maxW` pixel, thêm dấu "…" khi phải cắt. */
const fitText = (s: string, size: number, maxW: number): string => {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size) > maxW) break
    out += ch
  }
  return out + '…'
}

// --- Bố cục trái sang phải; tiếng Do Thái lật mọi ô qua trục giữa hàng (`mx`) và chữ bám
// phía bị lật. Chữ `words` có thể là tiếng Do Thái nên đặt `direction="rtl"` (khi đó
// `start` là mép phải); số giữ trái sang phải để "≈$0.25" đúng thứ tự.

const mx = (W: number, x: number, w = 0): number => (isRtl() ? W - x - w : x)

/** Chữ bắt đầu tại x: căn trái, hoặc căn phải tại x đã lật. */
const startText = (W: number, x: number, y: number, words = true): string =>
  !isRtl()
    ? `x="${x}" y="${y}"`
    : `x="${W - x}" y="${y}"${words ? ' direction="rtl" text-anchor="start"' : ' text-anchor="end"'}`

/** Chữ kết thúc tại x: căn phải, hoặc căn trái tại x đã lật. */
const endText = (W: number, x: number, y: number, words = false): string =>
  !isRtl() ? `x="${x}" y="${y}" text-anchor="end"` : `x="${W - x}" y="${y}"${words ? ' direction="rtl" text-anchor="end"' : ''}`

const crabWidth = Math.round(CRAB_BOX * CRAB_SCALE * 100) / 100

/** Con cua trong hàng rộng W: tiếng Do Thái thì đứng phía bị lật và quay mặt sang trái. */
const rowCrab = (W: number, x: number, y: number, costume: string, isWalking = false): string =>
  crab(mx(W, x, crabWidth), y, costume, false, isWalking, CRAB_SCALE, isRtl())

/** Bọc thân SVG; CSS hoạt ảnh con cua (~1 nghìn ký tự) chỉ đi kèm hàng có con cua đang đi. */
const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${body.includes(' run"') ? CRAB_CSS : ''}${body}</svg>`

const statusMark = (x: number, y: number, status: string, color: string): string => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="#3B9C5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed') return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="#D0453F" stroke-width="1.8" stroke-linecap="round"/>`
  return ''
}

// --- Lưới chấm làm nền: cao bằng phần nội dung đặt lên trên; các SVG hàng trong suốt nên
// lưới lộ ra giữa các nét.

const GRID_STEP = 16
/** Engine từ chối Svg cao quá 4096px: lưới dài ghép từ nhiều mảnh, bội số GRID_STEP để chấm thẳng hàng. */
const GRID_TILE = 4096

export const gridTiles = (H: number): number[] =>
  Array.from({ length: Math.ceil(H / GRID_TILE) }, (_, i) => Math.min(GRID_TILE, H - i * GRID_TILE))

export const gridSvg = (W: number, H: number): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>.d{fill:#d9d8d4}@media (prefers-color-scheme: dark){.d{fill:#3a3a38}}</style>
<defs><pattern id="g" width="${GRID_STEP}" height="${GRID_STEP}" patternUnits="userSpaceOnUse"><circle class="d" cx="${GRID_STEP / 2}" cy="${GRID_STEP / 2}" r="1"/></pattern></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`

// --- Các hàng

/** Ba ô tổng: chi phí, token, thời gian. */
export const headerSvg = (W: number, t: Totals): string => {
  const s = tr()
  const gap = 6
  const tw = (W - gap * 2) / 3
  const tile = (i: number, k: string, v: string) =>
    `<rect class="tile" x="${mx(W, i * (tw + gap), tw)}" y="0" width="${tw}" height="40" rx="8"/>
<text class="s" ${startText(W, i * (tw + gap) + 9, 16)} font-family="${FONT}" font-size="11">${k}</text>
<text class="t" ${startText(W, i * (tw + gap) + 9, 33, false)} font-family="${FONT}" font-size="15" font-weight="600" font-variant-numeric="tabular-nums">${v}</text>`
  return svg(W, HEADER_H, `${tile(0, s.cost, '≈' + usdShort(t.cost))}${tile(1, s.tokens, tokens(t.tokens))}${tile(2, s.time, stopwatch(t.time))}`)
}

/** Một agent: con cua, mô tả, loại · model, số liệu và thanh tiến độ. */
export const agentSvg = (W: number, a: AgentRun, at: number): string => {
  const s = tr()
  const ctx = ctxOf(a)
  const barW = W - 42 - 22
  const meta = [runModel(a)]
  if (a.round > 1) meta.push(`${s.round} ${a.round}`)
  if (a.status === 'failed') meta.push(s.failed)
  const progress = progressOf(a)
  const stats = `${s.ctx} ${ctx}% · ${tokens(a.contextTokens)}  ≈${usdShort(a.costUsd)}  ${stopwatch(elapsed(a, at))}`
  const fillW = Math.round(barW * (progress ?? ctx / 100))
  return svg(
    W,
    AGENT_H,
    `${rowCrab(W, 0, 14, costumeOf(a.type), a.status === 'running')}
<text class="t" ${startText(W, 42, 18)} font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, barW))}</text>
<text ${startText(W, 42, 34)} font-family="${FONT}" font-size="11"><tspan fill="${AGENT_COLOR}">${xml(a.type)}</tspan><tspan class="s">  ${xml(meta.join('  ·  '))}</tspan></text>
<text class="s" ${endText(W, 42 + barW, 49, true)} font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${stats}</text>
<rect class="k" x="${mx(W, 42, barW)}" y="55" width="${barW}" height="4" rx="2"/><rect${progress === null ? ' class="m"' : ''} x="${mx(W, 42, fillW)}" y="55" width="${fillW}" height="4" rx="2"${progress === null ? '' : ` fill="${AGENT_COLOR}"`}/>
${statusMark(mx(W, W - 8), 16, a.status, AGENT_COLOR)}
<line class="ln" x1="0" y1="${AGENT_H - 0.5}" x2="${W}" y2="${AGENT_H - 0.5}"/>`,
  )
}

/**
 * Hàng đã xong không đổi nữa (endedAt cố định): dựng một lần cho mỗi bộ dữ liệu. Khoá gồm cả
 * ngôn ngữ và bề rộng; đủ 256 mục thì xoá sạch.
 */
const FINISHED_MEMO = new Map<string, string>()
export const finishedSvg = (W: number, a: AgentRun): string => {
  const key = `${W}|${CFG.lang}|${JSON.stringify(a)}`
  let v = FINISHED_MEMO.get(key)
  if (v === undefined) {
    if (FINISHED_MEMO.size >= 256) FINISHED_MEMO.clear()
    FINISHED_MEMO.set(key, (v = agentSvg(W, a, a.endedAt ?? a.startedAt)))
  }
  return v
}

/** Khung thu gọn: một dãy con cua (đang chạy trước) và dòng tổng. */
export const compactSvg = (W: number, list: AgentRun[], t: Totals): string => {
  const ordered = [...list.filter(a => a.status === 'running'), ...list.filter(a => a.status !== 'running')]
  const fit = Math.max(1, Math.floor((W - 150) / 36))
  const shown = ordered.slice(0, fit)
  const more = ordered.length - shown.length
  const body = shown
    .map((a, i) => {
      const isRunning = a.status === 'running'
      return rowCrab(W, i * 36, 0, costumeOf(a.type), isRunning) + (isRunning ? `<circle class="live" cx="${mx(W, i * 36 + 32)}" cy="4" r="3" fill="${AGENT_COLOR}"/>` : '')
    })
    .join('')
  const x = shown.length * 36 + (more ? 4 : 0)
  return svg(
    W,
    32,
    `${body}${more ? `<text class="s" ${startText(W, x, 21, false)} font-family="${FONT}" font-size="12">+${more}</text>` : ''}
<text class="s" ${endText(W, W, 21)} font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">≈${usdShort(t.cost)} · ${tokens(t.tokens)} · ${stopwatch(t.time)}</text>`,
  )
}
