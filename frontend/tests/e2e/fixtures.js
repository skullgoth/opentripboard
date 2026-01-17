/**
 * E2E Test Fixtures and Helpers
 * Provides common test utilities, test data, and page object helpers
 */

import { test as base, expect } from '@playwright/test';

/**
 * Generate unique test user data
 * @param {string} prefix - Prefix for unique identifier
 * @returns {Object} Test user data
 */
export function generateTestUser(prefix = 'test') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    firstName: 'Test',
    lastName: 'User',
    email: `${prefix}-${timestamp}-${random}@test.opentripboard.local`,
    password: 'TestPass123!',
  };
}

/**
 * Generate unique test trip data
 * @param {string} prefix - Prefix for trip name
 * @returns {Object} Test trip data
 */
export function generateTestTrip(prefix = 'E2E Test Trip') {
  const timestamp = Date.now();
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() + 7);
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 14);

  return {
    name: `${prefix} ${timestamp}`,
    description: 'This is an automated E2E test trip',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Generate test activity data
 * @param {string} type - Activity type
 * @param {Object} options - Additional options
 * @returns {Object} Test activity data
 */
export function generateTestActivity(type = 'sightseeing', options = {}) {
  const timestamp = Date.now();
  const activityDate = options.date || new Date().toISOString().split('T')[0];

  const activityTypes = {
    sightseeing: {
      title: `Visit Museum ${timestamp}`,
      description: 'Explore the local museum',
      location: 'Main Museum, City Center',
    },
    dining: {
      title: `Dinner at Restaurant ${timestamp}`,
      description: 'Local cuisine experience',
      location: 'Downtown Restaurant District',
    },
    transport: {
      title: `Flight to Destination ${timestamp}`,
      description: 'Morning flight',
      location: 'International Airport',
    },
    accommodation: {
      title: `Hotel Check-in ${timestamp}`,
      description: 'Boutique hotel stay',
      location: 'City Center Hotel',
    },
    activity: {
      title: `Hiking Adventure ${timestamp}`,
      description: 'Mountain trail exploration',
      location: 'National Park',
    },
  };

  return {
    activityType: type,
    date: activityDate,
    ...activityTypes[type] || activityTypes.sightseeing,
    ...options,
  };
}

/**
 * Generate test suggestion data
 * @param {string} type - Activity type for suggestion
 * @returns {Object} Test suggestion data
 */
export function generateTestSuggestion(type = 'sightseeing') {
  const timestamp = Date.now();
  return {
    activityType: type,
    title: `Suggested Activity ${timestamp}`,
    description: 'This is a test suggestion',
    location: 'Suggested Location',
  };
}

/**
 * Page Object: Authentication Pages
 */
export class AuthPage {
  constructor(page) {
    this.page = page;
  }

  async goToLogin() {
    await this.page.goto('/#/login');
    await this.page.waitForSelector('#login-form');
  }

  async goToRegister() {
    await this.page.goto('/#/register');
    await this.page.waitForSelector('#register-form');
  }

  async login(email, password) {
    await this.goToLogin();
    await this.page.fill('#email', email);
    await this.page.fill('#password', password);
    await this.page.click('#login-btn');
  }

  async register(userData) {
    await this.goToRegister();
    await this.page.fill('#firstName', userData.firstName);
    await this.page.fill('#lastName', userData.lastName);
    await this.page.fill('#email', userData.email);
    await this.page.fill('#password', userData.password);
    await this.page.fill('#confirmPassword', userData.password);
    await this.page.click('#register-btn');
  }

  async logout() {
    // Click logout button in header if present
    const logoutBtn = this.page.locator('[data-action="logout"]');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    }
  }

  async isLoggedIn() {
    // Check if we're on home page with trips (not welcome page)
    const welcomePage = this.page.locator('.welcome-page');
    const tripsContainer = this.page.locator('.trips-container, .trip-list');
    return !(await welcomePage.isVisible()) || await tripsContainer.isVisible();
  }

  async getErrorMessage() {
    const errorEl = this.page.locator('[data-error="general"]');
    await errorEl.waitFor({ state: 'visible', timeout: 5000 });
    return await errorEl.textContent();
  }
}

