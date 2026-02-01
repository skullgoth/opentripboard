#!/usr/bin/env node

/**
 * Demo Data Seeder for OpenTripBoard
 *
 * Creates two demo users with pre-configured trips and cross-invitations
 * Can be run multiple times - idempotent (won't create duplicates)
 *
 * Usage: node bin/seed-demo-data.js
 * Or: npm run seed-demo
 *
 * Categorization:
 * - Activities: market, monument, museum, park, shopping, sightseeing
 * - Transit stops: airport, train_station, bus_stop, ferry_terminal, port, subway_station
 * - Lodging Reservations: hotel, rental
 * - Dining Reservations: bar, restaurant
 *
 * Note: Transit stops (airports, train stations, etc.) are now simple activities
 * with location/coordinates. The auto-calculated transport between activities
 * handles route visualization.
 */

const http = require('http');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost';
const API_BASE = '/api/v1';

// Demo users
const DEMO_USERS = [
  {
    fullName: 'Alice Johnson',
    email: 'test1@example.com',
    password: 'TestPassword123',
  },
  {
    fullName: 'Bob Smith',
    email: 'test2@example.com',
    password: 'TestPassword123',
  },
];

// Demo trips
const DEMO_TRIPS = [
  {
    userIndex: 0, // test1@example.com
    name: 'User1 Trip',
    destination: 'Paris, Île-de-France, France',
    startDate: '2026-07-01',
    endDate: '2026-07-10',
    budget: 10000,
    currency: 'EUR',
    description: 'Trip planned by user 1',
    // Validated destination data for automatic cover image fetch
    destinationData: {
      place_id: 98256513,
      display_name: 'Paris, Île-de-France, France',
      lat: 48.8588897,
      lon: 2.3200410217200766,
      type: 'city',
      address: {
        city: 'Paris',
        state: 'Île-de-France',
        country: 'France',
        country_code: 'fr',
      },
      validated: true,
    },
  },
  {
    userIndex: 1, // test2@example.com
    name: 'User2 Trip',
    destination: 'Tokyo, Japan',
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    budget: 100000,
    currency: 'JPY',
    description: 'Trip planned by user 2',
    // Validated destination data for automatic cover image fetch
    destinationData: {
      place_id: 258847628,
      display_name: 'Tokyo, Japan',
      lat: 35.6764225,
      lon: 139.650027,
      type: 'city',
      address: {
        city: 'Tokyo',
        country: 'Japan',
        country_code: 'jp',
      },
      validated: true,
    },
  },
];

