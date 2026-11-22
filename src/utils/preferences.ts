import { createSignal } from 'solid-js'

import storage from './storage'

export type UnitSystem = 'auto' | 'metric' | 'imperial'
export type TimeFormat = 'auto' | '24h' | '12h'

const isValidUnitSystem = (value: string | null): value is UnitSystem => value === 'auto' || value === 'metric' || value === 'imperial'

const isValidTimeFormat = (value: string | null): value is TimeFormat => value === 'auto' || value === '24h' || value === '12h'

const readInitialUnitSystem = (): UnitSystem => {
  const stored = storage.getItem('unitSystem')
  return isValidUnitSystem(stored) ? stored : 'auto'
}

const readInitialTimeFormat = (): TimeFormat => {
  const stored = storage.getItem('timeFormat')
  return isValidTimeFormat(stored) ? stored : 'auto'
}

const [unitSystem, _setUnitSystem] = createSignal<UnitSystem>(readInitialUnitSystem())
const [timeFormat, _setTimeFormat] = createSignal<TimeFormat>(readInitialTimeFormat())

export const setUnitSystem = (value: UnitSystem): void => {
  _setUnitSystem(value)
  storage.setItem('unitSystem', value)
}

export const setTimeFormat = (value: TimeFormat): void => {
  _setTimeFormat(value)
  storage.setItem('timeFormat', value)
}

export const useUnitSystem = () => [unitSystem, setUnitSystem] as const
export const useTimeFormat = () => [timeFormat, setTimeFormat] as const

export const isImperial = (): boolean => {
  const pref = unitSystem()
  if (pref === 'imperial') return true
  if (pref === 'metric') return false
  if (typeof navigator === 'undefined') return true
  const locale = navigator.language.toLowerCase()
  return locale.startsWith('en-us') || locale.startsWith('en-gb')
}

export const is24HourTime = (): boolean => {
  const pref = timeFormat()
  if (pref === '24h') return true
  if (pref === '12h') return false
  try {
    return Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 === false
  } catch {
    return false
  }
}
