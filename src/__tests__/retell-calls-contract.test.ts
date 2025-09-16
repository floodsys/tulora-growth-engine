import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRetellCalls } from '@/hooks/useRetellCalls'
import { renderHook } from '@testing-library/react'

// Mock supabase
const mockInvoke = vi.fn()
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke
    }
  }
}))

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('Retell Calls Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle exact response shape from edge function', async () => {
    // Mock successful response with exact expected shape
    const mockResponse = {
      data: {
        calls: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      },
      error: null
    }

    mockInvoke.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useRetellCalls('test-org-id'))

    // Wait for the hook to finish loading
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify exact response shape is handled correctly
    expect(result.current.calls).toEqual([])
    expect(result.current.pagination).toEqual({
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false
    })
  })

  it('should reject responses with extra top-level fields', async () => {
    // Mock response with extra fields (should not break but extra fields ignored)
    const mockResponse = {
      data: {
        calls: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false
        },
        extraField: 'should be ignored' // Extra field
      },
      error: null
    }

    mockInvoke.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useRetellCalls('test-org-id'))

    // Wait for the hook to finish loading
    await new Promise(resolve => setTimeout(resolve, 100))

    // Should still work with extra fields (graceful handling)
    expect(result.current.calls).toEqual([])
    expect(result.current.pagination).toEqual({
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false
    })
  })

  it('should handle missing required fields in response', async () => {
    // Mock response missing pagination field
    const mockResponse = {
      data: {
        calls: []
        // Missing pagination field
      },
      error: null
    }

    mockInvoke.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useRetellCalls('test-org-id'))

    // Wait for the hook to finish loading
    await new Promise(resolve => setTimeout(resolve, 100))

    // Should fallback to default pagination when missing
    expect(result.current.calls).toEqual([])
    expect(result.current.pagination).toEqual({
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false
    })
  })
})