// Demo activities (sightseeing activities and transit stops)
// Types: market, monument, museum, park, shopping, sightseeing, transit
const DEMO_ACTIVITIES = {
  // Activities for User1 Trip (Paris)
  0: [
    // Transit: Arrival airport
    {
      type: 'airport',
      title: 'Charles de Gaulle Airport (Arrival)',
      description: 'Arriving from JFK on Air France AF123',
      location: 'Charles de Gaulle Airport, Roissy-en-France',
      latitude: 49.0097,
      longitude: 2.5479,
      startTime: '2026-07-01T10:00:00.000Z',
      endTime: '2026-07-01T11:00:00.000Z',
      orderIndex: 0,
      metadata: {
        confirmationCode: 'AF123XYZ',
      },
    },
    {
      type: 'monument',
      title: 'Eiffel Tower Visit',
      description: 'Visit the iconic Eiffel Tower',
      location: 'Champ de Mars, Paris',
      latitude: 48.8584,
      longitude: 2.2945,
      startTime: '2026-07-02T10:00:00.000Z',
      endTime: '2026-07-02T13:00:00.000Z',
      orderIndex: 1,
    },
    {
      type: 'museum',
      title: 'Louvre Museum',
      description: 'World\'s largest art museum',
      location: 'Rue de Rivoli, Paris',
      latitude: 48.8606,
      longitude: 2.3376,
      startTime: '2026-07-03T09:00:00.000Z',
      endTime: '2026-07-03T14:00:00.000Z',
      orderIndex: 2,
    },
    {
      type: 'monument',
      title: 'Notre-Dame Cathedral',
      description: 'Historic cathedral (exterior view)',
      location: '6 Parvis Notre-Dame, Paris',
      latitude: 48.8530,
      longitude: 2.3499,
      startTime: '2026-07-04T10:00:00.000Z',
      endTime: '2026-07-04T12:00:00.000Z',
      orderIndex: 3,
    },
    {
      type: 'sightseeing',
      title: 'Montmartre & Sacré-Cœur',
      description: 'Explore the artistic neighborhood',
      location: 'Sacré-Cœur, Paris',
      latitude: 48.8867,
      longitude: 2.3431,
      startTime: '2026-07-05T10:00:00.000Z',
      endTime: '2026-07-05T16:00:00.000Z',
      orderIndex: 4,
    },
    {
      type: 'shopping',
      title: 'Champs-Élysées Shopping',
      description: 'Famous shopping avenue',
      location: 'Avenue des Champs-Élysées, Paris',
      latitude: 48.8698,
      longitude: 2.3075,
      startTime: '2026-07-06T14:00:00.000Z',
      endTime: '2026-07-06T18:00:00.000Z',
      orderIndex: 5,
    },
    {
      type: 'park',
      title: 'Luxembourg Gardens',
      description: 'Beautiful Parisian park',
      location: 'Jardin du Luxembourg, Paris',
      latitude: 48.8462,
      longitude: 2.3371,
      startTime: '2026-07-07T09:00:00.000Z',
      endTime: '2026-07-07T12:00:00.000Z',
      orderIndex: 6,
    },
    // Transit: Day trip to London
    {
      type: 'train_station',
      title: 'Gare du Nord (Eurostar to London)',
      description: 'Day trip to London via Eurostar',
      location: 'Paris Gare du Nord',
      latitude: 48.8809,
      longitude: 2.3553,
      startTime: '2026-07-08T08:30:00.000Z',
      endTime: '2026-07-08T09:00:00.000Z',
      orderIndex: 7,
      metadata: {
        confirmationCode: 'EURO9876',
      },
    },
    // Transit: Departure airport
    {
      type: 'airport',
      title: 'Charles de Gaulle Airport (Departure)',
      description: 'Departing to JFK on Air France AF456',
      location: 'Charles de Gaulle Airport, Roissy-en-France',
      latitude: 49.0097,
      longitude: 2.5479,
      startTime: '2026-07-10T12:00:00.000Z',
      endTime: '2026-07-10T14:00:00.000Z',
      orderIndex: 99,
      metadata: {
        confirmationCode: 'AF456ABC',
      },
    },
  ],
  // Activities for User2 Trip (Tokyo)
  1: [
    // Transit: Arrival airport
    {
      type: 'airport',
      title: 'Narita International Airport (Arrival)',
      description: 'Arriving from LAX on JAL JL002',
      location: 'Narita International Airport',
      latitude: 35.7720,
      longitude: 140.3929,
      startTime: '2026-08-01T08:00:00.000Z',
      endTime: '2026-08-01T09:00:00.000Z',
      orderIndex: 0,
      metadata: {
        confirmationCode: 'JAL002XYZ',
      },
    },
    {
      type: 'monument',
      title: 'Senso-ji Temple',
      description: 'Tokyo\'s oldest Buddhist temple',
      location: '2-3-1 Asakusa, Taito City, Tokyo',
      latitude: 35.7148,
      longitude: 139.7967,
      startTime: '2026-08-02T09:00:00.000Z',
      endTime: '2026-08-02T12:00:00.000Z',
      orderIndex: 1,
    },
    {
      type: 'sightseeing',
      title: 'Shibuya Crossing',
      description: 'World\'s busiest pedestrian crossing',
      location: 'Shibuya Crossing, Tokyo',
      latitude: 35.6595,
      longitude: 139.7004,
      startTime: '2026-08-03T18:00:00.000Z',
      endTime: '2026-08-03T20:00:00.000Z',
      orderIndex: 2,
    },
    // Transit: Shinkansen to Kyoto
    {
      type: 'train_station',
      title: 'Tokyo Station (Shinkansen to Kyoto)',
      description: 'Bullet train to Kyoto for day trip',
      location: 'Tokyo Station',
      latitude: 35.6812,
      longitude: 139.7671,
      startTime: '2026-08-04T07:00:00.000Z',
      endTime: '2026-08-04T07:30:00.000Z',
      orderIndex: 3,
      metadata: {
        confirmationCode: 'NOZOMI789',
      },
    },
    // Transit: Kyoto Station arrival
    {
      type: 'train_station',
      title: 'Kyoto Station (Arrival)',
      description: 'Arriving in Kyoto',
      location: 'Kyoto Station',
      latitude: 34.9858,
      longitude: 135.7588,
      startTime: '2026-08-04T09:15:00.000Z',
      endTime: '2026-08-04T09:30:00.000Z',
      orderIndex: 4,
    },
    // Transit: Return to Tokyo
    {
      type: 'train_station',
      title: 'Kyoto Station (Return to Tokyo)',
      description: 'Return bullet train to Tokyo',
      location: 'Kyoto Station',
      latitude: 34.9858,
      longitude: 135.7588,
      startTime: '2026-08-05T16:00:00.000Z',
      endTime: '2026-08-05T16:30:00.000Z',
      orderIndex: 5,
      metadata: {
        confirmationCode: 'NOZOMI042',
      },
    },
    {
      type: 'monument',
      title: 'Meiji Shrine',
      description: 'Shinto shrine in a forest setting',
      location: '1-1 Yoyogikamizonocho, Shibuya City, Tokyo',
      latitude: 35.6764,
      longitude: 139.6993,
      startTime: '2026-08-06T08:00:00.000Z',
      endTime: '2026-08-06T10:00:00.000Z',
      orderIndex: 6,
    },
    {
      type: 'sightseeing',
      title: 'Tokyo Skytree',
      description: 'Tallest tower in Japan',
      location: '1-1-2 Oshiage, Sumida City, Tokyo',
      latitude: 35.7101,
      longitude: 139.8107,
      startTime: '2026-08-06T14:00:00.000Z',
      endTime: '2026-08-06T17:00:00.000Z',
      orderIndex: 7,
    },
    {
      type: 'market',
      title: 'Tsukiji Outer Market',
      description: 'Famous fish market for fresh seafood',
      location: 'Tsukiji Outer Market, Tokyo',
      latitude: 35.6654,
      longitude: 139.7707,
      startTime: '2026-08-07T06:00:00.000Z',
      endTime: '2026-08-07T09:00:00.000Z',
      orderIndex: 8,
    },
    {
      type: 'park',
      title: 'Shinjuku Gyoen',
      description: 'Beautiful Japanese garden',
      location: 'Shinjuku Gyoen, Tokyo',
      latitude: 35.6852,
      longitude: 139.7100,
      startTime: '2026-08-08T10:00:00.000Z',
      endTime: '2026-08-08T13:00:00.000Z',
      orderIndex: 9,
    },
    // Transit: Departure airport
    {
      type: 'airport',
      title: 'Narita International Airport (Departure)',
      description: 'Departing to LAX on JAL JL001',
      location: 'Narita International Airport',
      latitude: 35.7720,
      longitude: 140.3929,
      startTime: '2026-08-10T15:00:00.000Z',
      endTime: '2026-08-10T17:00:00.000Z',
      orderIndex: 99,
      metadata: {
        confirmationCode: 'JAL001ABC',
      },
    },
  ],
};

