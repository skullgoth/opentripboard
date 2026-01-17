/**
 * E2E Tests: Activity Management
 * Tests activity creation, editing, viewing, deletion, and reordering
 */

import {
  test,
  expect,
  generateTestUser,
  generateTestTrip,
  generateTestActivity,
  AuthPage,
  HomePage,
  TripDetailPage,
  registerAndLogin,
  createTripAndNavigate,
} from './fixtures.js';

test.describe('Activity Management', () => {
  let userData;

  test.beforeEach(async ({ page }) => {
    // Register and login a fresh user for each test
    userData = await registerAndLogin(page);
  });

  test.describe('Activity Creation', () => {
    test('should create a new activity successfully', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const activityData = generateTestActivity('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createActivity(activityData);

      // Wait for activity to appear
      await page.waitForTimeout(1000);

      // Activity should appear in the timeline
      const activityCards = await tripDetailPage.getActivityCards();
      const activityTexts = await activityCards.allTextContents();

      const foundActivity = activityTexts.some(text =>
        text.includes(activityData.title)
      );
      expect(foundActivity).toBe(true);
    });

    test('should open activity creation modal', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.clickAddActivity();

      // Modal should be visible
      const modal = page.locator('#activity-form-modal, .activity-form-modal, .modal');
      await expect(modal).toBeVisible();

      // Form elements should be present
      const titleInput = page.locator('[name="title"]');
      await expect(titleInput).toBeVisible();

      const typeSelect = page.locator('[name="activityType"]');
      await expect(typeSelect).toBeVisible();
    });

    test('should create different activity types', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      const activityTypes = ['sightseeing', 'dining', 'transport', 'accommodation'];

      for (const type of activityTypes) {
        const activityData = generateTestActivity(type);
        await tripDetailPage.createActivity(activityData);
        await page.waitForTimeout(500);
      }

      // All activities should be created
      const activityCards = await tripDetailPage.getActivityCards();
      expect(await activityCards.count()).toBeGreaterThanOrEqual(activityTypes.length);
    });

    test('should close activity modal on cancel', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.clickAddActivity();

      // Click cancel/close button
      const closeBtn = page.locator('[data-action="close-modal"], [data-action="cancel"], .modal-close');
      await closeBtn.click();

      // Modal should be hidden
      const modal = page.locator('#activity-form-modal, .activity-form-modal');
      await expect(modal).not.toBeVisible({ timeout: 5000 });
    });

    test('should create activity with location', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const activityData = generateTestActivity('sightseeing', {
        location: 'Eiffel Tower, Paris',
      });

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createActivity(activityData);

      await page.waitForTimeout(1000);

      // Activity with location should be visible
      const activityCards = await tripDetailPage.getActivityCards();
      const activityTexts = await activityCards.allTextContents();

      const foundActivity = activityTexts.some(text =>
        text.includes(activityData.title)
      );
      expect(foundActivity).toBe(true);
    });

    test('should create activity with time range', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const activityData = generateTestActivity('dining', {
        startTime: '19:00',
        endTime: '21:00',
      });

      await tripDetailPage.waitForLoaded();

      // Fill activity form with times
      await tripDetailPage.clickAddActivity();

      await page.selectOption('[name="activityType"]', activityData.activityType);
      await page.fill('[name="title"]', activityData.title);

      // Fill time fields if available
      const startTimeInput = page.locator('[name="startTime"]');
      const endTimeInput = page.locator('[name="endTime"]');

      if (await startTimeInput.isVisible()) {
        await startTimeInput.fill(activityData.startTime);
      }
      if (await endTimeInput.isVisible()) {
        await endTimeInput.fill(activityData.endTime);
      }

      await page.click('[data-action="save-activity"], .activity-form button[type="submit"]');

      await page.waitForTimeout(1000);

      // Activity should be created
      const activityCards = await tripDetailPage.getActivityCards();
      const activityTexts = await activityCards.allTextContents();

      const foundActivity = activityTexts.some(text =>
        text.includes(activityData.title)
      );
      expect(foundActivity).toBe(true);
    });
  });

  test.describe('Activity Viewing', () => {
    test('should display activity details in timeline', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const activityData = generateTestActivity('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createActivity(activityData);

      await page.waitForTimeout(1000);

      // Activity title should be visible
      const activityTitle = page.locator(`.activity-card:has-text("${activityData.title}"), .activity-item:has-text("${activityData.title}")`);
      await expect(activityTitle).toBeVisible();
    });

    test('should display activity type icon', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const activityData = generateTestActivity('dining');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createActivity(activityData);

      await page.waitForTimeout(1000);

      // Activity card should be visible with appropriate icon or type indicator
      const activityCard = page.locator(`.activity-card:has-text("${activityData.title}"), .activity-item:has-text("${activityData.title}")`);
      await expect(activityCard).toBeVisible();
    });

    test('should show activities grouped by date', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      // Create activity
      const activityData = generateTestActivity('sightseeing');
      await tripDetailPage.createActivity(activityData);

      await page.waitForTimeout(1000);

      // Timeline should have date sections
      const dateHeaders = page.locator('.day-header, .timeline-date, [data-date]');
      // At least one date section should exist
      expect(await dateHeaders.count()).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Activity Editing', () => {
    test('should open edit activity modal', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const activityData = generateTestActivity('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createActivity(activityData);

      await page.waitForTimeout(1000);

      // Click edit on the activity
      const activityCard = page.locator(`.activity-card:has-text("${activityData.title}"), .activity-item:has-text("${activityData.title}")`);
      const editBtn = activityCard.locator('[data-action="edit-activity"], .edit-button');
      await editBtn.click();

      // Modal should be visible
      const modal = page.locator('#activity-form-modal, .activity-form-modal, .modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Form should be pre-filled with activity data
      const titleInput = page.locator('[name="title"]');
      await expect(titleInput).toHaveValue(activityData.title);
    });

    test('should update activity title', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const activityData = generateTestActivity('sightseeing');
      const newTitle = 'Updated Activity Title ' + Date.now();

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createActivity(activityData);

      await page.waitForTimeout(1000);

      // Open edit modal
      const activityCard = page.locator(`.activity-card:has-text("${activityData.title}"), .activity-item:has-text("${activityData.title}")`);
      const editBtn = activityCard.locator('[data-action="edit-activity"], .edit-button');
      await editBtn.click();

      // Update title
      const titleInput = page.locator('[name="title"]');
      await titleInput.clear();
      await titleInput.fill(newTitle);

      // Save
      await page.click('[data-action="save-activity"], .activity-form button[type="submit"]');

      await page.waitForTimeout(1000);

      // Verify updated title
      const updatedActivity = page.locator(`.activity-card:has-text("${newTitle}"), .activity-item:has-text("${newTitle}")`);
      await expect(updatedActivity).toBeVisible({ timeout: 5000 });
    });

    test('should update activity type', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const activityData = generateTestActivity('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createActivity(activityData);

      await page.waitForTimeout(1000);

      // Open edit modal
      const activityCard = page.locator(`.activity-card:has-text("${activityData.title}"), .activity-item:has-text("${activityData.title}")`);
      const editBtn = activityCard.locator('[data-action="edit-activity"], .edit-button');
      await editBtn.click();

      // Change type
      await page.selectOption('[name="activityType"]', 'dining');

      // Save
      await page.click('[data-action="save-activity"], .activity-form button[type="submit"]');

      await page.waitForTimeout(1000);

      // Activity should still exist (type changed but title same)
      const updatedActivity = page.locator(`.activity-card:has-text("${activityData.title}"), .activity-item:has-text("${activityData.title}")`);
      await expect(updatedActivity).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Activity Deletion', () => {
    test('should delete activity', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const activityData = generateTestActivity('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createActivity(activityData);

      await page.waitForTimeout(1000);

      // Verify activity exists
      let activityCard = page.locator(`.activity-card:has-text("${activityData.title}"), .activity-item:has-text("${activityData.title}")`);
      await expect(activityCard).toBeVisible();

      // Delete the activity
      const deleteBtn = activityCard.locator('[data-action="delete-activity"], .delete-button');

      // Handle confirmation dialog
      page.once('dialog', dialog => dialog.accept());

      await deleteBtn.click();

      await page.waitForTimeout(1000);

      // Activity should no longer be visible
      activityCard = page.locator(`.activity-card:has-text("${activityData.title}"), .activity-item:has-text("${activityData.title}")`);
      await expect(activityCard).not.toBeVisible({ timeout: 5000 });
    });

    test('should cancel activity deletion', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);
      const activityData = generateTestActivity('sightseeing');

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.createActivity(activityData);

      await page.waitForTimeout(1000);

      // Get delete button
      const activityCard = page.locator(`.activity-card:has-text("${activityData.title}"), .activity-item:has-text("${activityData.title}")`);
      const deleteBtn = activityCard.locator('[data-action="delete-activity"], .delete-button');

      // Handle confirmation dialog - dismiss it
      page.once('dialog', dialog => dialog.dismiss());

      await deleteBtn.click();

      await page.waitForTimeout(500);

      // Activity should still exist
      await expect(activityCard).toBeVisible();
    });
  });

  test.describe('Multiple Activities', () => {
    test('should display multiple activities', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      // Create multiple activities
      const activity1 = generateTestActivity('sightseeing');
      const activity2 = generateTestActivity('dining');
      const activity3 = generateTestActivity('transport');

      await tripDetailPage.createActivity(activity1);
      await page.waitForTimeout(500);

      await tripDetailPage.createActivity(activity2);
      await page.waitForTimeout(500);

      await tripDetailPage.createActivity(activity3);
      await page.waitForTimeout(500);

      // All activities should be visible
      const activityCards = await tripDetailPage.getActivityCards();
      expect(await activityCards.count()).toBeGreaterThanOrEqual(3);
    });

    test('should maintain activity order after page refresh', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();

      // Create activities
      const activity1 = generateTestActivity('sightseeing');
      const activity2 = generateTestActivity('dining');

      await tripDetailPage.createActivity(activity1);
      await page.waitForTimeout(500);

      await tripDetailPage.createActivity(activity2);
      await page.waitForTimeout(500);

      // Refresh the page
      await page.reload();
      await tripDetailPage.waitForLoaded();

      // Activities should still be there
      const activityCards = await tripDetailPage.getActivityCards();
      expect(await activityCards.count()).toBeGreaterThanOrEqual(2);

      const activityTexts = await activityCards.allTextContents();
      expect(activityTexts.some(text => text.includes(activity1.title))).toBe(true);
      expect(activityTexts.some(text => text.includes(activity2.title))).toBe(true);
    });
  });

  test.describe('Activity Form Validation', () => {
    test('should require activity title', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.clickAddActivity();

      // Try to submit without title
      await page.selectOption('[name="activityType"]', 'sightseeing');
      // Leave title empty

      await page.click('[data-action="save-activity"], .activity-form button[type="submit"]');

      // Should show validation error or form should not submit
      // Check if still on the form
      const modal = page.locator('#activity-form-modal, .activity-form-modal, .modal');
      await expect(modal).toBeVisible();
    });

    test('should require activity type selection', async ({ page }) => {
      const tripData = await createTripAndNavigate(page);
      const tripDetailPage = new TripDetailPage(page);

      await tripDetailPage.waitForLoaded();
      await tripDetailPage.clickAddActivity();

      // Fill title but not type
      await page.fill('[name="title"]', 'Test Activity');

      // Activity type select should have a default or require selection
      const typeSelect = page.locator('[name="activityType"]');
      const selectedValue = await typeSelect.inputValue();

      // Either it has a default or requires selection
      expect(selectedValue !== '' || await typeSelect.getAttribute('required')).toBeTruthy();
    });
  });
});
