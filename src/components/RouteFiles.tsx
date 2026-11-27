import { createMemo, createResource, createSignal, For, onCleanup, Show, type VoidComponent } from 'solid-js'
import clsx from 'clsx'

import { downloadStitchedVideo, getAlreadyUploadedFiles, type DownloadVideoStage, type DownloadVideoType } from '~/api/file'
import type { Files } from '~/api/types'
import Icon from '~/components/material/Icon'
import { buildZip, type ZipEntry } from '~/utils/zip'

type Kind = keyof Files

type Row = {
  key: Kind
  label: string
  quantized?: boolean
  isLog?: boolean
  video?: DownloadVideoType
}

const ROWS: Row[] = [
  { key: 'cameras', label: 'Road camera', video: 'fcamera' },
  { key: 'ecameras', label: 'Wide-angle camera', video: 'ecamera' },
  { key: 'dcameras', label: 'Driver camera', video: 'dcamera' },
  { key: 'logs', label: 'Logs', isLog: true },
  { key: 'qcameras', label: 'Quantized camera', quantized: true },
  { key: 'qlogs', label: 'Quantized logs', quantized: true, isLog: true },
]

const segmentOf = (url: string): number => {
  const parts = url.split('/')
  return Number(parts[parts.length - 2] ?? -1)
}

const formatEta = (etaSeconds: number | null): string => {
  if (etaSeconds == null || etaSeconds <= 0) return ''
  if (etaSeconds < 60) return ` (${etaSeconds}s)`
  return ` (${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s)`
}

