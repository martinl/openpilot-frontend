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
}

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>
  }
}

const runtimeConfig: Partial<AppConfig> = typeof window !== 'undefined' && window.__APP_CONFIG__ ? window.__APP_CONFIG__ : {}

export const appConfig: AppConfig = {
  apiUrl: runtimeConfig.apiUrl ?? (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.konik.ai',
  athenaUrl: runtimeConfig.athenaUrl ?? (import.meta.env.VITE_ATHENA_URL as string | undefined) ?? 'https://api.konik.ai/ws',
  billingUrl: runtimeConfig.billingUrl ?? (import.meta.env.VITE_BILLING_URL as string | undefined) ?? 'https://billing.comma.ai',
  useradminUrl: runtimeConfig.useradminUrl ?? (import.meta.env.VITE_USERADMIN_URL as string | undefined) ?? 'https://useradmin.konik.ai',
  githubClientId: runtimeConfig.githubClientId ?? (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined) ?? 'Ov23liy0AI1YCd15pypf',
  googleClientId:
    runtimeConfig.googleClientId ??
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ??
    '45471411055-ornt4svd2miog6dnopve7qtmh5mnu6id.apps.googleusercontent.com',
  appleClientId: runtimeConfig.appleClientId ?? (import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined) ?? 'ai.comma.login',
  mapboxToken: runtimeConfig.mapboxToken ?? (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? '',
  mapboxUsername: runtimeConfig.mapboxUsername ?? (import.meta.env.VITE_MAPBOX_USERNAME as string | undefined) ?? 'commaai',
  mapboxLightStyleId:
    runtimeConfig.mapboxLightStyleId ?? (import.meta.env.VITE_MAPBOX_LIGHT_STYLE_ID as string | undefined) ?? 'clcl7mnu2000214s2zgcdly6e',
  mapboxDarkStyleId:
    runtimeConfig.mapboxDarkStyleId ?? (import.meta.env.VITE_MAPBOX_DARK_STYLE_ID as string | undefined) ?? 'clcgvbi4f000q15t6o2s8gys3',
  mapboxSatelliteStyleId:
    runtimeConfig.mapboxSatelliteStyleId ??
    (import.meta.env.VITE_MAPBOX_SATELLITE_STYLE_ID as string | undefined) ??
    'satellite-streets-v12',
  sentryDsn: runtimeConfig.sentryDsn ?? (import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? '',
  sentryEnvironment: runtimeConfig.sentryEnvironment ?? (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined),
  iceServers: runtimeConfig.iceServers ?? [{ urls: ['stun:stun.l.google.com:19302'] }],
}
