/**
 * E2E Tests: Reservations Management
 * Tests creating, viewing, editing, and deleting reservations.
 */

import {
  test,
  expect,
  registerAndLogin,
  createTripAndNavigate,
  TripDetailPage,
  generateTestActivity,
} from './fixtures.js';

test.describe('Reservations Management', () => {
  let userData;

  test.beforeEach(async ({ page }) => {
    // Register and login a fresh user for each test
    userData = await registerAndLogin(page);
  });

  test('should navigate to reservations page from trip menu', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    await tripDetailPage.openTripMenu();
    await page.click('[data-action="view-reservations"]');

    await expect(page).toHaveURL(new RegExp(`/#/trips/${tripData.id}/reservations`));
  });

  test('should add a new lodging reservation', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    // Navigate to reservations page
    await page.goto(`/#/trips/${tripData.id}/reservations`);

    const lodgingReservation = generateTestActivity('accommodation');
    
    // Click add lodging button and fill out the form
    await page.click('button:has-text("Add Lodging")');
    await page.fill('[name="title"]', lodgingReservation.title);
    await page.fill('[name="location"]', lodgingReservation.location);
    await page.click('[data-action="save-activity"]');
    
    // Should see the new reservation in the list
    await expect(page.locator('.reservation-list')).toContainText(lodgingReservation.title);
  });

  test('should add a new transportation reservation', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    // Navigate to reservations page
    await page.goto(`/#/trips/${tripData.id}/reservations`);

    const transportReservation = generateTestActivity('transport');

    // Click add transport button and fill out the form
    await page.click('button:has-text("Add Transportation")');
    await page.fill('[name="title"]', transportReservation.title);
    await page.fill('[name="location"]', transportReservation.location);
    await page.click('[data-action="save-activity"]');

    // Should see the new reservation in the list
    await expect(page.locator('.reservation-list')).toContainText(transportReservation.title);
  });

  test('should edit a reservation', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();
    
    await page.goto(`/#/trips/${tripData.id}/reservations`);

    const lodgingReservation = generateTestActivity('accommodation');
    await page.click('button:has-text("Add Lodging")');
    await page.fill('[name="title"]', lodgingReservation.title);
    await page.click('[data-action="save-activity"]');

    await page.locator(`.reservation-card:has-text("${lodgingReservation.title}") button[data-action="edit-reservation"]`).click();

    const updatedTitle = 'Updated Hotel';
    await page.fill('[name="title"]', updatedTitle);
    await page.click('[data-action="save-activity"]');

    await expect(page.locator('.reservation-list')).toContainText(updatedTitle);
  });

  test('should delete a reservation', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    await page.goto(`/#/trips/${tripData.id}/reservations`);

    const lodgingReservation = generateTestActivity('accommodation');
    await page.click('button:has-text("Add Lodging")');
    await page.fill('[name="title"]', lodgingReservation.title);
    await page.click('[data-action="save-activity"]');

    page.on('dialog', dialog => dialog.accept());
    await page.locator(`.reservation-card:has-text("${lodgingReservation.title}") button[data-action="delete-reservation"]`).click();

    await expect(page.locator('.reservation-list')).not.toContainText(lodgingReservation.title);
  });
});