/**
 * Page Object: Home/Trips Page
 */
export class HomePage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/#/');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForTripsLoaded() {
    // Wait for either trips list or empty state
    await this.page.waitForSelector('.trip-list, .trips-empty, .welcome-page', {
      timeout: 10000,
    });
  }

  async clickCreateTrip() {
    await this.page.click('[data-action="create-trip"]');
    await this.page.waitForSelector('#trip-modal, .trip-form-modal', {
      timeout: 5000,
    });
  }

  async createTrip(tripData) {
    await this.clickCreateTrip();
    await this.page.fill('#trip-name, [name="name"]', tripData.name);
    if (tripData.description) {
      await this.page.fill('#trip-description, [name="description"]', tripData.description);
    }
    if (tripData.startDate) {
      await this.page.fill('#trip-start-date, [name="startDate"]', tripData.startDate);
    }
    if (tripData.endDate) {
      await this.page.fill('#trip-end-date, [name="endDate"]', tripData.endDate);
    }
    await this.page.click('[data-action="save-trip"], #trip-form button[type="submit"]');
  }

  async getTripCards() {
    return this.page.locator('.trip-card');
  }

  async clickTrip(tripName) {
    await this.page.click(`.trip-card:has-text("${tripName}")`);
  }

  async deleteTrip(tripName) {
    const tripCard = this.page.locator(`.trip-card:has-text("${tripName}")`);
    const deleteBtn = tripCard.locator('[data-action="delete-trip"]');
    await deleteBtn.click();

    // Handle confirmation dialog
    this.page.once('dialog', dialog => dialog.accept());
  }
}

/**
 * Page Object: Trip Detail Page
 */
export class TripDetailPage {
  constructor(page) {
    this.page = page;
  }

