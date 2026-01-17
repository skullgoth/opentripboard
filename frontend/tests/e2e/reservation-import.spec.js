
import {
  test,
  expect,
  registerAndLogin,
  createTripAndNavigate,
  TripDetailPage,
} from './fixtures.js';

test.describe('Reservation Import', () => {
  let tripData;

  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
    tripData = await createTripAndNavigate(page);
  });

  test('should import a reservation from email content', async ({ page }) => {
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.waitForLoaded();

    // Navigate to reservations page
    await page.goto(`/#/trips/${tripData.id}/reservations`);

    // Click the "Import from Email" button
    await page.click('button:has-text("Import from Email")');

    // Fill in the form
    const emailContent = `
      From: reservations@example.com
      To: test@example.com
      Subject: Your flight confirmation

      Your flight details:
      Flight: UA123
      Departure: 2024-08-01 10:00
      Arrival: 2024-08-01 12:00
      From: JFK
      To: LAX
    `;
    await page.fill('textarea[name="emailContent"]', emailContent);
    await page.click('button[type="submit"]');

    // Should see the new reservation in the list
    await expect(page.locator('.reservation-list')).toContainText('Flight UA123');
  });
});
