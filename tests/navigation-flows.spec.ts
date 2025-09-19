import { test, expect } from '@playwright/test';

test.describe('Navigation Flow Tests', () => {
  
  test('auth with session redirects to dashboard without history loop', async ({ page }) => {
    // Mock authentication state
    await page.goto('/auth');
    
    // Mock existing session
    await page.addInitScript(() => {
      // Simulate authenticated session
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock_token',
        user: { id: 'test-user' }
      }));
    });
    
    await page.reload();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Test back button doesn't create loop
    await page.goBack();
    await expect(page).not.toHaveURL('/auth');
  });

  test('auth callback with next parameter preserves destination', async ({ page }) => {
    await page.goto('/auth/callback?next=/calls');
    
    // Mock successful auth callback
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock_token',
        user: { id: 'test-user' }
      }));
    });
    
    // Should eventually navigate to /calls
    await expect(page).toHaveURL(/\/calls$/);
    
    // Back button should not loop to callback
    await page.goBack();
    await expect(page).not.toHaveURL(/\/auth\/callback/);
  });

  test('dashboard with incomplete profile redirects to onboarding', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Mock authenticated but incomplete profile
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock_token',
        user: { id: 'test-user' }
      }));
      // Mock incomplete profile that triggers guard
      window.sessionStorage.setItem('profile_incomplete', 'true');
    });
    
    await page.reload();
    
    // Should redirect to onboarding with next parameter
    await expect(page).toHaveURL('/onboarding/organization?next=%2Fdashboard');
    
    // Back button should not create loop
    await page.goBack();
    await expect(page).not.toHaveURL('/dashboard');
  });

  test('legacy complete-profile path returns 404', async ({ page }) => {
    const response = await page.goto('/complete-profile');
    
    // Should return 404 since legacy route was removed
    expect(response?.status()).toBe(404);
    
    // Or should redirect to proper route if fallback handling exists
    await expect(page).toHaveURL(/\/(404|not-found|onboarding)/);
  });

  test('malicious next parameter is sanitized', async ({ page }) => {
    await page.goto('/auth/callback?next=//evil.com/steal-data');
    
    // Mock successful auth
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock_token',
        user: { id: 'test-user' }
      }));
    });
    
    // Should fallback to safe route, not external domain
    await expect(page).toHaveURL('/dashboard');
    
    // Ensure we're still on same origin
    expect(page.url()).toMatch(/^https?:\/\/localhost/);
  });

  test('encoded malicious next parameter is sanitized', async ({ page }) => {
    await page.goto('/auth/callback?next=%2F%2Fevil.com');
    
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock_token',
        user: { id: 'test-user' }
      }));
    });
    
    // Should fallback to dashboard, not decode to //evil.com
    await expect(page).toHaveURL('/dashboard');
    expect(page.url()).toMatch(/^https?:\/\/localhost/);
  });

});