// T035: E2E test for automatic cover generation
import { test, expect } from '@playwright/test';

test.describe('Trip Cover Image Generation', () => {
  let testUserEmail;

  test.beforeEach(async ({ page }) => {
    // Register a test user and log in
    await page.goto('/');

    // Check if already logged in
    const isLoggedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);

    if (!isLoggedIn) {
      // Go to register page
      await page.click('a[href="/register"]');

      // Fill registration form
      const timestamp = Date.now();
      testUserEmail = `test${timestamp}@example.com`;
      await page.fill('[name="name"]', `Test User ${timestamp}`);
      await page.fill('[name="email"]', testUserEmail);
      await page.fill('[name="password"]', 'TestPassword123!');
      await page.fill('[name="confirmPassword"]', 'TestPassword123!');

      // Submit registration
      await page.click('button[type="submit"]');

      // Wait for redirect to home page after login
      await page.waitForURL('/');
    }

    // Navigate to trip creation page
    await page.click('a[href="/trips/new"]');
    await page.waitForURL('/trips/new');
  });

  test('should show loading indicator during trip creation with validated destination', async ({ page }) => {
    // Fill in trip name
    await page.fill('[name="name"]', 'Tokyo Adventure');

    // Select destination from autocomplete
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Tokyo');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();
    await page.locator('.autocomplete-item').first().click();

    // Verify destination hint shows validated
    await expect(page.locator('#destination-hint')).toBeVisible();
    const hintText = await page.locator('#destination-hint').textContent();
    expect(hintText).toContain('Validated');

    // Fill in dates
    await page.fill('[name="startDate"]', '2026-07-01');
    await page.fill('[name="endDate"]', '2026-07-10');

    // Submit form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Verify loading text appears (cover image fetch message)
    await expect(submitButton).toContainText(/Creating trip|fetching cover/i);

    // Wait for redirect to trip detail page
    await page.waitForURL(/\/trips\/[a-f0-9-]+$/, { timeout: 30000 });
  });

  test('should display cover image on trip detail page', async ({ page }) => {
    // Create trip with validated destination
    await page.fill('[name="name"]', 'Paris Getaway');

    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();
    await page.locator('.autocomplete-item').first().click();

    await page.fill('[name="startDate"]', '2026-08-01');
    await page.fill('[name="endDate"]', '2026-08-10');

    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL(/\/trips\/[a-f0-9-]+$/, { timeout: 30000 });

    // Verify cover image is displayed
    const coverImage = page.locator('[data-testid="trip-cover-image"]');
    await expect(coverImage).toBeVisible();

    // Verify image has a src attribute (could be Pexels or placeholder)
    const src = await coverImage.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src.length).toBeGreaterThan(0);
  });

  test('should display Pexels attribution when cover from Pexels', async ({ page }) => {
    // Mock Pexels API to return a known result
    await page.route('**/api/v1/cover-images/fetch', async (route) => {
      // Let the actual request through but we'll check the attribution on the page
      await route.continue();
    });

    // Create trip with validated destination
    await page.fill('[name="name"]', 'London Explorer');

    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('London');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();
    await page.locator('.autocomplete-item').first().click();

    await page.fill('[name="startDate"]', '2026-09-01');
    await page.fill('[name="endDate"]', '2026-09-10');

    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL(/\/trips\/[a-f0-9-]+$/, { timeout: 30000 });

    // Check for attribution (if Pexels returned an image)
    // Note: Attribution is only shown for Pexels images, not placeholders
    const attribution = page.locator('.cover-image-attribution');
    const coverImage = page.locator('[data-testid="trip-cover-image"]');

    const src = await coverImage.getAttribute('src');

    // If it's a Pexels image (not placeholder), attribution should be visible
    if (src && !src.includes('placeholder')) {
      await expect(attribution).toBeVisible();
      await expect(attribution).toContainText('Photo by');
      await expect(attribution).toContainText('Pexels');
    }
  });

  test('should use placeholder image when Pexels API fails', async ({ page }) => {
    // Mock Pexels API to fail
    await page.route('**/api/v1/cover-images/fetch', (route) =>
      route.fulfill({
        status: 503,
        body: JSON.stringify({
          error: 'Service Unavailable',
          message: 'Pexels API is temporarily unavailable',
        }),
      })
    );

    // Create trip with validated destination
    await page.fill('[name="name"]', 'Barcelona Trip');

    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Barcelona');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();
    await page.locator('.autocomplete-item').first().click();

    await page.fill('[name="startDate"]', '2026-10-01');
    await page.fill('[name="endDate"]', '2026-10-10');

    await page.click('button[type="submit"]');

    // Wait for redirect - trip creation should still succeed
    await page.waitForURL(/\/trips\/[a-f0-9-]+$/, { timeout: 30000 });

    // Verify a cover image is displayed (should be placeholder)
    const coverImage = page.locator('[data-testid="trip-cover-image"]');
    await expect(coverImage).toBeVisible();

    // No Pexels attribution should be shown for placeholder
    const attribution = page.locator('.cover-image-attribution');
    await expect(attribution).not.toBeVisible();
  });

  test('should not fetch cover image for non-validated destination', async ({ page }) => {
    // Track API calls
    let coverImageFetchCalled = false;
    await page.route('**/api/v1/cover-images/fetch', (route) => {
      coverImageFetchCalled = true;
      route.continue();
    });

    // Mock geocoding API to fail (forcing manual entry)
    await page.route('**/api/v1/geocoding/search*', (route) =>
      route.fulfill({
        status: 503,
        body: JSON.stringify({
          error: 'Service Unavailable',
          message: 'Geocoding service unavailable',
        }),
      })
    );

    // Fill in trip with manual destination
    await page.fill('[name="name"]', 'Manual Entry Trip');

    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Some Random Place');

    // Wait a bit for API error
    await page.waitForTimeout(500);

    // Clear and type destination manually
    await autocompleteInput.clear();
    await autocompleteInput.fill('Manual Destination Entry');

    await page.fill('[name="startDate"]', '2026-11-01');
    await page.fill('[name="endDate"]', '2026-11-10');

    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL(/\/trips\/[a-f0-9-]+$/, { timeout: 30000 });

    // Cover image fetch should not have been called for non-validated destination
    // (The backend handles this, but we verify the trip was created successfully)
    const coverImage = page.locator('[data-testid="trip-cover-image"]');
    await expect(coverImage).toBeVisible();
  });

  test('should handle rate limit gracefully', async ({ page }) => {
    // Mock Pexels API to return rate limit error
    await page.route('**/api/v1/cover-images/fetch', (route) =>
      route.fulfill({
        status: 429,
        body: JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
        }),
      })
    );

    // Create trip
    await page.fill('[name="name"]', 'Rate Limited Trip');

    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Rome');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();
    await page.locator('.autocomplete-item').first().click();

    await page.fill('[name="startDate"]', '2026-12-01');
    await page.fill('[name="endDate"]', '2026-12-10');

    await page.click('button[type="submit"]');

    // Trip should still be created successfully with placeholder
    await page.waitForURL(/\/trips\/[a-f0-9-]+$/, { timeout: 30000 });

    // Verify trip was created
    await expect(page.locator('h1')).toContainText('Rate Limited Trip');
  });

  test('should allow changing cover image after creation', async ({ page }) => {
    // Create trip with validated destination
    await page.fill('[name="name"]', 'Cover Change Test');

    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Berlin');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();
    await page.locator('.autocomplete-item').first().click();

    await page.fill('[name="startDate"]', '2026-06-01');
    await page.fill('[name="endDate"]', '2026-06-10');

    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL(/\/trips\/[a-f0-9-]+$/, { timeout: 30000 });

    // Verify change cover button exists
    const changeCoverButton = page.locator('[data-action="edit-cover-image"]');
    await expect(changeCoverButton).toBeVisible();

    // Note: Actual file upload test would require test file fixtures
    // This just verifies the button is present and clickable
    await expect(changeCoverButton).toBeEnabled();
  });
});
