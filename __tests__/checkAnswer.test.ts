import { describe, it, expect } from 'vitest'
import { extractJsonFromText, validateGradingResult } from '@/lib/checkAnswerHelpers'

describe('extractJsonFromText', () => {
  it('extracts a plain JSON object', () => {
    const text = '{"result":"correct","explanation":"Good answer.","suggestedMark":true}'
    expect(extractJsonFromText(text)).toEqual({
      result: 'correct',
      explanation: 'Good answer.',
      suggestedMark: true,
    })
  })

  it('extracts JSON wrapped in a markdown code fence', () => {
    const text = '```json\n{"result":"partial","explanation":"Close.","suggestedMark":true}\n```'
    expect(extractJsonFromText(text)).toEqual({
      result: 'partial',
      explanation: 'Close.',
      suggestedMark: true,
    })
  })

  it('extracts JSON preceded by prose text', () => {
    const text = 'Here is my grading:\n{"result":"incorrect","explanation":"Off target.","suggestedMark":false}'
    const parsed = extractJsonFromText(text)
    expect(parsed).not.toBeNull()
    expect(parsed?.result).toBe('incorrect')
  })

  it('returns null when the response contains no JSON object', () => {
    expect(extractJsonFromText('No JSON here at all.')).toBeNull()
  })

  it('returns null when the matched braces contain malformed JSON', () => {
    expect(extractJsonFromText('{result: correct, not valid json}')).toBeNull()
  })
})

describe('validateGradingResult', () => {
  it('"correct" passes through unchanged', () => {
    expect(validateGradingResult('correct')).toBe('correct')
  })

  it('"partial" passes through unchanged', () => {
    expect(validateGradingResult('partial')).toBe('partial')
  })

  it('"incorrect" passes through unchanged', () => {
    expect(validateGradingResult('incorrect')).toBe('incorrect')
  })

  it('falls back to "incorrect" for an unrecognised string', () => {
    expect(validateGradingResult('wrong')).toBe('incorrect')
  })

  it('falls back to "incorrect" for undefined', () => {
    expect(validateGradingResult(undefined)).toBe('incorrect')
  })

  it('falls back to "incorrect" for null', () => {
    expect(validateGradingResult(null)).toBe('incorrect')
  })

  it('falls back to "incorrect" for a number', () => {
    expect(validateGradingResult(1)).toBe('incorrect')
  })
})
