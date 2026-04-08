# Firebase Setup Guide - Week 1

**Status:** Ready to Deploy
**Date:** April 2, 2026
**Files Created:** 6 core files
**Next Step:** Firebase Project Creation

---

## Files Created in This Session

### ✅ Configuration Files
1. **firebase.json** - Firebase project configuration
2. **firestore.rules** - Security rules for database
3. **firestore.indexes.json** - Database indexes for performance
4. **netlify.toml** - Netlify configuration with functions

### ✅ Backend Functions
5. **netlify/functions/espn-pace.js** - ESPN API integration
6. **netlify/functions/package.json** - Function dependencies

### ✅ Frontend Modules
7. **frontend/firebase-init.js** - Firebase initialization
8. **frontend/pace-data-fetcher.js** - Data fetching & caching

---

## Step-by-Step Setup

### Step 1: Create Firebase Project (10 minutes)

**Go to:** https://console.firebase.google.com

**Actions:**
1. Click "Create Project"
2. Name: `propedge`
3. Enable Google Analytics (optional, recommended)
4. Click "Create Project"
5. Wait for project to be created (~2 minutes)

**After Creation:**
1. Go to Project Settings (gear icon, top left)
2. Copy these values and save them:
   - Project ID
   - Web API Key
   - Auth Domain
   - Storage Bucket
   - Messaging Sender ID
   - App ID

---

### Step 2: Enable Firestore (5 minutes)

**In Firebase Console:**
1. Click "Firestore Database" (left menu)
2. Click "Create Database"
3. Select region: `us-central1` (or nearest to you)
4. Choose: **Start in production mode**
5. Click "Create"
6. Wait for Firestore to initialize (~1 minute)

**Expected result:** Empty Firestore database ready

---

### Step 3: Enable Authentication (3 minutes)

**In Firebase Console:**
1. Click "Authentication" (left menu)
2. Click "Get Started"
3. Enable providers:
   - Email/Password ✅ (click Enable)
   - Google ✅ (optional, click Enable)
4. Save

**Expected result:** Auth system ready

---

### Step 4: Create Service Account (5 minutes)

**In Firebase Console:**
1. Go to Project Settings (gear icon)
2. Click "Service Accounts" tab
3. Click "Generate New Private Key"
4. Save the JSON file somewhere safe
5. Copy these values:
   - `private_key`
   - `client_email`
   - `project_id`

**Store these as environment variables for Netlify:**
```
FIREBASE_PRIVATE_KEY=<paste the private_key value>
FIREBASE_CLIENT_EMAIL=<paste the client_email>
FIREBASE_PROJECT_ID=<paste the project_id>
```

---

### Step 5: Deploy Firestore Rules (2 minutes)

**Option A: Using Firebase CLI**

```bash
# 1. Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Initialize Firebase in your project
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
firebase init firestore

# 4. Accept defaults (use existing firestore.rules and firestore.indexes.json)

# 5. Deploy rules
firebase deploy --only firestore:rules,firestore:indexes
```

**Option B: Manual Deployment**

1. In Firebase Console, go to Firestore Database
2. Click "Rules" tab
3. Copy entire content of `firestore.rules` file
4. Paste into Firebase Console
5. Click "Publish"

---

### Step 6: Update Configuration Files

**Update netlify.toml with your Firebase credentials:**

```toml
[env]
  FIREBASE_API_KEY = "your-api-key"
  FIREBASE_AUTH_DOMAIN = "your-project.firebaseapp.com"
  FIREBASE_PROJECT_ID = "your-project-id"
  FIREBASE_STORAGE_BUCKET = "your-project.appspot.com"
  FIREBASE_MESSAGING_SENDER_ID = "your-sender-id"
  FIREBASE_APP_ID = "your-app-id"
```

**Update frontend/firebase-init.js:**

Replace the `firebaseConfig` object with your actual credentials from Step 1.

---

### Step 7: Install Dependencies

```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge

# Install main dependencies
npm install firebase firebase-admin node-fetch

# Install function dependencies
cd netlify/functions
npm install
cd ../..
```

