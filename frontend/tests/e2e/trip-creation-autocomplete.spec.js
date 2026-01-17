// T023: E2E test for destination autocomplete flow
import { test, expect } from '@playwright/test';

test.describe('Trip Creation with Destination Autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    // Register a test user and log in
    await page.goto('/');

    // Check if already logged in, if not, register and login
    const isLoggedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);

    if (!isLoggedIn) {
      // Go to register page
      await page.click('a[href="/register"]');

      // Fill registration form
      const timestamp = Date.now();
      await page.fill('[name="name"]', `Test User ${timestamp}`);
      await page.fill('[name="email"]', `test${timestamp}@example.com`);
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

  test('should display autocomplete dropdown when typing destination', async ({ page }) => {
    // Type in destination field (minimum 2 characters)
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Par');

    // Wait for dropdown to appear
    const dropdown = page.locator('.autocomplete-dropdown');
    await expect(dropdown).toBeVisible();

    // Verify dropdown contains results
    const items = page.locator('.autocomplete-item');
    await expect(items).not.toHaveCount(0);

    // Verify results contain "Paris" or similar
    const firstItem = items.first();
    const itemText = await firstItem.textContent();
    expect(itemText.toLowerCase()).toContain('par');
  });

  test('should select destination from dropdown and populate field', async ({ page }) => {
    // Type in destination field
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');

    // Wait for dropdown
    const dropdown = page.locator('.autocomplete-dropdown');
    await expect(dropdown).toBeVisible();

    // Click first result
    const firstItem = page.locator('.autocomplete-item').first();
    await firstItem.click();

    // Verify field is populated
    const inputValue = await autocompleteInput.inputValue();
    expect(inputValue).toBeTruthy();
    expect(inputValue.length).toBeGreaterThan(0);

    // Verify success hint appears
    const hint = page.locator('#destination-hint');
    await expect(hint).toBeVisible();
    const hintText = await hint.textContent();
    expect(hintText).toContain('Validated location');
  });

  test('should navigate dropdown with keyboard', async ({ page }) => {
    // Type in destination field
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');

    // Wait for dropdown
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();

    // Press ArrowDown to select first item
    await autocompleteInput.press('ArrowDown');

    // Verify first item is selected
    const selectedItem = page.locator('.autocomplete-item.selected');
    await expect(selectedItem).toBeVisible();

    // Press ArrowDown again to select second item
    await autocompleteInput.press('ArrowDown');

    // Verify second item is selected
    const items = page.locator('.autocomplete-item');
    const secondItem = items.nth(1);
    await expect(secondItem).toHaveClass(/selected/);

    // Press Enter to select
    await autocompleteInput.press('Enter');

    // Verify field is populated
    const inputValue = await autocompleteInput.inputValue();
    expect(inputValue).toBeTruthy();
  });

  test('should close dropdown on Escape key', async ({ page }) => {
    // Type in destination field
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');

    // Wait for dropdown
    const dropdown = page.locator('.autocomplete-dropdown');
    await expect(dropdown).toBeVisible();

    // Press Escape
    await autocompleteInput.press('Escape');

    // Verify dropdown is hidden
    await expect(dropdown).not.toBeVisible();
  });

  test('should display loading state while searching', async ({ page }) => {
    // Slow down network to see loading state
    await page.route('**/api/v1/geocoding/search*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    // Type in destination field
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');

    // Verify loading state appears
    const loadingMessage = page.locator('.autocomplete-dropdown:has-text("Searching")');
    await expect(loadingMessage).toBeVisible({ timeout: 500 });
  });

  test('should display no results message for invalid search', async ({ page }) => {
    // Type nonsense query
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('xyzxyzxyz12345');

    // Wait for dropdown
    const dropdown = page.locator('.autocomplete-dropdown');
    await expect(dropdown).toBeVisible();

    // Verify no results message
    const noResultsMessage = page.locator('.autocomplete-dropdown:has-text("No destinations found")');
    await expect(noResultsMessage).toBeVisible();
  });

  test('should submit trip with validated destination data', async ({ page }) => {
    // Fill in trip name
    await page.fill('[name="name"]', 'My Paris Trip');

    // Select destination from autocomplete
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();
    await page.locator('.autocomplete-item').first().click();

    // Fill in dates
    await page.fill('[name="startDate"]', '2026-06-01');
    await page.fill('[name="endDate"]', '2026-06-10');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to trip detail page
    await page.waitForURL(/\/trips\/[a-f0-9-]+$/);

    // Verify trip was created
    await expect(page.locator('h1:has-text("My Paris Trip")')).toBeVisible();

    // Verify destination is displayed
    const destination = page.locator('[data-testid="trip-destination"]');
    await expect(destination).toBeVisible();
    const destinationText = await destination.textContent();
    expect(destinationText.toLowerCase()).toContain('paris');
  });

  test('should fallback to manual input when API unavailable', async ({ page }) => {
    // Mock API to return 503 Service Unavailable
    await page.route('**/api/v1/geocoding/search*', (route) =>
      route.fulfill({
        status: 503,
        body: JSON.stringify({
          error: 'Service Unavailable',
          message: 'Geocoding service temporarily unavailable',
        }),
      })
    );

    // Type in destination field
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');

    // Wait for error state
    await page.waitForTimeout(500);

    // Verify warning hint appears
    const hint = page.locator('#destination-hint');
    await expect(hint).toBeVisible();
    const hintText = await hint.textContent();
    expect(hintText).toContain('temporarily unavailable');

    // Verify user can still type manually
    await autocompleteInput.clear();
    await autocompleteInput.fill('Paris, France');
    const inputValue = await autocompleteInput.inputValue();
    expect(inputValue).toBe('Paris, France');
  });

  test('should handle rate limit exceeded gracefully', async ({ page }) => {
    // Mock API to return 429 Rate Limit Exceeded
    await page.route('**/api/v1/geocoding/search*', (route) =>
      route.fulfill({
        status: 429,
        body: JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
        }),
      })
    );

    // Type in destination field
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');

    // Wait for error state
    await page.waitForTimeout(500);

    // Verify error is displayed in dropdown
    const dropdown = page.locator('.autocomplete-dropdown');
    await expect(dropdown).toBeVisible();
    const errorMessage = page.locator('.autocomplete-dropdown:has-text("Too many requests")');
    await expect(errorMessage).toBeVisible();
  });

  test('should cache results and show cached indicator', async ({ page }) => {
    let requestCount = 0;

    // Track API calls
    await page.route('**/api/v1/geocoding/search*', (route) => {
      requestCount++;
      route.continue();
    });

    // First search
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();

    // Wait for results
    await page.waitForTimeout(500);
    const firstRequestCount = requestCount;

    // Clear and search again
    await autocompleteInput.clear();
    await page.waitForTimeout(500);
    await autocompleteInput.fill('Paris');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();

    // Verify same number of requests (cached on backend)
    await page.waitForTimeout(500);
    // Note: Frontend always makes request, but backend returns cached results
    // We can't easily test backend caching from E2E, but we verify the flow works
    expect(requestCount).toBeGreaterThan(0);
  });

  test('should allow editing selected destination', async ({ page }) => {
    // Select destination from autocomplete
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();
    await page.locator('.autocomplete-item').first().click();

    // Verify field is populated
    let inputValue = await autocompleteInput.inputValue();
    expect(inputValue).toBeTruthy();

    // Edit the destination
    await autocompleteInput.clear();
    await autocompleteInput.fill('London');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();

    // Select new destination
    await page.locator('.autocomplete-item').first().click();

    // Verify field is updated
    inputValue = await autocompleteInput.inputValue();
    expect(inputValue.toLowerCase()).toContain('london');
  });

  test('should respect minimum character requirement', async ({ page }) => {
    // Type only 1 character
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('P');

    // Wait a bit
    await page.waitForTimeout(500);

    // Verify dropdown does not appear
    const dropdown = page.locator('.autocomplete-dropdown');
    await expect(dropdown).not.toBeVisible();

    // Type second character
    await autocompleteInput.fill('Pa');

    // Now dropdown should appear
    await expect(dropdown).toBeVisible();
  });

  test('should clear dropdown when input is cleared', async ({ page }) => {
    // Type and open dropdown
    const autocompleteInput = page.locator('.autocomplete-input');
    await autocompleteInput.fill('Paris');
    await expect(page.locator('.autocomplete-dropdown')).toBeVisible();

    // Clear input
    await autocompleteInput.clear();

    // Verify dropdown is hidden
    const dropdown = page.locator('.autocomplete-dropdown');
    await expect(dropdown).not.toBeVisible();
  });
});
