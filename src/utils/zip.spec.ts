import { describe, expect, test } from 'vitest'

import { buildZip } from './zip'

describe('buildZip', () => {
  test('creates a valid store-only zip archive with local header, central directory, and EOCD', async () => {
    const payload = new TextEncoder().encode('hello openpilot')
    const blob = buildZip([{ name: '000000dd--455f14369d--0/rlog.zst', data: payload }])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(bytes.buffer)

    // Local file header signature PK\x03\x04
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    // End of central directory signature PK\x05\x06 at the end (22 bytes)
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50)
    expect(view.getUint16(bytes.length - 12, true)).toBe(1)

    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('000000dd--455f14369d--0/rlog.zst')
    expect(text).toContain('hello openpilot')
  })
})
