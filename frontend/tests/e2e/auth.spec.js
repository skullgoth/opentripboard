/**
 * E2E Tests: Authentication Flow
 * Tests user registration, login, logout, and session management
 */

import { test, expect, generateTestUser, AuthPage, HomePage } from './fixtures.js';

test.describe('Authentication Flow', () => {
  test.describe('User Registration', () => {
    test('should successfully register a new user', async ({ page }) => {
      const authPage = new AuthPage(page);
      const userData = generateTestUser('register');

      await authPage.register(userData);

      // Should redirect to home page after successful registration
      await expect(page).toHaveURL('/#/', { timeout: 10000 });

      // Should show authenticated state (trips page, not welcome)
      await page.waitForSelector('.trip-list, .trips-container, .trips-empty', {
        timeout: 10000,
      });
    });

    test('should show error for invalid email format', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.goToRegister();
      await page.fill('#firstName', 'Test');
      await page.fill('#lastName', 'User');
      await page.fill('#email', 'invalid-email');
      await page.fill('#password', 'TestPass123!');
      await page.fill('#confirmPassword', 'TestPass123!');
      await page.click('#register-btn');

      // Should show email validation error
      const emailError = page.locator('[data-error="email"]');
      await expect(emailError).toBeVisible();
      await expect(emailError).toContainText('valid email');
    });

    test('should show error for weak password', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.goToRegister();
      await page.fill('#firstName', 'Test');
      await page.fill('#lastName', 'User');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'weak');
      await page.fill('#confirmPassword', 'weak');
      await page.click('#register-btn');

      // Should show password validation error
      const passwordError = page.locator('[data-error="password"]');
      await expect(passwordError).toBeVisible();
    });

    test('should show error for password mismatch', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.goToRegister();
      await page.fill('#firstName', 'Test');
      await page.fill('#lastName', 'User');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'TestPass123!');
      await page.fill('#confirmPassword', 'DifferentPass123!');
      await page.click('#register-btn');

      // Should show confirmation password error
      const confirmError = page.locator('[data-error="confirmPassword"]');
      await expect(confirmError).toBeVisible();
      await expect(confirmError).toContainText('match');
    });

    test('should show error for missing required fields', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.goToRegister();
      // Leave all fields empty and submit
      await page.click('#register-btn');

      // Should show required field errors
      const firstNameError = page.locator('[data-error="firstName"]');
      await expect(firstNameError).toBeVisible();
    });

    test('should have link to login page', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.goToRegister();

      const loginLink = page.locator('a[href="#/login"]');
      await expect(loginLink).toBeVisible();

      await loginLink.click();
      await expect(page).toHaveURL('/#/login');
    });
  });

  test.describe('User Login', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      const authPage = new AuthPage(page);
      const userData = generateTestUser('login');

      // First register the user
      await authPage.register(userData);
      await page.waitForURL('/#/', { timeout: 10000 });

      // Logout (clear storage)
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Now login
      await authPage.login(userData.email, userData.password);

      // Should redirect to home page
      await expect(page).toHaveURL('/#/', { timeout: 10000 });

      // Should show authenticated state
      await page.waitForSelector('.trip-list, .trips-container, .trips-empty', {
        timeout: 10000,
      });
    });

    test('should show error for invalid credentials', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.login('nonexistent@example.com', 'WrongPassword123!');

      // Should show error message
      const errorEl = page.locator('[data-error="general"]');
      await expect(errorEl).toBeVisible({ timeout: 5000 });
    });

    test('should show error for empty fields', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.goToLogin();
      await page.click('#login-btn');

      // Should show error
      const errorEl = page.locator('[data-error="general"]');
      await expect(errorEl).toBeVisible();
      await expect(errorEl).toContainText('fill in all fields');
    });

    test('should have link to register page', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.goToLogin();

      const registerLink = page.locator('a[href="#/register"]');
      await expect(registerLink).toBeVisible();

      await registerLink.click();
      await expect(page).toHaveURL('/#/register');
    });

    test('should disable login button during submission', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.goToLogin();
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'TestPass123!');

      // Click and immediately check button state
      const loginPromise = page.click('#login-btn');
      const loginBtn = page.locator('#login-btn');

      // Button should be disabled during login attempt
      await expect(loginBtn).toBeDisabled({ timeout: 1000 });
      await expect(loginBtn).toContainText('Logging in');

      await loginPromise;
    });
  });

  test.describe('Session Management', () => {
    test('should persist session after page refresh', async ({ page }) => {
      const authPage = new AuthPage(page);
      const userData = generateTestUser('session');

      // Register and login
      await authPage.register(userData);
      await page.waitForURL('/#/', { timeout: 10000 });

      // Refresh the page
      await page.reload();

      // Should still be logged in
      await page.waitForSelector('.trip-list, .trips-container, .trips-empty', {
        timeout: 10000,
      });

      // Should not show welcome page
      const welcomePage = page.locator('.welcome-page');
      await expect(welcomePage).not.toBeVisible();
    });

    test('should redirect to login when accessing protected route while logged out', async ({ page }) => {
      // Clear any existing session
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Try to access a trip detail page directly
      await page.goto('/#/trips/some-trip-id');

      // Should redirect to login
      await expect(page).toHaveURL(/\/#\/login/, { timeout: 10000 });
    });

    test('should show welcome page for unauthenticated users', async ({ page }) => {
      // Clear any existing session
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Go to home page
      await page.goto('/#/');

      // Should show welcome page
      const welcomePage = page.locator('.welcome-page');
      await expect(welcomePage).toBeVisible({ timeout: 10000 });

      // Should have login and signup buttons
      const loginBtn = page.locator('.welcome-page a[href="#/login"]');
      const signupBtn = page.locator('.welcome-page a[href="#/register"]');

      await expect(loginBtn).toBeVisible();
      await expect(signupBtn).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate between login and register pages', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Start at login
      await authPage.goToLogin();
      await expect(page).toHaveURL('/#/login');

      // Go to register
      await page.click('a[href="#/register"]');
      await expect(page).toHaveURL('/#/register');

      // Go back to login
      await page.click('a[href="#/login"]');
      await expect(page).toHaveURL('/#/login');
    });

    test('should navigate from welcome page to login', async ({ page }) => {
      // Clear session
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      await page.goto('/#/');

      // Click login button on welcome page
      await page.click('.welcome-page a[href="#/login"]');

      await expect(page).toHaveURL('/#/login');
    });

    test('should navigate from welcome page to register', async ({ page }) => {
      // Clear session
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      await page.goto('/#/');

      // Click signup button on welcome page
      await page.click('.welcome-page a[href="#/register"]');

      await expect(page).toHaveURL('/#/register');
    });
  });
});
