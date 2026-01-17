/**
 * E2E Tests: Trip Buddies and Collaboration
 * Tests inviting, accepting, and managing trip buddies.
 */

import {
  test,
  expect,
  registerAndLogin,
  createTripAndNavigate,
  TripDetailPage,
  AuthPage,
  HomePage,
  generateTestUser,
} from './fixtures.js';

test.describe('Trip Buddies and Collaboration', () => {
  let ownerData;
  let buddyData;

  test.beforeEach(async ({ page }) => {
    // Register and login a fresh user for each test
    ownerData = await registerAndLogin(page);
    buddyData = generateTestUser('buddy');

    // The buddy needs to be registered in the system to be invited
    const authPage = new AuthPage(page);
    await authPage.register(buddyData);
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    await authPage.login(ownerData.email, ownerData.password);
  });

  test('should invite a trip buddy', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    await tripDetailPage.inviteTripBuddy(buddyData.email, 'editor');

    // Expect a success toast
    const toast = page.locator('.toast.success');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Trip buddy invited successfully');
  });

  test('should show invited buddy in the buddy list', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    await tripDetailPage.inviteTripBuddy(buddyData.email, 'editor');
    await page.waitForTimeout(1000); // Wait for UI to update

    const buddyList = page.locator('.trip-buddy-list');
    await expect(buddyList).toContainText(buddyData.email);
  });

  test('should accept a trip invitation', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    await tripDetailPage.inviteTripBuddy(buddyData.email, 'editor');

    // Log out owner and log in as buddy
    const authPage = new AuthPage(page);
    await authPage.logout();
    await authPage.login(buddyData.email, buddyData.password);

    // Go to invitations page
    await page.goto('/#/invitations');

    // Accept the invitation
    const invitationCard = page.locator('.invitation-card');
    await expect(invitationCard).toContainText(tripData.name);
    await invitationCard.locator('button:has-text("Accept")').click();

    // Should be redirected to the trip page
    await expect(page).toHaveURL(new RegExp(`/#/trips/`));
  });

  test('should show different UI for viewer role', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    await tripDetailPage.inviteTripBuddy(buddyData.email, 'viewer');

    // Log in as buddy
    const authPage = new AuthPage(page);
    await authPage.logout();
    await authPage.login(buddyData.email, buddyData.password);

    // Accept invitation
    await page.goto('/#/invitations');
    await page.locator('.invitation-card button:has-text("Accept")').click();
    await expect(page).toHaveURL(new RegExp(`/#/trips/`));
    await tripDetailPage.waitForLoaded();

    // Viewer should not see edit/delete buttons
    await tripDetailPage.openTripMenu();
    const editTripBtn = page.locator('[data-action="edit-trip"]');
    const deleteTripBtn = page.locator('[data-action="delete-trip"]');
    await expect(editTripBtn).toBeDisabled();
    await expect(deleteTripBtn).toBeDisabled();

    const addActivityBtn = page.locator('[data-action="add-activity"]');
    await expect(addActivityBtn).not.toBeVisible();
  });
});
