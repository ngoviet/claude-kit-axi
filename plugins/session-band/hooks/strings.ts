// Chữ hiển thị: tiếng Anh như bản gốc, thêm tiếng Việt.
import { CFG } from './config'

export const LANGS = ['en', 'vi'] as const

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

/** Bộ chữ theo ngôn ngữ đang chọn. */
export const tr = () => STRINGS[CFG.lang === 'vi' ? 'vi' : 'en']
