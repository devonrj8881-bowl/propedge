# Phase 3.5 - PropEdge Advanced Features & Data Integration

**Status:** Planning & Architecture
**Target Timeline:** 6-10 weeks
**Priority:** Data Integration → Analytics → User Features → Database
**Date Started:** April 2, 2026

---

## Overview

Phase 3.5 transforms PropEdge from a static prop viewer to a **dynamic analytics platform** with real-time data, predictive insights, and personalized user experiences.

### Current State (Phase 3)
- ✅ Mock pace data (5 sample players)
- ✅ Multi-book odds display
- ✅ Sharp money detection
- ✅ Live game clocks
- ❌ No persistent user accounts
- ❌ No historical data tracking
- ❌ No predictions/ML models

### Target State (Phase 3.5)
- ✅ Real live ESPN pace data
- ✅ Historical trend analysis
- ✅ ML-powered matchup predictions
- ✅ User accounts & watchlists
- ✅ Custom alerts system
- ✅ Price history tracking
- ✅ Performance analytics

---

## Phase 3.5 Detailed Breakdown

### TIER 1: Data Integration (Weeks 1-2)

**Goal:** Replace mock data with real ESPN API data

#### 1.1 ESPN API Setup
- Research ESPN API available endpoints
- Document available pace metrics
- Set up API credentials and rate limiting
- Build error handling & fallbacks

**Implementation:**
```javascript
// Current: Mock data in paceDatabase array
paceDatabase: [
  { player: "Luka Doncic", playerPace: 100.2, opponentPace: 98.5, ... },
  ...
]

// Target: Real-time ESPN data
async function fetchLiveEspnPaceData(league) {
  // Fetch from ESPN API
  // Parse pace metrics
  // Cache results
  // Return formatted data
}
```

**Deliverables:**
- [ ] ESPN API integration complete
- [ ] Live pace metrics for all 4 leagues
- [ ] Caching strategy implemented
- [ ] Rate limiting handled
- [ ] Error fallbacks in place

#### 1.2 Pace Metric Calculations
- Player pace (possessions per 48 minutes)
- Opponent pace (how fast opponent plays)
- Pace differential (advantage calculation)
- Confidence scores (based on sample size)

**Data Points to Calculate:**
- Season average pace
- Last 10 games pace trend
- Home/away pace splits
- Matchup-specific pace adjustments
- Heat index (how hot/cold vs usual)

**Deliverables:**
- [ ] Pace calculation engine built
- [ ] All metrics computed from ESPN data
- [ ] Trend analysis working
- [ ] Splits analysis working
- [ ] Heat index displaying

#### 1.3 Data Refresh Strategy
- Implement auto-refresh (every 15-30 minutes during games)
- Build background fetch system
- Handle stale data gracefully
- Show last-update timestamp

**Deliverables:**
- [ ] Auto-refresh every 15 min
- [ ] Background fetches don't block UI
- [ ] Stale data warnings shown
- [ ] Timestamp displayed on all data

---

### TIER 2: Advanced Analytics (Weeks 3-4)

**Goal:** Build predictive engines and historical analysis

#### 2.1 Historical Trend Analysis
- Track pace changes over season
- Identify momentum shifts
- Calculate volatility metrics
- Generate trend forecasts

**Features:**
- Last 10 games pace chart (line graph)
- Season-long pace trend
- Moving averages (3, 5, 10 game)
- Uptrend/downtrend badges
- Trend confidence scores

**Implementation:**
```javascript
class PaceTrendAnalyzer {
  calculateTrend(playerPaceHistory) {
    // Linear regression on pace data
    // Calculate volatility
    // Forecast next game
    // Return trend metadata
  }

  getMomentumScore(player) {
    // Current pace vs season average
    // Trend direction (↑ ↓ →)
    // Score: -100 to +100
  }
}
```

**Deliverables:**
- [ ] Trend analyzer class built
- [ ] Historical data collected
- [ ] Charts displaying trends
- [ ] Momentum scoring working
- [ ] Forecasts generating

