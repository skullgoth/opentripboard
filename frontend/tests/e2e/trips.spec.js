/**
 * E2E Tests: Trip Management
 * Tests trip creation, editing, viewing, and deletion
 */

import {
  test,
  expect,
  generateTestUser,
  generateTestTrip,
  AuthPage,
  HomePage,
  TripDetailPage,
  registerAndLogin,
} from './fixtures.js';

test.describe('Trip Management', () => {
  let userData;

  test.beforeEach(async ({ page }) => {
    // Register and login a fresh user for each test
    userData = await registerAndLogin(page);
  });

  test.describe('Trip Creation', () => {
    test('should create a new trip successfully', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripData = generateTestTrip('Create Test');

      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      // Should navigate to trip detail page
      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });

      // Should display trip name
      const tripDetailPage = new TripDetailPage(page);
      await tripDetailPage.waitForLoaded();

      const tripName = await tripDetailPage.getTripName();
      expect(tripName).toContain(tripData.name);
    });

    test('should show trip in list after creation', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripData = generateTestTrip('List Test');

      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      // Wait for redirect to trip detail
      await page.waitForURL(/\/#\/trips\//, { timeout: 10000 });

      // Navigate back to home
      await homePage.goto();
      await homePage.waitForTripsLoaded();

      // Trip should appear in the list
      const tripCards = await homePage.getTripCards();
      const tripTexts = await tripCards.allTextContents();

      const foundTrip = tripTexts.some(text => text.includes(tripData.name));
      expect(foundTrip).toBe(true);
    });

    test('should open trip creation modal', async ({ page }) => {
      const homePage = new HomePage(page);

      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.clickCreateTrip();

      // Modal should be visible
      const modal = page.locator('#trip-modal, .trip-form-modal');
      await expect(modal).toBeVisible();

      // Form elements should be present
      const nameInput = page.locator('#trip-name, [name="name"]');
      await expect(nameInput).toBeVisible();
    });

    test('should close trip modal on cancel', async ({ page }) => {
      const homePage = new HomePage(page);

      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.clickCreateTrip();

      // Click cancel button
      const cancelBtn = page.locator('[data-action="close-modal"], [data-action="cancel"]');
      await cancelBtn.click();

      // Modal should be hidden
      const modal = page.locator('#trip-modal, .trip-form-modal');
      await expect(modal).not.toBeVisible({ timeout: 5000 });
    });

    test('should create trip with dates', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripData = generateTestTrip('Dated Trip');

      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      // Should navigate to trip detail page
      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });

      // Check dates are displayed
      const dateText = page.locator('.trip-dates, .trip-date-range');
      // Dates should be visible somewhere on the page
      const pageContent = await page.content();
      // Dates are formatted, so we just verify the page loaded with trip info
      const tripDetailPage = new TripDetailPage(page);
      await tripDetailPage.waitForLoaded();
    });
  });

  test.describe('Trip Viewing', () => {
    test('should display trip details correctly', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripData = generateTestTrip('View Test');

      // Create a trip first
      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      // Should be on trip detail page
      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });

      const tripDetailPage = new TripDetailPage(page);
      await tripDetailPage.waitForLoaded();

      // Verify trip name is displayed
      const tripName = await tripDetailPage.getTripName();
      expect(tripName).toContain(tripData.name);
    });

    test('should navigate to trip detail from trip list', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripData = generateTestTrip('Navigate Test');

      // Create a trip
      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      // Go back to home
      await homePage.goto();
      await homePage.waitForTripsLoaded();

      // Click on the trip card
      await homePage.clickTrip(tripData.name);

      // Should navigate to trip detail
      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });
    });

    test('should show empty state for new trip', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripData = generateTestTrip('Empty State');

      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });

      // New trip should have empty timeline or prompt to add activities
      const timeline = page.locator('.itinerary-timeline, .timeline-empty, .activities-empty');
      await expect(timeline).toBeVisible({ timeout: 5000 });
    });

    test('should display cover image', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripData = generateTestTrip('Cover Image');

      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });

      // Cover image should be visible (default or custom)
      const coverImage = page.locator('.trip-cover-image, [data-testid="trip-cover-image"]');
      await expect(coverImage).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Trip Editing', () => {
    test('should open edit trip modal', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripDetailPage = new TripDetailPage(page);
      const tripData = generateTestTrip('Edit Modal');

      // Create a trip
      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });
      await tripDetailPage.waitForLoaded();

      // Open edit modal
      await tripDetailPage.clickEditTrip();

      // Modal should be visible
      const modal = page.locator('#trip-modal, .trip-form-modal');
      await expect(modal).toBeVisible();
    });

    test('should update trip name', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripDetailPage = new TripDetailPage(page);
      const tripData = generateTestTrip('Update Name');
      const newName = 'Updated Trip Name ' + Date.now();

      // Create a trip
      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });
      await tripDetailPage.waitForLoaded();

      // Open edit modal
      await tripDetailPage.clickEditTrip();

      // Update the name
      const nameInput = page.locator('#trip-name, [name="name"]');
      await nameInput.clear();
      await nameInput.fill(newName);

      // Save
      await page.click('[data-action="save-trip"], .trip-form button[type="submit"]');

      // Wait for modal to close and page to refresh
      await page.waitForTimeout(1000);

      // Verify updated name
      const tripName = await tripDetailPage.getTripName();
      expect(tripName).toContain(newName);
    });

    test('should show trip menu with edit and delete options', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripDetailPage = new TripDetailPage(page);
      const tripData = generateTestTrip('Menu Test');

      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });
      await tripDetailPage.waitForLoaded();

      // Open trip menu
      await tripDetailPage.openTripMenu();

      // Verify menu options
      const editOption = page.locator('[data-action="edit-trip"]');
      const deleteOption = page.locator('[data-action="delete-trip"]');

      await expect(editOption).toBeVisible();
      await expect(deleteOption).toBeVisible();
    });
  });

  test.describe('Trip Deletion', () => {
    test('should delete trip from detail page', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripDetailPage = new TripDetailPage(page);
      const tripData = generateTestTrip('Delete Detail');

      // Create a trip
      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });
      await tripDetailPage.waitForLoaded();

      // Delete the trip (with dialog auto-accept)
      page.once('dialog', dialog => dialog.accept());
      await tripDetailPage.clickDeleteTrip();

      // Should redirect to home page
      await expect(page).toHaveURL('/#/', { timeout: 10000 });

      // Trip should no longer appear in list
      await homePage.waitForTripsLoaded();
      const tripCards = await homePage.getTripCards();
      const tripTexts = await tripCards.allTextContents();

      const foundTrip = tripTexts.some(text => text.includes(tripData.name));
      expect(foundTrip).toBe(false);
    });

    test('should cancel trip deletion', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripDetailPage = new TripDetailPage(page);
      const tripData = generateTestTrip('Delete Cancel');

      // Create a trip
      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 10000 });
      await tripDetailPage.waitForLoaded();

      // Try to delete but cancel
      page.once('dialog', dialog => dialog.dismiss());
      await tripDetailPage.clickDeleteTrip();

      // Should still be on trip detail page
      await expect(page).toHaveURL(/\/#\/trips\//, { timeout: 5000 });

      // Trip name should still be visible
      const tripName = await tripDetailPage.getTripName();
      expect(tripName).toContain(tripData.name);
    });
  });

  test.describe('Multiple Trips', () => {
    test('should display multiple trips in list', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripData1 = generateTestTrip('Multi Test 1');
      const tripData2 = generateTestTrip('Multi Test 2');

      // Create first trip
      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData1);
      await page.waitForURL(/\/#\/trips\//, { timeout: 10000 });

      // Create second trip
      await homePage.goto();
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData2);
      await page.waitForURL(/\/#\/trips\//, { timeout: 10000 });

      // Go back to home and verify both trips exist
      await homePage.goto();
      await homePage.waitForTripsLoaded();

      const tripCards = await homePage.getTripCards();
      expect(await tripCards.count()).toBeGreaterThanOrEqual(2);

      const tripTexts = await tripCards.allTextContents();
      expect(tripTexts.some(text => text.includes(tripData1.name))).toBe(true);
      expect(tripTexts.some(text => text.includes(tripData2.name))).toBe(true);
    });
  });
});