  async goto(tripId) {
    await this.page.goto(`/#/trips/${tripId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForLoaded() {
    await this.page.waitForSelector('.trip-detail-page, .trip-detail-header', {
      timeout: 10000,
    });
  }

  async getTripName() {
    const header = this.page.locator('.trip-detail-header h1, .trip-info-overlay h1');
    return await header.textContent();
  }

  async clickAddActivity(date = null) {
    if (date) {
      await this.page.click(`[data-date="${date}"] [data-action="add-activity"]`);
    } else {
      await this.page.click('[data-action="add-activity"]');
    }
    await this.page.waitForSelector('#activity-form-modal, .activity-form', {
      timeout: 5000,
    });
  }

  async createActivity(activityData) {
    await this.clickAddActivity(activityData.date);

    // Fill activity form
    await this.page.selectOption('[name="activityType"]', activityData.activityType);
    await this.page.fill('[name="title"]', activityData.title);

    if (activityData.description) {
      await this.page.fill('[name="description"]', activityData.description);
    }
    if (activityData.location) {
      await this.page.fill('[name="location"]', activityData.location);
    }
    if (activityData.startTime) {
      await this.page.fill('[name="startTime"]', activityData.startTime);
    }
    if (activityData.endTime) {
      await this.page.fill('[name="endTime"]', activityData.endTime);
    }

    await this.page.click('[data-action="save-activity"], .activity-form button[type="submit"]');
  }

  async getActivityCards() {
    return this.page.locator('.activity-card, .activity-item');
  }

  async editActivity(activityTitle) {
    const activityCard = this.page.locator(`.activity-card:has-text("${activityTitle}"), .activity-item:has-text("${activityTitle}")`);
    await activityCard.locator('[data-action="edit-activity"]').click();
    await this.page.waitForSelector('#activity-form-modal, .activity-form', {
      timeout: 5000,
    });
  }

  async deleteActivity(activityTitle) {
    const activityCard = this.page.locator(`.activity-card:has-text("${activityTitle}"), .activity-item:has-text("${activityTitle}")`);
    await activityCard.locator('[data-action="delete-activity"]').click();

    // Handle confirmation dialog if present
    this.page.once('dialog', dialog => dialog.accept());
  }

  async clickAddSuggestion() {
    await this.page.click('[data-action="create-suggestion"]');
    await this.page.waitForSelector('#suggestion-modal, .suggestion-form', {
      timeout: 5000,
    });
  }

  async createSuggestion(suggestionData) {
    await this.clickAddSuggestion();

    await this.page.selectOption('[name="activityType"]', suggestionData.activityType);
    await this.page.fill('[name="title"]', suggestionData.title);

    if (suggestionData.description) {
      await this.page.fill('[name="description"]', suggestionData.description);
    }
    if (suggestionData.location) {
      await this.page.fill('[name="location"]', suggestionData.location);
    }

    await this.page.click('#suggestion-form button[type="submit"]');
  }

  async getSuggestionCards() {
    return this.page.locator('.suggestion-card, .suggestion-item');
  }

  async voteSuggestion(suggestionTitle, vote) {
    const suggestionCard = this.page.locator(`.suggestion-card:has-text("${suggestionTitle}"), .suggestion-item:has-text("${suggestionTitle}")`);
    await suggestionCard.locator(`[data-action="vote-suggestion"][data-vote="${vote}"]`).click();
  }

  async acceptSuggestion(suggestionTitle) {
    const suggestionCard = this.page.locator(`.suggestion-card:has-text("${suggestionTitle}"), .suggestion-item:has-text("${suggestionTitle}")`);
    await suggestionCard.locator('[data-action="accept-suggestion"]').click();
  }

  async rejectSuggestion(suggestionTitle) {
    const suggestionCard = this.page.locator(`.suggestion-card:has-text("${suggestionTitle}"), .suggestion-item:has-text("${suggestionTitle}")`);
    await suggestionCard.locator('[data-action="reject-suggestion"]').click();
  }

  async openTripMenu() {
    await this.page.click('[data-action="toggle-trip-menu"], [data-testid="trip-menu-button"]');
    await this.page.waitForSelector('.trip-menu-dropdown[style*="block"], .dropdown-menu:visible', {
      timeout: 3000,
    });
  }

  async clickEditTrip() {
    await this.openTripMenu();
    await this.page.click('[data-action="edit-trip"], [data-testid="edit-trip-menu-item"]');
    await this.page.waitForSelector('#trip-modal, .trip-form-modal', {
      timeout: 5000,
    });
  }

  async clickDeleteTrip() {
    await this.openTripMenu();

    // Setup dialog handler before clicking
    this.page.once('dialog', dialog => dialog.accept());

    await this.page.click('[data-action="delete-trip"], [data-testid="delete-trip-menu-item"]');
  }

  async inviteTripBuddy(email, role = 'editor') {
    await this.page.click('[data-action="invite-trip-buddy"]');
    await this.page.waitForSelector('#invite-trip-buddy-modal', { timeout: 5000 });

    await this.page.fill('[name="email"]', email);
    await this.page.selectOption('[name="role"]', role);
    await this.page.click('#invite-trip-buddy-form button[type="submit"]');
  }
}

/**
 * Extended test fixture with page objects
 */
export const test = base.extend({
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  tripDetailPage: async ({ page }, use) => {
    await use(new TripDetailPage(page));
  },
});

/**
 * Helper to register and login a new test user
 * @param {Object} page - Playwright page
 * @returns {Object} User credentials
 */
export async function registerAndLogin(page) {
  const authPage = new AuthPage(page);
  const userData = generateTestUser();

  await authPage.register(userData);

  // Wait for redirect to home page after registration
  await page.waitForURL('**/#/', { timeout: 10000 });

  return userData;
}

/**
 * Helper to create a trip and return to detail page
 * @param {Object} page - Playwright page
 * @param {Object} tripData - Optional trip data
 * @returns {Object} Created trip data
 */
export async function createTripAndNavigate(page, tripData = null) {
  const homePage = new HomePage(page);
  const data = tripData || generateTestTrip();

  await homePage.goto();
  await homePage.waitForTripsLoaded();
  await homePage.createTrip(data);

  // Wait for navigation to trip detail page
  await page.waitForURL('**/#/trips/**', { timeout: 10000 });

  return data;
}

export { expect };
