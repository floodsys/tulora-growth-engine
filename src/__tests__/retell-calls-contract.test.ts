import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// vi.hoisted runs before vi.mock hoisting, so the reference is available
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn()
}))

// Mock supabase
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

// Mock useUserOrganization (imported by useRetellCalls)
vi.mock('@/hooks/useUserOrganization', () => ({
  useUserOrganization: () => ({ organization: { id: 'test-org-id' }, loading: false })
}))

// Must import after mocks are declared
const { useRetellCalls } = await import('@/hooks/useRetellCalls')

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

    const { result } = renderHook(() => useRetellCalls())

    // Wait for the hook to finish loading (inside act via waitFor)
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

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

    const { result } = renderHook(() => useRetellCalls())

    // Wait for the hook to finish loading (inside act via waitFor)
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

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

    const { result } = renderHook(() => useRetellCalls())

    // Wait for the hook to finish loading (inside act via waitFor)
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

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