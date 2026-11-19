// Chữ hiển thị: tiếng Anh, Nga, Do Thái như bản gốc, thêm tiếng Việt.
import { CFG } from './config'

export const LANGS = ['en', 'ru', 'he', 'vi'] as const

const STRINGS = {
  en: {
    pane: 'Agents',
    cost: 'Cost',
    tokens: 'Tokens',
    time: 'Time',
    collapse: 'Collapse',
    expand: 'Expand',
    running: 'Running',
    finished: 'Finished',
    empty: 'No subagents yet.',
    round: 'round',
    failed: 'error',
    tokensWord: 'tokens',
    agentsCount: 'agents',
    isRunning: 'running',
    isFinished: 'finished',
    opened: 'Agents panel opened.',
    closed: 'Agents panel closed.',
    ctx: 'ctx',
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  ru: {
    pane: 'Агенты',
    cost: 'Стоимость',
    tokens: 'Токены',
    time: 'Время',
    collapse: 'Свернуть',
    expand: 'Развернуть',
    running: 'Работают',
    finished: 'Завершены',
    empty: 'Субагентов пока нет.',
    round: 'раунд',
    failed: 'ошибка',
    tokensWord: 'токенов',
    agentsCount: 'агентов',
    isRunning: 'работает',
    isFinished: 'завершён',
    opened: 'Панель агентов открыта.',
    closed: 'Панель агентов закрыта.',
    ctx: 'ctx',
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  he: {
    pane: 'סוכנים',
    cost: 'עלות',
    tokens: 'טוקנים',
    time: 'זמן',
    collapse: 'כיווץ',
    expand: 'הרחבה',
    running: 'פועלים',
    finished: 'הסתיימו',
    empty: 'עדיין אין סוכנים.',
    round: 'סבב',
    failed: 'שגיאה',
    tokensWord: 'טוקנים',
    agentsCount: 'סוכנים',
    isRunning: 'פועל',
    isFinished: 'הסתיים',
    opened: 'חלונית הסוכנים נפתחה.',
    closed: 'חלונית הסוכנים נסגרה.',
    ctx: 'הקשר',
    effort: { low: 'נמוך', medium: 'בינוני', high: 'גבוה', xhigh: 'גבוה מאוד', max: 'מקסימלי' },
  },
  vi: {
    pane: 'Agent',
    cost: 'Chi phí',
    tokens: 'Token',
    time: 'Thời gian',
    collapse: 'Thu gọn',
    expand: 'Mở rộng',
    running: 'Đang chạy',
    finished: 'Đã xong',
    empty: 'Chưa có subagent nào.',
    round: 'vòng',
    failed: 'lỗi',
    tokensWord: 'token',
    agentsCount: 'agent',
    isRunning: 'đang chạy',
    isFinished: 'đã xong',
    opened: 'Đã mở bảng agent.',
    closed: 'Đã đóng bảng agent.',
    ctx: 'ctx',
    // Theo bản Việt của Claude Code: Thấp · Trung bình · Cao · Cao hơn · Tối đa (viết thường vì đứng giữa dòng).
    effort: { low: 'thấp', medium: 'trung bình', high: 'cao', xhigh: 'cao hơn', max: 'tối đa' },
  },
} as const

/** Bộ chữ theo ngôn ngữ đang chọn. */
export const tr = () => STRINGS[CFG.lang]

/** Tiếng Do Thái vẽ mọi hàng lật ngược: con cua và tiêu đề bên phải, số bên trái. */
export const isRtl = (): boolean => CFG.lang === 'he'

/** Chữ của mức effort; mức lạ giữ nguyên như engine báo. */
export const effortWord = (effort: string): string => (tr().effort as Record<string, string>)[effort] ?? effort
