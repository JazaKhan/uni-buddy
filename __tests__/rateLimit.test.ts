import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted runs before any imports so these are available in vi.mock factories.
// rateLimit.ts creates `ratelimit` (general, 60/min) first, then `aiRatelimit`
// (ai, 10/min). We track call order so each instance gets its own mock limit fn.
const { mockGeneralLimit, mockAiLimit, MockRatelimit } = vi.hoisted(() => {
  const mockGeneralLimit = vi.fn()
  const mockAiLimit = vi.fn()
  let callCount = 0

  // Must be a regular function (not arrow) to support `new Ratelimit({...})`
  const MockRatelimit = Object.assign(
    function MockRatelimitCtor(this: { limit: unknown }) {
      callCount++
      this.limit = callCount === 1 ? mockGeneralLimit : mockAiLimit
    },
    { slidingWindow: function () { return {} } }
  )

  return { mockGeneralLimit, mockAiLimit, MockRatelimit }
})

// Redis must also be a class/regular-function to support `new Redis({...})`
vi.mock('@upstash/redis', () => ({ Redis: class MockRedis {} }))
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: MockRatelimit }))

import { checkRateLimit } from '@/lib/rateLimit'

beforeEach(() => {
  vi.clearAllMocks()
  mockGeneralLimit.mockResolvedValue({ success: true })
  mockAiLimit.mockResolvedValue({ success: true })
})

describe('checkRateLimit — tier routing', () => {
  it('general tier calls ratelimit, not aiRatelimit', async () => {
    await checkRateLimit('user-1', 'general')
    expect(mockGeneralLimit).toHaveBeenCalledWith('user-1')
    expect(mockAiLimit).not.toHaveBeenCalled()
  })

  it('ai tier calls aiRatelimit, not ratelimit', async () => {
    await checkRateLimit('user-1', 'ai')
    expect(mockAiLimit).toHaveBeenCalledWith('user-1')
    expect(mockGeneralLimit).not.toHaveBeenCalled()
  })

  it('defaults to general tier when no tier argument is passed', async () => {
    await checkRateLimit('user-1')
    expect(mockGeneralLimit).toHaveBeenCalledWith('user-1')
    expect(mockAiLimit).not.toHaveBeenCalled()
  })
})

describe('checkRateLimit — return value', () => {
  it('returns true when general limiter allows', async () => {
    mockGeneralLimit.mockResolvedValue({ success: true })
    expect(await checkRateLimit('user-1', 'general')).toBe(true)
  })

  it('returns false when general limiter denies', async () => {
    mockGeneralLimit.mockResolvedValue({ success: false })
    expect(await checkRateLimit('user-1', 'general')).toBe(false)
  })

  it('returns true when ai limiter allows', async () => {
    mockAiLimit.mockResolvedValue({ success: true })
    expect(await checkRateLimit('user-1', 'ai')).toBe(true)
  })

  it('returns false when ai limiter denies', async () => {
    mockAiLimit.mockResolvedValue({ success: false })
    expect(await checkRateLimit('user-1', 'ai')).toBe(false)
  })
})
