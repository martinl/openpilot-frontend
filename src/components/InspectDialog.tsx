import { createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX, type VoidComponent } from 'solid-js'
import { Portal } from 'solid-js/web'

import Icon from '~/components/material/Icon'
import { formatTime, parseTimestamp } from '~/utils/format'

const TITLE_CASE = /([a-z0-9])([A-Z])/g

const label = (key: string): string => {
  const spaced = key.replace(/_/g, ' ').replace(TITLE_CASE, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const isTimestampField = (key: string) => key.endsWith('_millis') || key.endsWith('_time') || key === 'last_athena_ping'

const display = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '--'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    if (!value) return isTimestampField(key) ? '--' : '0'
    if (isTimestampField(key)) {
      const d = parseTimestamp(value).local()
      return d.isValid() ? `${d.format('YYYY-MM-DD')} ${formatTime(d)}` : String(value)
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(4)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const InspectDialog: VoidComponent<{
  title: string
  subtitle?: string
  open: boolean
  onClose: () => void
  data: Record<string, unknown> | undefined
  error?: string
  actions?: JSX.Element
}> = (props) => {
  const [raw, setRaw] = createSignal(false)
  const [copied, setCopied] = createSignal(false)

  const entries = createMemo(() => Object.entries(props.data ?? {}).sort(([a], [b]) => a.localeCompare(b)))
  const json = () => JSON.stringify(props.data ?? {}, null, 2)

  createEffect(() => {
    if (!props.open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => document.removeEventListener('keydown', onKeyDown))
  })

  const copy = () => {
    void navigator.clipboard?.writeText(json()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
          onClick={() => props.onClose()}
        >
          <div
            class="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-surface-container-low shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center gap-3 border-b border-surface-container-high px-5 py-4">
              <div class="min-w-0 flex-1">
                <h3 class="truncate text-base font-medium text-on-surface">{props.title}</h3>
                <Show when={props.subtitle}>
                  <p class="truncate font-mono text-xs text-on-surface-variant">{props.subtitle}</p>
                </Show>
              </div>
              <button
                type="button"
                onClick={() => setRaw((v) => !v)}
                class="rounded-lg px-2.5 py-1.5 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-high"
              >
                {raw() ? 'Table' : 'Raw JSON'}
              </button>
              <button
                type="button"
                onClick={copy}
                title="Copy JSON"
                class="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high"
              >
                <Icon name={copied() ? 'check' : 'file_copy'} size="20" />
              </button>
              <button
                type="button"
                onClick={() => props.onClose()}
                title="Close"
                class="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high"
              >
                <Icon name="close" size="20" />
              </button>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto">
              <Show when={!props.error} fallback={<div class="p-5 text-sm text-error">{props.error}</div>}>
                <Show when={props.data} fallback={<div class="p-5 text-sm text-on-surface-variant">Loading...</div>}>
                  <Show
                    when={!raw()}
                    fallback={<pre class="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-on-surface-variant">{json()}</pre>}
                  >
                    <For each={entries()}>
                      {([key, value]) => (
                        <div class="flex items-start gap-4 border-b border-surface-container px-5 py-2.5 last:border-0">
                          <span class="w-44 shrink-0 text-sm text-on-surface-variant">{label(key)}</span>
                          <span class="min-w-0 flex-1 break-words font-mono text-sm text-on-surface">{display(key, value)}</span>
                        </div>
                      )}
                    </For>
                  </Show>
                </Show>
              </Show>
            </div>

            <Show when={props.actions}>
              <div class="flex flex-wrap gap-2 border-t border-surface-container-high px-5 py-3">{props.actions}</div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  )
}

export default InspectDialog
