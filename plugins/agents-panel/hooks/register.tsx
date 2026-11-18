// agents-panel (bản axi, trước đây tên savvy-progress), dựa trên johnnyvizz/claude-kit plugins/savvy-progress 1.2.1, MIT.
// Thay đổi so với bản gốc (kể cả việc bỏ savvy-flow ở 2.0.0-axi.1): docs/thay-doi.md.
//
// Tệp này chỉ nối các hook; mỗi phần nằm ở module riêng:
//   config.ts   tuỳ chọn                   state.ts    giá trị trong $.state
//   strings.ts  chữ hiển thị (en ru he vi)  pricing.ts  giá model, cửa sổ context
//   runs.ts     sổ các subagent            crab.ts     con cua pixel
//   svg.ts      hình vẽ khung trên desktop  pane.tsx    khung Agents
//   row.tsx     F: dòng chi phí dưới Agent  lib/        mã chép từ shared/
import type { Register } from 'claude-code'

import { CFG, PANE, applyOptions } from './config'
import { detectLang } from './lib/lang'
import { autoOpen, drawPane, openPane, tickRunning, togglePane } from './pane'
import { drawAgentRow } from './row'
import { recordEnd, recordRequest, recordSpawn } from './runs'
import { LANGS, tr } from './strings'

export const register: Register = (on, options) => {
  applyOptions(options)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    CFG.lang = await detectLang($, options.language, LANGS)
    await $.command.register({
      name: 'agents-info',
      description: 'Show or hide the panel of subagents: running and finished, with model, context, cost and time',
    })
    // Đồng hồ của các agent đang chạy; im khi không có agent nào chạy.
    $.clock.every(1000, async () => {
      await tickRunning($)
    })
    return started
  })

  on('command.run', { command: 'agents-info' }, async ($, e) => {
    // `/agents-info open` mở khung hoặc đưa nó lên trước, không bật/tắt.
    if ((e.args ?? '').trim() === 'open') {
      await openPane($)
      return { text: tr().opened }
    }
    return { text: (await togglePane($)) ? tr().opened : tr().closed }
  })

  // --- Sổ subagent

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started
    await recordSpawn($, {
      agentId: started.agentId,
      toolUseId: e.tool_use_id,
      type: e.subagentType,
      description: e.description,
      model: started.model,
    })
    if (CFG.autoOpen) await autoOpen($, 'any-agent')
    return started
  })

  // Mỗi request model của một subagent: context, token và chi phí.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (e.agentId && result.usage) {
      await recordRequest($, e.agentId, result.usage.model || e.model, typeof e.effort === 'string' ? e.effort : undefined, result.usage)
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) await recordEnd($, e.agentId, e.reason === 'answer', e.usage ?? null)
    return next(e)
  })

  // --- Vẽ

  on('ui.render', { component: 'ToolUse' }, ($, e, next) => drawAgentRow($, e, next))
  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => drawPane($, e))
}
