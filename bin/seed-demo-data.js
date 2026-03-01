#!/usr/bin/env node

/**
 * Demo Data Seeder for OpenTripBoard
 *
 * Creates two demo users with comprehensive showcase trips
 * Demonstrates all features: multiple cities, varied lodging, transport types, dining
 *
 * Usage: node bin/seed-demo-data.js
 * Or: npm run seed-demo
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

// Demo trips - comprehensive showcase trips
const DEMO_TRIPS = [
  {
    userIndex: 0,
    name: 'European Adventure',
    destination: 'Paris, France',
    startDate: '2026-07-01',
    endDate: '2026-07-14',
    budget: 5000,
    currency: 'EUR',
    description: 'A two-week journey through France: Paris, Loire Valley, Lyon, and the French Riviera',
    destinationData: {
      place_id: 98256513,
      display_name: 'Paris, France',
      lat: 48.8588897,
      lon: 2.3200410217200766,
      type: 'city',
      address: { city: 'Paris', country: 'France', country_code: 'fr' },
      validated: true,
    },
  },
  {
    userIndex: 1,
    name: 'Japan Discovery',
    destination: 'Tokyo, Japan',
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    budget: 400000,
    currency: 'JPY',
    description: 'Two weeks exploring Japan: Tokyo, Hakone, Kyoto, Osaka, and Hiroshima',
    destinationData: {
      place_id: 258847628,
      display_name: 'Tokyo, Japan',
      lat: 35.6764225,
      lon: 139.650027,
      type: 'city',
      address: { city: 'Tokyo', country: 'Japan', country_code: 'jp' },
      validated: true,
    },
  },
];

// ============================================================================
// TRIP 1: European Adventure (Paris → Loire → Lyon → Nice)
// ============================================================================
const TRIP1_ACTIVITIES = [
  // === DAY 1: Arrival in Paris ===
  {
    type: 'airport',
    title: 'Charles de Gaulle Airport (Arrival)',
    description: 'Landing in Paris from New York JFK - Air France AF007',
    location: 'Charles de Gaulle Airport, Terminal 2E',
    latitude: 49.0097,
    longitude: 2.5479,
    startTime: '2026-07-01T08:30:00.000Z',
    endTime: '2026-07-01T10:00:00.000Z',
    orderIndex: 1,
    metadata: { confirmationCode: 'AF007NYC' },
  },
  {
    type: 'sightseeing',
    title: 'Walk along the Seine',
    description: 'Leisurely afternoon stroll along the river, jet lag recovery',
    location: 'Pont des Arts, Paris',
    latitude: 48.8584,
    longitude: 2.3374,
    startTime: '2026-07-01T15:00:00.000Z',
    endTime: '2026-07-01T17:00:00.000Z',
    orderIndex: 2,
  },

  // === DAY 2: Paris Highlights ===
  {
    type: 'monument',
    title: 'Eiffel Tower',
    description: 'Morning visit to the iconic tower - summit tickets booked',
    location: 'Champ de Mars, 5 Avenue Anatole France, Paris',
    latitude: 48.8584,
    longitude: 2.2945,
    startTime: '2026-07-02T09:00:00.000Z',
    endTime: '2026-07-02T12:00:00.000Z',
    orderIndex: 3,
    metadata: { confirmationCode: 'EIFFEL2026' },
  },
  {
    type: 'park',
    title: 'Trocadéro Gardens',
    description: 'Best photo spot for Eiffel Tower views',
    location: 'Place du Trocadéro, Paris',
    latitude: 48.8616,
    longitude: 2.2892,
    startTime: '2026-07-02T12:30:00.000Z',
    endTime: '2026-07-02T13:30:00.000Z',
    orderIndex: 4,
  },
  {
    type: 'museum',
    title: 'Musée d\'Orsay',
    description: 'Impressionist masterpieces in a beautiful former train station',
    location: '1 Rue de la Légion d\'Honneur, Paris',
    latitude: 48.8600,
    longitude: 2.3266,
    startTime: '2026-07-02T14:30:00.000Z',
    endTime: '2026-07-02T18:00:00.000Z',
    orderIndex: 5,
    metadata: { confirmationCode: 'ORSAY789' },
  },

  // === DAY 3: Paris Culture ===
  {
    type: 'museum',
    title: 'Louvre Museum',
    description: 'World\'s largest art museum - Mona Lisa, Venus de Milo',
    location: 'Rue de Rivoli, Paris',
    latitude: 48.8606,
    longitude: 2.3376,
    startTime: '2026-07-03T09:00:00.000Z',
    endTime: '2026-07-03T14:00:00.000Z',
    orderIndex: 6,
    metadata: { confirmationCode: 'LOUVRE456' },
  },
  {
    type: 'shopping',
    title: 'Le Marais District',
    description: 'Trendy neighborhood - boutiques, vintage shops, falafel',
    location: 'Le Marais, Paris',
    latitude: 48.8566,
    longitude: 2.3622,
    startTime: '2026-07-03T15:00:00.000Z',
    endTime: '2026-07-03T18:00:00.000Z',
    orderIndex: 7,
  },

  // === DAY 4: Montmartre & Sacred Heart ===
  {
    type: 'monument',
    title: 'Sacré-Cœur Basilica',
    description: 'Beautiful white church on the hill with panoramic views',
    location: '35 Rue du Chevalier de la Barre, Paris',
    latitude: 48.8867,
    longitude: 2.3431,
    startTime: '2026-07-04T09:00:00.000Z',
    endTime: '2026-07-04T11:00:00.000Z',
    orderIndex: 8,
  },
  {
    type: 'sightseeing',
    title: 'Montmartre Artists Quarter',
    description: 'Place du Tertre, street artists, Moulin Rouge area',
    location: 'Place du Tertre, Montmartre, Paris',
    latitude: 48.8865,
    longitude: 2.3408,
    startTime: '2026-07-04T11:30:00.000Z',
    endTime: '2026-07-04T14:00:00.000Z',
    orderIndex: 9,
  },
  {
    type: 'monument',
    title: 'Notre-Dame Cathedral',
    description: 'Exterior visit - reconstruction in progress',
    location: '6 Parvis Notre-Dame, Paris',
    latitude: 48.8530,
    longitude: 2.3499,
    startTime: '2026-07-04T15:00:00.000Z',
    endTime: '2026-07-04T16:30:00.000Z',
    orderIndex: 10,
  },

  // === DAY 5: Day trip to Versailles ===
  {
    type: 'train_station',
    title: 'Gare Saint-Lazare (to Versailles)',
    description: 'RER C train to Versailles',
    location: 'Gare Saint-Lazare, Paris',
    latitude: 48.8764,
    longitude: 2.3247,
    startTime: '2026-07-05T08:00:00.000Z',
    endTime: '2026-07-05T08:30:00.000Z',
    orderIndex: 11,
    metadata: { transportToNext: { mode: 'train' } },
  },
  {
    type: 'monument',
    title: 'Palace of Versailles',
    description: 'Full day exploring the palace, gardens, and Trianon',
    location: 'Place d\'Armes, Versailles',
    latitude: 48.8049,
    longitude: 2.1204,
    startTime: '2026-07-05T09:30:00.000Z',
    endTime: '2026-07-05T17:00:00.000Z',
    orderIndex: 12,
    metadata: { confirmationCode: 'VERSAILLES2026' },
  },

  // === DAY 6: Travel to Loire Valley ===
  {
    type: 'train_station',
    title: 'Paris Austerlitz (TGV to Tours)',
    description: 'High-speed train to Loire Valley',
    location: 'Gare d\'Austerlitz, Paris',
    latitude: 48.8422,
    longitude: 2.3652,
    startTime: '2026-07-06T09:00:00.000Z',
    endTime: '2026-07-06T09:30:00.000Z',
    orderIndex: 13,
    metadata: { confirmationCode: 'TGV8834', transportToNext: { mode: 'train' } },
  },
  {
    type: 'train_station',
    title: 'Tours Station (Arrival)',
    description: 'Arriving in the Loire Valley',
    location: 'Gare de Tours, Tours',
    latitude: 47.3893,
    longitude: 0.6939,
    startTime: '2026-07-06T11:00:00.000Z',
    endTime: '2026-07-06T11:30:00.000Z',
    orderIndex: 14,
  },
  {
    type: 'monument',
    title: 'Château de Chenonceau',
    description: 'The "Ladies\' Castle" spanning the River Cher',
    location: 'Château de Chenonceau, Chenonceaux',
    latitude: 47.3249,
    longitude: 1.0703,
    startTime: '2026-07-06T14:00:00.000Z',
    endTime: '2026-07-06T17:00:00.000Z',
    orderIndex: 15,
  },

  // === DAY 7: Loire Valley Castles ===
  {
    type: 'monument',
    title: 'Château de Chambord',
    description: 'Largest château in the Loire Valley - Renaissance masterpiece',
    location: 'Château de Chambord, Chambord',
    latitude: 47.6161,
    longitude: 1.5170,
    startTime: '2026-07-07T09:00:00.000Z',
    endTime: '2026-07-07T13:00:00.000Z',
    orderIndex: 16,
    metadata: { confirmationCode: 'CHAMBORD123' },
  },
  {
    type: 'sightseeing',
    title: 'Wine Tasting in Vouvray',
    description: 'Famous white wines of the Loire',
    location: 'Vouvray, Loire Valley',
    latitude: 47.4128,
    longitude: 0.7986,
    startTime: '2026-07-07T15:00:00.000Z',
    endTime: '2026-07-07T18:00:00.000Z',
    orderIndex: 17,
  },

  // === DAY 8: Travel to Lyon ===
  {
    type: 'train_station',
    title: 'Tours Station (to Lyon)',
    description: 'TGV to Lyon Part-Dieu',
    location: 'Gare de Tours, Tours',
    latitude: 47.3893,
    longitude: 0.6939,
    startTime: '2026-07-08T08:30:00.000Z',
    endTime: '2026-07-08T09:00:00.000Z',
    orderIndex: 18,
    metadata: { confirmationCode: 'TGV6621', transportToNext: { mode: 'train' } },
  },
  {
    type: 'train_station',
    title: 'Lyon Part-Dieu (Arrival)',
    description: 'Arriving in France\'s gastronomic capital',
    location: 'Gare de Lyon Part-Dieu, Lyon',
    latitude: 45.7606,
    longitude: 4.8594,
    startTime: '2026-07-08T11:30:00.000Z',
    endTime: '2026-07-08T12:00:00.000Z',
    orderIndex: 19,
  },
  {
    type: 'sightseeing',
    title: 'Vieux Lyon (Old Town)',
    description: 'Renaissance architecture and traboules (hidden passageways)',
    location: 'Vieux Lyon, Lyon',
    latitude: 45.7622,
    longitude: 4.8267,
    startTime: '2026-07-08T14:00:00.000Z',
    endTime: '2026-07-08T17:00:00.000Z',
    orderIndex: 20,
  },

  // === DAY 9: Lyon Exploration ===
  {
    type: 'monument',
    title: 'Basilica of Notre-Dame de Fourvière',
    description: 'Stunning basilica overlooking the city',
    location: '8 Place de Fourvière, Lyon',
    latitude: 45.7623,
    longitude: 4.8225,
    startTime: '2026-07-09T09:00:00.000Z',
    endTime: '2026-07-09T11:00:00.000Z',
    orderIndex: 21,
  },
  {
    type: 'market',
    title: 'Les Halles de Lyon Paul Bocuse',
    description: 'Famous indoor food market - gourmet heaven',
    location: '102 Cours Lafayette, Lyon',
    latitude: 45.7631,
    longitude: 4.8539,
    startTime: '2026-07-09T11:30:00.000Z',
    endTime: '2026-07-09T14:00:00.000Z',
    orderIndex: 22,
  },
  {
    type: 'museum',
    title: 'Musée des Confluences',
    description: 'Modern science and anthropology museum',
    location: '86 Quai Perrache, Lyon',
    latitude: 45.7327,
    longitude: 4.8183,
    startTime: '2026-07-09T15:00:00.000Z',
    endTime: '2026-07-09T18:00:00.000Z',
    orderIndex: 23,
  },

  // === DAY 10: Travel to Nice ===
  {
    type: 'train_station',
    title: 'Lyon Part-Dieu (to Nice)',
    description: 'TGV to the French Riviera',
    location: 'Gare de Lyon Part-Dieu, Lyon',
    latitude: 45.7606,
    longitude: 4.8594,
    startTime: '2026-07-10T08:00:00.000Z',
    endTime: '2026-07-10T08:30:00.000Z',
    orderIndex: 24,
    metadata: { confirmationCode: 'TGV9912', transportToNext: { mode: 'train' } },
  },
  {
    type: 'train_station',
    title: 'Nice-Ville Station (Arrival)',
    description: 'Welcome to the Côte d\'Azur!',
    location: 'Gare de Nice-Ville, Nice',
    latitude: 43.7044,
    longitude: 7.2619,
    startTime: '2026-07-10T12:30:00.000Z',
    endTime: '2026-07-10T13:00:00.000Z',
    orderIndex: 25,
  },
  {
    type: 'sightseeing',
    title: 'Promenade des Anglais',
    description: 'Famous seaside promenade and beach time',
    location: 'Promenade des Anglais, Nice',
    latitude: 43.6947,
    longitude: 7.2653,
    startTime: '2026-07-10T15:00:00.000Z',
    endTime: '2026-07-10T18:00:00.000Z',
    orderIndex: 26,
  },

  // === DAY 11: Nice & Surroundings ===
  {
    type: 'sightseeing',
    title: 'Old Town Nice (Vieux Nice)',
    description: 'Colorful streets, Cours Saleya market, local specialties',
    location: 'Vieux Nice, Nice',
    latitude: 43.6958,
    longitude: 7.2756,
    startTime: '2026-07-11T09:00:00.000Z',
    endTime: '2026-07-11T12:00:00.000Z',
    orderIndex: 27,
  },
  {
    type: 'sightseeing',
    title: 'Castle Hill (Colline du Château)',
    description: 'Panoramic views over Nice and the bay',
    location: 'Colline du Château, Nice',
    latitude: 43.6952,
    longitude: 7.2810,
    startTime: '2026-07-11T14:00:00.000Z',
    endTime: '2026-07-11T16:00:00.000Z',
    orderIndex: 28,
  },
  {
    type: 'museum',
    title: 'Musée Matisse',
    description: 'Dedicated to the works of Henri Matisse',
    location: '164 Avenue des Arènes de Cimiez, Nice',
    latitude: 43.7199,
    longitude: 7.2753,
    startTime: '2026-07-11T16:30:00.000Z',
    endTime: '2026-07-11T18:30:00.000Z',
    orderIndex: 29,
  },

  // === DAY 12: Day trip to Monaco ===
  {
    type: 'bus_stop',
    title: 'Bus to Monaco',
    description: 'Scenic coastal bus ride #100',
    location: 'Nice Port, Nice',
    latitude: 43.6961,
    longitude: 7.2847,
    startTime: '2026-07-12T09:00:00.000Z',
    endTime: '2026-07-12T09:30:00.000Z',
    orderIndex: 30,
  },
  {
    type: 'sightseeing',
    title: 'Monte Carlo Casino',
    description: 'Iconic casino and luxury cars',
    location: 'Place du Casino, Monaco',
    latitude: 43.7396,
    longitude: 7.4269,
    startTime: '2026-07-12T10:30:00.000Z',
    endTime: '2026-07-12T12:00:00.000Z',
    orderIndex: 31,
  },
  {
    type: 'monument',
    title: 'Prince\'s Palace of Monaco',
    description: 'Official residence of the Prince of Monaco',
    location: 'Place du Palais, Monaco',
    latitude: 43.7314,
    longitude: 7.4203,
    startTime: '2026-07-12T13:00:00.000Z',
    endTime: '2026-07-12T15:00:00.000Z',
    orderIndex: 32,
  },
  {
    type: 'museum',
    title: 'Oceanographic Museum',
    description: 'Marine science museum on the cliff',
    location: 'Avenue Saint-Martin, Monaco',
    latitude: 43.7308,
    longitude: 7.4256,
    startTime: '2026-07-12T15:30:00.000Z',
    endTime: '2026-07-12T17:30:00.000Z',
    orderIndex: 33,
  },

  // === DAY 13: Relaxation & Beach ===
  {
    type: 'sightseeing',
    title: 'Beach Day at Villefranche-sur-Mer',
    description: 'Charming fishing village with crystal clear water',
    location: 'Villefranche-sur-Mer',
    latitude: 43.7048,
    longitude: 7.3117,
    startTime: '2026-07-13T10:00:00.000Z',
    endTime: '2026-07-13T16:00:00.000Z',
    orderIndex: 34,
  },
  {
    type: 'shopping',
    title: 'Last Minute Shopping in Nice',
    description: 'Souvenirs, lavender products, local specialties',
    location: 'Avenue Jean Médecin, Nice',
    latitude: 43.7026,
    longitude: 7.2689,
    startTime: '2026-07-13T17:00:00.000Z',
    endTime: '2026-07-13T19:00:00.000Z',
    orderIndex: 35,
  },

  // === DAY 14: Departure ===
  {
    type: 'airport',
    title: 'Nice Côte d\'Azur Airport (Departure)',
    description: 'Flying home via Paris CDG - Air France AF1234',
    location: 'Nice Côte d\'Azur Airport',
    latitude: 43.6584,
    longitude: 7.2159,
    startTime: '2026-07-14T10:00:00.000Z',
    endTime: '2026-07-14T12:00:00.000Z',
    orderIndex: 99,
    metadata: { confirmationCode: 'AF1234NCE' },
  },
];

const TRIP1_RESERVATIONS = [
  // === LODGING ===
  // Paris Hotel (Days 1-5)
  {
    type: 'hotel',
    title: 'Hôtel Le Marais',
    description: 'Boutique hotel in the heart of Le Marais',
    location: '12 Rue de Birague, 75004 Paris',
    latitude: 48.8539,
    longitude: 2.3658,
    startTime: '2026-07-01T14:00:00.000Z',
    endTime: '2026-07-06T11:00:00.000Z',
    orderIndex: 100,
    metadata: {
      propertyName: 'Hôtel Le Marais',
      provider: 'Booking.com',
      checkInDate: '2026-07-01',
      checkOutDate: '2026-07-06',
      confirmationCode: 'BK78901PAR',
    },
  },
  // Loire Valley B&B (Days 6-7)
  {
    type: 'rental',
    title: 'Château B&B Loire',
    description: 'Charming bed & breakfast in a small château',
    location: 'Route de Chambord, Cheverny',
    latitude: 47.5003,
    longitude: 1.4583,
    startTime: '2026-07-06T15:00:00.000Z',
    endTime: '2026-07-08T10:00:00.000Z',
    orderIndex: 101,
    metadata: {
      propertyName: 'Château de la Rozelle',
      provider: 'Airbnb',
      checkInDate: '2026-07-06',
      checkOutDate: '2026-07-08',
      confirmationCode: 'ABNB456LOIRE',
    },
  },
  // Lyon Apartment (Days 8-9)
  {
    type: 'rental',
    title: 'Lyon City Apartment',
    description: 'Modern apartment near Les Halles',
    location: '45 Rue de la République, Lyon',
    latitude: 45.7640,
    longitude: 4.8357,
    startTime: '2026-07-08T14:00:00.000Z',
    endTime: '2026-07-10T11:00:00.000Z',
    orderIndex: 102,
    metadata: {
      propertyName: 'Lyon City Flat',
      provider: 'Vrbo',
      checkInDate: '2026-07-08',
      checkOutDate: '2026-07-10',
      confirmationCode: 'VRBO789LYON',
    },
  },
  // Nice Seaside Hotel (Days 10-14)
  {
    type: 'hotel',
    title: 'Hôtel Negresco',
    description: 'Iconic Belle Époque hotel on the Promenade',
    location: '37 Promenade des Anglais, Nice',
    latitude: 43.6951,
    longitude: 7.2580,
    startTime: '2026-07-10T15:00:00.000Z',
    endTime: '2026-07-14T11:00:00.000Z',
    orderIndex: 103,
    metadata: {
      propertyName: 'Hôtel Negresco',
      provider: 'Direct',
      checkInDate: '2026-07-10',
      checkOutDate: '2026-07-14',
      confirmationCode: 'NEG2026NICE',
    },
  },

  // === DINING ===
  {
    type: 'restaurant',
    title: 'Le Jules Verne',
    description: 'Michelin-starred restaurant in the Eiffel Tower',
    location: 'Eiffel Tower, Avenue Gustave Eiffel, Paris',
    latitude: 48.8584,
    longitude: 2.2945,
    startTime: '2026-07-02T19:30:00.000Z',
    endTime: '2026-07-02T22:00:00.000Z',
    orderIndex: 110,
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
    type: 'cafe',
    title: 'Café de Flore',
    description: 'Legendary Parisian café - Art Deco interior',
    location: '172 Boulevard Saint-Germain, Paris',
    latitude: 48.8540,
    longitude: 2.3325,
    startTime: '2026-07-03T15:00:00.000Z',
    endTime: '2026-07-03T16:30:00.000Z',
    orderIndex: 111,
    metadata: {
      venueName: 'Café de Flore',
      reservationDate: '2026-07-03',
      reservationTime: '15:00',
      partySize: 2,
    },
  },
  {
    type: 'restaurant',
    title: 'Bouchon Lyonnais',
    description: 'Traditional Lyon bouchon - authentic local cuisine',
    location: 'Rue Mercière, Lyon',
    latitude: 45.7631,
    longitude: 4.8333,
    startTime: '2026-07-08T19:00:00.000Z',
    endTime: '2026-07-08T21:30:00.000Z',
    orderIndex: 112,
    metadata: {
      venueName: 'Daniel et Denise',
      provider: 'TheFork',
      reservationDate: '2026-07-08',
      reservationTime: '19:00',
      partySize: 2,
      confirmationCode: 'DD2026LYON',
    },
  },
  {
    type: 'bar',
    title: 'Rooftop Bar Nice',
    description: 'Sunset cocktails with sea views',
    location: 'Promenade des Anglais, Nice',
    latitude: 43.6947,
    longitude: 7.2600,
    startTime: '2026-07-11T19:00:00.000Z',
    endTime: '2026-07-11T21:00:00.000Z',
    orderIndex: 113,
    metadata: {
      venueName: 'Le Rooftop',
      reservationDate: '2026-07-11',
      reservationTime: '19:00',
      partySize: 2,
    },
  },
  {
    type: 'restaurant',
    title: 'Farewell Dinner - Nice',
    description: 'Final dinner with Mediterranean cuisine',
    location: 'Vieux Nice, Nice',
    latitude: 43.6958,
    longitude: 7.2756,
    startTime: '2026-07-13T20:00:00.000Z',
    endTime: '2026-07-13T22:30:00.000Z',
    orderIndex: 114,
    metadata: {
      venueName: 'La Petite Maison',
      provider: 'Direct',
      reservationDate: '2026-07-13',
      reservationTime: '20:00',
      partySize: 2,
      confirmationCode: 'LPM2026',
    },
  },
];

// ============================================================================
// TRIP 2: Japan Discovery (Tokyo → Hakone → Kyoto → Osaka → Hiroshima)
// ============================================================================
const TRIP2_ACTIVITIES = [
  // === DAY 1: Arrival in Tokyo ===
  {
    type: 'airport',
    title: 'Narita Airport (Arrival)',
    description: 'Landing from Los Angeles - JAL JL061',
    location: 'Narita International Airport, Terminal 2',
    latitude: 35.7720,
    longitude: 140.3929,
    startTime: '2026-09-01T14:00:00.000Z',
    endTime: '2026-09-01T15:30:00.000Z',
    orderIndex: 1,
    metadata: { confirmationCode: 'JL061LAX' },
  },
  {
    type: 'train_station',
    title: 'Narita Express to Tokyo',
    description: 'Direct train to Shinjuku Station',
    location: 'Narita Airport Terminal 2 Station',
    latitude: 35.7720,
    longitude: 140.3929,
    startTime: '2026-09-01T16:00:00.000Z',
    endTime: '2026-09-01T16:30:00.000Z',
    orderIndex: 2,
    metadata: { confirmationCode: 'NEX1234', transportToNext: { mode: 'train' } },
  },

  // === DAY 2: Tokyo Exploration ===
  {
    type: 'monument',
    title: 'Senso-ji Temple',
    description: 'Tokyo\'s oldest and most famous Buddhist temple',
    location: '2-3-1 Asakusa, Taito City, Tokyo',
    latitude: 35.7148,
    longitude: 139.7967,
    startTime: '2026-09-02T08:00:00.000Z',
    endTime: '2026-09-02T10:30:00.000Z',
    orderIndex: 3,
  },
  {
    type: 'sightseeing',
    title: 'Tokyo Skytree',
    description: 'Tallest structure in Japan - 360° views',
    location: '1-1-2 Oshiage, Sumida City, Tokyo',
    latitude: 35.7101,
    longitude: 139.8107,
    startTime: '2026-09-02T11:00:00.000Z',
    endTime: '2026-09-02T13:00:00.000Z',
    orderIndex: 4,
    metadata: { confirmationCode: 'SKYTREE789' },
  },
  {
    type: 'shopping',
    title: 'Akihabara Electronics District',
    description: 'Electronics, anime, manga paradise',
    location: 'Akihabara, Chiyoda City, Tokyo',
    latitude: 35.7023,
    longitude: 139.7745,
    startTime: '2026-09-02T14:30:00.000Z',
    endTime: '2026-09-02T17:30:00.000Z',
    orderIndex: 5,
  },

  // === DAY 3: Modern Tokyo ===
  {
    type: 'sightseeing',
    title: 'Shibuya Crossing',
    description: 'World\'s busiest pedestrian crossing',
    location: 'Shibuya Crossing, Tokyo',
    latitude: 35.6595,
    longitude: 139.7004,
    startTime: '2026-09-03T10:00:00.000Z',
    endTime: '2026-09-03T11:30:00.000Z',
    orderIndex: 6,
  },
  {
    type: 'park',
    title: 'Yoyogi Park & Meiji Shrine',
    description: 'Peaceful forest shrine in the heart of Tokyo',
    location: '1-1 Yoyogikamizonocho, Shibuya City, Tokyo',
    latitude: 35.6764,
    longitude: 139.6993,
    startTime: '2026-09-03T12:00:00.000Z',
    endTime: '2026-09-03T14:30:00.000Z',
    orderIndex: 7,
  },
  {
    type: 'shopping',
    title: 'Harajuku & Takeshita Street',
    description: 'Youth fashion and street food',
    location: 'Takeshita Street, Harajuku, Tokyo',
    latitude: 35.6702,
    longitude: 139.7027,
    startTime: '2026-09-03T15:00:00.000Z',
    endTime: '2026-09-03T18:00:00.000Z',
    orderIndex: 8,
  },

  // === DAY 4: Day trip to Hakone ===
  {
    type: 'train_station',
    title: 'Shinjuku Station (Romancecar to Hakone)',
    description: 'Scenic train ride to hot spring resort',
    location: 'Shinjuku Station, Tokyo',
    latitude: 35.6896,
    longitude: 139.7006,
    startTime: '2026-09-04T08:00:00.000Z',
    endTime: '2026-09-04T08:30:00.000Z',
    orderIndex: 9,
    metadata: { confirmationCode: 'ROMANCE456', transportToNext: { mode: 'train' } },
  },
  {
    type: 'sightseeing',
    title: 'Hakone Open-Air Museum',
    description: 'Outdoor sculpture garden with mountain views',
    location: 'Hakone Open-Air Museum, Hakone',
    latitude: 35.2449,
    longitude: 139.0089,
    startTime: '2026-09-04T10:30:00.000Z',
    endTime: '2026-09-04T12:30:00.000Z',
    orderIndex: 10,
  },
  {
    type: 'sightseeing',
    title: 'Lake Ashi Pirate Ship Cruise',
    description: 'Scenic cruise with Mt. Fuji views (weather permitting)',
    location: 'Hakone-machi Port, Hakone',
    latitude: 35.1984,
    longitude: 139.0269,
    startTime: '2026-09-04T13:30:00.000Z',
    endTime: '2026-09-04T15:00:00.000Z',
    orderIndex: 11,
  },
  {
    type: 'sightseeing',
    title: 'Hakone Ropeway',
    description: 'Cable car over volcanic valley Owakudani',
    location: 'Hakone Ropeway, Hakone',
    latitude: 35.2421,
    longitude: 139.0243,
    startTime: '2026-09-04T15:30:00.000Z',
    endTime: '2026-09-04T17:00:00.000Z',
    orderIndex: 12,
  },

  // === DAY 5: Travel to Kyoto ===
  {
    type: 'train_station',
    title: 'Tokyo Station (Shinkansen to Kyoto)',
    description: 'Nozomi bullet train - fastest option',
    location: 'Tokyo Station',
    latitude: 35.6812,
    longitude: 139.7671,
    startTime: '2026-09-05T08:00:00.000Z',
    endTime: '2026-09-05T08:30:00.000Z',
    orderIndex: 13,
    metadata: { confirmationCode: 'NOZOMI789', transportToNext: { mode: 'train' } },
  },
  {
    type: 'train_station',
    title: 'Kyoto Station (Arrival)',
    description: 'Welcome to the ancient capital',
    location: 'Kyoto Station',
    latitude: 34.9858,
    longitude: 135.7588,
    startTime: '2026-09-05T10:45:00.000Z',
    endTime: '2026-09-05T11:15:00.000Z',
    orderIndex: 14,
  },
  {
    type: 'monument',
    title: 'Fushimi Inari Shrine',
    description: 'Famous thousand vermillion torii gates',
    location: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto',
    latitude: 34.9671,
    longitude: 135.7727,
    startTime: '2026-09-05T13:00:00.000Z',
    endTime: '2026-09-05T16:00:00.000Z',
    orderIndex: 15,
  },
  {
    type: 'sightseeing',
    title: 'Gion District Evening Walk',
    description: 'Traditional geisha district at dusk',
    location: 'Gion, Higashiyama Ward, Kyoto',
    latitude: 35.0037,
    longitude: 135.7757,
    startTime: '2026-09-05T17:00:00.000Z',
    endTime: '2026-09-05T19:00:00.000Z',
    orderIndex: 16,
  },

  // === DAY 6: Kyoto Temples ===
  {
    type: 'monument',
    title: 'Kinkaku-ji (Golden Pavilion)',
    description: 'Iconic gold-leaf covered temple',
    location: '1 Kinkakujicho, Kita Ward, Kyoto',
    latitude: 35.0394,
    longitude: 135.7292,
    startTime: '2026-09-06T08:30:00.000Z',
    endTime: '2026-09-06T10:00:00.000Z',
    orderIndex: 17,
  },
  {
    type: 'monument',
    title: 'Ryoan-ji Temple',
    description: 'Famous Zen rock garden',
    location: '13 Ryoanji Goryonoshitacho, Ukyo Ward, Kyoto',
    latitude: 35.0345,
    longitude: 135.7183,
    startTime: '2026-09-06T10:30:00.000Z',
    endTime: '2026-09-06T12:00:00.000Z',
    orderIndex: 18,
  },
  {
    type: 'park',
    title: 'Arashiyama Bamboo Grove',
    description: 'Magical bamboo forest walk',
    location: 'Arashiyama, Ukyo Ward, Kyoto',
    latitude: 35.0094,
    longitude: 135.6722,
    startTime: '2026-09-06T13:30:00.000Z',
    endTime: '2026-09-06T16:00:00.000Z',
    orderIndex: 19,
  },
  {
    type: 'monument',
    title: 'Tenryu-ji Temple',
    description: 'World Heritage Zen temple with beautiful garden',
    location: '68 Saga-Tenryuji-Susukinobabacho, Ukyo Ward, Kyoto',
    latitude: 35.0151,
    longitude: 135.6742,
    startTime: '2026-09-06T16:30:00.000Z',
    endTime: '2026-09-06T18:00:00.000Z',
    orderIndex: 20,
  },

  // === DAY 7: Nara Day Trip ===
  {
    type: 'train_station',
    title: 'JR Nara Line (to Nara)',
    description: 'Quick train to the ancient capital',
    location: 'Kyoto Station',
    latitude: 34.9858,
    longitude: 135.7588,
    startTime: '2026-09-07T08:30:00.000Z',
    endTime: '2026-09-07T09:00:00.000Z',
    orderIndex: 21,
    metadata: { transportToNext: { mode: 'train' } },
  },
  {
    type: 'monument',
    title: 'Todai-ji Temple',
    description: 'Giant Buddha statue in world\'s largest wooden building',
    location: '406-1 Zoshicho, Nara',
    latitude: 34.6890,
    longitude: 135.8398,
    startTime: '2026-09-07T10:00:00.000Z',
    endTime: '2026-09-07T12:00:00.000Z',
    orderIndex: 22,
  },
  {
    type: 'park',
    title: 'Nara Park & Deer',
    description: 'Friendly deer and beautiful park grounds',
    location: 'Nara Park, Nara',
    latitude: 34.6851,
    longitude: 135.8430,
    startTime: '2026-09-07T12:30:00.000Z',
    endTime: '2026-09-07T15:00:00.000Z',
    orderIndex: 23,
  },
  {
    type: 'monument',
    title: 'Kasuga Taisha Shrine',
    description: 'Thousands of stone and bronze lanterns',
    location: '160 Kasuganocho, Nara',
    latitude: 34.6818,
    longitude: 135.8493,
    startTime: '2026-09-07T15:30:00.000Z',
    endTime: '2026-09-07T17:00:00.000Z',
    orderIndex: 24,
  },

  // === DAY 8: Travel to Osaka ===
  {
    type: 'train_station',
    title: 'JR Special Rapid (Kyoto to Osaka)',
    description: 'Quick train to Japan\'s kitchen',
    location: 'Kyoto Station',
    latitude: 34.9858,
    longitude: 135.7588,
    startTime: '2026-09-08T10:00:00.000Z',
    endTime: '2026-09-08T10:30:00.000Z',
    orderIndex: 25,
    metadata: { transportToNext: { mode: 'train' } },
  },
  {
    type: 'monument',
    title: 'Osaka Castle',
    description: 'Iconic castle and museum',
    location: '1-1 Osakajo, Chuo Ward, Osaka',
    latitude: 34.6873,
    longitude: 135.5262,
    startTime: '2026-09-08T11:30:00.000Z',
    endTime: '2026-09-08T14:00:00.000Z',
    orderIndex: 26,
  },
  {
    type: 'sightseeing',
    title: 'Dotonbori District',
    description: 'Neon lights, Glico man, street food heaven',
    location: 'Dotonbori, Chuo Ward, Osaka',
    latitude: 34.6687,
    longitude: 135.5016,
    startTime: '2026-09-08T15:00:00.000Z',
    endTime: '2026-09-08T18:00:00.000Z',
    orderIndex: 27,
  },
  {
    type: 'market',
    title: 'Kuromon Market',
    description: '"Osaka\'s Kitchen" - fresh seafood, street food',
    location: '2-4-1 Nipponbashi, Chuo Ward, Osaka',
    latitude: 34.6622,
    longitude: 135.5057,
    startTime: '2026-09-08T18:30:00.000Z',
    endTime: '2026-09-08T20:00:00.000Z',
    orderIndex: 28,
  },

  // === DAY 9: Day trip to Hiroshima ===
  {
    type: 'train_station',
    title: 'Shin-Osaka (Shinkansen to Hiroshima)',
    description: 'Bullet train to Hiroshima',
    location: 'Shin-Osaka Station',
    latitude: 34.7336,
    longitude: 135.5004,
    startTime: '2026-09-09T07:30:00.000Z',
    endTime: '2026-09-09T08:00:00.000Z',
    orderIndex: 29,
    metadata: { confirmationCode: 'HIKARI234', transportToNext: { mode: 'train' } },
  },
  {
    type: 'monument',
    title: 'Peace Memorial Park',
    description: 'Atomic Bomb Dome and Peace Memorial Museum',
    location: '1-2 Nakajimacho, Naka Ward, Hiroshima',
    latitude: 34.3955,
    longitude: 132.4536,
    startTime: '2026-09-09T10:00:00.000Z',
    endTime: '2026-09-09T13:00:00.000Z',
    orderIndex: 30,
  },
  {
    type: 'ferry_terminal',
    title: 'Ferry to Miyajima Island',
    description: 'Quick ferry ride to the sacred island',
    location: 'Miyajimaguchi Ferry Terminal',
    latitude: 34.2998,
    longitude: 132.2997,
    startTime: '2026-09-09T14:00:00.000Z',
    endTime: '2026-09-09T14:30:00.000Z',
    orderIndex: 31,
  },
  {
    type: 'monument',
    title: 'Itsukushima Shrine',
    description: 'Floating torii gate - UNESCO World Heritage',
    location: 'Itsukushima Shrine, Miyajima',
    latitude: 34.2961,
    longitude: 132.3198,
    startTime: '2026-09-09T15:00:00.000Z',
    endTime: '2026-09-09T17:30:00.000Z',
    orderIndex: 32,
  },

  // === DAY 10: Osaka Exploration ===
  {
    type: 'museum',
    title: 'Osaka Aquarium Kaiyukan',
    description: 'One of the world\'s largest aquariums',
    location: '1-1-10 Kaigandori, Minato Ward, Osaka',
    latitude: 34.6545,
    longitude: 135.4290,
    startTime: '2026-09-10T10:00:00.000Z',
    endTime: '2026-09-10T13:00:00.000Z',
    orderIndex: 33,
    metadata: { confirmationCode: 'KAIYUKAN456' },
  },
  {
    type: 'sightseeing',
    title: 'Tempozan Ferris Wheel',
    description: 'Harbor area views',
    location: '1-1-10 Kaigandori, Minato Ward, Osaka',
    latitude: 34.6527,
    longitude: 135.4296,
    startTime: '2026-09-10T13:30:00.000Z',
    endTime: '2026-09-10T14:30:00.000Z',
    orderIndex: 34,
  },
  {
    type: 'shopping',
    title: 'Shinsaibashi Shopping Arcade',
    description: 'Covered shopping street - fashion & souvenirs',
    location: 'Shinsaibashi, Chuo Ward, Osaka',
    latitude: 34.6739,
    longitude: 135.5018,
    startTime: '2026-09-10T15:30:00.000Z',
    endTime: '2026-09-10T18:30:00.000Z',
    orderIndex: 35,
  },

  // === DAY 11: Return to Tokyo ===
  {
    type: 'train_station',
    title: 'Shin-Osaka (Shinkansen to Tokyo)',
    description: 'Return to Tokyo for final days',
    location: 'Shin-Osaka Station',
    latitude: 34.7336,
    longitude: 135.5004,
    startTime: '2026-09-11T09:00:00.000Z',
    endTime: '2026-09-11T09:30:00.000Z',
    orderIndex: 36,
    metadata: { confirmationCode: 'NOZOMI321', transportToNext: { mode: 'train' } },
  },
  {
    type: 'museum',
    title: 'teamLab Planets',
    description: 'Immersive digital art museum',
    location: '6-1-16 Toyosu, Koto City, Tokyo',
    latitude: 35.6501,
    longitude: 139.7906,
    startTime: '2026-09-11T14:00:00.000Z',
    endTime: '2026-09-11T17:00:00.000Z',
    orderIndex: 37,
    metadata: { confirmationCode: 'TEAMLAB789' },
  },

  // === DAY 12: Tokyo Food & Culture ===
  {
    type: 'market',
    title: 'Tsukiji Outer Market',
    description: 'Fresh sushi breakfast and food stalls',
    location: 'Tsukiji Outer Market, Chuo City, Tokyo',
    latitude: 35.6654,
    longitude: 139.7707,
    startTime: '2026-09-12T07:00:00.000Z',
    endTime: '2026-09-12T10:00:00.000Z',
    orderIndex: 38,
  },
  {
    type: 'museum',
    title: 'Ghibli Museum',
    description: 'Studio Ghibli animation museum',
    location: '1-1-83 Shimorenjaku, Mitaka, Tokyo',
    latitude: 35.6962,
    longitude: 139.5704,
    startTime: '2026-09-12T12:00:00.000Z',
    endTime: '2026-09-12T15:00:00.000Z',
    orderIndex: 39,
    metadata: { confirmationCode: 'GHIBLI2026' },
  },
  {
    type: 'sightseeing',
    title: 'Shinjuku Night Views',
    description: 'Tokyo Metropolitan Government Building observation deck',
    location: '2-8-1 Nishishinjuku, Shinjuku City, Tokyo',
    latitude: 35.6896,
    longitude: 139.6917,
    startTime: '2026-09-12T17:00:00.000Z',
    endTime: '2026-09-12T19:00:00.000Z',
    orderIndex: 40,
  },

  // === DAY 13: Last Day in Tokyo ===
  {
    type: 'shopping',
    title: 'Last Minute Shopping - Ginza',
    description: 'Upscale shopping and department stores',
    location: 'Ginza, Chuo City, Tokyo',
    latitude: 35.6721,
    longitude: 139.7653,
    startTime: '2026-09-13T10:00:00.000Z',
    endTime: '2026-09-13T14:00:00.000Z',
    orderIndex: 41,
  },
  {
    type: 'park',
    title: 'Imperial Palace East Gardens',
    description: 'Peaceful gardens of the Imperial Palace',
    location: '1-1 Chiyoda, Chiyoda City, Tokyo',
    latitude: 35.6852,
    longitude: 139.7528,
    startTime: '2026-09-13T15:00:00.000Z',
    endTime: '2026-09-13T17:00:00.000Z',
    orderIndex: 42,
  },

  // === DAY 14: Departure ===
  {
    type: 'train_station',
    title: 'Narita Express (to Airport)',
    description: 'Final train ride in Japan',
    location: 'Shinjuku Station, Tokyo',
    latitude: 35.6896,
    longitude: 139.7006,
    startTime: '2026-09-14T08:00:00.000Z',
    endTime: '2026-09-14T08:30:00.000Z',
    orderIndex: 43,
    metadata: { transportToNext: { mode: 'train' } },
  },
  {
    type: 'airport',
    title: 'Narita Airport (Departure)',
    description: 'Flying home - JAL JL062',
    location: 'Narita International Airport, Terminal 2',
    latitude: 35.7720,
    longitude: 140.3929,
    startTime: '2026-09-14T11:00:00.000Z',
    endTime: '2026-09-14T13:00:00.000Z',
    orderIndex: 99,
    metadata: { confirmationCode: 'JL062NRT' },
  },
];

const TRIP2_RESERVATIONS = [
  // === LODGING ===
  // Tokyo Hotel (Days 1-4)
  {
    type: 'hotel',
    title: 'Park Hyatt Tokyo',
    description: 'Iconic hotel from Lost in Translation',
    location: '3-7-1-2 Nishi-Shinjuku, Shinjuku City, Tokyo',
    latitude: 35.6867,
    longitude: 139.6906,
    startTime: '2026-09-01T15:00:00.000Z',
    endTime: '2026-09-05T11:00:00.000Z',
    orderIndex: 100,
    metadata: {
      propertyName: 'Park Hyatt Tokyo',
      provider: 'Hyatt.com',
      checkInDate: '2026-09-01',
      checkOutDate: '2026-09-05',
      confirmationCode: 'HYATT2026TYO',
    },
  },
  // Kyoto Ryokan (Days 5-7)
  {
    type: 'hotel',
    title: 'Gion Hatanaka Ryokan',
    description: 'Traditional Japanese inn with kaiseki dinner',
    location: '505 Gionmachi Minamigawa, Higashiyama Ward, Kyoto',
    latitude: 35.0020,
    longitude: 135.7754,
    startTime: '2026-09-05T15:00:00.000Z',
    endTime: '2026-09-08T10:00:00.000Z',
    orderIndex: 101,
    metadata: {
      propertyName: 'Gion Hatanaka',
      provider: 'Japanican',
      checkInDate: '2026-09-05',
      checkOutDate: '2026-09-08',
      confirmationCode: 'GION789KYO',
    },
  },
  // Osaka Hostel (Days 8-10) - Different accommodation type
  {
    type: 'hostel',
    title: 'The Millennials Osaka',
    description: 'Modern capsule-style hostel in Namba',
    location: '2-6-4 Shinsaibashisuji, Chuo Ward, Osaka',
    latitude: 34.6714,
    longitude: 135.5028,
    startTime: '2026-09-08T15:00:00.000Z',
    endTime: '2026-09-11T11:00:00.000Z',
    orderIndex: 102,
    metadata: {
      propertyName: 'The Millennials Osaka',
      provider: 'Hostelworld',
      checkInDate: '2026-09-08',
      checkOutDate: '2026-09-11',
      confirmationCode: 'MILL2026OSA',
    },
  },
  // Tokyo Final Hotel (Days 11-14) - Different hotel
  {
    type: 'hotel',
    title: 'Aman Tokyo',
    description: 'Luxury minimalist hotel with city views',
    location: 'Otemachi Tower, 1-5-6 Otemachi, Chiyoda City, Tokyo',
    latitude: 35.6866,
    longitude: 139.7637,
    startTime: '2026-09-11T15:00:00.000Z',
    endTime: '2026-09-14T11:00:00.000Z',
    orderIndex: 103,
    metadata: {
      propertyName: 'Aman Tokyo',
      provider: 'Aman.com',
      checkInDate: '2026-09-11',
      checkOutDate: '2026-09-14',
      confirmationCode: 'AMAN2026TYO',
    },
  },

  // === DINING ===
  {
    type: 'restaurant',
    title: 'Sushi Saito',
    description: '3 Michelin stars - best sushi in Tokyo',
    location: 'ARK Hills South Tower, 1-4-5 Roppongi, Minato City, Tokyo',
    latitude: 35.6669,
    longitude: 139.7401,
    startTime: '2026-09-02T18:00:00.000Z',
    endTime: '2026-09-02T20:00:00.000Z',
    orderIndex: 110,
    metadata: {
      venueName: 'Sushi Saito',
      provider: 'Direct reservation',
      reservationDate: '2026-09-02',
      reservationTime: '18:00',
      partySize: 2,
      confirmationCode: 'SAITO2026',
    },
  },
  {
    type: 'restaurant',
    title: 'Kichi Kichi Omurice',
    description: 'Famous omurice with theatrical service',
    location: 'Pontocho, Nakagyo Ward, Kyoto',
    latitude: 35.0047,
    longitude: 135.7710,
    startTime: '2026-09-06T12:00:00.000Z',
    endTime: '2026-09-06T13:30:00.000Z',
    orderIndex: 111,
    metadata: {
      venueName: 'Kichi Kichi',
      provider: 'Direct',
      reservationDate: '2026-09-06',
      reservationTime: '12:00',
      partySize: 2,
      confirmationCode: 'KICHI2026',
    },
  },
  {
    type: 'bar',
    title: 'Bar Benfiddich',
    description: 'Award-winning cocktail bar',
    location: '1-13-7 Nishi-Shinjuku, Shinjuku City, Tokyo',
    latitude: 35.6923,
    longitude: 139.6982,
    startTime: '2026-09-03T20:00:00.000Z',
    endTime: '2026-09-03T22:00:00.000Z',
    orderIndex: 112,
    metadata: {
      venueName: 'Bar Benfiddich',
      reservationDate: '2026-09-03',
      reservationTime: '20:00',
      partySize: 2,
    },
  },
  {
    type: 'restaurant',
    title: 'Ichiran Ramen',
    description: 'Solo booth ramen experience',
    location: 'Dotonbori, Chuo Ward, Osaka',
    latitude: 34.6687,
    longitude: 135.5016,
    startTime: '2026-09-08T19:00:00.000Z',
    endTime: '2026-09-08T20:00:00.000Z',
    orderIndex: 113,
    metadata: {
      venueName: 'Ichiran Dotonbori',
      reservationDate: '2026-09-08',
      reservationTime: '19:00',
      partySize: 2,
    },
  },
  {
    type: 'restaurant',
    title: 'Narisawa',
    description: 'Innovative Japanese - Asia\'s 50 Best',
    location: '2-6-15 Minami-Aoyama, Minato City, Tokyo',
    latitude: 35.6693,
    longitude: 139.7197,
    startTime: '2026-09-12T19:00:00.000Z',
    endTime: '2026-09-12T22:00:00.000Z',
    orderIndex: 114,
    metadata: {
      venueName: 'Narisawa',
      provider: 'Direct',
      reservationDate: '2026-09-12',
      reservationTime: '19:00',
      partySize: 2,
      confirmationCode: 'NARI2026',
    },
  },
  {
    type: 'cafe',
    title: 'Blue Bottle Coffee Kyoto',
    description: 'Specialty coffee in a 100-year-old machiya',
    location: 'Nanzenji, Sakyo Ward, Kyoto',
    latitude: 35.0116,
    longitude: 135.7925,
    startTime: '2026-09-07T09:00:00.000Z',
    endTime: '2026-09-07T10:00:00.000Z',
    orderIndex: 115,
    metadata: {
      venueName: 'Blue Bottle Coffee',
      reservationDate: '2026-09-07',
      reservationTime: '09:00',
      partySize: 2,
    },
  },
];

// Demo expenses - covering all split types
const DEMO_EXPENSES = {
  0: [
    { amount: 85.00, category: 'shopping', description: 'Souvenirs from Paris', expenseDate: '2026-07-03', splitType: 'none' },
    { amount: 150.00, category: 'activities', description: 'Eiffel Tower tickets for both', expenseDate: '2026-07-02', splitType: 'equal' },
    { amount: 280.00, category: 'food', description: 'Dinner at Le Jules Verne', expenseDate: '2026-07-02', splitType: 'equal' },
    { amount: 450.00, category: 'accommodation', description: 'Loire Valley B&B', expenseDate: '2026-07-06', splitType: 'custom', customSplits: [0.6, 0.4] },
    { amount: 120.00, category: 'transportation', description: 'TGV Paris to Tours', expenseDate: '2026-07-06', splitType: 'equal' },
    { payerIndex: 1, amount: 95.00, category: 'activities', description: 'Wine tasting for Alice', expenseDate: '2026-07-07', splitType: 'oneway' },
    { payerIndex: 1, amount: 95.00, category: 'settlement', description: 'Settlement: Alice repaid wine tasting', expenseDate: '2026-07-09', splitType: 'settlement' },
  ],
  1: [
    { amount: 5000, category: 'shopping', description: 'Anime figures from Akihabara', expenseDate: '2026-09-02', splitType: 'none' },
    { amount: 35000, category: 'food', description: 'Sushi Saito omakase', expenseDate: '2026-09-02', splitType: 'equal' },
    { amount: 25000, category: 'accommodation', description: 'Ryokan kaiseki dinner', expenseDate: '2026-09-06', splitType: 'equal' },
    { amount: 28000, category: 'transportation', description: 'JR Pass 7 days', expenseDate: '2026-09-01', splitType: 'custom', customSplits: [0.5, 0.5] },
    { payerIndex: 0, amount: 8000, category: 'activities', description: 'teamLab tickets for Bob', expenseDate: '2026-09-11', splitType: 'oneway' },
    { amount: 15000, category: 'food', description: 'Narisawa dinner', expenseDate: '2026-09-12', splitType: 'equal' },
    { payerIndex: 0, amount: 8000, category: 'settlement', description: 'Settlement: Bob repaid teamLab', expenseDate: '2026-09-13', splitType: 'settlement' },
  ],
};

// Demo lists
const DEMO_LISTS = {
  0: [
    {
      type: 'packing',
      title: 'Europe Packing List',
      items: [
        { text: 'Passport & copies', checked: true },
        { text: 'EU power adapter', checked: true },
        { text: 'Comfortable walking shoes', checked: true },
        { text: 'Light rain jacket', checked: false },
        { text: 'Camera & charger', checked: true },
        { text: 'Sunglasses', checked: false },
        { text: 'Day backpack', checked: true },
        { text: 'Travel toiletries', checked: true },
        { text: 'Neck pillow for train', checked: false },
        { text: 'Reusable water bottle', checked: false },
      ],
    },
    {
      type: 'todo',
      title: 'Pre-Trip Tasks',
      items: [
        { text: 'Book all TGV trains', checked: true },
        { text: 'Reserve Eiffel Tower tickets', checked: true },
        { text: 'Get travel insurance', checked: true },
        { text: 'Notify bank of travel', checked: true },
        { text: 'Download offline Paris map', checked: false },
        { text: 'Learn basic French phrases', checked: false },
        { text: 'Exchange some EUR', checked: true },
      ],
    },
    {
      type: 'shopping',
      title: 'Things to Buy in France',
      items: [
        { text: 'French wine (Burgundy)', checked: false },
        { text: 'Macarons from Ladurée', checked: false },
        { text: 'Cheese selection', checked: false },
        { text: 'Lavender products from Provence', checked: false },
        { text: 'Perfume from Paris', checked: false },
        { text: 'Art prints from museums', checked: false },
      ],
    },
  ],
  1: [
    {
      type: 'packing',
      title: 'Japan Essentials',
      items: [
        { text: 'Passport', checked: true },
        { text: 'JR Pass voucher', checked: true },
        { text: 'Comfortable walking shoes', checked: true },
        { text: 'Pocket wifi reservation', checked: true },
        { text: 'Power bank', checked: false },
        { text: 'Small towel for onsen', checked: false },
        { text: 'Cash (Japan is cash-heavy)', checked: true },
        { text: 'Slip-on shoes (temples)', checked: true },
        { text: 'Light layers', checked: false },
        { text: 'Reusable shopping bag', checked: false },
      ],
    },
    {
      type: 'todo',
      title: 'Japan Prep Checklist',
      items: [
        { text: 'Activate JR Pass at station', checked: false },
        { text: 'Book Ghibli Museum tickets', checked: true },
        { text: 'Reserve teamLab Planets', checked: true },
        { text: 'Download Japan transit app', checked: true },
        { text: 'Book Sushi Saito 3 months ahead', checked: true },
        { text: 'Learn basic Japanese greetings', checked: false },
        { text: 'Get travel insurance', checked: true },
        { text: 'Register for ryokan dinner', checked: true },
      ],
    },
    {
      type: 'custom',
      title: 'Must-Try Japanese Foods',
      items: [
        { text: 'Omakase sushi', checked: false },
        { text: 'Authentic ramen (Tokyo)', checked: false },
        { text: 'Okonomiyaki (Osaka)', checked: false },
        { text: 'Kaiseki dinner', checked: false },
        { text: 'Fresh sashimi at Tsukiji', checked: false },
        { text: 'Matcha everything in Kyoto', checked: false },
        { text: 'Wagyu beef', checked: false },
        { text: 'Takoyaki (Osaka)', checked: false },
        { text: 'Convenience store onigiri', checked: false },
        { text: 'Japanese 7-Eleven treats', checked: false },
      ],
    },
  ],
};

// Combine activities and reservations for each trip
const DEMO_ACTIVITIES = {
  0: TRIP1_ACTIVITIES,
  1: TRIP2_ACTIVITIES,
};

const DEMO_RESERVATIONS = {
  0: TRIP1_RESERVATIONS,
  1: TRIP2_RESERVATIONS,
};

// ============================================================================
// Helper functions (same as before)
// ============================================================================

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: body ? JSON.parse(body) : null });
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function registerOrLoginUser(user) {
  console.log(`\n📝 Setting up user: ${user.email}`);
  const registerResponse = await makeRequest('POST', '/auth/register', {
    fullName: user.fullName, email: user.email, password: user.password,
  });

  if (registerResponse.statusCode === 201) {
    console.log(`   ✅ User registered (role: ${registerResponse.body.user.role || 'user'})`);
    return { token: registerResponse.body.accessToken, userId: registerResponse.body.user.id, role: registerResponse.body.user.role };
  } else if (registerResponse.statusCode === 409 || registerResponse.statusCode === 400) {
    const loginResponse = await makeRequest('POST', '/auth/login', { email: user.email, password: user.password });
    if (loginResponse.statusCode === 200) {
      console.log(`   ✅ User logged in (role: ${loginResponse.body.user.role || 'user'})`);
      return { token: loginResponse.body.accessToken, userId: loginResponse.body.user.id, role: loginResponse.body.user.role };
    }
    throw new Error(`Failed to login: ${JSON.stringify(loginResponse.body)}`);
  }
  throw new Error(`Failed to register: ${JSON.stringify(registerResponse.body)}`);
}

async function createTrip(tripData, token) {
  console.log(`\n🌍 Setting up trip: ${tripData.name}`);
  const listResponse = await makeRequest('GET', '/trips', null, token);
  if (listResponse.statusCode === 200 && listResponse.body.length > 0) {
    const existing = listResponse.body.find(t => t.name === tripData.name);
    if (existing) { console.log(`   ℹ️  Trip exists (ID: ${existing.id})`); return existing.id; }
  }

  const createResponse = await makeRequest('POST', '/trips', {
    name: tripData.name, destination: tripData.destination, startDate: tripData.startDate,
    endDate: tripData.endDate, budget: tripData.budget, currency: tripData.currency,
    description: tripData.description, destinationData: tripData.destinationData || null,
  }, token);

  if (createResponse.statusCode === 201) {
    console.log(`   ✅ Trip created (ID: ${createResponse.body.id})`);
    return createResponse.body.id;
  }
  throw new Error(`Failed to create trip: ${JSON.stringify(createResponse.body)}`);
}

async function createActivity(tripId, activityData, token) {
  const listResponse = await makeRequest('GET', `/trips/${tripId}/activities`, null, token);
  if (listResponse.statusCode === 200 && listResponse.body.length > 0) {
    const existing = listResponse.body.find(a => a.title === activityData.title);
    if (existing) return { exists: true, id: existing.id };
  }

  const createResponse = await makeRequest('POST', `/trips/${tripId}/activities`, activityData, token);
  if (createResponse.statusCode === 201) return { exists: false, id: createResponse.body.id };
  console.log(`      ⚠️  Failed: "${activityData.title}"`);
  return { exists: false, id: null };
}

async function createActivitiesForTrip(tripIndex, tripId, token) {
  const activities = DEMO_ACTIVITIES[tripIndex];
  if (!activities) return;

  console.log(`\n📍 Creating ${activities.length} activities for trip ${tripIndex + 1}...`);
  let created = 0, existed = 0;
  for (const activity of activities) {
    const result = await createActivity(tripId, activity, token);
    if (result.exists) existed++; else if (result.id) created++;
  }
  console.log(`   ✅ Activities: ${created} created, ${existed} existed`);
}

async function createReservationsForTrip(tripIndex, tripId, token) {
  const reservations = DEMO_RESERVATIONS[tripIndex];
  if (!reservations) return;

  console.log(`\n🏨 Creating ${reservations.length} reservations for trip ${tripIndex + 1}...`);
  let created = 0, existed = 0;
  for (const reservation of reservations) {
    const result = await createActivity(tripId, reservation, token);
    if (result.exists) existed++; else if (result.id) created++;
  }
  console.log(`   ✅ Reservations: ${created} created, ${existed} existed`);
}

async function inviteToTrip(tripId, inviteeEmail, role, token) {
  console.log(`\n👥 Inviting ${inviteeEmail} to trip ${tripId.slice(0, 8)}...`);
  const listResponse = await makeRequest('GET', `/trips/${tripId}/trip-buddies`, null, token);
  if (listResponse.statusCode === 200 && listResponse.body.find(tb => tb.email === inviteeEmail)) {
    console.log(`   ℹ️  Already invited`);
    return null;
  }

  const inviteResponse = await makeRequest('POST', `/trips/${tripId}/trip-buddies`, { email: inviteeEmail, role }, token);
  if (inviteResponse.statusCode === 201) {
    console.log(`   ✅ Invitation sent`);
    return inviteResponse.body.id;
  }
  console.log(`   ⚠️  Invitation failed (${inviteResponse.statusCode}): ${JSON.stringify(inviteResponse.body)}`);
  return null;
}

async function acceptInvitation(tripId, token) {
  const listResponse = await makeRequest('GET', '/trip-buddies/invitations', null, token);
  if (listResponse.statusCode === 200 && listResponse.body.length > 0) {
    const invitation = listResponse.body.find(inv => inv.tripId === tripId);
    if (invitation) {
      const acceptResponse = await makeRequest('POST', `/trip-buddies/${invitation.id}/accept`, {}, token);
      if (acceptResponse.statusCode === 200) {
        console.log(`   ✅ Accepted invitation for trip ${tripId.slice(0, 8)}...`);
        return true;
      }
    }
  }
  return false;
}

async function createExpense(tripId, expenseData, token) {
  const createResponse = await makeRequest('POST', `/trips/${tripId}/expenses`, expenseData, token);
  return createResponse.statusCode === 201 ? { success: true } : { success: false };
}

async function createExpensesForTrip(tripIndex, tripId, userCredentials, ownerIndex) {
  const expenses = DEMO_EXPENSES[tripIndex];
  if (!expenses) return;

  console.log(`\n💰 Creating ${expenses.length} expenses for trip ${tripIndex + 1}...`);
  const ownerUserId = userCredentials[ownerIndex].userId;
  const buddyIndex = ownerIndex === 0 ? 1 : 0;
  const buddyUserId = userCredentials[buddyIndex].userId;

  let created = 0;
  for (const expense of expenses) {
    const payerIndex = expense.payerIndex !== undefined ? expense.payerIndex : ownerIndex;
    const payerId = userCredentials[payerIndex].userId;
    const payerToken = userCredentials[payerIndex].token;
    const otherUserId = payerId === ownerUserId ? buddyUserId : ownerUserId;

    const payload = {
      payerId, amount: expense.amount, category: expense.category,
      description: expense.description, expenseDate: expense.expenseDate,
    };

    switch (expense.splitType) {
      case 'oneway':
        payload.splits = [{ userId: otherUserId, amount: expense.amount, percentage: 100 }];
        break;
      case 'equal':
        const half = Math.round((expense.amount / 2) * 100) / 100;
        payload.splits = [
          { userId: ownerUserId, amount: half, percentage: 50 },
          { userId: buddyUserId, amount: expense.amount - half, percentage: 50 },
        ];
        break;
      case 'custom':
        const [ownerPct, buddyPct] = expense.customSplits;
        payload.splits = [
          { userId: ownerUserId, amount: Math.round(expense.amount * ownerPct * 100) / 100, percentage: ownerPct * 100 },
          { userId: buddyUserId, amount: Math.round(expense.amount * buddyPct * 100) / 100, percentage: buddyPct * 100 },
        ];
        break;
      case 'settlement':
        payload.splits = [{ userId: otherUserId, amount: expense.amount, percentage: 100 }];
        break;
    }

    const result = await createExpense(tripId, payload, payerToken);
    if (result.success) created++;
  }
  console.log(`   ✅ Expenses: ${created} created`);
}

async function createList(tripId, listData, token) {
  const listResponse = await makeRequest('GET', `/trips/${tripId}/lists`, null, token);
  if (listResponse.statusCode === 200 && listResponse.body.find(l => l.title === listData.title)) {
    return { exists: true };
  }
  const createResponse = await makeRequest('POST', `/trips/${tripId}/lists`, listData, token);
  return createResponse.statusCode === 201 ? { exists: false, id: createResponse.body.id } : { exists: false };
}

async function createListsForTrip(tripIndex, tripId, token) {
  const lists = DEMO_LISTS[tripIndex];
  if (!lists) return;

  console.log(`\n📋 Creating ${lists.length} lists for trip ${tripIndex + 1}...`);
  let created = 0, existed = 0;
  for (const list of lists) {
    const result = await createList(tripId, list, token);
    if (result.exists) existed++; else if (result.id) created++;
  }
  console.log(`   ✅ Lists: ${created} created, ${existed} existed`);
}

// ============================================================================
// Main
// ============================================================================

// Helper to wait for rate limit reset
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function seedDemoData() {
  console.log('🚀 Starting comprehensive demo data seed...\n');
  console.log(`📍 API URL: ${API_URL}${API_BASE}\n`);

  try {
    // Step 1: Users
    const userCredentials = [];
    for (const user of DEMO_USERS) {
      userCredentials.push(await registerOrLoginUser(user));
    }

    // Step 2: Trips
    const tripIds = [];
    for (let i = 0; i < DEMO_TRIPS.length; i++) {
      const tripData = DEMO_TRIPS[i];
      const tripId = await createTrip(tripData, userCredentials[tripData.userIndex].token);
      tripIds.push({ id: tripId, userIndex: tripData.userIndex });
    }

    // Step 3: Activities for Trip 1 (36 activities × 2 requests = 72 requests)
    await createActivitiesForTrip(0, tripIds[0].id, userCredentials[tripIds[0].userIndex].token);

    // Wait for rate limit reset (100 requests/minute limit)
    console.log('\n⏳ Waiting for rate limit reset (1/2)...');
    await sleep(61000);

    // Step 4: Activities for Trip 2 (44 activities × 2 requests = 88 requests)
    await createActivitiesForTrip(1, tripIds[1].id, userCredentials[tripIds[1].userIndex].token);

    // Wait for rate limit reset again
    console.log('\n⏳ Waiting for rate limit reset (2/2)...');
    await sleep(61000);

    // Step 5: Reservations for Trip 1
    await createReservationsForTrip(0, tripIds[0].id, userCredentials[tripIds[0].userIndex].token);

    // Step 6: Reservations for Trip 2
    await createReservationsForTrip(1, tripIds[1].id, userCredentials[tripIds[1].userIndex].token);

    // Step 7: Invitations
    await inviteToTrip(tripIds[0].id, DEMO_USERS[1].email, 'editor', userCredentials[0].token);
    await inviteToTrip(tripIds[1].id, DEMO_USERS[0].email, 'editor', userCredentials[1].token);

    // Step 8: Accept invitations
    console.log('\n🤝 Accepting invitations...');
    await acceptInvitation(tripIds[0].id, userCredentials[1].token);
    await acceptInvitation(tripIds[1].id, userCredentials[0].token);

    // Step 9: Expenses
    for (let i = 0; i < tripIds.length; i++) {
      await createExpensesForTrip(i, tripIds[i].id, userCredentials, tripIds[i].userIndex);
    }

    // Step 10: Lists
    for (let i = 0; i < tripIds.length; i++) {
      await createListsForTrip(i, tripIds[i].id, userCredentials[tripIds[i].userIndex].token);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Demo data seed completed successfully!');
    console.log('='.repeat(60));
    console.log('\n📧 Demo Accounts:');
    console.log(`   • Alice: ${DEMO_USERS[0].email} / ${DEMO_USERS[0].password} (ADMIN)`);
    console.log(`   • Bob: ${DEMO_USERS[1].email} / ${DEMO_USERS[1].password}`);
    console.log('\n📊 Trip 1: "European Adventure" (14 days)');
    console.log('   • Cities: Paris → Loire Valley → Lyon → Nice → Monaco');
    console.log('   • Lodging: 2 hotels, 2 rentals (B&B, apartment)');
    console.log('   • Transport: Flights, TGV trains, buses');
    console.log('   • Activities: Museums, monuments, parks, markets, shopping');
    console.log('   • Dining: Michelin restaurants, cafés, bars');
    console.log('\n📊 Trip 2: "Japan Discovery" (14 days)');
    console.log('   • Cities: Tokyo → Hakone → Kyoto → Nara → Osaka → Hiroshima');
    console.log('   • Lodging: 2 hotels, 1 ryokan, 1 hostel');
    console.log('   • Transport: Flights, Shinkansen, local trains, ferries');
    console.log('   • Activities: Temples, shrines, museums, markets, shopping');
    console.log('   • Dining: Sushi omakase, ramen, kaiseki, cocktail bars');
    console.log('\n🎉 Login and explore the demo trips!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

seedDemoData();
