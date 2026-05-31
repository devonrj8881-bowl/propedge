#!/usr/bin/env node

/**
 * Initialize PropEdge pace data storage
 * Creates pace-db.json for storing player pace data and predictions
 * No external dependencies required - pure Node.js
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'propedge-data.json');

// Sample players to track
const initialData = {
  version: '1.0.0',
  lastSync: null,
  players: [
    { id: 1, espnId: '4396', name: 'Stephen Curry', team: 'GSW', position: 'PG', createdAt: new Date().toISOString() },
    { id: 2, espnId: '6442', name: 'LeBron James', team: 'LAL', position: 'SF', createdAt: new Date().toISOString() },
    { id: 3, espnId: '4265', name: 'Luka Doncic', team: 'DAL', position: 'PG', createdAt: new Date().toISOString() },
    { id: 4, espnId: '2991371', name: 'Jayson Tatum', team: 'BOS', position: 'SF', createdAt: new Date().toISOString() },
    { id: 5, espnId: '4047', name: 'Kevin Durant', team: 'PHX', position: 'SF', createdAt: new Date().toISOString() },
  ],
  paceData: [], // Array of { playerId, date, pace, possessions, minutes, source }
  predictions: [], // Array of { playerId, predictionDate, predictedPace, trend, volatility, ma7, ma14, confidence }
};

try {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    console.log(`✅ Database initialized at ${dbPath}`);
  } else {
    console.log(`ℹ️ Database already exists at ${dbPath}`);
  }
} catch (error) {
  console.error('❌ Error initializing database:', error.message);
  process.exit(1);
}