#### 2.2 Player Correlation Analysis
- Find teammates with similar pace patterns
- Identify opposing players with complementary/adverse pace
- Build matchup matrices
- Calculate synergy scores

**Features:**
- "Players like this" recommendations
- Matchup charts (favorable/unfavorable)
- Synergy heatmaps
- Correlation strength indicators

**Deliverables:**
- [ ] Correlation engine built
- [ ] Matchup matrices calculated
- [ ] Similar players identified
- [ ] Synergy scores computed

#### 2.3 ML Predictions (Optional - Advanced)
- Build pace prediction model (XGBoost or similar)
- Train on historical data
- Generate game-by-game predictions
- Show confidence intervals

**Features:**
- Predicted pace for upcoming game
- Confidence interval (e.g., 98.5 ± 2.3)
- Hit rate tracking (predictions vs actuals)
- Model accuracy dashboard

**Deliverables:**
- [ ] Training data pipeline built
- [ ] Model trained and tested
- [ ] Predictions generating
- [ ] Accuracy tracking working

#### 2.4 Win Rate Analytics
- Track edge accuracy over time
- Calculate ROI for various pace edges
- Identify profitable patterns
- Build performance dashboard

**Features:**
- Edge accuracy by value size
- ROI by league
- Profitable pace ranges
- Streak tracking

**Deliverables:**
- [ ] Performance tracker built
- [ ] ROI calculations working
- [ ] Patterns identified
- [ ] Dashboard displaying

---

### TIER 3: User Features (Weeks 5-7)

**Goal:** Build personalized user experience

#### 3.1 User Accounts & Authentication
- Auth system (email + password or OAuth)
- User profiles (preferences, settings)
- Session management
- Password reset/security

**Tech Stack Options:**
- Backend: Firebase Auth OR Express.js + JWT
- Database: Firebase OR MongoDB
- Frontend: Currently just HTML/JS, add login page

**Deliverables:**
- [ ] Auth system chosen & implemented
- [ ] Login/signup page working
- [ ] Session management working
- [ ] Password reset working
- [ ] Profile page built

#### 3.2 Watchlist System
- Save favorite players
- Save favorite matchups
- Quick-filter to watchlist only
- Watchlist persistence (to database)

**Features:**
- Heart icon to save/unsave
- Dedicated "My Watchlist" tab
- Sort/filter within watchlist
- Export watchlist

**UI Additions:**
```
Current: Props tab, Games tab, Injuries tab, Parlay tab, Pace tab, Strategy tab
Target: + My Watchlist tab (shows only saved players)
```

**Deliverables:**
- [ ] Watchlist UI added
- [ ] Save/unsave functionality
- [ ] Database persistence
- [ ] Filter to watchlist
- [ ] Export working