// Demo reservations organized by category
// Lodging: hotel, rental
// Dining: bar, restaurant
// Note: Transport types (flight, train, car, etc.) are now simple transit activities
const DEMO_RESERVATIONS = {
  // Reservations for User1 Trip (Paris)
  0: [
    // ===== LODGING =====
    {
      type: 'hotel',
      title: 'Hôtel Plaza Athénée',
      description: 'Luxury hotel on Avenue Montaigne',
      location: '25 Avenue Montaigne, 75008 Paris',
      latitude: 48.8661,
      longitude: 2.3042,
      startTime: '2026-07-01T14:00:00.000Z',
      endTime: '2026-07-10T11:00:00.000Z',
      orderIndex: 1,
      metadata: {
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-10',
        confirmationCode: 'PLAZA78901',
      },
    },
    // ===== DINING =====
    {
      type: 'restaurant',
      title: 'Le Jules Verne',
      description: 'Michelin-starred restaurant in the Eiffel Tower',
      location: 'Eiffel Tower, Avenue Gustave Eiffel, Paris',
      latitude: 48.8584,
      longitude: 2.2945,
      startTime: '2026-07-02T19:30:00.000Z',
      endTime: '2026-07-02T22:00:00.000Z',
      orderIndex: 105,
      metadata: {
        venueName: 'Le Jules Verne',
        provider: 'OpenTable',
        reservationDate: '2026-07-02',
        reservationTime: '19:30',
        partySize: 2,
        confirmationCode: 'JV2026070',
      },
    },
    {
      type: 'restaurant',
      title: 'Café de Flore',
      description: 'Famous Parisian café',
      location: '172 Boulevard Saint-Germain, Paris',
      latitude: 48.8540,
      longitude: 2.3325,
      startTime: '2026-07-04T12:00:00.000Z',
      endTime: '2026-07-04T14:00:00.000Z',
      orderIndex: 106,
      metadata: {
        venueName: 'Café de Flore',
        provider: 'Direct Booking',
        reservationDate: '2026-07-04',
        reservationTime: '12:00',
        partySize: 2,
        confirmationCode: 'FLORE2026',
      },
    },
    {
      type: 'bar',
      title: 'Harry\'s New York Bar',
      description: 'Historic cocktail bar',
      location: '5 Rue Daunou, Paris',
      latitude: 48.8696,
      longitude: 2.3322,
      startTime: '2026-07-06T21:00:00.000Z',
      endTime: '2026-07-06T23:00:00.000Z',
      orderIndex: 107,
      metadata: {
        venueName: 'Harry\'s New York Bar',
        provider: 'Direct Booking',
        reservationDate: '2026-07-06',
        reservationTime: '21:00',
        partySize: 2,
        confirmationCode: 'HARRYS001',
      },
    },
  ],
  // Reservations for User2 Trip (Tokyo)
  1: [
    // ===== LODGING =====
    {
      type: 'hotel',
      title: 'The Ritz-Carlton Tokyo',
      description: 'Luxury hotel in Tokyo Midtown',
      location: 'Tokyo Midtown, 9-7-1 Akasaka, Minato City',
      latitude: 35.6657,
      longitude: 139.7313,
      startTime: '2026-08-01T15:00:00.000Z',
      endTime: '2026-08-10T11:00:00.000Z',
      orderIndex: 1,
      metadata: {
        checkInDate: '2026-08-01',
        checkOutDate: '2026-08-10',
        confirmationCode: 'RITZ456789',
      },
    },
    {
      type: 'rental',
      title: 'Traditional Machiya in Kyoto',
      description: 'Historic wooden townhouse stay',
      location: 'Higashiyama, Kyoto',
      latitude: 34.9981,
      longitude: 135.7789,
      startTime: '2026-08-04T15:00:00.000Z',
      endTime: '2026-08-05T10:00:00.000Z',
      orderIndex: 2,
      metadata: {
        propertyName: 'Machiya Residence Inn',
        provider: 'Airbnb',
        checkInDate: '2026-08-04',
        checkOutDate: '2026-08-05',
        confirmationCode: 'ABNB789012',
      },
    },
    // ===== DINING =====
    {
      type: 'restaurant',
      title: 'Sukiyabashi Jiro',
      description: 'World-famous sushi restaurant',
      location: 'Tsukamoto Sogyo Building, 4-2-15 Ginza, Chuo City, Tokyo',
      latitude: 35.6711,
      longitude: 139.7635,
      startTime: '2026-08-03T18:00:00.000Z',
      endTime: '2026-08-03T20:00:00.000Z',
      orderIndex: 106,
      metadata: {
        venueName: 'Sukiyabashi Jiro',
        provider: 'Direct Booking',
        reservationDate: '2026-08-03',
        reservationTime: '18:00',
        partySize: 2,
        confirmationCode: 'JIRO20268',
      },
    },
    {
      type: 'restaurant',
      title: 'Narisawa',
      description: 'Innovative Japanese cuisine',
      location: '2-6-15 Minami-Aoyama, Minato City, Tokyo',
      latitude: 35.6693,
      longitude: 139.7197,
      startTime: '2026-08-08T19:00:00.000Z',
      endTime: '2026-08-08T22:00:00.000Z',
      orderIndex: 107,
      metadata: {
        venueName: 'Narisawa',
        provider: 'Direct Booking',
        reservationDate: '2026-08-08',
        reservationTime: '19:00',
        partySize: 2,
        confirmationCode: 'NARI2026',
      },
    },
    {
      type: 'bar',
      title: 'Bar High Five',
      description: 'Award-winning cocktail bar',
      location: 'Efflore Ginza 5F, 4-5-6 Ginza, Chuo City, Tokyo',
      latitude: 35.6721,
      longitude: 139.7653,
      startTime: '2026-08-09T20:00:00.000Z',
      endTime: '2026-08-09T23:00:00.000Z',
      orderIndex: 108,
      metadata: {
        venueName: 'Bar High Five',
        provider: 'Direct Booking',
        reservationDate: '2026-08-09',
        reservationTime: '20:00',
        partySize: 2,
        confirmationCode: 'HIGH52026',
      },
    },
  ],
};

