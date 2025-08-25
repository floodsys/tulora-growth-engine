import { describe, it, expect, vi } from 'vitest';

// Integration tests for actual edge functions
// These tests make real HTTP calls to edge functions

const SUPABASE_URL = 'https://nkjxbeypbiclvouqfjyc.supabase.co';
const TEST_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`;

// Test JWT tokens (these would be real tokens in CI environment)
const SUPERADMIN_JWT = process.env.TEST_SUPERADMIN_JWT || 'mock-superadmin-jwt';
const REGULAR_USER_JWT = process.env.TEST_REGULAR_USER_JWT || 'mock-regular-jwt';

describe('Edge Functions Integration Tests', () => {
  // Skip these tests if we don't have real JWT tokens
  const hasTestTokens = process.env.TEST_SUPERADMIN_JWT && process.env.TEST_REGULAR_USER_JWT;
  
  const adminEndpoints = [
    'admin-billing-actions',
    'admin-billing-overview', 
    'org-suspension',
  ];

  adminEndpoints.forEach(endpoint => {
    describe(`${endpoint} endpoint`, () => {
      it.skipIf(!hasTestTokens)(`should return 200 for superadmin JWT`, async () => {
        const response = await fetch(`${TEST_FUNCTION_URL}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPERADMIN_JWT}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'test_probe' }),
        });

        // Should not be 403 (access denied)
        expect(response.status).not.toBe(403);
        
        // Should either succeed (200) or fail for other reasons (400, 500)
        // but never due to authorization (403)
        if (response.status >= 400) {
          const errorText = await response.text();
          expect(errorText).not.toContain('Access denied');
          expect(errorText).not.toContain('Superadmin privileges required');
        }
      });

      it.skipIf(!hasTestTokens)(`should return 403 for regular user JWT`, async () => {
        const response = await fetch(`${TEST_FUNCTION_URL}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${REGULAR_USER_JWT}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'test_probe' }),
        });

        // Should be 403 (access denied) or 401 (unauthorized)
        expect([401, 403]).toContain(response.status);
        
        if (response.status === 403) {
          const errorText = await response.text();
          expect(errorText).toMatch(/Access denied|Superadmin privileges required/);
        }
      });
    });
  });

  describe('DB RPC Function Direct Test', () => {
    it.skipIf(!hasTestTokens)('should verify is_superadmin RPC with real tokens', async () => {
      // Test direct RPC call to verify DB function works correctly
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_superadmin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPERADMIN_JWT}`,
          'Content-Type': 'application/json',
          'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(typeof result).toBe('boolean');
    });
  });
});