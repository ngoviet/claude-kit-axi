// Tuỳ chọn của mod sau khi đọc và kiểm.
//
// Engine đòi mọi hàm nhận `$` khai báo ở cấp đầu tệp, nên các hàm đó không đọc được biến
// trong `register`. Tuỳ chọn vì vậy được ghi vào object CFG này một lần lúc `register`.
import type { Lang } from './lib/lang'

/** Mã của khung Agents (pane). */
export const PANE = 'agents-panel'

export const CFG = {
  lang: 'en' as Lang,
  /**
   * Hệ số giá ghi cache so với giá input: 1,25 cho loại 5 phút, 2 cho loại 1 giờ. Engine chỉ
   * báo một số ghi cache, không tách loại. Đo transcript 7 ngày trên PC1 (17/11/2026):
   * subagent ghi 100% loại 5 phút (luồng chính ~99% loại 1 giờ), nên mặc định 5m;
   * `subagentCacheTtl: 1h` trả về cách tính của bản gốc.
   */
  cacheWriteMult: 1.25,
  /** Tự mở khung khi subagent đầu tiên của phiên chạy. */
  autoOpen: true,
  /** F: dòng chi phí dưới mỗi hàng gọi Agent. */
  rowCost: true,
}

/** Đọc tuỳ chọn vào CFG. `language: auto` thì dò thêm ở session.start (cần `$`). */
export const applyOptions = (options: Record<string, unknown>): void => {
  // Ngôn ngữ đặt cứng áp ngay, để khung đúng tiếng cả trước khi session.start chạy xong.
  const l = options.language
  CFG.lang = l === 'ru' || l === 'he' || l === 'vi' ? l : 'en'
  CFG.cacheWriteMult = options.subagentCacheTtl === '1h' ? 2 : 1.25
  // `savvy` là giá trị cũ (chỉ mở cho savvy-flow, đã bỏ): coi như `any`.
  CFG.autoOpen = options.autoOpen !== 'off'
  CFG.rowCost = options.rowCost !== 'off'
}
