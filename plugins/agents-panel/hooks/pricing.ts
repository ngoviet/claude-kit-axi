// Giá model, cửa sổ context và tên hiển thị. Engine chỉ báo token, không báo tiền, nên
// chi phí trong khung là ước tính theo bảng giá này.
import { CFG } from './config'

/** USD cho mỗi triệu token: input, output, đọc cache. */
type Price = [input: number, output: number, cacheRead: number]

/**
 * Dòng đầu tiên khớp mã model được dùng, nên bản phát hành cụ thể đứng trên họ model.
 * Đối chiếu skill `claude-api` (shared/models.md, bản đi kèm Claude Code 2.1.325) ngày
 * 17/11/2026. Model không khớp dòng nào tính theo giá Opus 5.5.
 */
const PRICES: [RegExp, Price][] = [
  [/(fable|mythos)-5-2/, [8, 40, 0.2]],
  [/(fable|mythos)-5-1/, [10, 50, 0.25]],
  [/fable|mythos/, [10, 50, 1]],
  [/opus-5-5/, [4, 20, 0.2]],
  [/opus/, [5, 25, 0.5]],
  [/sonnet-5-5/, [2, 10, 0.1]],
  [/sonnet-5/, [2, 10, 0.2]],
  [/sonnet/, [3, 15, 0.3]],
  [/haiku-5-5/, [0.1, 0.5, 0.01]],
  [/haiku/, [1, 5, 0.1]],
]
const FALLBACK: Price = [4, 20, 0.2]

/** Haiku 5.5 tính giá theo độ dài prompt: request có prompt (input + đọc + ghi cache) trên 100.000 token trả giá này. */
const HAIKU_LONG_PROMPT = 100_000
const HAIKU_LONG: Price = [0.5, 2.5, 0.05]

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const priceOf = (model: string, prompt: number): Price => {
  const id = model.toLowerCase()
  if (prompt > HAIKU_LONG_PROMPT && /haiku-5-5/.test(id)) return HAIKU_LONG
  return PRICES.find(([re]) => re.test(id))?.[1] ?? FALLBACK
}

/** Tổng token của một usage. */
export const totalTokens = (u: Usage): number =>
  (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)

/**
 * Chi phí USD của một usage. `isRequest` cho biết đó là một request model, thứ mà giá theo
 * độ dài prompt dựa vào; tổng của cả lượt thì tính giá thường của model.
 */
export const costOf = (model: string, u: Usage, isRequest: boolean): number => {
  const prompt = isRequest ? (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) : 0
  const [i, o, r] = priceOf(model, prompt)
  return (
    ((u.input_tokens || 0) * i +
      (u.output_tokens || 0) * o +
      (u.cache_read_input_tokens || 0) * r +
      (u.cache_creation_input_tokens || 0) * i * CFG.cacheWriteMult) /
    1e6
  )
}

/** Cửa sổ context: Haiku 4.5 và các model Claude 3 là 200K; còn lại (kể cả Haiku 5.5) 1M. */
export const windowOf = (model: string): number => (/haiku-4|claude-3/i.test(model) ? 200_000 : 1_000_000)

/** Tên gọn của model: "claude-opus-5-5" → "Opus 5.5". */
export const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (!family) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? '.' + minor : ''}`
}
