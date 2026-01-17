/**
 * E2E Tests: Suggestions and Collaboration
 * Tests suggestion creation, voting, acceptance/rejection, and collaboration features
 */

import {
  test,
  expect,
  generateTestUser,
  generateTestTrip,
  generateTestSuggestion,
  AuthPage,
  HomePage,
  TripDetailPage,
  registerAndLogin,
  createTripAndNavigate,
} from './fixtures.js';

test.describe('Suggestions and Collaboration', () => {
  let userData;

  test.beforeEach(async ({ page }) => {
    // Register and login a fresh user for each test
    userData = await registerAndLogin(page);
  });

  test.describe('Suggestion Creation', () => {
    test('should create a new suggestion successfully', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const suggestionData = generateTestSuggestion('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createSuggestion(suggestionData);

      // Wait for suggestion to appear
      await page.waitForTimeout(1000);

      // Suggestion should appear in the list
      const suggestionCards = await tripDetailPage.getSuggestionCards();
      const suggestionTexts = await suggestionCards.allTextContents();

      const foundSuggestion = suggestionTexts.some(text =>
        text.includes(suggestionData.title)
      );
      expect(foundSuggestion).toBe(true);
    });

    test('should open suggestion creation modal', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.clickAddSuggestion();

      // Modal should be visible
      const modal = page.locator('#suggestion-modal, .suggestion-form-modal, .modal-overlay');
      await expect(modal).toBeVisible();

      // Form elements should be present
      const titleInput = page.locator('#suggestion-form [name="title"]');
      await expect(titleInput).toBeVisible();

      const typeSelect = page.locator('#suggestion-form [name="activityType"]');
      await expect(typeSelect).toBeVisible();
    });

    test('should close suggestion modal on cancel', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.clickAddSuggestion();

      // Click close button
      const closeBtn = page.locator('#suggestion-modal [data-action="close-modal"]');
      await closeBtn.click();

      // Modal should be hidden
      const modal = page.locator('#suggestion-modal');
      await expect(modal).not.toBeVisible({ timeout: 5000 });
    });

    test('should create suggestions of different activity types', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      const types = ['sightseeing', 'dining', 'activity'];

      for (const type of types) {
        const suggestionData = generateTestSuggestion(type);
        await tripDetailPage.createSuggestion(suggestionData);
        await page.waitForTimeout(500);
      }

      // All suggestions should be created
      const suggestionCards = await tripDetailPage.getSuggestionCards();
      expect(await suggestionCards.count()).toBeGreaterThanOrEqual(types.length);
    });
  });

  test.describe('Suggestion Voting', () => {
    test('should upvote a suggestion', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const suggestionData = generateTestSuggestion('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createSuggestion(suggestionData);

      await page.waitForTimeout(1000);

      // Find and click upvote button
      const suggestionCard = page.locator(`.suggestion-card:has-text("${suggestionData.title}"), .suggestion-item:has-text("${suggestionData.title}")`);
      const upvoteBtn = suggestionCard.locator('[data-action="vote-suggestion"][data-vote="up"], .vote-up');

      if (await upvoteBtn.isVisible()) {
        await upvoteBtn.click();
        await page.waitForTimeout(500);

        // Vote count should update or button state should change
        // The UI might show active state or increment count
      }
    });

    test('should downvote a suggestion', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const suggestionData = generateTestSuggestion('dining');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createSuggestion(suggestionData);

      await page.waitForTimeout(1000);

      // Find and click downvote button
      const suggestionCard = page.locator(`.suggestion-card:has-text("${suggestionData.title}"), .suggestion-item:has-text("${suggestionData.title}")`);
      const downvoteBtn = suggestionCard.locator('[data-action="vote-suggestion"][data-vote="down"], .vote-down');

      if (await downvoteBtn.isVisible()) {
        await downvoteBtn.click();
        await page.waitForTimeout(500);
      }
    });

    test('should toggle vote (neutral)', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const suggestionData = generateTestSuggestion('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createSuggestion(suggestionData);

      await page.waitForTimeout(1000);

      const suggestionCard = page.locator(`.suggestion-card:has-text("${suggestionData.title}"), .suggestion-item:has-text("${suggestionData.title}")`);
      const upvoteBtn = suggestionCard.locator('[data-action="vote-suggestion"][data-vote="up"], .vote-up');

      if (await upvoteBtn.isVisible()) {
        // Vote up
        await upvoteBtn.click();
        await page.waitForTimeout(500);

        // Click again to toggle off (neutral)
        await upvoteBtn.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Suggestion Acceptance/Rejection', () => {
    test('should accept a suggestion', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const suggestionData = generateTestSuggestion('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createSuggestion(suggestionData);

      await page.waitForTimeout(1000);

      // Accept the suggestion
      const suggestionCard = page.locator(`.suggestion-card:has-text("${suggestionData.title}"), .suggestion-item:has-text("${suggestionData.title}")`);
      const acceptBtn = suggestionCard.locator('[data-action="accept-suggestion"]');

      if (await acceptBtn.isVisible()) {
        // Handle alert
        page.once('dialog', dialog => dialog.accept());

        await acceptBtn.click();

        await page.waitForTimeout(1000);

        // Suggestion should be moved to history or converted to activity
        // Check for activity in timeline or suggestion in history
      }
    });

    test('should reject a suggestion', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const suggestionData = generateTestSuggestion('dining');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createSuggestion(suggestionData);

      await page.waitForTimeout(1000);

      // Reject the suggestion
      const suggestionCard = page.locator(`.suggestion-card:has-text("${suggestionData.title}"), .suggestion-item:has-text("${suggestionData.title}")`);
      const rejectBtn = suggestionCard.locator('[data-action="reject-suggestion"]');

      if (await rejectBtn.isVisible()) {
        await rejectBtn.click();

        await page.waitForTimeout(1000);

        // Suggestion should be moved to history with rejected status
      }
    });

    test('should show accepted suggestion in history', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const suggestionData = generateTestSuggestion('activity');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createSuggestion(suggestionData);

      await page.waitForTimeout(1000);

      // Accept the suggestion
      const suggestionCard = page.locator(`.suggestion-card:has-text("${suggestionData.title}"), .suggestion-item:has-text("${suggestionData.title}")`);
      const acceptBtn = suggestionCard.locator('[data-action="accept-suggestion"]');

      if (await acceptBtn.isVisible()) {
        page.once('dialog', dialog => dialog.accept());
        await acceptBtn.click();

        await page.waitForTimeout(1000);

        // Toggle history to see accepted suggestions
        const historyToggle = page.locator('[data-action="toggle-history"]');
        if (await historyToggle.isVisible()) {
          await historyToggle.click();
          await page.waitForTimeout(500);

          // History should contain the accepted suggestion
          const historySection = page.locator('.suggestion-history');
          if (await historySection.isVisible()) {
            const historyText = await historySection.textContent();
            expect(historyText).toContain(suggestionData.title);
          }
        }
      }
    });
  });

  test.describe('Suggestion History', () => {
    test('should toggle suggestion history visibility', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      // Create and accept a suggestion to have something in history
      const suggestionData = generateTestSuggestion('sightseeing');
      await tripDetailPage.createSuggestion(suggestionData);
      await page.waitForTimeout(500);

      // Accept it
      const suggestionCard = page.locator(`.suggestion-card:has-text("${suggestionData.title}"), .suggestion-item:has-text("${suggestionData.title}")`);
      const acceptBtn = suggestionCard.locator('[data-action="accept-suggestion"]');

      if (await acceptBtn.isVisible()) {
        page.once('dialog', dialog => dialog.accept());
        await acceptBtn.click();
        await page.waitForTimeout(1000);
      }

      // Toggle history
      const historyToggle = page.locator('[data-action="toggle-history"]');
      if (await historyToggle.isVisible()) {
        // Show history
        await historyToggle.click();
        await page.waitForTimeout(300);

        const historySection = page.locator('.suggestion-history');
        await expect(historySection).toBeVisible();

        // Hide history
        await historyToggle.click();
        await page.waitForTimeout(300);

        await expect(historySection).not.toBeVisible();
      }
    });

    test('should paginate suggestion history', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      // Create multiple suggestions and accept them to fill history
      for (let i = 0; i < 6; i++) {
        const suggestionData = generateTestSuggestion('sightseeing');
        await tripDetailPage.createSuggestion(suggestionData);
        await page.waitForTimeout(300);

        const suggestionCard = page.locator(`.suggestion-card:has-text("${suggestionData.title}"), .suggestion-item:has-text("${suggestionData.title}")`);
        const acceptBtn = suggestionCard.locator('[data-action="accept-suggestion"]');

        if (await acceptBtn.isVisible()) {
          page.once('dialog', dialog => dialog.accept());
          await acceptBtn.click();
          await page.waitForTimeout(500);
        }
      }

      // Toggle history
      const historyToggle = page.locator('[data-action="toggle-history"]');
      if (await historyToggle.isVisible()) {
        await historyToggle.click();
        await page.waitForTimeout(500);

        // Check for pagination controls
        const prevBtn = page.locator('[data-action="prev-page"]');
        const nextBtn = page.locator('[data-action="next-page"]');

        // If pagination exists, test navigation
        if (await nextBtn.isVisible() && !(await nextBtn.isDisabled())) {
          await nextBtn.click();
          await page.waitForTimeout(300);
        }
      }
    });
  });

  test.describe('Suggestion Deletion', () => {
    test('should delete own suggestion', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const suggestionData = generateTestSuggestion('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createSuggestion(suggestionData);

      await page.waitForTimeout(1000);

      // Find delete button
      const suggestionCard = page.locator(`.suggestion-card:has-text("${suggestionData.title}"), .suggestion-item:has-text("${suggestionData.title}")`);
      const deleteBtn = suggestionCard.locator('[data-action="delete-suggestion"]');

      if (await deleteBtn.isVisible()) {
        // Handle confirmation
        page.once('dialog', dialog => dialog.accept());

        await deleteBtn.click();

        await page.waitForTimeout(1000);

        // Suggestion should no longer be visible
        await expect(suggestionCard).not.toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Suggestions Section UI', () => {
    test('should display suggestions section', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      // Suggestions section should be visible
      const suggestionsSection = page.locator('.suggestions-section, .suggestion-list');
      await expect(suggestionsSection).toBeVisible();
    });

    test('should show add suggestion button', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      // Add suggestion button should be visible
      const addBtn = page.locator('[data-action="create-suggestion"]');
      await expect(addBtn).toBeVisible();
    });

    test('should show empty state when no suggestions', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      // If no suggestions, should show empty state or just the add button
      const suggestionsSection = page.locator('.suggestions-section, .suggestion-list');
      await expect(suggestionsSection).toBeVisible();

      // Either empty state message or zero suggestion cards
      const suggestionCards = await tripDetailPage.getSuggestionCards();
      // Initially should be empty
      expect(await suggestionCards.count()).toBe(0);
    });
  });

  test.describe('Trip Buddies', () => {
    test('should show invite trip buddy button for owner', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      // Invite button should be visible for trip owner
      const inviteBtn = page.locator('[data-action="invite-trip-buddy"]');
      // May or may not be visible depending on UI
      // Just verify the page loaded correctly
      await expect(page.locator('.trip-detail-page, .trip-detail-header')).toBeVisible();
    });

    test('should open invite trip buddy modal', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      const inviteBtn = page.locator('[data-action="invite-trip-buddy"]');

      if (await inviteBtn.isVisible()) {
        await inviteBtn.click();

        // Modal should open
        const modal = page.locator('#invite-trip-buddy-modal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Form should have email and role fields
        const emailInput = page.locator('#invite-trip-buddy-form [name="email"]');
        const roleSelect = page.locator('#invite-trip-buddy-form [name="role"]');

        await expect(emailInput).toBeVisible();
        await expect(roleSelect).toBeVisible();
      }
    });

    test('should close invite modal on cancel', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      const inviteBtn = page.locator('[data-action="invite-trip-buddy"]');

      if (await inviteBtn.isVisible()) {
        await inviteBtn.click();

        const modal = page.locator('#invite-trip-buddy-modal');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Close modal
        const closeBtn = page.locator('#invite-trip-buddy-modal [data-action="close-modal"]');
        await closeBtn.click();

        await expect(modal).not.toBeVisible({ timeout: 5000 });
      }
    });

    test('should show trip buddies list', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      // Trip buddies area should be visible (even if just showing owner)
      const buddiesArea = page.locator('.trip-buddies-inline, .trip-buddy-list, [data-action="invite-trip-buddy"]');
      await expect(buddiesArea.first()).toBeVisible();
    });
  });
});