// Demo expenses - covering all split types
// Will be created after invitations are accepted so both users are trip participants
const DEMO_EXPENSES = {
  // Expenses for User1 Trip (Paris) - EUR currency
  0: [
    // 1. No split (personal expense) - Alice buys a souvenir for herself
    {
      amount: 100.00,
      category: 'shopping',
      description: 'Personal souvenir from gift shop',
      expenseDate: '2026-07-03',
      splitType: 'none',
    },
    // 2. One-way split - Alice pays for Bob's museum ticket
    {
      amount: 100.00,
      category: 'activities',
      description: 'Louvre Museum ticket for Bob',
      expenseDate: '2026-07-03',
      splitType: 'oneway', // Bob owes Alice
    },
    // 3. Equal split - Dinner for both
    {
      amount: 100.00,
      category: 'food',
      description: 'Dinner at Le Jules Verne',
      expenseDate: '2026-07-02',
      splitType: 'equal',
    },
    // 4. Custom split (60/40) - Hotel room (Alice stayed extra night)
    {
      amount: 100.00,
      category: 'accommodation',
      description: 'Hotel Plaza Athénée - shared room',
      expenseDate: '2026-07-05',
      splitType: 'custom',
      customSplits: [0.6, 0.4], // Alice 60%, Bob 40%
    },
    // 5. Another equal split - Taxi ride
    {
      amount: 100.00,
      category: 'transportation',
      description: 'Taxi from airport',
      expenseDate: '2026-07-01',
      splitType: 'equal',
    },
    // 6. One-way split (Bob pays, Alice owes) - Bob buys concert tickets
    {
      payerIndex: 1, // Bob pays
      amount: 100.00,
      category: 'entertainment',
      description: 'Concert tickets at Olympia',
      expenseDate: '2026-07-06',
      splitType: 'oneway', // Alice owes Bob
    },
    // 7. Settlement - Bob pays back Alice for the museum ticket
    {
      payerIndex: 1, // Bob pays
      amount: 100.00,
      category: 'settlement',
      description: 'Settlement: Bob paid Alice for museum ticket',
      expenseDate: '2026-07-04',
      splitType: 'settlement', // Alice receives
    },
  ],
  // Expenses for User2 Trip (Tokyo) - JPY currency
  1: [
    // 1. No split - Bob's personal expense
    {
      amount: 1000,
      category: 'shopping',
      description: 'Personal manga collection',
      expenseDate: '2026-08-03',
      splitType: 'none',
    },
    // 2. Equal split - Sushi dinner
    {
      amount: 1000,
      category: 'food',
      description: 'Omakase at Sukiyabashi Jiro',
      expenseDate: '2026-08-03',
      splitType: 'equal',
    },
    // 3. One-way split - Bob pays for Alice's temple entry
    {
      amount: 1000,
      category: 'activities',
      description: 'Senso-ji Temple offering for Alice',
      expenseDate: '2026-08-02',
      splitType: 'oneway',
    },
    // 4. Custom split (70/30) - Ryokan stay
    {
      amount: 1000,
      category: 'accommodation',
      description: 'Traditional Ryokan - Bob had larger room',
      expenseDate: '2026-08-04',
      splitType: 'custom',
      customSplits: [0.3, 0.7], // Alice 30%, Bob 70%
    },
    // 5. Equal split - Shinkansen tickets
    {
      amount: 1000,
      category: 'transportation',
      description: 'Shinkansen round trip Tokyo-Kyoto',
      expenseDate: '2026-08-04',
      splitType: 'equal',
    },
    // 6. One-way (Alice pays, Bob owes)
    {
      payerIndex: 0, // Alice pays
      amount: 1000,
      category: 'food',
      description: 'Ramen lunch for Bob',
      expenseDate: '2026-08-05',
      splitType: 'oneway',
    },
    // 7. Settlement - Alice pays Bob back for temple offering
    {
      payerIndex: 0, // Alice pays
      amount: 1000,
      category: 'settlement',
      description: 'Settlement: Alice paid Bob for temple offering',
      expenseDate: '2026-08-06',
      splitType: 'settlement',
    },
  ],
};

