// Thông báo ra ngoài thanh: thông báo hệ thống, PushNotification, toast.
import type { EngineInterface } from 'claude-code'

/** Tên thư mục dự án của phiên. Tách cả `/` và `\` để chạy đúng trên Windows. */
export async function projectOf($: EngineInterface): Promise<string> {
  return (await $.session.cwd()).split(/[\\/]/).filter(Boolean).pop() ?? 'session'
}

/**
 * E: thông báo hệ thống qua kênh của Claude Code (`$.ui.notify`: desktop app, terminal có
 * hỗ trợ thông báo), không được thì qua công cụ PushNotification. Trả về đã gửi được chưa;
 * chưa thì người gọi tự hiện toast.
 */
export async function notifyOs($: EngineInterface, text: string, key: string, title?: string): Promise<boolean> {
  const sent = await $.ui.notify(text, { key, ...(title ? { title } : {}) }).catch(() => null)
  // `terminal_bell` chỉ kêu chuông, không hiện chữ: coi như chưa báo.
  if (sent?.isSent === true && sent.channel !== 'terminal_bell') return true

  const pushed = await $.tool
    .call({ tool: 'PushNotification', message: title ? `${title}: ${text}` : text, status: 'proactive' })
    .catch(() => null)
  return (
    pushed !== null &&
    pushed.deny === undefined &&
    pushed.isError !== true &&
    (pushed.result.pushSent === true || pushed.result.localSent === true)
  )
}
