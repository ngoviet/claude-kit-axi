// Giá trị đầu của những gì mod giữ trong $.state (sống qua reload; mỗi lần ghi làm vẽ lại
// mọi chỗ đọc nó). Hợp đồng kiểu nằm ở types/index.d.ts.
//
// Engine chỉ nhận atom được tạo bằng `atom({ plugin, key }, …)` ngay trong tệp gọi
// read/update, nên mỗi tệp tự khai atom nó dùng; tệp này chỉ giữ giá trị đầu cho thống nhất.
// Cùng plugin + key là cùng một giá trị, dù khai ở tệp nào.
//   stats     lượt, tốc độ, chi phí, context           cache    hạn cache, giây còn lại
//   isHidden  đã đóng bằng × (ẩn tới hết phiên)        isBusy   đang có lượt chạy
//   warned    mốc phút nhỏ nhất đã báo, 0 là chưa      limits   A: cửa sổ hạn mức
//   fired     D: khoá ngưỡng đã báo (không ai vẽ)       measure  B: phép đo /token
import type { Cache, Limit, Measure, Stats } from '../types'

export const STATS0: Stats = { turn: 0, speed: null, turnCost: null, total: 0, context: 0, costAtStart: 0 }
export const CACHE0: Cache = { expiresAt: null, secondsLeft: null }
export const LIMITS0: Limit[] = []
export const FIRED0: string[] = []
export const MEASURE0: Measure | null = null
