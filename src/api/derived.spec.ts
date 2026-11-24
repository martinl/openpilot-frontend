import { describe, expect, test } from 'vitest'

import { generateRouteStatistics, generateTimelineEvents } from './derived'
import type { Route } from './types'

const baseRoute = {
  fullname: '0000000000000000|2026-01-01--00-00-00',
  dongle_id: '0000000000000000',
  start_time: '2026-01-01T00:00:00',
  end_time: '2026-01-01T00:02:00',
  maxqlog: 1,
  url: 'https://example.com/route',
  length: 2,
  is_public: false,
} as Route

describe('derived route events', () => {
  test('counts both legacy user_flag and openpilot user_bookmark events', () => {
    const timeline = generateTimelineEvents(baseRoute, [
      {
        type: 'state',
        time: 0,
        offset_millis: 0,
        route_offset_millis: 10_000,
        data: { state: 'enabled', enabled: true, alertStatus: 0 },
      },
      {
        type: 'state',
        time: 0,
        offset_millis: 0,
        route_offset_millis: 40_000,
        data: { state: 'disabled', enabled: false, alertStatus: 0 },
      },
      {
        type: 'user_flag',
        time: 0,
        offset_millis: 0,
        route_offset_millis: 15_000,
        data: {},
      },
      {
        type: 'user_bookmark',
        time: 0,
        offset_millis: 0,
        route_offset_millis: 25_000,
        data: {},
      },
    ])

    const stats = generateRouteStatistics(baseRoute, timeline)
    expect(stats.routeDurationMs).toBe(120_000)
    expect(stats.engagedDurationMs).toBe(30_000)
    expect(stats.userFlags).toBe(2)
  })
})
