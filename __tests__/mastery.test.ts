import { describe, it, expect } from 'vitest'
import { weightedScore } from '@/lib/mastery'

describe('weightedScore — correct answers', () => {
  it('correct + CONFIDENT → 1.0', () => {
    expect(weightedScore(true, 'CONFIDENT')).toBe(1.0)
  })

  it('correct + UNSURE → 0.7', () => {
    expect(weightedScore(true, 'UNSURE')).toBe(0.7)
  })

  it('correct + GUESSED → 0.5', () => {
    expect(weightedScore(true, 'GUESSED')).toBe(0.5)
  })
})

describe('weightedScore — incorrect answers', () => {
  it('incorrect + CONFIDENT → 0.0', () => {
    expect(weightedScore(false, 'CONFIDENT')).toBe(0.0)
  })

  it('incorrect + UNSURE → 0.2', () => {
    expect(weightedScore(false, 'UNSURE')).toBe(0.2)
  })

  it('incorrect + GUESSED → 0.1', () => {
    expect(weightedScore(false, 'GUESSED')).toBe(0.1)
  })
})

describe('weightedScore — range invariant', () => {
  const cases: [boolean, string][] = [
    [true, 'CONFIDENT'],
    [true, 'UNSURE'],
    [true, 'GUESSED'],
    [false, 'CONFIDENT'],
    [false, 'UNSURE'],
    [false, 'GUESSED'],
  ]

  it.each(cases)('weightedScore(%s, %s) is between 0 and 1 inclusive', (isCorrect, confidence) => {
    const score = weightedScore(isCorrect, confidence)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})
