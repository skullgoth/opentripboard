/**
 * E2E Tests: Accessibility Audit
 * T299: Automated accessibility testing using axe-core
 * Tests key pages for WCAG 2.1 AA compliance
 */

import { test, expect, generateTestUser, AuthPage, HomePage, TripDetailPage, generateTestTrip } from './fixtures.js';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Audit', () => {
  test.describe('Public Pages', () => {
    test('welcome page should have no accessibility violations', async ({ page }) => {
      // Clear any existing session
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto('/#/');
      await page.waitForSelector('.welcome-page', { timeout: 10000 });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('login page should have no accessibility violations', async ({ page }) => {
      await page.goto('/#/login');
      await page.waitForSelector('#login-form', { timeout: 10000 });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('register page should have no accessibility violations', async ({ page }) => {
      await page.goto('/#/register');
      await page.waitForSelector('#register-form', { timeout: 10000 });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Authenticated Pages', () => {
    let userData;

    test.beforeEach(async ({ page }) => {
      // Register and login a new user
      const authPage = new AuthPage(page);
      userData = generateTestUser('a11y');
      await authPage.register(userData);
      await page.waitForURL('/#/', { timeout: 10000 });
    });

    test('trips list page should have no accessibility violations', async ({ page }) => {
      await page.waitForSelector('.trip-list, .trips-container, .trips-empty', {
        timeout: 10000,
      });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('create trip modal should have no accessibility violations', async ({ page }) => {
      const homePage = new HomePage(page);
      await homePage.waitForTripsLoaded();
      await homePage.clickCreateTrip();

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('trip detail page should have no accessibility violations', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripData = generateTestTrip('A11y Test');

      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);

      // Wait for navigation to trip detail
      await page.waitForURL('**/#/trips/**', { timeout: 10000 });
      await page.waitForSelector('.trip-detail-page, .trip-detail-header', {
        timeout: 10000,
      });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('activity form modal should have no accessibility violations', async ({ page }) => {
      const homePage = new HomePage(page);
      const tripDetailPage = new TripDetailPage(page);
      const tripData = generateTestTrip('A11y Activity Test');

      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);
      await page.waitForURL('**/#/trips/**', { timeout: 10000 });
      await tripDetailPage.waitForLoaded();

      // Open activity form
      await tripDetailPage.clickAddActivity();

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Interactive Components', () => {
    test('should support keyboard navigation on drag-and-drop items', async ({ page }) => {
      // Register and create a trip with activities
      const authPage = new AuthPage(page);
      const userData = generateTestUser('kbd-nav');
      await authPage.register(userData);
      await page.waitForURL('/#/', { timeout: 10000 });

      const homePage = new HomePage(page);
      const tripData = generateTestTrip('Keyboard Nav Test');
      await homePage.waitForTripsLoaded();
      await homePage.createTrip(tripData);
      await page.waitForURL('**/#/trips/**', { timeout: 10000 });

      // Check for draggable items
      const draggableItems = page.locator('[data-sortable-item], .sortable-item, .activity-card');
      const count = await draggableItems.count();

      if (count > 0) {
        // Verify keyboard accessibility attributes
        const firstItem = draggableItems.first();
        await expect(firstItem).toHaveAttribute('tabindex', '0');
        await expect(firstItem).toHaveAttribute('role', 'listitem');
      }
    });

    test('should have skip-to-content link', async ({ page }) => {
      await page.goto('/#/');

      // Skip link should exist and be focusable
      const skipLink = page.locator('.skip-link, #skip-to-content, [href="#main-content"]');
      await expect(skipLink).toBeAttached();

      // Focus the skip link and verify it becomes visible
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      const tagName = await focusedElement.evaluate(el => el.tagName);

      // First focusable element should be the skip link
      if (tagName === 'A') {
        const href = await focusedElement.getAttribute('href');
        expect(href).toMatch(/#main|#content/i);
      }
    });

    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('/#/login');
      await page.waitForSelector('#login-form', { timeout: 10000 });

      // Tab to the first input
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Check that focused element has visible focus styles
      const focusedElement = page.locator(':focus');
      const outline = await focusedElement.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          outlineWidth: styles.outlineWidth,
          outlineStyle: styles.outlineStyle,
          boxShadow: styles.boxShadow,
        };
      });

      // Should have either outline or box-shadow for focus indication
      const hasFocusIndicator =
        (outline.outlineWidth !== '0px' && outline.outlineStyle !== 'none') ||
        outline.boxShadow !== 'none';

      expect(hasFocusIndicator).toBe(true);
    });
  });

  test.describe('Screen Reader Announcements', () => {
    test('should have aria-live regions for dynamic content', async ({ page }) => {
      const authPage = new AuthPage(page);
      const userData = generateTestUser('sr-test');
      await authPage.register(userData);
      await page.waitForURL('/#/', { timeout: 10000 });

      // Check for aria-live regions
      const ariaLiveRegions = page.locator('[aria-live]');
      const count = await ariaLiveRegions.count();

      // Should have at least one aria-live region for announcements
      expect(count).toBeGreaterThan(0);
    });

    test('should announce toast notifications to screen readers', async ({ page }) => {
      const authPage = new AuthPage(page);
      const userData = generateTestUser('toast-test');
      await authPage.register(userData);
      await page.waitForURL('/#/', { timeout: 10000 });

      // Look for toast container with appropriate ARIA attributes
      const toastContainer = page.locator('.toast-container, [role="alert"], [role="status"]');

      // Toast container should exist for screen reader announcements
      await expect(toastContainer.first()).toBeAttached();
    });
  });

  test.describe('Form Accessibility', () => {
    test('form inputs should have associated labels', async ({ page }) => {
      await page.goto('/#/register');
      await page.waitForSelector('#register-form', { timeout: 10000 });

      // Get all form inputs
      const inputs = page.locator('input:not([type="hidden"]):not([type="submit"])');
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        // Check if input has an associated label or aria-label
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;
          const hasAriaLabel = !!ariaLabel || !!ariaLabelledBy;

          expect(hasLabel || hasAriaLabel).toBe(true);
        }
      }
    });

    test('form validation errors should be announced', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.goToRegister();

      // Submit empty form
      await page.click('#register-btn');

      // Error messages should have appropriate ARIA attributes
      const errorMessages = page.locator('[data-error], .error-message, .field-error');
      const errorCount = await errorMessages.count();

      if (errorCount > 0) {
        const firstError = errorMessages.first();
        // Errors should be associated with inputs or have role="alert"
        const role = await firstError.getAttribute('role');
        const ariaLive = await firstError.getAttribute('aria-live');

        expect(role === 'alert' || ariaLive === 'assertive' || ariaLive === 'polite').toBe(true);
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('text should have sufficient color contrast', async ({ page }) => {
      await page.goto('/#/login');
      await page.waitForSelector('#login-form', { timeout: 10000 });

      // Run axe specifically for color contrast
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({
          rules: {
            'color-contrast': { enabled: true },
          },
        })
        .analyze();

      // Filter for just color contrast violations
      const contrastViolations = accessibilityScanResults.violations.filter(
        v => v.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    });
  });

  test.describe('Images and Media', () => {
    test('images should have alt text', async ({ page }) => {
      const authPage = new AuthPage(page);
      const userData = generateTestUser('img-test');
      await authPage.register(userData);
      await page.waitForURL('/#/', { timeout: 10000 });

      // Check all images have alt text
      const images = page.locator('img');
      const imgCount = await images.count();

      for (let i = 0; i < imgCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');

        // Image should have alt text or role="presentation" for decorative images
        expect(alt !== null || role === 'presentation' || role === 'none').toBe(true);
      }
    });
  });
});
