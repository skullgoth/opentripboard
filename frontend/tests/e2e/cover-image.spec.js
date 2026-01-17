/**
 * E2E Tests: Cover Image Management
 * Tests uploading and deleting trip cover images.
 */

import {
  test,
  expect,
  registerAndLogin,
  createTripAndNavigate,
  TripDetailPage,
} from './fixtures.js';
import path from 'path';

test.describe('Cover Image Management', () => {
  let userData;

  test.beforeEach(async ({ page }) => {
    // Register and login a fresh user for each test
    userData = await registerAndLogin(page);
  });

  test('should upload a new cover image', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    const coverImage = page.locator('[data-testid="trip-cover-image"]');
    const initialSrc = await coverImage.getAttribute('src');

    // Path to the test image file
    const testImagePath = path.join(__dirname, 'test-assets', 'test-image.jpg');

    // Create a dummy file if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(testImagePath)) {
      if (!fs.existsSync(path.dirname(testImagePath))) {
        fs.mkdirSync(path.dirname(testImagePath), { recursive: true });
      }
      fs.writeFileSync(testImagePath, 'dummy content');
    }

    // Set up the file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-action="edit-cover-image"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testImagePath);

    // Wait for the upload and page reload
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Verify the new image is loaded
    await tripDetailPage.waitForLoaded();
    const newSrc = await coverImage.getAttribute('src');
    expect(newSrc).not.toBe(initialSrc);
    expect(newSrc).toContain('processed-');
  });

  test('should delete a cover image', async ({ page }) => {
    const tripData = await createTripAndNavigate(page);
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    // First, upload a cover image
    const testImagePath = path.join(__dirname, 'test-assets', 'test-image.jpg');
    const fs = require('fs');
    if (!fs.existsSync(testImagePath)) {
      if (!fs.existsSync(path.dirname(testImagePath))) {
        fs.mkdirSync(path.dirname(testImagePath), { recursive: true });
      }
      fs.writeFileSync(testImagePath, 'dummy content');
    }
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-action="edit-cover-image"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testImagePath);
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    await tripDetailPage.waitForLoaded();

    const coverImage = page.locator('[data-testid="trip-cover-image"]');
    const uploadedSrc = await coverImage.getAttribute('src');

    // Now, delete the image
    page.on('dialog', dialog => dialog.accept());
    await page.click('[data-action="delete-cover-image"]');

    // Wait for the page to reload
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Verify the image has been removed and reverted to default
    await tripDetailPage.waitForLoaded();
    const finalSrc = await coverImage.getAttribute('src');
    expect(finalSrc).not.toBe(uploadedSrc);
    expect(finalSrc).toContain('default-');
  });
});