// Demo lists - packing lists, todo lists, and custom lists
const DEMO_LISTS = {
  // Lists for User1 Trip (Paris)
  0: [
    {
      type: 'packing',
      title: 'Paris Packing List',
      items: [
        { text: 'Passport', checked: true },
        { text: 'Travel adapter (EU)', checked: true },
        { text: 'Walking shoes', checked: true },
        { text: 'Light jacket', checked: false },
        { text: 'Umbrella', checked: false },
        { text: 'Camera', checked: true },
        { text: 'Chargers', checked: false },
        { text: 'Toiletries bag', checked: true },
        { text: 'Sunglasses', checked: false },
        { text: 'Day bag/backpack', checked: false },
      ],
    },
    {
      type: 'todo',
      title: 'Pre-Trip Tasks',
      items: [
        { text: 'Book airport transfer', checked: true },
        { text: 'Exchange some currency', checked: true },
        { text: 'Download offline maps', checked: false },
        { text: 'Print hotel confirmation', checked: true },
        { text: 'Notify bank of travel', checked: true },
        { text: 'Check passport expiry', checked: true },
      ],
    },
    {
      type: 'shopping',
      title: 'Paris Shopping List',
      items: [
        { text: 'Macarons from Ladurée', checked: false },
        { text: 'French cheese selection', checked: false },
        { text: 'Wine from local cave', checked: false },
        { text: 'Perfume from duty-free', checked: false },
        { text: 'Souvenirs for family', checked: false },
      ],
    },
  ],
  // Lists for User2 Trip (Tokyo)
  1: [
    {
      type: 'packing',
      title: 'Tokyo Travel Essentials',
      items: [
        { text: 'Passport', checked: true },
        { text: 'JR Pass voucher', checked: true },
        { text: 'Comfortable walking shoes', checked: true },
        { text: 'Portable wifi/SIM card', checked: false },
        { text: 'Power bank', checked: false },
        { text: 'Light layers', checked: true },
        { text: 'Small towel (for onsens)', checked: false },
        { text: 'Cash (Japan is cash-heavy)', checked: true },
        { text: 'Basic Japanese phrasebook', checked: false },
        { text: 'Reusable shopping bag', checked: false },
      ],
    },
    {
      type: 'todo',
      title: 'Tokyo Prep Checklist',
      items: [
        { text: 'Activate JR Pass', checked: false },
        { text: 'Download Japan transit app', checked: true },
        { text: 'Reserve Ghibli Museum tickets', checked: true },
        { text: 'Book TeamLab tickets', checked: false },
        { text: 'Research best ramen spots', checked: true },
        { text: 'Learn basic Japanese greetings', checked: false },
        { text: 'Get travel insurance', checked: true },
      ],
    },
    {
      type: 'custom',
      title: 'Must-Try Foods',
      items: [
        { text: 'Authentic ramen', checked: false },
        { text: 'Fresh sushi at Tsukiji', checked: false },
        { text: 'Wagyu beef', checked: false },
        { text: 'Okonomiyaki', checked: false },
        { text: 'Matcha desserts', checked: false },
        { text: 'Conveyor belt sushi', checked: false },
        { text: 'Takoyaki', checked: false },
        { text: 'Japanese 7-Eleven snacks', checked: false },
      ],
    },
  ],
};

/**
 * Make HTTP request helper
 */
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Register a user or get existing user credentials
 */
async function registerOrLoginUser(user) {
  console.log(`\n📝 Setting up user: ${user.email}`);

  // Try to register
  const registerResponse = await makeRequest('POST', '/auth/register', {
    fullName: user.fullName,
    email: user.email,
    password: user.password,
  });

  if (registerResponse.statusCode === 201) {
    const role = registerResponse.body.user.role || 'user';
    console.log(`   ✅ User registered successfully (role: ${role})`);
    return {
      token: registerResponse.body.accessToken,
      userId: registerResponse.body.user.id,
      role: role,
    };
  } else if (registerResponse.statusCode === 409 || registerResponse.statusCode === 400) {
    // User already exists, try to login
    console.log(`   ℹ️  User already exists, logging in...`);
    const loginResponse = await makeRequest('POST', '/auth/login', {
      email: user.email,
      password: user.password,
    });

    if (loginResponse.statusCode === 200) {
      const role = loginResponse.body.user.role || 'user';
      console.log(`   ✅ User logged in successfully (role: ${role})`);
      return {
        token: loginResponse.body.accessToken,
        userId: loginResponse.body.user.id,
        role: role,
      };
    } else {
      throw new Error(`Failed to login user ${user.email}: ${JSON.stringify(loginResponse.body)}`);
    }
  } else {
    throw new Error(`Failed to register user ${user.email}: ${JSON.stringify(registerResponse.body)}`);
  }
}

