/**
 * E2E Tests: Invitations Page
 * Tests viewing and managing trip invitations.
 */

import {
  test,
  expect,
  registerAndLogin,
  createTripAndNavigate,
  TripDetailPage,
  AuthPage,
  generateTestUser,
} from './fixtures.js';

test.describe('Invitations Page', () => {
  let ownerData;
  let buddyData;

  test.beforeEach(async ({ page }) => {
    // Register and login a fresh user for each test
    ownerData = await registerAndLogin(page);
    buddyData = generateTestUser('buddy-inv');

    // The buddy needs to be registered in the system to be invited
    const authPage = new AuthPage(page);
    await authPage.register(buddyData);
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    await authPage.login(ownerData.email, ownerData.password);
  });

  test('should show pending invitations on the invitations page', async ({ page }) => {
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

    const invitationCard = page.locator('.invitation-card');
    await expect(invitationCard).toBeVisible();
    await expect(invitationCard).toContainText(tripData.name);
  });

  test('should remove invitation from list after accepting', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    await tripDetailPage.inviteTripBuddy(buddyData.email, 'editor');

    // Log in as buddy
    const authPage = new AuthPage(page);
    await authPage.logout();
    await authPage.login(buddyData.email, buddyData.password);

    await page.goto('/#/invitations');

    const invitationCard = page.locator('.invitation-card');
    await invitationCard.locator('button:has-text("Accept")').click();

    // Should be redirected to the trip page
    await expect(page).toHaveURL(new RegExp(`/#/trips/`));
    
    // Go back to invitations page
    await page.goto('/#/invitations');
    
    // Should be no invitations
    await expect(invitationCard).not.toBeVisible();
    await expect(page.locator('text=You have no pending invitations')).toBeVisible();
  });
});
