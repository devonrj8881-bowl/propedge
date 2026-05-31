# Phase 3.5 - Full Implementation Guide

**Status:** Starting Implementation
**Stack:** Firebase + Netlify Functions + Express.js Backend (optional)
**Timeline:** 6-10 weeks (aggressive: 4-6 weeks with focus)
**Date Started:** April 2, 2026

---

## Implementation Architecture

```
┌──────────────────────────────────────────┐
│      PropEdge Frontend (Netlify)         │
│    Updated with Auth, Watchlist, etc.    │
└────────────────┬─────────────────────────┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
    ┌──────────┐    ┌──────────────────┐
    │ Netlify  │    │  Express.js      │
    │Functions │    │  Backend (Optional│
    │(Quick API│    │  for ML/Heavy    │
    │ calls)   │    │  Compute)        │
    └────┬─────┘    └────┬─────────────┘
         │               │
         └───────┬───────┘
                 ↓
         ┌───────────────┐
         │   Firebase    │
         │   Firestore   │
         │   (Database)  │
         └───────┬───────┘
                 │
         ┌───────┴────────┐
         ↓                ↓
    ┌─────────┐   ┌───────────┐
    │ ESPN    │   │ The-Odds  │
    │ API     │   │ API       │
    └─────────┘   └───────────┘
```

---

## TIER 1: Firebase Setup & Data Integration

### Step 1.1: Create Firebase Project

**What you need:**
1. Google account
2. Firebase Console (firebase.google.com)

**Steps:**
```bash
# 1. Go to https://console.firebase.google.com
# 2. Click "Create Project"
# 3. Name: "PropEdge"
# 4. Enable Google Analytics (optional)
# 5. Create project

# 6. Install Firebase CLI
npm install -g firebase-tools

# 7. Login to Firebase
firebase login

# 8. Initialize Firebase in your project
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
firebase init firestore
firebase init auth
firebase init functions
```

**What gets created:**
```
propedge/
├─ firebase.json (config)
├─ firestore.rules (security rules)
├─ firestore.indexes.json
└─ functions/
   ├─ index.js (cloud functions)
   └─ package.json
```

**Deliverable:** ✅ Firebase project created and initialized

---

### Step 1.2: Design Firestore Database Schema

**Create these collections:**

#### Collection 1: `users`
```javascript
{
  uid: "firebase_uid_here",
  email: "devon@example.com",
  displayName: "Devon Johnson",
  createdAt: timestamp,
  preferences: {
    defaultLeague: "NBA",
    darkMode: true,
    refreshRate: 15,  // minutes
    notificationFrequency: "daily"  // or "realtime", "weekly"
  },
  watchlist: ["player_id_1", "player_id_2"],
  alerts: ["alert_id_1", "alert_id_2"],
  stats: {
    totalEdges: 0,
    profitLoss: 0,
    hitRate: 0,
    roiPercentage: 0
  }
}
```

#### Collection 2: `pace_data`
```javascript
{
  playerId: "nba_123",
  playerName: "Luka Doncic",
  league: "NBA",
  date: timestamp,
  season: 2025,

  // Current game
  currentPace: 100.2,
  opponentPace: 98.5,
  paceEdge: 1.7,
  edgePercentage: 1.72,

  // Season stats
  seasonAvgPace: 99.8,
  last10AvgPace: 100.5,
  last5AvgPace: 101.2,
  seasonHigh: 105.3,
  seasonLow: 94.2,

  // Trends
  paceVsAverage: 0.4,  // +0.4 above season average
  trendDirection: "up",  // "up", "down", "stable"
  volatility: 2.3,

  // Context
  homeAway: "home",
  oppRank: 12,  // opponent pace rank
  confidence: 0.89  // based on sample size
}
```

#### Collection 3: `predictions`
```javascript
{
  predictionId: "pred_123",
  playerId: "nba_123",
  playerName: "Luka Doncic",
  gameDate: timestamp,
  league: "NBA",

  // Prediction
  predictedPace: 99.5,
  confidenceInterval: {
    low: 97.2,
    high: 101.8
  },
  modelVersion: "v1.0",

  // Actual (filled after game)
  actualPace: null,
  wasCorrect: null,  // true/false after game
  errorMargin: null,  // |predicted - actual|

  createdAt: timestamp,
  gameTime: timestamp
}
```

