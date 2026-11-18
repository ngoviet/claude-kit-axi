// F: dưới hàng gọi Agent trong transcript, một dòng model · token · chi phí · thời gian của
// đúng subagent đó. Không đọc `now` (đổi mỗi giây): dòng chỉ vẽ lại theo từng request.
import { atom, read } from 'claude-code'
import type { MatchedHook } from 'claude-code'

import { CFG } from './config'
import { stopwatch, tokens, usdShort } from './lib/format'
import { elapsed, runModel } from './runs'
import { AGENTS0 } from './state'

const agents = atom({ plugin: 'agents-panel', key: 'agents' } as const, AGENTS0)

type RowHook = MatchedHook<'ui.render', { component: 'ToolUse' }>

/** Hook `ui.render` của hàng công cụ: giữ hàng gốc, thêm dòng chi phí dưới hàng Agent. */
export async function drawAgentRow($: Parameters<RowHook>[0], e: Parameters<RowHook>[1], next: Parameters<RowHook>[2]): Promise<Awaited<ReturnType<RowHook>>> {
  if (e.props.tool !== 'Agent' || !CFG.rowCost) return next(e)
  const run = (await read($, agents)).find(a => a.toolUseId === e.props.tool_use_id)
  // Agent chưa gửi request nào thì chưa có gì để báo.
  if (!run || (run.steps === 0 && run.status === 'running')) return next(e)

  const { Box, Text } = $.ui.resolve(e)
  const row = await next(e)
  const at = await $.clock.now()
  const line = `${runModel(run)} · ${tokens(run.tokens)} tok · ≈${usdShort(run.costUsd)} · ${stopwatch(elapsed(run, at))}`
  return (
    <Box flexDirection="column">
      {row}
      <Text dimColor wrap="truncate-end">{`  ${line}`}</Text>
    </Box>
  )
}
