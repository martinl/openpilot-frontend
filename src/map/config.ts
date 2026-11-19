import { appConfig } from '~/config'

export const MAPBOX_USERNAME = appConfig.mapboxUsername

export const MAPBOX_LIGHT_STYLE_ID = appConfig.mapboxLightStyleId
export const MAPBOX_DARK_STYLE_ID = appConfig.mapboxDarkStyleId
export const MAPBOX_SATELLITE_STYLE_ID = appConfig.mapboxSatelliteStyleId

export type BaseMapStyleKey = 'light' | 'dark' | 'satellite'

export type MapStyleOption = {
  key: BaseMapStyleKey
  label: string
  owner: string
  id: string
}

export const MAP_STYLE_OPTIONS: MapStyleOption[] = [
  { key: 'light', label: 'Light', owner: MAPBOX_USERNAME, id: MAPBOX_LIGHT_STYLE_ID },
  { key: 'dark', label: 'Dark', owner: MAPBOX_USERNAME, id: MAPBOX_DARK_STYLE_ID },
  // mapbox-owned style keeps satellite tiles available even if custom styles change
  { key: 'satellite', label: 'Satellite', owner: 'mapbox', id: MAPBOX_SATELLITE_STYLE_ID },
]

export const MAPBOX_TOKEN = appConfig.mapboxToken
