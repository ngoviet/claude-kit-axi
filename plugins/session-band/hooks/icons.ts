// Màu và hình vẽ của thanh. Chuỗi SVG cố định dựng một lần; hình phụ thuộc số được nhớ
// theo số, nên mỗi lần vẽ lại không dựng chuỗi mới.

export const SPEED = '#8b8cf8'
export const MONEY = '#4caf6e'
const MUTED = '#8a8f8c'
const CONTEXT = '#5fa8d3'
export const CACHE = '#4fb3a9'
export const WARN = '#e2a94e'
export const ALERT = '#e0846b'

const ring = (color: string, glyph: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="2"/>${glyph}</svg>`

/** Đồng hồ tốc độ. */
export const SPEED_ICON = ring(
  SPEED,
  `<path d="M6.5 15a6 6 0 0 1 11 0" fill="none" stroke="${SPEED}" stroke-width="1.8" stroke-linecap="round"/><path d="M12 15l3-4" stroke="${SPEED}" stroke-width="1.8" stroke-linecap="round"/>`,
)

export const MONEY_ICON = ring(
  MONEY,
  `<text x="12" y="16.5" text-anchor="middle" font-family="-apple-system,'Segoe UI',sans-serif" font-size="13" font-weight="600" fill="${MONEY}">$</text>`,
)

/** Đồng hồ cát: cache prompt đang cạn. Chỉ ba màu nên dựng sẵn cả ba. */
export const CACHE_ICON: Record<string, string> = Object.fromEntries(
  [CACHE, WARN, ALERT].map(color => [
    color,
    ring(
      color,
      `<g fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M8.5 6.5h7M8.5 17.5h7"/><path d="M9.5 6.5c0 3 5 3.5 5 5.5s-5 2.5-5 5.5M14.5 6.5c0 3-5 3.5-5 5.5s5 2.5 5 5.5"/></g>`,
    ),
  ]),
)

/** Nhớ theo phần trăm nguyên (0..100): tối đa 101 chuỗi mỗi loại. */
const byPercent = <T,>(build: (n: number) => T) => {
  const seen = new Map<number, T>()
  return (n: number): T => {
    const key = Math.max(0, Math.min(100, Math.round(n)))
    let v = seen.get(key)
    if (v === undefined) seen.set(key, (v = build(key)))
    return v
  }
}

/** Vòng tròn đầy dần theo context, quanh một trang giấy. */
export const contextIcon = byPercent(percent => {
  const c = 2 * Math.PI * 10
  const filled = (percent / 100) * c
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="none" stroke="${MUTED}" stroke-opacity="0.35" stroke-width="2"/><circle cx="12" cy="12" r="10" fill="none" stroke="${CONTEXT}" stroke-width="2" stroke-linecap="round" stroke-dasharray="${filled.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 12 12)"/><path d="M8.5 9h7M8.5 12h7M8.5 15h4.5" stroke="${CONTEXT}" stroke-width="1.6" stroke-linecap="round"/></svg>`
})

/** Thanh ngang của context, đổi màu ở 65% và 85%. */
export const contextBar = byPercent(percent => {
  const color = percent >= 85 ? ALERT : percent >= 65 ? WARN : MONEY
  const w = Math.round((percent / 100) * 80)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 6" width="80" height="6"><rect width="80" height="6" rx="3" fill="${MUTED}" fill-opacity="0.3"/><rect width="${w}" height="6" rx="3" fill="${color}"/></svg>`
})
