import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockFindMany, mockCreateSignedUrl } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { document: { findMany: mockFindMany } },
}))

vi.mock('@/lib/supabase/serviceClient', () => ({
  serviceClient: {
    storage: { from: vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) },
  },
}))

import { loadDocumentBlocks } from '@/lib/docLoader'

const TWENTY_MB = 20 * 1024 * 1024
const SIGNED_URL = 'https://example.com/signed/doc.pdf'

function makeSignedUrlOk() {
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: SIGNED_URL }, error: null })
}

function makeSmallPdfFetch() {
  const arrayBuf = new ArrayBuffer(512)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => arrayBuf,
  }))
  return arrayBuf
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadDocumentBlocks', () => {
  it('returns empty array when no documents are found', async () => {
    mockFindMany.mockResolvedValue([])
    const result = await loadDocumentBlocks('course-1', ['lecture'])
    expect(result).toEqual([])
  })

  it('filters out documents where createSignedUrl returns an error', async () => {
    mockFindMany.mockResolvedValue([{ id: '1', fileUrl: 'a/b.pdf' }])
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error('Storage error') })
    const result = await loadDocumentBlocks('course-1', ['lecture'])
    expect(result).toEqual([])
  })

  it('filters out documents where the signed URL fetch is not ok', async () => {
    mockFindMany.mockResolvedValue([{ id: '1', fileUrl: 'a/b.pdf' }])
    makeSignedUrlOk()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await loadDocumentBlocks('course-1', ['lecture'])
    expect(result).toEqual([])
  })

  it('filters out documents where the fetch throws', async () => {
    mockFindMany.mockResolvedValue([{ id: '1', fileUrl: 'a/b.pdf' }])
    makeSignedUrlOk()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network timeout')))
    const result = await loadDocumentBlocks('course-1', ['lecture'])
    expect(result).toEqual([])
  })

  it('filters out documents over 20MB', async () => {
    mockFindMany.mockResolvedValue([{ id: '1', fileUrl: 'a/b.pdf' }])
    makeSignedUrlOk()
    const bigBuf = new ArrayBuffer(TWENTY_MB + 1)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bigBuf,
    }))
    const result = await loadDocumentBlocks('course-1', ['lecture'])
    expect(result).toEqual([])
  })

  it('returns a correctly shaped DocBlock for a valid document', async () => {
    mockFindMany.mockResolvedValue([{ id: '1', fileUrl: 'a/b.pdf' }])
    makeSignedUrlOk()
    const arrayBuf = makeSmallPdfFetch()
    const expectedBase64 = Buffer.from(arrayBuf).toString('base64')

    const result = await loadDocumentBlocks('course-1', ['lecture'])

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('document')
    expect(result[0].source.type).toBe('base64')
    expect(result[0].source.media_type).toBe('application/pdf')
    expect(result[0].source.data).toBe(expectedBase64)
  })

  it('passes take to prisma.document.findMany when provided', async () => {
    mockFindMany.mockResolvedValue([])
    await loadDocumentBlocks('course-1', ['lecture', 'outcomes'], 3)
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }))
  })

  it('omits take from prisma.document.findMany when not provided', async () => {
    mockFindMany.mockResolvedValue([])
    await loadDocumentBlocks('course-1', ['lecture'])
    const callArg = mockFindMany.mock.calls[0][0]
    expect(callArg).not.toHaveProperty('take')
  })
})
