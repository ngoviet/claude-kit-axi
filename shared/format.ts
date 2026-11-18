// Định dạng số, tiền, token và thời gian cho cả hai mod.
// Bản gốc nằm ở shared/; tools/sync_shared.py chép sang plugins/<mod>/hooks/lib/.

/** Hai chữ số, thêm 0 ở đầu: 5 → "05". */
export const pad = (n: number): string => String(n).padStart(2, '0')

/** Tiền USD hai số lẻ: "$1.25". */
export const usd = (n: number): string => `$${n.toFixed(2)}`

/** Tiền USD gọn: hai số lẻ dưới $10, một số lẻ từ $10: "$0.05", "$58.4". */
export const usdShort = (n: number): string => `$${n < 10 ? n.toFixed(2) : n.toFixed(1)}`

/** Số nguyên có dấu chấm ngăn hàng nghìn: 2000 → "2.000". */
export const int = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Số token gọn: "950", "13k", "1.2M". */
export const tokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

/** Khoảng thời gian dài, làm tròn phút: "45m", "2h20", "1d8h" (từ một ngày thì làm tròn giờ). */
export const span = (ms: number): string => {
  const m = Math.max(0, Math.round(ms / 60_000))
  if (m < 60) return `${m}m`
  if (m < 24 * 60) return `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ''}`
  const h = Math.round(m / 60)
  return `${Math.floor(h / 24)}d${h % 24 ? `${h % 24}h` : ''}`
}

/** Đồng hồ bấm giờ, tính đến giây: "1:30", "1:02:03". */
export const stopwatch = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}