---

### Step 8: Test Locally

```bash
# Start development server with functions
netlify dev

# In another terminal, test the API endpoint
curl "http://localhost:8888/.netlify/functions/espn-pace?league=NBA"

# Expected response:
# {
#   "data": { "players": [...], "playerCount": 20 },
#   "source": "live",
#   "league": "NBA"
# }
```

---

## Firestore Database Schema (Auto-Created)

The following collections will be created automatically as data flows in:

### Collection: `cache`
Temporary storage for API responses (auto-refreshed every 15 min)
```
{
  pace_NBA: { data: {...}, timestamp: 1234567890 },
  pace_NFL: { data: {...}, timestamp: 1234567890 },
  // ... etc
}
```

### Collection: `pace_data`
Historical pace metrics for each player
```
{
  playerId: "nba_123",
  playerName: "Luka Doncic",
  league: "NBA",
  date: Timestamp,
  currentPace: 100.2,
  opponentPace: 98.5,
  paceEdge: 1.7,
  // ... other metrics
}
```

### Collection: `users` (Created when users sign up)
User profiles and preferences
```
{
  uid: "firebase_uid",
  email: "user@example.com",
  displayName: "User Name",
  preferences: { defaultLeague: "NBA", ... },
  watchlist: [...],
  stats: { totalEdges: 0, roi: 0, ... }
}
```

### Collections: `alerts`, `predictions`, `edge_tracking`, `price_history`, `analytics_snapshots`
Created automatically as features are built

---

## Verification Checklist

After setup, verify everything is working:

- [ ] Firebase project created
- [ ] Firestore database initialized
- [ ] Authentication enabled
- [ ] Service account created
- [ ] Firestore rules deployed
- [ ] netlify.toml updated with credentials
- [ ] firebase-init.js updated with config
- [ ] Dependencies installed
- [ ] Local development server works
- [ ] API endpoint returns data (curl test)

---

## Troubleshooting

### Issue: "Project ID not found"
**Solution:** Make sure FIREBASE_PROJECT_ID environment variable is set correctly

### Issue: "Authentication failed" when deploying
**Solution:** Run `firebase login` again and re-authenticate

### Issue: Firestore returns permission denied
**Solution:** Check firestore.rules - make sure your rules are deployed

### Issue: ESPN API returns 404
**Solution:** The API endpoint may have changed. Check ESPN API documentation at https://site.api.espn.com

### Issue: Functions won't deploy
**Solution:** Make sure you have netlify.toml in the root directory and functions are in netlify/functions/

---

## Environment Variables for Netlify

Add these to your Netlify site settings:

**Dashboard → Site Settings → Build & Deploy → Environment**

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-service-account-email
```

---

## Next Steps (Week 2)

Once Firebase is set up:

1. **Verify data flow:**
   - Make API calls to ESPN
   - Check Firestore console for new documents
   - Verify caching is working

2. **Build pace trend analyzer:**
   - Moving averages
   - Volatility calculations
   - Trend forecasts

3. **Start ML model:**
   - Collect training data
   - Train Gradient Boosting model
   - Integrate predictions

---

## Quick Commands Reference

```bash
# Start development
netlify dev

# Deploy to production
netlify deploy --prod

# View Firebase logs
firebase functions:log

# Check Firestore
firebase firestore:list

# Reset Firestore (careful!)
firebase firestore:delete --all

# SSH into Firebase Functions
firebase functions:shell
```

---

## Firebase Console Quick Links

- **Firestore:** https://console.firebase.google.com/project/[PROJECT_ID]/firestore
- **Authentication:** https://console.firebase.google.com/project/[PROJECT_ID]/authentication
- **Functions:** https://console.firebase.google.com/project/[PROJECT_ID]/functions
- **Project Settings:** https://console.firebase.google.com/project/[PROJECT_ID]/settings/general

---

**Status:** Ready for manual setup
**Estimated Time:** 30-45 minutes
**Next Checkpoint:** Verify API data flowing into Firestore