#### Collection 4: `alerts`
```javascript
{
  alertId: "alert_123",
  userId: "user_uid",
  type: "pace_edge",  // or "price_movement", "sharp_money", "game_time"

  // Trigger settings
  trigger: {
    metric: "pace_edge",  // what to monitor
    operator: ">",  // ">", "<", "==", "between"
    value: 2.0,  // threshold
    league: "NBA"  // or "ALL"
  },

  // Notification settings
  frequency: "realtime",  // or "daily_digest", "weekly"
  channels: ["email", "in_app"],

  // Status
  isActive: true,
  lastTriggered: timestamp,
  triggerCount: 5,

  createdAt: timestamp
}
```

#### Collection 5: `edge_tracking`
```javascript
{
  edgeId: "edge_123",
  userId: "user_uid",

  // Edge details
  playerId: "nba_123",
  playerName: "Luka Doncic",
  league: "NBA",
  paceEdge: 2.5,

  // Bet details
  betAmount: 100,
  oddsBet: -110,

  // Game result (filled after)
  gameDate: timestamp,
  actualPace: null,
  result: null,  // "win", "loss", "push"
  payout: null,
  roi: null,  // (payout - betAmount) / betAmount

  createdAt: timestamp,
  resultAt: timestamp
}
```

#### Collection 6: `price_history`
```javascript
{
  priceId: "price_123",
  propId: "prop_456",
  playerName: "Luka Doncic",
  marketName: "Points Over 22.5",

  bookCode: "draftkings",  // draftkings, fanduel, betmgm, etc.

  // Price data
  odds: -110,
  decimalOdds: 1.909,
  impliedProb: 0.524,

  // Movement tracking
  openingOdds: -130,
  openingTime: timestamp,
  currentTime: timestamp,

  // Sharp indicators
  sharpPercent: 45,  // % of sharp action on this side
  publicPercent: 75,  // % of public action on this side

  recordedAt: timestamp
}
```

#### Collection 7: `analytics_snapshots`
```javascript
{
  snapshotId: "snap_123",
  userId: "user_uid",
  snapshotDate: timestamp,

  // Performance metrics
  totalEdges: 100,
  winningEdges: 67,
  hitRate: 0.67,

  roiPercentage: 12.5,
  profitLoss: 1250,

  // By league
  byLeague: {
    NBA: { hitRate: 0.70, roi: 15.2 },
    NFL: { hitRate: 0.62, roi: 8.5 },
    NHL: { hitRate: 0.64, roi: 10.1 },
    MLB: { hitRate: 0.65, roi: 11.3 }
  },

  // Trends
  hitRateTrend: "up",  // vs previous week
  roiTrend: "stable"
}
```

**Deliverable:** ✅ Database schema designed

---

### Step 1.3: Set Up Firestore Rules (Security)

