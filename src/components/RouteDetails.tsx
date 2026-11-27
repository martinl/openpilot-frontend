import { createSignal, Show, type VoidComponent } from 'solid-js'

import type { Route } from '~/api/types'
import Icon from '~/components/material/Icon'

const CopyRow: VoidComponent<{ label: string; value: string | undefined; href?: string; mono?: boolean }> = (props) => {
  const [copied, setCopied] = createSignal(false)
  const copy = () => {
    if (!props.value) return
    void navigator.clipboard?.writeText(props.value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <Show when={props.value}>
      {(value) => (
        <div class="flex items-center gap-3 border-b border-surface-container-high px-4 py-2.5 last:border-0">
          <span class="w-24 shrink-0 text-sm text-on-surface-variant">{props.label}</span>
          <Show
            when={props.href}
            fallback={<span class={`min-w-0 flex-1 truncate text-sm text-on-surface ${props.mono ? 'font-mono' : ''}`}>{value()}</span>}
          >
            {(href) => (
              <a href={href()} target="_blank" rel="noreferrer" class="min-w-0 flex-1 truncate text-sm text-primary hover:underline">
                {value()}
              </a>
            )}
          </Show>
          <button
            type="button"
            onClick={copy}
            title="Copy"
            class="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
          >
            <Icon name={copied() ? 'check' : 'file_copy'} size="20" />
          </button>
        </div>
      )}
    </Show>
  )
}

const RouteDetails: VoidComponent<{ routeName: string; route: Route | undefined; dongleId: string }> = (props) => {
  const repo = () => props.route?.git_remote?.replace(/^https?:\/\//, '').replace(/\.git$/, '')
  const commit = () => props.route?.git_commit?.slice(0, 7) || undefined

  return (
    <div class="flex flex-col gap-2">
      <span class="text-sm">Details</span>
      <div class="overflow-hidden rounded-md bg-surface-container">
        <CopyRow label="Route" value={props.routeName} mono />
        <CopyRow label="Dongle ID" value={props.dongleId} mono />
        <CopyRow label="Vehicle" value={props.route?.platform || undefined} mono />
        <CopyRow label="Repo" value={repo()} href={props.route?.git_remote || undefined} />
        <CopyRow label="Branch" value={props.route?.git_branch || undefined} mono />
        <CopyRow label="Commit" value={commit()} mono />
        <CopyRow label="Version" value={props.route?.version || undefined} mono />
      </div>
    </div>
  )
}

export default RouteDetails
