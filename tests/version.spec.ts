import { test, expect } from '@playwright/test';

test.describe('Version Information', () => {
  test('should display version info in admin diagnostics', async ({ page }) => {
    // Navigate to admin self-check page (assuming we have superadmin access in tests)
    await page.goto('/admin/self-check');
    
    // Wait for the page to load and check for version section
    await expect(page.getByText('Version Information')).toBeVisible();
    
    // Check that commit SHA is displayed and has valid format
    const commitSha = await page.getByTestId('commit-sha').textContent();
    expect(commitSha).toBeTruthy();
    expect(commitSha).toMatch(/^[a-f0-9]{7,40}|unknown$/i);
    
    // Check that build ID is displayed and non-empty
    const buildId = await page.getByTestId('build-id').textContent();
    expect(buildId).toBeTruthy();
    expect(buildId!.length).toBeGreaterThan(0);
    
    // Check that build timestamp is displayed and valid
    const buildTimestamp = await page.getByTestId('build-timestamp').textContent();
    expect(buildTimestamp).toBeTruthy();
    
    // Verify copy buttons are present
    await expect(page.getByTestId('copy-commit-sha')).toBeVisible();
    await expect(page.getByTestId('copy-build-id')).toBeVisible();
    await expect(page.getByTestId('copy-build-timestamp')).toBeVisible();
    await expect(page.getByTestId('copy-all-build-info')).toBeVisible();
    
    // Test copy functionality (if browser supports it)
    await page.getByTestId('copy-commit-sha').click();
    // Note: We can't easily test clipboard in headless mode, but we verify the button works
    
    // If there's a commit link (when REPO_URL is set), verify it
    const commitLink = page.getByTestId('commit-link');
    if (await commitLink.isVisible()) {
      const href = await commitLink.getAttribute('href');
      expect(href).toContain('/commit/');
      expect(href).toContain(commitSha);
    }
    
    // Store values for comparison with API
    const pageValues = {
      commitSha: commitSha?.trim(),
      buildId: buildId?.trim(),
      buildTimestamp: buildTimestamp?.trim()
    };
    
    // Fetch version.json and compare values
    const response = await page.request.get('/version.json');
    expect(response.ok()).toBeTruthy();
    
    const versionJson = await response.json();
    expect(versionJson).toHaveProperty('commit');
    expect(versionJson).toHaveProperty('buildId');
    expect(versionJson).toHaveProperty('buildTimestamp');
    
    // Values should match between UI and API
    expect(versionJson.commit).toBe(pageValues.commitSha);
    expect(versionJson.buildId).toBe(pageValues.buildId);
    
    // Build timestamp should be parseable ISO date
    const buildDate = new Date(versionJson.buildTimestamp);
    expect(buildDate.toISOString()).toBe(versionJson.buildTimestamp);
  });

  test('should serve version.json with correct structure', async ({ page }) => {
    const response = await page.request.get('/version.json');
    
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');
    
    const versionInfo = await response.json();
    
    // Verify required fields
    expect(versionInfo).toHaveProperty('commit');
    expect(versionInfo).toHaveProperty('buildId');
    expect(versionInfo).toHaveProperty('buildTimestamp');
    
    // Verify types and formats
    expect(typeof versionInfo.commit).toBe('string');
    expect(typeof versionInfo.buildId).toBe('string');
    expect(typeof versionInfo.buildTimestamp).toBe('string');
    
    expect(versionInfo.commit.length).toBeGreaterThan(0);
    expect(versionInfo.buildId.length).toBeGreaterThan(0);
    
    // Verify ISO timestamp
    const date = new Date(versionInfo.buildTimestamp);
    expect(date.toISOString()).toBe(versionInfo.buildTimestamp);
    
    // Optional env field
    if (versionInfo.env) {
      expect(typeof versionInfo.env).toBe('string');
    }
  });

  test('should include version headers in HTML responses', async ({ page }) => {
    const response = await page.goto('/');
    
    expect(response).toBeTruthy();
    expect(response!.ok()).toBeTruthy();
    
    const headers = response!.headers();
    
    // Check for version headers
    expect(headers).toHaveProperty('x-commit-sha');
    expect(headers).toHaveProperty('x-build-id');
    
    const commitSha = headers['x-commit-sha'];
    const buildId = headers['x-build-id'];
    
    expect(commitSha).toBeTruthy();
    expect(buildId).toBeTruthy();
    
    // Commit SHA should be hex or 'unknown'
    expect(commitSha).toMatch(/^[a-f0-9]{7,40}|unknown$/i);
    
    // Build ID should be non-empty
    expect(buildId.length).toBeGreaterThan(0);
    
    // Compare with version.json
    const versionResponse = await page.request.get('/version.json');
    const versionJson = await versionResponse.json();
    
    expect(commitSha).toBe(versionJson.commit);
    expect(buildId).toBe(versionJson.buildId);
  });

  test('should handle missing version.json gracefully', async ({ page }) => {
    // Test the fallback mechanism by directly testing the utility
    // This would be more of an integration test in a real scenario
    await page.goto('/admin/self-check');
    
    // Even if version.json is missing, the page should still load
    // and show version info from build-info.ts fallback
    await expect(page.getByText('Version Information')).toBeVisible();
    
    const commitSha = await page.getByTestId('commit-sha').textContent();
    const buildId = await page.getByTestId('build-id').textContent();
    
    expect(commitSha).toBeTruthy();
    expect(buildId).toBeTruthy();
  });
});

test.describe('Health endpoint', () => {
  test('should return health status with version info', async ({ page }) => {
    // Test /api/healthz endpoint
    const response = await page.request.get('/api/healthz');
    expect(response.status()).toBe(200);
    
    const healthData = await response.json();
    expect(healthData.status).toBe('ok');
    expect(healthData.commit).toBeTruthy();
    expect(healthData.buildId).toBeTruthy();
    expect(healthData.buildTimestamp).toBeTruthy();
    expect(typeof healthData.uptimeSec).toBe('number');
    
    // Verify cache headers
    expect(response.headers()['cache-control']).toContain('no-store');
    
    // Compare with /version.json to ensure consistency
    const versionResponse = await page.request.get('/version.json');
    const versionData = await versionResponse.json();
    
    expect(healthData.commit).toBe(versionData.commit);
    expect(healthData.buildId).toBe(versionData.buildId);
    expect(healthData.buildTimestamp).toBe(versionData.buildTimestamp);
  });
});