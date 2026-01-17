/**
 * E2E Tests: Real-time Collaboration
 * Tests real-time updates between two users.
 */

import {
  test,
  expect,
  registerAndLogin,
  createTripAndNavigate,
  TripDetailPage,
  AuthPage,
  generateTestUser,
  generateTestActivity,
  generateTestSuggestion,
} from './fixtures.js';

test.describe('Real-time Collaboration', () => {
  test('should show presence indicators for active users', async ({ browser }) => {
    // Create two separate user sessions
    const ownerContext = await browser.newContext();
    const buddyContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const buddyPage = await buddyContext.newPage();

    const ownerData = await registerAndLogin(ownerPage);
    const buddyData = generateTestUser('rt-buddy');
    
    // Register buddy user
    const authPage = new AuthPage(buddyPage);
    await authPage.register(buddyData);
    await buddyContext.storageState({ path: 'buddyStorageState.json' });


    // Owner creates a trip
    const tripData = await createTripAndNavigate(ownerPage);
    const tripDetailPageOwner = new TripDetailPage(ownerPage);
    await tripDetailPageOwner.waitForLoaded();
    const tripUrl = ownerPage.url();

    // Owner invites buddy
    await tripDetailPageOwner.inviteTripBuddy(buddyData.email, 'editor');
    
    // Buddy logs in
    const authPageBuddy = new AuthPage(buddyPage);
    await authPageBuddy.login(buddyData.email, buddyData.password);
    
    // Buddy accepts invitation
    await buddyPage.goto('/#/invitations');
    await buddyPage.locator('.invitation-card button:has-text("Accept")').click();
    await expect(buddyPage).toHaveURL(new RegExp(`/#/trips/`));
    
    // Both users are on the same trip page
    await ownerPage.goto(tripUrl);
    await buddyPage.goto(tripUrl);
    await tripDetailPageOwner.waitForLoaded();
    const tripDetailPageBuddy = new TripDetailPage(buddyPage);
    await tripDetailPageBuddy.waitForLoaded();

    // Check for presence indicators
    const ownerPresence = ownerPage.locator('.trip-buddy-avatar.is-active');
    const buddyPresence = buddyPage.locator('.trip-buddy-avatar.is-active');
    
    await expect(ownerPresence).toHaveCount(2);
    await expect(buddyPresence).toHaveCount(2);

    await ownerContext.close();
    await buddyContext.close();
  });

  test('should show new activity created by another user in real-time', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const buddyContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const buddyPage = await buddyContext.newPage();

    const ownerData = await registerAndLogin(ownerPage);
    const buddyData = generateTestUser('rt-buddy-act');
    const authPage = new AuthPage(buddyPage);
    await authPage.register(buddyData);
    await buddyContext.storageState({ path: 'buddyActStorageState.json' });

    const tripData = await createTripAndNavigate(ownerPage);
    const tripDetailPageOwner = new TripDetailPage(ownerPage);
    await tripDetailPageOwner.waitForLoaded();
    const tripUrl = ownerPage.url();

    await tripDetailPageOwner.inviteTripBuddy(buddyData.email, 'editor');

    const authPageBuddy = new AuthPage(buddyPage);
    await authPageBuddy.login(buddyData.email, buddyData.password);
    await buddyPage.goto('/#/invitations');
    await buddyPage.locator('.invitation-card button:has-text("Accept")').click();

    await ownerPage.goto(tripUrl);
    await buddyPage.goto(tripUrl);
    await tripDetailPageOwner.waitForLoaded();
    const tripDetailPageBuddy = new TripDetailPage(buddyPage);
    await tripDetailPageBuddy.waitForLoaded();

    const activityData = generateTestActivity('sightseeing');
    await tripDetailPageOwner.createActivity(activityData);

    // Buddy should see the new activity appear
    const newActivityOnBuddyPage = buddyPage.locator(`.activity-card:has-text("${activityData.title}")`);
    await expect(newActivityOnBuddyPage).toBeVisible({ timeout: 10000 });

    await ownerContext.close();
    await buddyContext.close();
  });

  test('should show new suggestion created by another user in real-time', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const buddyContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const buddyPage = await buddyContext.newPage();

    const ownerData = await registerAndLogin(ownerPage);
    const buddyData = generateTestUser('rt-buddy-sug');
    const authPage = new AuthPage(buddyPage);
    await authPage.register(buddyData);
    await buddyContext.storageState({ path: 'buddySugStorageState.json' });

    const tripData = await createTripAndNavigate(ownerPage);
    const tripDetailPageOwner = new TripDetailPage(ownerPage);
    await tripDetailPageOwner.waitForLoaded();
    const tripUrl = ownerPage.url();

    await tripDetailPageOwner.inviteTripBuddy(buddyData.email, 'editor');

    const authPageBuddy = new AuthPage(buddyPage);
    await authPageBuddy.login(buddyData.email, buddyData.password);
    await buddyPage.goto('/#/invitations');
    await buddyPage.locator('.invitation-card button:has-text("Accept")').click();

    await ownerPage.goto(tripUrl);
    await buddyPage.goto(tripUrl);
    await tripDetailPageOwner.waitForLoaded();
    const tripDetailPageBuddy = new TripDetailPage(buddyPage);
    await tripDetailPageBuddy.waitForLoaded();

    const suggestionData = generateTestSuggestion('dining');
    await tripDetailPageOwner.createSuggestion(suggestionData);

    // Buddy should see the new suggestion appear
    const newSuggestionOnBuddyPage = buddyPage.locator(`.suggestion-card:has-text("${suggestionData.title}")`);
    await expect(newSuggestionOnBuddyPage).toBeVisible({ timeout: 10000 });

    await ownerContext.close();
    await buddyContext.close();
  });
});
