// Chọn ngôn ngữ hiển thị cho cả hai mod.
// Bản gốc nằm ở shared/; tools/sync_shared.py chép sang plugins/<mod>/hooks/lib/.
import type { EngineInterface } from 'claude-code'

export type Lang = 'en' | 'vi' | 'ru' | 'he'

// Nhận ra ngôn ngữ từ một chuỗi như "vi", "Vietnamese", "ru_RU.UTF-8", "עברית".
const PATTERNS: readonly (readonly [Lang, RegExp])[] = [
  ['he', /^(he|iw|hebrew|עברית)/i],
  ['ru', /^(ru|russian|рус)/i],
  ['vi', /^(vi|vietnamese|tiếng việt)/i],
]

const langOf = (v: unknown): Lang | null =>
  typeof v === 'string' ? (PATTERNS.find(([, re]) => re.test(v.trim()))?.[0] ?? null) : null

/**
 * Ngôn ngữ của mod. Tuỳ chọn `language` là một mã mod hỗ trợ thì dùng luôn; `auto` hoặc
 * bỏ trống thì theo cài đặt `language` của Claude Code, rồi tới locale của môi trường.
 * Ngôn ngữ mod không hỗ trợ thì về tiếng Anh.
 */
export async function detectLang<L extends Lang>($: EngineInterface, option: unknown, supported: readonly L[]): Promise<L | 'en'> {
  const known = supported as readonly unknown[]
  const pick = (l: Lang | null): L | 'en' => (l !== null && known.includes(l) ? (l as L) : 'en')
  if (option !== undefined && option !== '' && option !== 'auto') return known.includes(option) ? (option as L) : 'en'
  try {
    const settings = (await $.settings.read()) as Record<string, unknown>
    if (typeof settings.language === 'string' && settings.language.trim()) return pick(langOf(settings.language))
  } catch {
    // Không đọc được cài đặt: xét tiếp locale.
  }
  try {
    const locale = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
    return pick(langOf(locale))
  } catch {
    // Không đọc được môi trường (vd trong test): tiếng Anh.
    return 'en'
  }
}