/**
 * Create a trip or get existing trip
 */
async function createTrip(tripData, token, userId) {
  console.log(`\n🌍 Setting up trip: ${tripData.name}`);

  // First check if trip already exists
  const listResponse = await makeRequest('GET', `/trips`, null, token);

  if (listResponse.statusCode === 200 && listResponse.body.length > 0) {
    const existingTrip = listResponse.body.find(t => t.name === tripData.name);
    if (existingTrip) {
      console.log(`   ℹ️  Trip already exists (ID: ${existingTrip.id})`);
      return existingTrip.id;
    }
  }

  // Create new trip (include destinationData for automatic cover image fetch)
  const createResponse = await makeRequest('POST', '/trips', {
    name: tripData.name,
    destination: tripData.destination,
    startDate: tripData.startDate,
    endDate: tripData.endDate,
    budget: tripData.budget,
    currency: tripData.currency,
    description: tripData.description,
    destinationData: tripData.destinationData || null,
  }, token);

  if (createResponse.statusCode === 201) {
    console.log(`   ✅ Trip created successfully (ID: ${createResponse.body.id})`);
    return createResponse.body.id;
  } else {
    throw new Error(`Failed to create trip ${tripData.name}: ${JSON.stringify(createResponse.body)}`);
  }
}

/**
 * Create an activity for a trip
 */
async function createActivity(tripId, activityData, token) {
  // First check if activity already exists by title
  const listResponse = await makeRequest('GET', `/trips/${tripId}/activities`, null, token);

  if (listResponse.statusCode === 200 && listResponse.body.length > 0) {
    const existingActivity = listResponse.body.find(a => a.title === activityData.title);
    if (existingActivity) {
      return { exists: true, id: existingActivity.id };
    }
  }

  // Create new activity
  const createResponse = await makeRequest('POST', `/trips/${tripId}/activities`, activityData, token);

  if (createResponse.statusCode === 201) {
    return { exists: false, id: createResponse.body.id };
  } else {
    console.log(`      ⚠️  Failed to create activity "${activityData.title}": ${JSON.stringify(createResponse.body)}`);
    return { exists: false, id: null };
  }
}

/**
 * Create activities for a trip (sightseeing activities)
 */
async function createActivitiesForTrip(tripIndex, tripId, token) {
  const activities = DEMO_ACTIVITIES[tripIndex];
  if (!activities || activities.length === 0) {
    return;
  }

  console.log(`\n📍 Creating activities for trip ${tripIndex + 1}...`);
  console.log(`   Types: market, monument, museum, park, shopping, sightseeing`);

  let created = 0;
  let existed = 0;

  for (const activity of activities) {
    const result = await createActivity(tripId, activity, token);
    if (result.exists) {
      existed++;
    } else if (result.id) {
      created++;
    }
  }

  console.log(`   ✅ Activities: ${created} created, ${existed} already existed`);
}

/**
 * Create reservations for a trip (lodging, transport, dining)
 */
async function createReservationsForTrip(tripIndex, tripId, token) {
  const reservations = DEMO_RESERVATIONS[tripIndex];
  if (!reservations || reservations.length === 0) {
    return;
  }

  console.log(`\n📋 Creating reservations for trip ${tripIndex + 1}...`);
  console.log(`   Categories: Lodging (hotel, rental), Transport (flight, train, car), Dining (restaurant, bar)`);

  let created = 0;
  let existed = 0;

  for (const reservation of reservations) {
    const result = await createActivity(tripId, reservation, token);
    if (result.exists) {
      existed++;
    } else if (result.id) {
      created++;
    }
  }

  console.log(`   ✅ Reservations: ${created} created, ${existed} already existed`);
}

/**
 * Invite user to trip
 */
async function inviteToTrip(tripId, inviteeEmail, role, token) {
  console.log(`\n👥 Inviting ${inviteeEmail} to trip...`);

  // First check if invitation already exists
  const listResponse = await makeRequest('GET', `/trips/${tripId}/trip-buddies`, null, token);

  if (listResponse.statusCode === 200 && listResponse.body.length > 0) {
    const existingInvite = listResponse.body.find(tb => tb.email === inviteeEmail);
    if (existingInvite) {
      console.log(`   ℹ️  Invitation already exists`);
      return existingInvite.id;
    }
  }

  // Create invitation
  const inviteResponse = await makeRequest('POST', `/trips/${tripId}/trip-buddies`, {
    email: inviteeEmail,
    role: role,
  }, token);

  if (inviteResponse.statusCode === 201) {
    console.log(`   ✅ Invitation sent successfully`);
    console.log(`   ℹ️  Invitation is pending (can be accepted via UI)`);
    return inviteResponse.body.id;
  } else if (inviteResponse.statusCode === 400 || inviteResponse.statusCode === 409) {
    console.log(`   ℹ️  Invitation may already exist or user is already a trip buddy`);
    return null;
  } else {
    throw new Error(`Failed to invite ${inviteeEmail}: ${JSON.stringify(inviteResponse.body)}`);
  }
}

