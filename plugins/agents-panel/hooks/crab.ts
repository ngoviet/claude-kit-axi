// Con cua pixel Clawd (từ DockCrab / Clawdy): thân 24×18 trên lưới 30×28. Agent Explore đội
// mũ cướp biển; các agent khác là con cua thường. Thân giữ màu đất sét của thương hiệu.

/** Lưới vẽ con cua rộng 30 đơn vị, tính cả đạo cụ. */
export const CRAB_BOX = 30
export const CRAB_SCALE = 1.1

const CLAY = '#D97757'
const INK = '#1F1E1D'

/**
 * Tô một ô chữ nhật. `cls` xếp ô vào nhóm: `bd` (mặc định) là thân và trang phục, `la`/`lb`
 * là hai cặp chân, nhóm khác là đạo cụ có chuyển động riêng.
 */
type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

/**
 * Vẽ hình từ các dòng ký tự (mỗi ký tự một pixel, tra màu trong `map`). Mỗi dải pixel liền
 * nhau cùng màu thành một rect (bản gốc: một rect mỗi pixel); với crispEdges hình y hệt mà
 * chuỗi SVG ngắn đi nhiều lần.
 */
const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string): void =>
  rows.forEach((row, dy) => {
    const cells = [...row]
    for (let dx = 0; dx < cells.length; ) {
      const ch = cells[dx] ?? ''
      let run = 1
      while (cells[dx + run] === ch) run++
      const c = map[ch]
      if (c) f(x + dx, y + dy, run, 1, c, cls)
      dx += run
    }
  })

/** Thân, càng, mắt và chân. `armCls` cho càng giơ lên đi theo đạo cụ nó cầm. */
const crabBody = (f: Fill, armFront = 0, armCls?: string): void => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, 14 + armFront, 4, 4, CLAY, armCls)
  f(9, 12, 2, 2, INK)
  f(19, 12, 2, 2, INK)
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

/**
 * Hoạt ảnh thuần CSS, trình kết xuất tự chạy, không cần vẽ lại. Chu kỳ chia hết một giây
 * nên lần vẽ lại mỗi giây của hàng đang chạy khởi động lại chúng đúng pha. Con cua nào cũng
 * bước đi; trang phục thêm chuyển động của đạo cụ.
 */
export const CRAB_CSS = `<style>
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.c-explore.run .it{transform-origin:50% 100%;animation:fence .5s ease-in-out infinite}
@keyframes fence{50%{transform:rotate(25deg)}}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

const COSTUMES: Record<string, (f: Fill) => void> = {
  // Explore: cướp biển đi dò mã; thanh kiếm múa.
  explore: f => {
    crabBody(f)
    stamp(f, 5, 3, ['.kk..............kk.', '.kkk....kkkk....kkk.', '..kkkkkkkwwkkkkkkk..', '..kkkkkkkkkkkkkkkk..', '.gggggggggggggggggg.'], { k: '#55514C', w: '#F8F6F1', g: '#F5C542' })
    f(7, 11, 11, 1, INK); f(18, 11, 4, 3, INK)
    f(27, 6, 1, 9, '#C9CCD2', 'it'); f(26, 15, 3, 1, '#7A4A26', 'it')
  },
  other: f => crabBody(f),
}

/** Trang phục theo loại subagent. */
export const costumeOf = (type: string): string => (type === 'Explore' ? 'explore' : 'other')

/**
 * Phần trong của con cua. Thân và đạo cụ nằm trong `bd` nên đạo cụ nhún theo thân rồi thêm
 * chuyển động riêng; chân nằm ngoài và tự bước.
 */
const crabInner = (costume: string, isWalking: boolean): string => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (cx, cy, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  ;(COSTUMES[costume] ?? crabBody)(f)
  const group = (cls: string) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  return `<g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g>`
}

/**
 * Phần trong chỉ phụ thuộc trang phục và việc con cua có đi hay không: dựng một lần, mỗi lần
 * vẽ chỉ bọc thêm transform. Bản gốc dựng lại ~100-200 rect cho mỗi hàng mỗi giây.
 */
const INNER_MEMO = new Map<string, string>()

/** Con cua tại (x, y). `mirror` lật nó trong ô của chính nó (x .. x + CRAB_BOX × scale) để quay mặt sang trái. */
export const crab = (x: number, y: number, costume: string, dim = false, isWalking = false, scale = CRAB_SCALE, mirror = false): string => {
  const place = mirror ? `translate(${x + CRAB_BOX * scale},${y}) scale(${-scale},${scale})` : `translate(${x},${y}) scale(${scale})`
  const key = `${costume}|${isWalking ? 1 : 0}`
  let inner = INNER_MEMO.get(key)
  if (inner === undefined) INNER_MEMO.set(key, (inner = crabInner(costume, isWalking)))
  return `<g transform="${place}"${dim ? ' opacity="0.45"' : ''} shape-rendering="crispEdges">${inner}</g>`
}
