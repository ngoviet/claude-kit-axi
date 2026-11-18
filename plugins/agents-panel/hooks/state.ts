// Giá trị đầu của những gì mod giữ trong $.state (sống qua reload; mỗi lần ghi làm vẽ lại
// mọi chỗ đọc nó). Hợp đồng kiểu nằm ở types/index.d.ts.
//
// Engine chỉ nhận atom được tạo bằng `atom({ plugin, key }, …)` ngay trong tệp gọi
// read/update, nên mỗi tệp tự khai atom nó dùng; tệp này chỉ giữ giá trị đầu cho thống nhất.
// Cùng plugin + key là cùng một giá trị, dù khai ở tệp nào.
//   agents  mọi subagent của phiên (tối đa 200)
//   panel   trạng thái khung: thu gọn, ẩn mục đã xong, đã tự mở cho khoá nào
//   now     mốc giờ vẽ khung, nhích mỗi giây khi có agent đang chạy
import type { AgentRun, Panel } from '../types'

export const AGENTS0: AgentRun[] = []
export const PANEL0: Panel = { isCompact: false, isDoneCollapsed: false, autoOpenedFor: '' }