const RouteFiles: VoidComponent<{
  routeName: string
  dongleId: string
  dateStr: string
  totalSegments?: number
  onJumpToSegment?: (segment: number) => void
}> = (props) => {
  const [files, { refetch }] = createResource(() => props.routeName, getAlreadyUploadedFiles)
  const [segment, setSegment] = createSignal<number | null>(null)
  const [refreshing, setRefreshing] = createSignal(false)
  const [bulk, setBulk] = createSignal<{ kind: Kind; done: number; total: number } | null>(null)
  const [stitch, setStitch] = createSignal<{
    kind: Kind
    stage: DownloadVideoStage
    percent: number
    eta: number | null
    failed?: boolean
  } | null>(null)

  let bulkAbort: AbortController | null = null
  let stitchAbort: AbortController | null = null
  onCleanup(() => {
    bulkAbort?.abort()
    stitchAbort?.abort()
  })

  const bySegment = createMemo(() => {
    const map = new Map<number, Set<Kind>>()
    const data = files()
    if (!data) return map
    for (const row of ROWS) {
      for (const url of data[row.key] ?? []) {
        const n = segmentOf(url)
        if (!Number.isFinite(n) || n < 0) continue
        if (!map.has(n)) map.set(n, new Set())
        map.get(n)!.add(row.key)
      }
    }
    return map
  })

  const segments = createMemo(() => [...bySegment().keys()].sort((a, b) => a - b))
  const urlFor = (kind: Kind, n: number): string | undefined => files()?.[kind]?.find((url) => segmentOf(url) === n)
  const present = (kind: Kind): number[] => segments().filter((n) => bySegment().get(n)?.has(kind))
  const target = (kind: Kind): string | undefined => {
    const chosen = segment()
    if (chosen !== null) return urlFor(kind, chosen)
    const first = present(kind)[0]
    return first === undefined ? undefined : urlFor(kind, first)
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const routeSegmentCount = () => props.totalSegments ?? segments().length

  const downloadVideo = async (row: Row) => {
    if (!row.video || stitch()) return
    stitchAbort = new AbortController()
    setStitch({ kind: row.key, stage: 'processing', percent: 0, eta: null })
    try {
      await downloadStitchedVideo(props.routeName, row.video, {
        signal: stitchAbort.signal,
        onStage: (stage) => setStitch({ kind: row.key, stage, percent: 0, eta: null }),
        onProgress: ({ percent, etaSeconds }) => setStitch((prev) => (prev ? { ...prev, percent, eta: etaSeconds } : prev)),
      })
      setStitch(null)
    } catch (error) {
      if (stitchAbort.signal.aborted) {
        setStitch(null)
        return
      }
      console.error('Failed to download stitched video', error)
      setStitch({ kind: row.key, stage: 'processing', percent: 0, eta: null, failed: true })
      setTimeout(() => setStitch(null), 2500)
    }
  }

  const filenameFor = (url: string): string => {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const [dongle, route, seg, file] = parts.slice(-4)
    return `${dongle}_${route}--${seg}--${file}`
  }

  const saveBlob = (blob: Blob, name: string) => {
    const object = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = object
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(object), 10_000)
  }

  const downloadAll = async (kind: Kind) => {
    if (bulk()) return
    const asZip = ROWS.find((row) => row.key === kind)?.isLog === true
    const urls = (files()?.[kind] ?? []).slice().sort((a, b) => segmentOf(a) - segmentOf(b))
    bulkAbort = new AbortController()
    const { signal } = bulkAbort
    setBulk({ kind, done: 0, total: urls.length })
    try {
      const entries: ZipEntry[] = []
      for (const [index, url] of urls.entries()) {
        if (signal.aborted) break
        try {
          const response = await fetch(url, { signal })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          if (asZip) {
            const basename = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? 'file'
            entries.push({
              name: `${props.dateStr}--${segmentOf(url)}/${basename}`,
              data: new Uint8Array(await response.arrayBuffer()),
            })
          } else {
            saveBlob(await response.blob(), filenameFor(url))
          }
        } catch (error) {
          if (signal.aborted) break
          console.error(`Failed to download ${url}`, error)
        }
        setBulk({ kind, done: index + 1, total: urls.length })
      }
      if (!signal.aborted && asZip && entries.length > 0) {
        saveBlob(buildZip(entries), `${props.dongleId}_${props.dateStr}_${kind}.zip`)
      }
    } finally {
      bulkAbort = null
      setBulk(null)
    }
  }

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-sm">Files</span>
        <div class="flex items-center gap-2">
          <Show when={segment() !== null && props.onJumpToSegment}>
            <button
              type="button"
              onClick={() => props.onJumpToSegment?.(segment()!)}
              class="rounded-lg bg-surface-container-high px-2.5 py-1 text-xs text-primary hover:bg-surface-container-highest"
            >
              Jump to seg {segment()}
            </button>
          </Show>
          <button
            type="button"
            onClick={() => void refresh()}
            title="Refresh"
            class="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Icon class={clsx(refreshing() && 'animate-spin')} name="refresh" size="20" />
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-3 rounded-md bg-surface-container p-4">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSegment(null)}
            class={clsx(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              segment() === null ? 'bg-on-surface font-medium text-surface-container' : 'bg-surface-container-high text-on-surface-variant',
            )}
          >
            All
          </button>
          <For
            each={segments()}
            fallback={
              <span class="py-1.5 text-sm text-on-surface-variant">{files.loading ? 'Loading files...' : 'Nothing uploaded yet'}</span>
            }
          >
            {(n) => (
              <button
                type="button"
                onClick={() => setSegment(n)}
                class={clsx(
                  'min-w-9 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                  segment() === n
                    ? 'bg-on-surface font-medium text-surface-container'
                    : 'bg-surface-container-high text-emerald-400 hover:bg-surface-container-highest',
                )}
              >
                {n}
              </button>
            )}
          </For>
        </div>

        <div class="flex flex-col">
          <For each={ROWS}>
            {(row) => {
              const count = () => present(row.key).length
              const href = () => target(row.key)
              const available = () => (segment() === null ? count() > 0 : !!href())
              const incompleteStitch = () => count() < routeSegmentCount()
              return (
                <div class="flex flex-col gap-1.5 py-2.5">
                  <div class="flex items-center gap-2">
                    <span class={clsx('min-w-0 flex-1 truncate text-sm', available() ? 'text-on-surface' : 'text-on-surface-variant/50')}>
                      {row.label}
                    </span>

                    <Show
                      when={available()}
                      fallback={
                        <span class="shrink-0 rounded-lg bg-surface-container-high px-3 py-1.5 text-xs text-on-surface-variant/50">
                          None
                        </span>
                      }
                    >
                      <Show
                        when={row.isLog}
                        fallback={
                          <>
                            <Show when={row.video && segment() === null && count() > 0}>
                              <button
                                type="button"
                                disabled={!!stitch() || incompleteStitch()}
                                onClick={() => void downloadVideo(row)}
                                title={
                                  incompleteStitch()
                                    ? `Only ${count()} of ${routeSegmentCount()} segments uploaded`
                                    : 'Stitch every segment into one MP4'
                                }
                                class="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
                              >
                                <Icon class="text-on-surface-variant" name="download" size="20" />
                                {stitch()?.kind === row.key
                                  ? stitch()!.failed
                                    ? 'Failed'
                                    : stitch()!.stage === 'downloading'
                                      ? `Downloading ${Math.round(stitch()!.percent)}%${formatEta(stitch()!.eta)}`
                                      : `Processing ${Math.round(stitch()!.percent)}%${formatEta(stitch()!.eta)}`
                                  : incompleteStitch()
                                    ? `MP4 (${count()}/${routeSegmentCount()})`
                                    : 'MP4'}
                              </button>
                            </Show>
                            <Show when={segment() === null && count() > 0}>
                              <Show
                                when={bulk()?.kind === row.key}
                                fallback={
                                  <button
                                    type="button"
                                    disabled={!!bulk()}
                                    onClick={() => void downloadAll(row.key)}
                                    class="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
                                  >
                                    <Icon class="text-on-surface-variant" name="download" size="20" />
                                    {count() === segments().length ? 'Download all' : 'Download all (uploaded)'}
                                  </button>
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => bulkAbort?.abort()}
                                  class="flex shrink-0 items-center gap-1.5 rounded-lg bg-error-container px-3 py-1.5 text-xs text-on-error-container"
                                >
                                  <Icon name="close" size="20" />
                                  Cancel ({bulk()!.done}/{bulk()!.total})
                                </button>
                              </Show>
                            </Show>
                            <Show when={segment() !== null}>
                              <a
                                href={href()}
                                target="_blank"
                                rel="noreferrer"
                                class="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-highest"
                              >
                                <Icon class="text-on-surface-variant" name="movie" size="20" />
                                Open
                              </a>
                            </Show>
                          </>
                        }
                      >
                        <Show when={segment() === null && count() > 0}>
                          <Show
                            when={bulk()?.kind === row.key}
                            fallback={
                              <button
                                type="button"
                                disabled={!!bulk()}
                                onClick={() => void downloadAll(row.key)}
                                class="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
                              >
                                <Icon class="text-on-surface-variant" name="download" size="20" />
                                {count() === segments().length ? 'Download all' : 'Download all (uploaded)'}
                              </button>
                            }
                          >
                            <button
                              type="button"
                              onClick={() => bulkAbort?.abort()}
                              class="flex shrink-0 items-center gap-1.5 rounded-lg bg-error-container px-3 py-1.5 text-xs text-on-error-container"
                            >
                              <Icon name="close" size="20" />
                              Cancel ({bulk()!.done}/{bulk()!.total})
                            </button>
                          </Show>
                        </Show>
                        <Show when={segment() !== null}>
                          <a
                            href={href()}
                            class="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-highest"
                          >
                            <Icon class="text-on-surface-variant" name="download" size="20" />
                            Download
                          </a>
                        </Show>
                      </Show>
                    </Show>
                  </div>

                  <div class="flex h-1 gap-px overflow-hidden rounded-full">
                    <For each={segments()}>
                      {(n) => (
                        <div
                          class={clsx(
                            'h-full flex-1',
                            bySegment().get(n)?.has(row.key)
                              ? row.quantized
                                ? 'bg-sky-400'
                                : 'bg-emerald-400'
                              : 'bg-surface-container-highest',
                            segment() === n && 'ring-1 ring-on-surface',
                          )}
                        />
                      )}
                    </For>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}

export default RouteFiles