/**
 * Accept pending invitation to a trip
 */
async function acceptInvitation(tripId, token) {
  // Get pending invitations for this user (correct endpoint is /trip-buddies/invitations)
  const listResponse = await makeRequest('GET', '/trip-buddies/invitations', null, token);

  if (listResponse.statusCode === 200 && listResponse.body.length > 0) {
    const invitation = listResponse.body.find(inv => inv.tripId === tripId);
    if (invitation) {
      // Note: The accept endpoint requires a JSON body (even empty)
      const acceptResponse = await makeRequest('POST', `/trip-buddies/${invitation.id}/accept`, {}, token);
      if (acceptResponse.statusCode === 200) {
        console.log(`   ✅ Invitation accepted for trip ${tripId}`);
        return true;
      } else {
        console.log(`   ⚠️  Failed to accept invitation: ${JSON.stringify(acceptResponse.body)}`);
      }
    } else {
      console.log(`   ℹ️  No pending invitation found for trip ${tripId} (may already be accepted)`);
    }
  } else {
    console.log(`   ℹ️  No pending invitations found (may already be accepted)`);
  }
  return false;
}

/**
 * Create an expense for a trip
 */
async function createExpense(tripId, expenseData, token) {
  const createResponse = await makeRequest('POST', `/trips/${tripId}/expenses`, expenseData, token);

  if (createResponse.statusCode === 201) {
    return { success: true, id: createResponse.body.id };
  } else {
    console.log(`      ⚠️  Failed to create expense "${expenseData.description}": ${JSON.stringify(createResponse.body)}`);
    return { success: false, id: null };
  }
}

/**
 * Create expenses for a trip with various split types
 */
async function createExpensesForTrip(tripIndex, tripId, userCredentials, ownerIndex) {
  const expenses = DEMO_EXPENSES[tripIndex];
  if (!expenses || expenses.length === 0) {
    return;
  }

  console.log(`\n💰 Creating expenses for trip ${tripIndex + 1}...`);
  console.log(`   Split types: none, one-way, equal, custom, settlement`);

  // Get user IDs - owner is at ownerIndex, the other user is the buddy
  const ownerUserId = userCredentials[ownerIndex].userId;
  const buddyIndex = ownerIndex === 0 ? 1 : 0;
  const buddyUserId = userCredentials[buddyIndex].userId;

  let created = 0;
  let failed = 0;

  for (const expense of expenses) {
    // Determine payer (default to owner if not specified)
    const payerIndex = expense.payerIndex !== undefined ? expense.payerIndex : ownerIndex;
    const payerId = userCredentials[payerIndex].userId;
    const payerToken = userCredentials[payerIndex].token;

    // The "other" person for one-way splits
    const otherUserId = payerId === ownerUserId ? buddyUserId : ownerUserId;

    // Build expense data
    const expensePayload = {
      payerId: payerId,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      expenseDate: expense.expenseDate,
    };

    // Add splits based on split type
    switch (expense.splitType) {
      case 'none':
        // No splits - personal expense
        break;

      case 'oneway':
        // One person owes the full amount
        expensePayload.splits = [
          {
            userId: otherUserId,
            amount: expense.amount,
            percentage: 100,
          },
        ];
        break;

      case 'equal':
        // Split equally between both participants
        const halfAmount = Math.round((expense.amount / 2) * 100) / 100;
        expensePayload.splits = [
          {
            userId: ownerUserId,
            amount: halfAmount,
            percentage: 50,
          },
          {
            userId: buddyUserId,
            amount: expense.amount - halfAmount, // Handle rounding
            percentage: 50,
          },
        ];
        break;

      case 'custom':
        // Custom percentages
        const [ownerPct, buddyPct] = expense.customSplits;
        expensePayload.splits = [
          {
            userId: ownerUserId,
            amount: Math.round(expense.amount * ownerPct * 100) / 100,
            percentage: ownerPct * 100,
          },
          {
            userId: buddyUserId,
            amount: Math.round(expense.amount * buddyPct * 100) / 100,
            percentage: buddyPct * 100,
          },
        ];
        break;

      case 'settlement':
        // Settlement: payer pays, other person receives
        expensePayload.splits = [
          {
            userId: otherUserId,
            amount: expense.amount,
            percentage: 100,
          },
        ];
        break;
    }

    const result = await createExpense(tripId, expensePayload, payerToken);
    if (result.success) {
      created++;
    } else {
      failed++;
    }
  }

  console.log(`   ✅ Expenses: ${created} created, ${failed} failed`);
}

/**
 * Create a list for a trip
 */
async function createList(tripId, listData, token) {
  // First check if list already exists by title
  const listResponse = await makeRequest('GET', `/trips/${tripId}/lists`, null, token);

  if (listResponse.statusCode === 200 && listResponse.body.length > 0) {
    const existingList = listResponse.body.find(l => l.title === listData.title);
    if (existingList) {
      return { exists: true, id: existingList.id };
    }
  }

  // Create new list
  const createResponse = await makeRequest('POST', `/trips/${tripId}/lists`, listData, token);

  if (createResponse.statusCode === 201) {
    return { exists: false, id: createResponse.body.id };
  } else {
    console.log(`      ⚠️  Failed to create list "${listData.title}": ${JSON.stringify(createResponse.body)}`);
    return { exists: false, id: null };
  }
}