#### 3.3 Custom Alerts System
- Email/app alerts for specific edges
- Threshold-based triggers (e.g., "alert when pace > 102")
- Frequency controls (daily digest, real-time, weekly)
- Smart notifications (don't spam)

**Alert Types:**
- Pace edge alerts (matchup advantage)
- Price movement alerts (odds shift)
- Sharp money alerts (sharp action detected)
- Game time alerts (game starting soon)

**Deliverables:**
- [ ] Alert settings page built
- [ ] Notification engine created
- [ ] Email integration working
- [ ] Smart batching implemented
- [ ] Frequency controls working

#### 3.4 Preferences & Customization
- League preferences (which to show by default)
- Display preferences (dark mode, layout)
- Metric preferences (which to highlight)
- Data refresh rate preferences

**Deliverables:**
- [ ] Settings page built
- [ ] All preferences saved
- [ ] Preferences applied to UI
- [ ] Dark mode implemented

---

### TIER 4: Database & Analytics Infrastructure (Weeks 8-10)

**Goal:** Build backend data system

#### 4.1 Backend Infrastructure Setup
- Choose database (Firebase, MongoDB, PostgreSQL)
- Set up API server (Firebase Functions, Express.js, etc.)
- Design data schema
- Implement authentication/authorization

**Tech Decisions Needed:**
1. Database: Firebase vs MongoDB vs PostgreSQL?
2. Backend: Firebase Functions vs Express.js vs Supabase?
3. Hosting: Currently Netlify (frontend only). Need backend server.

**Schema Design:**
```
Users:
  - id, email, password_hash, created_at
  - preferences, watchlist, alerts

Pace Data:
  - player_id, league, date, pace_value, opponent
  - player_pace, opponent_pace, pace_edge

Predictions:
  - player_id, date, predicted_pace, confidence
  - actual_pace, was_correct

Alerts:
  - user_id, alert_type, threshold, frequency
  - is_active, last_triggered

Analytics:
  - user_id, edge_bet, result, roi
  - prediction_accuracy, hit_rate
```

**Deliverables:**
- [ ] Database chosen & set up
- [ ] API server deployed
- [ ] Schema designed & created
- [ ] CRUD operations working
- [ ] Authentication layer added

#### 4.2 Price History Database
- Record all odds for every prop
- Track changes over time
- Calculate sharp vs public movement
- Build price movement charts

**Data Collection:**
- Connect to The-Odds-API (already integrated)
- Store every price update
- Timestamp all changes
- Calculate velocity (how fast odds moved)

**Features:**
- Historical odds chart (line graph)
- Early price vs closing price
- Sharp vs public % movement
- Closing line value tracking

**Deliverables:**
- [ ] Price tracking implemented
- [ ] Historical charts working
- [ ] CLV calculations correct
- [ ] Visualization polished

#### 4.3 Edge Tracking System
- Record every edge identified
- Track if it won or lost
- Calculate ROI
- Build profit curves

**Data Collection:**
- Every time user views a pace edge, log it
- After game, fetch result
- Calculate if bet would have won
- Track profit/loss

**Features:**
- Edge accuracy dashboard
- ROI by edge size
- Profit/loss chart
- Hit rate tracking

**Deliverables:**
- [ ] Edge logging system built
- [ ] Result tracking working
- [ ] ROI calculations correct
- [ ] Dashboards displaying

#### 4.4 Advanced Analytics Dashboard
- User performance metrics
- Subscription analytics (if monetizing)
- Feature usage analytics
- Data quality metrics

**Admin Dashboard:**
- User signup trends
- Feature adoption rates
- API performance
- Error rates
- Data freshness

**User Dashboard:**
- My stats (profit, hit rate, ROI)
- Edge history
- Performance by league
- Favorite players/matchups

**Deliverables:**
- [ ] Admin dashboard built
- [ ] User dashboard built
- [ ] Analytics queries working
- [ ] Visualizations polished

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  Frontend (Current)                   │
│         PropEdge HTML/CSS/JavaScript App             │
│  (Phase 3.5: Add auth pages, watchlist, alerts)     │
└────────────┬────────────────────────────────────────┘
             │
             │ API Calls
             ↓
┌─────────────────────────────────────────────────────┐
│              API Server (NEW)                         │
│   Express.js / Firebase Functions / Supabase        │
│  ├─ /api/pace (fetch live ESPN pace)                │
│  ├─ /api/predictions (get ML predictions)           │
│  ├─ /api/user (user management)                     │
│  ├─ /api/watchlist (save/load watchlist)            │
│  ├─ /api/alerts (manage notifications)              │
│  └─ /api/analytics (performance data)               │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│                Database (NEW)                         │
│   MongoDB / PostgreSQL / Firebase Firestore         │
│  ├─ Users (profiles, preferences)                    │
│  ├─ Pace Data (historical, real-time)               │
│  ├─ Predictions (model outputs)                      │
│  ├─ Alerts (user-defined)                            │
│  ├─ Price History (odds tracking)                    │
│  └─ Analytics (edge tracking, ROI)                   │
└────────────┬────────────────────────────────────────┘
             │
             ↓ Data Sources
┌─────────────┴───────────────────────────────────────┐
│         External APIs (Existing)                      │
│  ├─ ESPN API (pace metrics)                          │
│  ├─ The-Odds-API (odds data)                         │
│  ├─ Google Sheets (props data)                       │
│  └─ PropFinder (via scraper)                         │
└─────────────────────────────────────────────────────┘
```

---

## Technology Stack Decisions Needed

### 1. Backend Framework
- **Option A:** Firebase (Easiest, serverless)
  - Pros: No server management, real-time DB, built-in auth
  - Cons: Higher costs at scale, vendor lock-in

- **Option B:** Express.js + Node (Most control)
  - Pros: Full control, cheaper at scale, standard stack
  - Cons: Need to manage servers, more setup

- **Option C:** Supabase (Postgres + Auth)
  - Pros: Open-source Firebase alternative, SQL power
  - Cons: Slightly more complex, newer platform

**Recommendation:** Start with **Firebase** (faster iteration) → Migrate to **Express.js** if costs become issue

### 2. Database
- **Option A:** Firebase Firestore (Easiest)
  - Pros: Real-time, serverless, great for MVP
  - Cons: Limited query power, costs

- **Option B:** MongoDB (Balanced)
  - Pros: Flexible schema, good for rapid development
  - Cons: Need to manage, not real-time

- **Option C:** PostgreSQL (Most powerful)
  - Pros: ACID, powerful queries, relational
  - Cons: More setup, learning curve

**Recommendation:** Start with **Firebase Firestore** (MVP speed) → **PostgreSQL** (production scale)

### 3. ML Framework (if doing predictions)
- **Option A:** TensorFlow.js (browser-based, but limited)
- **Option B:** scikit-learn (Python backend, powerful)
- **Option C:** XGBoost (excellent for tabular data)

**Recommendation:** **Python backend** with scikit-learn/XGBoost for pace prediction

---

## Implementation Order

```
Week 1-2: TIER 1 - Data Integration
  └─ ESPN API setup
  └─ Pace metric calculations
  └─ Data refresh strategy

Week 3-4: TIER 2 - Advanced Analytics
  └─ Historical trend analysis
  └─ Player correlation
  └─ Win rate analytics
  └─ ML predictions (optional)

Week 5-7: TIER 3 - User Features
  └─ User accounts & auth
  └─ Watchlist system
  └─ Custom alerts
  └─ Preferences

Week 8-10: TIER 4 - Database
  └─ Backend setup
  └─ Price history database
  └─ Edge tracking
  └─ Analytics dashboard
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Data freshness | <30 minutes old |
| Prediction accuracy | >65% hit rate |
| User retention | >40% monthly active |
| API response time | <500ms |
| Database query time | <100ms |
| Mobile responsiveness | 100% on <768px |
| Error rate | <0.1% |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| ESPN API rate limits | High | Medium | Implement caching, batch requests |
| ML model overfitting | Medium | High | Use cross-validation, multiple data splits |
| Database scalability | Low | High | Design schema for partitioning |
| User churn | High | High | Build engaging features early |
| Data staleness | Medium | Medium | Implement aggressive refresh |

---

## Next Steps

**Before we start coding:**

1. **Decide on tech stack:**
   - Backend: Firebase vs Express.js vs Supabase?
   - Database: Firestore vs MongoDB vs PostgreSQL?
   - ML: TensorFlow.js vs Python backend?

2. **Assess ESPN API:**
   - What pace metrics are available?
   - Rate limits? Costs?
   - Documentation quality?

3. **Plan API endpoints:**
   - List all endpoints needed
   - Design request/response format
   - Plan error handling

4. **Create database schema:**
   - Define all tables/collections
   - Define relationships
   - Plan indexes for performance

5. **Build MVP timeline:**
   - What's the minimum for beta launch?
   - What can wait for v2?

**Question for you:** Which tech stack do you prefer? Should we start with Firebase (fastest) or Express.js (most control)?

---

**Status:** Ready for architecture decisions and planning
**Next Meeting:** Discuss tech stack and ESPN API assessment
