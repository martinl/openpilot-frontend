/* @refresh reload */
import './index.css'

import * as Sentry from '@sentry/solid'
import { render } from 'solid-js/web'
import 'solid-devtools'
import { appConfig } from './config'
import App from './App'
import './pwa.ts'

Sentry.init({
  enabled: !!appConfig.sentryEnvironment && !!appConfig.sentryDsn,
  dsn: appConfig.sentryDsn,
  environment: appConfig.sentryEnvironment,
})

const root = document.getElementById('root')

if (!root) throw new Error('No #root element found in the DOM.')

render(() => <App />, root)
