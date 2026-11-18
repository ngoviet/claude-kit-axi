// Vẽ thanh phía trên ô nhập.
import { atom, read, update } from 'claude-code'
import type { MatchedHook } from 'claude-code'

import { cacheLevel, cacheText } from './cache'
import { CFG } from './config'
import { ALERT, CACHE, CACHE_ICON, MONEY, MONEY_ICON, SPEED, SPEED_ICON, WARN, contextBar, contextIcon } from './icons'
import { span, usd } from './lib/format'
import { LIMIT_LABEL, limitColor } from './limits'
import { CACHE0, LIMITS0, STATS0 } from './state'
import { tr } from './strings'

const cache = atom({ plugin: 'session-band', key: 'cache' } as const, CACHE0)
const isHidden = atom({ plugin: 'session-band', key: 'isHidden' } as const, false)
const limits = atom({ plugin: 'session-band', key: 'limits' } as const, LIMITS0)
const stats = atom({ plugin: 'session-band', key: 'stats' } as const, STATS0)

/**
 * Mức dày theo bề rộng (số ô) để thanh co lại thay vì xuống dòng:
 * 0 đủ cả; 1 bỏ thanh context; 2 gọn lượt/tốc độ; 3 chỉ chi phí lượt, biểu tượng nhỏ hơn;
 * 4 bỏ tốc độ. TIER_MIN là số cột tối thiểu của từng mức.
 */
const TIER_MIN = [78, 64, 52, 40] as const
const GAPS = [3, 2, 2, 1, 1] as const
export const tierFor = (columns: number): number => {
  const i = TIER_MIN.findIndex(min => columns >= min)
  return i === -1 ? TIER_MIN.length : i
}
/** A: số cột thêm cho hạn mức; thiếu chỗ thì bỏ hạn mức trước khi hạ mức thanh. */
const LIMIT_COLUMNS = 12

/** Bề rộng đo được lần vẽ gần nhất, cho `/session_data width` khi chỉnh TIER_MIN. */
export const lastDrawn = { columns: null as number | null }

type BandHook = MatchedHook<'ui.render', { component: 'AbovePrompt' }>

/** Hook `ui.render` của AbovePrompt. Viết dạng function khai báo: engine chỉ theo `$` qua import vào hàm khai báo. */
export async function drawBand($: Parameters<BandHook>[0], e: Parameters<BandHook>[1], next: Parameters<BandHook>[2]): Promise<Awaited<ReturnType<BandHook>>> {
  const s = await read($, stats)
  if (e.props.hasSurvey || s.turn === 0 || (await read($, isHidden))) return next(e)

  const t = tr()
  const ui = $.ui.resolve(e)
  const { Box, Button, Text } = ui
  const Svg = 'Svg' in ui ? ui.Svg : null
  const speed = s.speed === null ? '—' : `${s.speed} tok/s`
  const turnCost = s.turnCost === null ? '—' : usd(s.turnCost)

  const { secondsLeft } = await read($, cache)
  const lv = e.props.isWorking || secondsLeft === null ? null : cacheLevel(secondsLeft)
  const level = lv === 'alert' ? ALERT : lv === 'warn' ? WARN : null
  const cacheColor = level ?? CACHE
  const cacheLabel = e.props.isWorking ? '…' : secondsLeft === null ? '—' : cacheText(secondsLeft)

  lastDrawn.columns = e.props.bodyColumns
  // A: hạn mức chỉ hiện khi còn đủ chỗ sau phần gốc của thanh.
  const all = CFG.showLimits ? await read($, limits) : []
  const hasRoom = all.length > 0 && e.props.bodyColumns >= TIER_MIN[1] + LIMIT_COLUMNS
  const tier = tierFor(e.props.bodyColumns - (hasRoom ? LIMIT_COLUMNS : 0))
  const shownLimits = hasRoom ? all.filter(l => tier === 0 || l.kind === 'five_hour') : []
  const icon = tier >= 3 ? 18 : 22

  return (
    <Box
      flexDirection="row"
      alignItems="center"
      columnGap={GAPS[tier]}
      flexWrap="nowrap"
      overflow="hidden"
      paddingX={1}
      {...(level ? { borderStyle: 'round', borderColor: level } : {})}
    >
      {tier <= 2 ? (
        <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
          {tier <= 1 ? <Text dimColor>{t.turn}</Text> : <Text dimColor>#</Text>}
          <Text bold>{String(s.turn)}</Text>
        </Box>
      ) : null}
      {tier <= 3 ? (
        <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
          {Svg ? <Svg source={SPEED_ICON} alt="speed" width={icon} height={icon} /> : <Text color={SPEED}>⚡</Text>}
          <Text bold wrap="truncate-end">{tier <= 1 || s.speed === null ? speed : `${s.speed}/s`}</Text>
        </Box>
      ) : null}
      <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
        {Svg ? <Svg source={MONEY_ICON} alt="cost" width={icon} height={icon} /> : <Text color={MONEY}>$</Text>}
        <Text bold color={MONEY}>{turnCost}</Text>
        {tier <= 2 ? <Text dimColor>|</Text> : null}
        {tier <= 2 ? <Text bold>{usd(s.total)}</Text> : null}
      </Box>
      <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
        {Svg ? <Svg source={CACHE_ICON[cacheColor] ?? ''} alt="cache" width={icon} height={icon} /> : <Text color={cacheColor}>⧗</Text>}
        <Text bold color={level ?? undefined}>{cacheLabel}</Text>
      </Box>
      {shownLimits.map(l => (
        <Box key={l.kind} flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
          <Text dimColor>{LIMIT_LABEL[l.kind] ?? l.kind}</Text>
          <Text bold color={limitColor(l)}>{`${l.percent}%`}</Text>
          {l.etaMs !== null ? <Text color={WARN}>{`⚠${span(l.etaMs)}`}</Text> : null}
        </Box>
      ))}
      <Box flexGrow={1} flexShrink={1} />
      <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
        {Svg ? <Svg source={contextIcon(s.context)} alt="context" width={icon} height={icon} /> : null}
        {Svg && tier === 0 ? <Svg source={contextBar(s.context)} alt={`context ${s.context}%`} width={80} height={6} /> : null}
        <Text bold>{`${s.context}%`}</Text>
      </Box>
      <Button key="hide" label="×" role="dismiss" plain dimColor onPress={() => update($, isHidden, () => true)} />
    </Box>
  )
}