/**
 * Create lists for a trip
 */
async function createListsForTrip(tripIndex, tripId, token) {
  const lists = DEMO_LISTS[tripIndex];
  if (!lists || lists.length === 0) {
    return;
  }

  console.log(`\n📋 Creating lists for trip ${tripIndex + 1}...`);
  console.log(`   Types: packing, todo, shopping, custom`);

  let created = 0;
  let existed = 0;

  for (const list of lists) {
    const result = await createList(tripId, list, token);
    if (result.exists) {
      existed++;
    } else if (result.id) {
      created++;
    }
  }

  console.log(`   ✅ Lists: ${created} created, ${existed} already existed`);
}

/**
 * Main seeding function
 */
async function seedDemoData() {
  console.log('🚀 Starting demo data seed...\n');
  console.log(`📍 API URL: ${API_URL}${API_BASE}\n`);

  try {
    // Step 1: Register/Login users
    const userCredentials = [];
    for (const user of DEMO_USERS) {
      const creds = await registerOrLoginUser(user);
      userCredentials.push(creds);
    }

    // Step 2: Create trips
    const tripIds = [];
    for (let i = 0; i < DEMO_TRIPS.length; i++) {
      const tripData = DEMO_TRIPS[i];
      const userCreds = userCredentials[tripData.userIndex];
      const tripId = await createTrip(tripData, userCreds.token, userCreds.userId);
      tripIds.push({ id: tripId, userIndex: tripData.userIndex });
    }

    // Step 3: Create activities (sightseeing)
    for (let i = 0; i < tripIds.length; i++) {
      const { id: tripId, userIndex } = tripIds[i];
      const token = userCredentials[userIndex].token;
      await createActivitiesForTrip(i, tripId, token);
    }

    // Step 4: Create reservations (lodging, transport, dining)
    for (let i = 0; i < tripIds.length; i++) {
      const { id: tripId, userIndex } = tripIds[i];
      const token = userCredentials[userIndex].token;
      await createReservationsForTrip(i, tripId, token);
    }

    // Step 5: Cross-invite users
    // User 1 invites User 2 to Trip 1
    await inviteToTrip(
      tripIds[0].id,
      DEMO_USERS[1].email,
      'editor',
      userCredentials[0].token
    );

    // User 2 invites User 1 to Trip 2
    await inviteToTrip(
      tripIds[1].id,
      DEMO_USERS[0].email,
      'editor',
      userCredentials[1].token
    );

    // Step 6: Accept invitations (so expenses can include both users in splits)
    console.log('\n🤝 Accepting invitations...');
    // User 2 accepts invitation to Trip 1
    await acceptInvitation(tripIds[0].id, userCredentials[1].token);
    // User 1 accepts invitation to Trip 2
    await acceptInvitation(tripIds[1].id, userCredentials[0].token);

    // Step 7: Create expenses with various split types
    for (let i = 0; i < tripIds.length; i++) {
      const { id: tripId, userIndex } = tripIds[i];
      await createExpensesForTrip(i, tripId, userCredentials, userIndex);
    }

    // Step 8: Create lists (packing lists, todo lists, etc.)
    for (let i = 0; i < tripIds.length; i++) {
      const { id: tripId, userIndex } = tripIds[i];
      const token = userCredentials[userIndex].token;
      await createListsForTrip(i, tripId, token);
    }

    console.log('\n✨ Demo data seed completed successfully!\n');
    console.log('📧 Demo Accounts:');
    console.log(`   • ${DEMO_USERS[0].fullName}: ${DEMO_USERS[0].email} / ${DEMO_USERS[0].password} (ADMIN)`);
    console.log(`   • ${DEMO_USERS[1].fullName}: ${DEMO_USERS[1].email} / ${DEMO_USERS[1].password} (user)`);
    console.log('\n📊 Data Summary:');
    console.log('   Activities (per trip): 9-12 items');
    console.log('     • Types: monument, museum, sightseeing, shopping, park, market');
    console.log('     • Transit stops: airport, train_station (simple activities with location)');
    console.log('   Reservations (per trip): 4-5 items');
    console.log('     • Lodging: hotel, rental');
    console.log('     • Dining: restaurant (x2), bar');
    console.log('   Expenses (per trip): 7 items');
    console.log('     • Split types: none, one-way, equal, custom, settlement');
    console.log('   Lists (per trip): 3 items');
    console.log('     • Types: packing, todo, shopping, custom');
    console.log('\n🔐 User Roles (US8 - RBAC):');
    console.log('   • test1@example.com has ADMIN role (can manage all users)');
    console.log('   • test2@example.com has USER role (can only edit own profile)');
    console.log('\n🎉 You can now login and test the application!\n');

  } catch (error) {
    console.error('\n❌ Error seeding demo data:', error.message);
    process.exit(1);
  }
}

// Run the seeder
seedDemoData();
