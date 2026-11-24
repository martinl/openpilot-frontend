export interface AppConfig {
  apiUrl: string
  athenaUrl: string
  billingUrl: string
  useradminUrl: string
  githubClientId: string
  googleClientId: string
  appleClientId: string
  mapboxToken: string
  mapboxUsername: string
  mapboxLightStyleId: string
  mapboxDarkStyleId: string
  mapboxSatelliteStyleId: string
  sentryDsn: string
  sentryEnvironment?: string
  iceServers: RTCIceServer[]
  enableLiveView: boolean
}

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>
  }
}

const parseEnvBool = (value: string | undefined): boolean | undefined => {
  if (value === undefined) return undefined
  return value.toLowerCase() === 'true' || value === '1'
}

const appCfg: Partial<AppConfig> = typeof window !== 'undefined' && window.__APP_CONFIG__ ? window.__APP_CONFIG__ : {}

export const appConfig: AppConfig = {
  apiUrl: appCfg.apiUrl ?? (import.meta.env.VITE_API_URL as string | undefined) ?? '',
  athenaUrl: appCfg.athenaUrl ?? (import.meta.env.VITE_ATHENA_URL as string | undefined) ?? '',
  billingUrl: appCfg.billingUrl ?? (import.meta.env.VITE_BILLING_URL as string | undefined) ?? 'https://billing.comma.ai',
  useradminUrl: appCfg.useradminUrl ?? (import.meta.env.VITE_USERADMIN_URL as string | undefined) ?? '',
  githubClientId: appCfg.githubClientId ?? (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined) ?? 'Ov23liy0AI1YCd15pypf',
  googleClientId:
    appCfg.googleClientId ??
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ??
    '45471411055-ornt4svd2miog6dnopve7qtmh5mnu6id.apps.googleusercontent.com',
  appleClientId: appCfg.appleClientId ?? (import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined) ?? 'ai.comma.login',
  mapboxToken: appCfg.mapboxToken ?? (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? '',
  mapboxUsername: appCfg.mapboxUsername ?? (import.meta.env.VITE_MAPBOX_USERNAME as string | undefined) ?? 'commaai',
  mapboxLightStyleId:
    appCfg.mapboxLightStyleId ?? (import.meta.env.VITE_MAPBOX_LIGHT_STYLE_ID as string | undefined) ?? 'clcl7mnu2000214s2zgcdly6e',
  mapboxDarkStyleId:
    appCfg.mapboxDarkStyleId ?? (import.meta.env.VITE_MAPBOX_DARK_STYLE_ID as string | undefined) ?? 'clcgvbi4f000q15t6o2s8gys3',
  mapboxSatelliteStyleId:
    appCfg.mapboxSatelliteStyleId ?? (import.meta.env.VITE_MAPBOX_SATELLITE_STYLE_ID as string | undefined) ?? 'satellite-streets-v12',
  sentryDsn: appCfg.sentryDsn ?? (import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? '',
  sentryEnvironment: appCfg.sentryEnvironment ?? (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined),
  iceServers: appCfg.iceServers ?? [{ urls: ['stun:stun.l.google.com:19302'] }],
  enableLiveView: appCfg.enableLiveView ?? parseEnvBool(import.meta.env.VITE_ENABLE_LIVE_VIEW as string | undefined) ?? true,
}
