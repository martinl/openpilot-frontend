import type { VoidComponent } from 'solid-js'

import { generateRouteStatistics, type TimelineEvent } from '~/api/derived'
import type { Route } from '~/api/types'
import { formatDistance, formatRouteDuration } from '~/utils/format'
import StatisticBar from './StatisticBar'

const RouteStatisticsBar: VoidComponent<{ class?: string; route: Route | undefined; events?: TimelineEvent[] }> = (props) => {
  const stats = () => generateRouteStatistics(props.route, props.events ?? [])

  // Engagement is only meaningful once timeline events arrive.
  const engagement = () => {
    if (!props.events?.length) return undefined
    const { engagedDurationMs, routeDurationMs } = stats()
    if (!routeDurationMs) return undefined
    return `${Math.round((engagedDurationMs / routeDurationMs) * 100)}%`
  }

  return (
    <StatisticBar
      class={props.class}
      statistics={[
        { label: 'Distance', value: () => formatDistance(props.route?.length) },
        { label: 'Duration', value: () => formatRouteDuration(props.route) },
        ...(props.events !== undefined
          ? [
              { label: 'Engaged', value: engagement },
              { label: 'Flags', value: () => (props.events?.length ? stats().userFlags : undefined) },
            ]
          : []),
      ]}
    />
  )
}

export default RouteStatisticsBar