**Create file: `firestore.rules`**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Pace data is public read
    match /pace_data/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.admin == true;
    }

    // Predictions are public read
    match /predictions/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.admin == true;
    }

    // Alerts are user-specific
    match /alerts/{alertId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }

    // Edge tracking is user-specific
    match /edge_tracking/{edgeId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }

    // Price history is public read
    match /price_history/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.admin == true;
    }

    // Analytics are user-specific
    match /analytics_snapshots/{snapshotId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }
  }
}
```

**Deploy rules:**
```bash
firebase deploy --only firestore:rules
```

**Deliverable:** ✅ Firestore security rules deployed

---

### Step 1.4: Create Netlify Functions for API Calls

**Create file: `netlify/functions/espn-pace.js`**

```javascript
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase (use environment variable)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  // GET /api/espn-pace?league=NBA

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const league = event.queryStringParameters?.league || 'NBA';

  try {
    // Check cache in Firestore (if < 15 minutes old)
    const cacheRef = db.collection('cache').doc(`pace_${league}`);
    const cacheDoc = await cacheRef.get();

    if (cacheDoc.exists) {
      const cached = cacheDoc.data();
      const age = (Date.now() - cached.timestamp) / 1000 / 60;  // minutes

      if (age < 15) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            data: cached.data,
            source: 'cache',
            ageMinutes: Math.floor(age)
          })
        };
      }
    }

    // Fetch fresh data from ESPN API
    const paceData = await fetchFromEspn(league);

    // Store in Firestore
    await cacheRef.set({
      data: paceData,
      timestamp: Date.now(),
      league: league
    });

    // Also store individual documents in pace_data collection
    for (const player of paceData.players) {
      const docId = `${league}_${player.playerId}_${new Date().toISOString().split('T')[0]}`;
      await db.collection('pace_data').doc(docId).set({
        ...player,
        league: league,
        date: admin.firestore.Timestamp.now()
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: paceData,
        source: 'live',
        league: league
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Fetch pace data from ESPN API
async function fetchFromEspn(league) {
  try {
    // Example: ESPN API endpoint (you need to research actual endpoint)
    const url = `https://site.api.espn.com/v2/site/events?league=${league.toLowerCase()}`;

    const response = await fetch(url);
    const data = await response.json();

    // Parse and calculate pace metrics
    const players = [];

    // This is pseudo-code - actual ESPN data parsing will vary
    if (data.events) {
      for (const event of data.events) {
        for (const competitor of event.competitors || []) {
          // Calculate player pace
          const pace = calculatePace(competitor, event);

          players.push({
            playerId: competitor.id,
            playerName: competitor.displayName,
            currentPace: pace.current,
            opponentPace: pace.opponent,
            paceEdge: pace.edge,
            edgePercentage: pace.edgePercent,
            // ... other fields
          });
        }
      }
    }

    return { players, timestamp: Date.now() };

  } catch (error) {
    console.error('ESPN API error:', error);
    throw new Error(`Failed to fetch ESPN data: ${error.message}`);
  }
}

function calculatePace(competitor, event) {
  // Possession-based pace calculation
  // pace = (possessions / 48) * 100
  // This is simplified - real calculation needs game stats

  const possessions = competitor.stats?.possessions || 100;
  const timeElapsed = event.status?.period || 4;  // quarters

  const pace = (possessions / (timeElapsed * 12)) * 100;
  const opponentPace = 99;  // placeholder

  return {
    current: Math.round(pace * 10) / 10,
    opponent: opponentPace,
    edge: Math.round((pace - opponentPace) * 10) / 10,
    edgePercent: Math.round(((pace - opponentPace) / opponentPace) * 1000) / 10
  };
}
```

**Deploy to Netlify:**
```bash
# Add to netlify.toml
[build]
  functions = "netlify/functions"
  command = "npm run build"

[env]
  FIREBASE_PROJECT_ID = "your-project-id"
  FIREBASE_DATABASE_URL = "your-database-url"
```

**Deliverable:** ✅ Netlify Functions created for API calls

---

## TIER 2: Advanced Analytics Implementation

### Step 2.1: Build Pace Trend Analyzer

**Create file: `frontend/pace-analyzer.js`**

```javascript
class PaceTrendAnalyzer {
  /**
   * Analyze pace trends for a player
   */
  static analyzeTrend(paceHistory) {
    // paceHistory = [{ date, pace }, ...]

    const trend = {
      trend: 'stable',  // 'up', 'down', 'stable'
      direction: '→',  // ↑, ↓, →
      slope: 0,
      volatility: 0,
      movingAvg3: [],
      movingAvg5: [],
      movingAvg10: [],
      forecast: null
    };

    if (paceHistory.length < 2) return trend;

    // Calculate moving averages
    trend.movingAvg3 = this.calculateMovingAverage(paceHistory, 3);
    trend.movingAvg5 = this.calculateMovingAverage(paceHistory, 5);
    trend.movingAvg10 = this.calculateMovingAverage(paceHistory, 10);

    // Calculate slope (linear regression)
    const slope = this.calculateSlope(paceHistory);
    trend.slope = Math.round(slope * 100) / 100;

    // Determine trend direction
    if (slope > 0.2) {
      trend.trend = 'up';
      trend.direction = '↑';
    } else if (slope < -0.2) {
      trend.trend = 'down';
      trend.direction = '↓';
    } else {
      trend.trend = 'stable';
      trend.direction = '→';
    }

    // Calculate volatility (standard deviation)
    trend.volatility = this.calculateVolatility(paceHistory);

    // Forecast next value
    trend.forecast = this.forecastNextPace(paceHistory);

    return trend;
  }

  static calculateMovingAverage(data, window) {
    const averages = [];
    for (let i = 0; i <= data.length - window; i++) {
      const sum = data.slice(i, i + window).reduce((acc, d) => acc + d.pace, 0);
      averages.push(Math.round((sum / window) * 10) / 10);
    }
    return averages;
  }

  static calculateSlope(data) {
    // Simple linear regression
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = data[i].pace;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  static calculateVolatility(data) {
    const avg = data.reduce((sum, d) => sum + d.pace, 0) / data.length;
    const variance = data.reduce((sum, d) => sum + Math.pow(d.pace - avg, 2), 0) / data.length;
    return Math.round(Math.sqrt(variance) * 10) / 10;
  }

  static forecastNextPace(data) {
    // Simple forecast using last value + slope
    const slope = this.calculateSlope(data);
    const lastPace = data[data.length - 1].pace;
    return Math.round((lastPace + slope) * 10) / 10;
  }

  /**
   * Calculate momentum score (-100 to +100)
   */
  static getMomentumScore(player) {
    const currentPace = player.currentPace;
    const seasonAvg = player.seasonAvgPace;

    const diff = currentPace - seasonAvg;
    const pctDiff = (diff / seasonAvg) * 100;

    // Scale to -100 to +100
    const momentum = Math.max(-100, Math.min(100, pctDiff * 10));

    return Math.round(momentum);
  }
}
```

**Deliverable:** ✅ Pace trend analyzer built

---

### Step 2.2: Build Prediction Engine (Python)

**Create file: `backend/pace_predictor.py`**

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
import firebase_admin
from firebase_admin import credentials, firestore
import os
from datetime import datetime, timedelta

# Initialize Firebase
cred = credentials.Certificate('service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

class PacePredictorML:
    def __init__(self):
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5
        )
        self.scaler = StandardScaler()
        self.is_trained = False

    def train(self, training_data):
        """
        Train the model on historical data
        training_data = [
            {
                'playerPace': 99.5,
                'opponentPace': 98.2,
                'seasonAvgPace': 99.1,
                'last10Pace': 100.2,
                'homeAway': 'home',  (encode as 1/-1)
                'oppRank': 12,  (opponent pace rank)
                'dayOfWeek': 3,  (0-6)
                'restDays': 1,
                'actualPace': 99.8  (target)
            }
        ]
        """

        df = pd.DataFrame(training_data)

        # Prepare features and target
        feature_cols = [
            'playerPace', 'opponentPace', 'seasonAvgPace',
            'last10Pace', 'homeAway', 'oppRank', 'dayOfWeek', 'restDays'
        ]

        X = df[feature_cols]
        y = df['actualPace']

        # Normalize features
        X_scaled = self.scaler.fit_transform(X)

        # Train model
        self.model.fit(X_scaled, y)
        self.is_trained = True

        # Calculate accuracy
        predictions = self.model.predict(X_scaled)
        mse = np.mean((predictions - y) ** 2)
        rmse = np.sqrt(mse)

        return {
            'trained': True,
            'rmse': round(rmse, 2),
            'samples': len(training_data)
        }

    def predict(self, player_features):
        """
        Predict pace for upcoming game
        """
        if not self.is_trained:
            raise Exception("Model not trained yet")

        # Prepare features
        feature_array = np.array([[
            player_features['playerPace'],
            player_features['opponentPace'],
            player_features['seasonAvgPace'],
            player_features['last10Pace'],
            player_features['homeAway'],  # 1 or -1
            player_features['oppRank'],
            player_features['dayOfWeek'],
            player_features['restDays']
        ]])

        # Scale and predict
        feature_scaled = self.scaler.transform(feature_array)
        prediction = self.model.predict(feature_scaled)[0]

        # Calculate confidence interval (±)
        std_dev = self.model.estimators_[0].tree_.feature  # simplified
        confidence_interval = (
            round(prediction - 2.5, 1),
            round(prediction + 2.5, 1)
        )

        return {
            'predicted_pace': round(prediction, 1),
            'confidence_low': confidence_interval[0],
            'confidence_high': confidence_interval[1],
            'confidence_score': 0.85  # placeholder
        }

    def evaluate_accuracy(self, actual_pace, predicted_pace):
        """After game, track if prediction was correct"""
        error = abs(actual_pace - predicted_pace)
        was_correct = error < 2.0  # within 2.0 pace

        return {
            'error': round(error, 1),
            'was_correct': was_correct,
            'accuracy_percent': max(0, 100 - (error * 10))
        }

    def save_model(self, filename='pace_model.pkl'):
        """Save trained model"""
        import pickle
        with open(filename, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'scaler': self.scaler
            }, f)

    def load_model(self, filename='pace_model.pkl'):
        """Load saved model"""
        import pickle
        with open(filename, 'rb') as f:
            data = pickle.load(f)
            self.model = data['model']
            self.scaler = data['scaler']
            self.is_trained = True


# Firebase functions
async def fetch_training_data():
    """Get historical data for training"""

    docs = db.collection('pace_data').stream()
    training_data = []

    for doc in docs:
        data = doc.to_dict()
        training_data.append({
            'playerPace': data.get('currentPace', 0),
            'opponentPace': data.get('opponentPace', 0),
            'seasonAvgPace': data.get('seasonAvgPace', 0),
            'last10Pace': data.get('last10AvgPace', 0),
            'homeAway': 1 if data.get('homeAway') == 'home' else -1,
            'oppRank': data.get('oppRank', 15),
            'dayOfWeek': data.get('date').weekday(),
            'restDays': 1,  # would need to calculate
            'actualPace': data.get('actualPace', 0)
        })

    return training_data


async def generate_predictions(league='NBA'):
    """Generate predictions for upcoming games"""

    # Get players to predict
    players_ref = db.collection('pace_data').where('league', '==', league)
    players = []

    for doc in players_ref.stream():
        players.append(doc.to_dict())

    # Load model
    predictor = PacePredictorML()
    predictor.load_model()

    # Generate predictions
    predictions = []
    for player in players:
        pred = predictor.predict({
            'playerPace': player.get('currentPace', 99),
            'opponentPace': player.get('opponentPace', 99),
            'seasonAvgPace': player.get('seasonAvgPace', 99),
            'last10Pace': player.get('last10AvgPace', 99),
            'homeAway': 1,
            'oppRank': player.get('oppRank', 15),
            'dayOfWeek': datetime.now().weekday(),
            'restDays': 1
        })

        # Store in Firestore
        db.collection('predictions').add({
            'playerId': player['playerId'],
            'playerName': player['playerName'],
            'league': league,
            'predictedPace': pred['predicted_pace'],
            'confidenceInterval': {
                'low': pred['confidence_low'],
                'high': pred['confidence_high']
            },
            'modelVersion': 'v1.0',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'gameDate': datetime.now() + timedelta(days=1)
        })

        predictions.append(pred)

    return predictions
```

**Deliverable:** ✅ ML prediction engine built

---

## TIER 3: User Features Implementation

### Step 3.1: Frontend Authentication Update

**Create file: `frontend/auth.js`**

```javascript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// Initialize Firebase (get config from Firebase Console)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "propedge-xxx.firebaseapp.com",
  projectId: "propedge-xxx",
  storageBucket: "propedge-xxx.appspot.com",
  messagingSenderId: "xxx",
  appId: "xxx"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// Sign up
export async function signUp(email, password, displayName) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // Create user document
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: email,
      displayName: displayName,
      createdAt: new Date(),
      preferences: {
        defaultLeague: 'NBA',
        darkMode: false,
        refreshRate: 15,
        notificationFrequency: 'daily'
      },
      watchlist: [],
      alerts: [],
      stats: {
        totalEdges: 0,
        profitLoss: 0,
        hitRate: 0,
        roiPercentage: 0
      }
    });

    return user;
  } catch (error) {
    throw new Error(`Sign up failed: ${error.message}`);
  }
}

// Sign in
export async function signIn(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    throw new Error(`Sign in failed: ${error.message}`);
  }
}

// Sign out
export async function logOut() {
  try {
    await signOut(auth);
    currentUser = null;
  } catch (error) {
    throw new Error(`Sign out failed: ${error.message}`);
  }
}

// Listen for auth changes
export function onAuthChange(callback) {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      callback(userDoc.data());
    } else {
      callback(null);
    }
  });
}

// Get current user
export function getCurrentUser() {
  return currentUser;
}

// Update user preferences
export async function updatePreferences(userId, preferences) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { preferences }, { merge: true });
  } catch (error) {
    throw new Error(`Update failed: ${error.message}`);
  }
}
```

**Deliverable:** ✅ Firebase Auth integrated

### Step 3.2: Build Watchlist Feature

**Create file: `frontend/watchlist.js`**

```javascript
import { getFirestore, doc, updateDoc, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const db = getFirestore();

export async function addToWatchlist(userId, playerId) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    watchlist: arrayUnion(playerId)
  });
}

export async function removeFromWatchlist(userId, playerId) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    watchlist: arrayRemove(playerId)
  });
}

export async function getWatchlist(userId) {
  // Fetch from user document
  // Filter pace_data to only show watchlist players
}

export function renderWatchlistTab(users) {
  // Create "My Watchlist" tab in navigation
  const tab = document.createElement('div');
  tab.className = 'tab-button';
  tab.textContent = '⭐ Watchlist';
  tab.addEventListener('click', () => {
    showWatchlistView(users);
  });
  return tab;
}

export function renderWatchlistView(paceData, watchlist) {
  const filtered = paceData.filter(p => watchlist.includes(p.playerId));

  // Render same as pace tab but filtered to watchlist only
  return filtered.map(player => renderPaceCard(player));
}
```

**Deliverable:** ✅ Watchlist feature built

### Step 3.3: Build Alerts System

**Create file: `frontend/alerts.js`**

```javascript
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, where, query } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const db = getFirestore();

export async function createAlert(userId, alertConfig) {
  /**
   * alertConfig = {
   *   type: 'pace_edge',
   *   trigger: { metric: 'pace_edge', operator: '>', value: 2.0, league: 'NBA' },
   *   frequency: 'realtime',
   *   channels: ['email', 'in_app']
   * }
   */

  const docRef = await addDoc(collection(db, 'alerts'), {
    userId: userId,
    ...alertConfig,
    isActive: true,
    lastTriggered: null,
    triggerCount: 0,
    createdAt: new Date()
  });

  return docRef.id;
}

export async function getAlerts(userId) {
  const q = query(collection(db, 'alerts'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function updateAlert(alertId, updates) {
  const alertRef = doc(db, 'alerts', alertId);
  await updateDoc(alertRef, updates);
}

export async function deleteAlert(alertId) {
  await deleteDoc(doc(db, 'alerts', alertId));
}

export async function checkTriggers(userId, currentData) {
  /**
   * Check all alerts for a user against current data
   * Trigger notifications if conditions met
   */

  const alerts = await getAlerts(userId);

  for (const alert of alerts) {
    if (!alert.isActive) continue;

    // Check if trigger condition is met
    const triggered = checkTriggerCondition(alert.trigger, currentData);

    if (triggered) {
      // Send notification
      await sendNotification(userId, alert);

      // Update last triggered time
      await updateAlert(alert.id, {
        lastTriggered: new Date(),
        triggerCount: alert.triggerCount + 1
      });
    }
  }
}

function checkTriggerCondition(trigger, data) {
  const value = data[trigger.metric];  // pace_edge, etc.

  switch(trigger.operator) {
    case '>': return value > trigger.value;
    case '<': return value < trigger.value;
    case '==': return value === trigger.value;
    case 'between': return value >= trigger.value[0] && value <= trigger.value[1];
    default: return false;
  }
}

async function sendNotification(userId, alert) {
  // Send email notification
  // In-app notification badge
  // Push notification (if enabled)
}
```

**Deliverable:** ✅ Alerts system built

---

## TIER 4: Database & Analytics

### Step 4.1: Edge Tracking

**Create file: `frontend/edge-tracker.js`**

```javascript
import { getFirestore, collection, addDoc, updateDoc, doc } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const db = getFirestore();

export async function recordEdge(userId, edgeData) {
  /**
   * edgeData = {
   *   playerId: 'nba_123',
   *   playerName: 'Luka Doncic',
   *   league: 'NBA',
   *   paceEdge: 2.5,
   *   betAmount: 100,
   *   oddsBet: -110,
   *   gameDate: timestamp
   * }
   */

  const docRef = await addDoc(collection(db, 'edge_tracking'), {
    userId: userId,
    ...edgeData,
    result: null,  // filled after game
    createdAt: new Date()
  });

  return docRef.id;
}

export async function updateEdgeResult(edgeId, actualPace, odds) {
  // Determine if edge won or lost
  // Calculate ROI

  const result = actualPace > (expectedPace + 2) ? 'win' : 'loss';
  const payout = result === 'win' ? betAmount * (1 + odds/100) : 0;
  const roi = ((payout - betAmount) / betAmount) * 100;

  await updateDoc(doc(db, 'edge_tracking', edgeId), {
    actualPace: actualPace,
    result: result,
    payout: payout,
    roi: roi,
    resultAt: new Date()
  });
}
```

**Deliverable:** ✅ Edge tracking implemented

### Step 4.2: Analytics Dashboard

**Create file: `frontend/analytics-dashboard.js`**

```javascript
export function renderAnalyticsDashboard(userStats) {
  const dashboard = document.createElement('div');
  dashboard.className = 'analytics-dashboard';

  // Summary cards
  dashboard.innerHTML = `
    <div class="analytics-section">
      <h2>Your Performance</h2>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${userStats.totalEdges}</div>
          <div class="stat-label">Total Edges</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">${(userStats.hitRate * 100).toFixed(1)}%</div>
          <div class="stat-label">Hit Rate</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">${userStats.roiPercentage.toFixed(1)}%</div>
          <div class="stat-label">ROI</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">$${userStats.profitLoss.toFixed(0)}</div>
          <div class="stat-label">Profit/Loss</div>
        </div>
      </div>

      <h3>By League</h3>
      <div class="league-breakdown">
        ${Object.entries(userStats.byLeague).map(([league, stats]) => `
          <div class="league-stat">
            <span>${league}</span>
            <span>${(stats.hitRate * 100).toFixed(0)}%</span>
            <span>${stats.roi.toFixed(1)}% ROI</span>
          </div>
        `).join('')}
      </div>

      <h3>Profit Trend</h3>
      <canvas id="profit-chart"></canvas>

      <h3>Hit Rate Trend</h3>
      <canvas id="hitrate-chart"></canvas>
    </div>
  `;

  return dashboard;
}
```

**Deliverable:** ✅ Analytics dashboard created

---

## Integration Checklist

- [ ] Firebase project created and configured
- [ ] Firestore database schema created
- [ ] Security rules deployed
- [ ] Netlify Functions set up for ESPN API
- [ ] Frontend auth pages created (login, signup)
- [ ] Watchlist UI integrated
- [ ] Alerts system functional
- [ ] Pace trend analyzer working
- [ ] ML model trained and deployed
- [ ] Edge tracking logging
- [ ] Analytics dashboard displaying
- [ ] Price history database working
- [ ] End-to-end testing complete
- [ ] Deployed to production

---

## Deployment Steps

1. **Firebase:**
```bash
firebase deploy
```

2. **Netlify Functions:**
```bash
netlify deploy --prod
```

3. **Update index.html** with Firebase config

4. **Test authentication flow**

5. **Verify all APIs working**

6. **Deploy to production**

---

## Timeline Estimate

- **Week 1:** Firebase setup + Data integration (ESPN API)
- **Week 2:** Pace calculations + trend analyzer
- **Week 3:** User auth + watchlist + alerts
- **Week 4:** ML predictions + training
- **Week 5:** Edge tracking + analytics
- **Week 6:** Testing, optimization, deployment

**Total: 4-6 weeks for full implementation**

---

**Status:** Ready to implement
**Next Step:** Set up Firebase project and create service account key
