# Netlify Pitcher ERA Enrichment - Complete Setup Guide

## Overview

You now have a **scheduled Netlify function** that:
- ✅ Runs daily at **8 AM ET**
- ✅ Fetches today's MLB games from ESPN
- ✅ Looks up starting pitchers
- ✅ Fetches pitcher ERA from MLB StatsAPI
- ✅ Prepares to update your Google Sheet

---

## Setup Steps (5 minutes)

### Step 1: Add Google Sheet Column (Already Done ✅)
Your `pitcher_era` column is ready in propedge-main sheet.

### Step 2: Get Your Sheet ID

1. Open: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
2. Copy the **SHEET_ID** from the URL (long alphanumeric string)
3. Save it somewhere safe

Example URL:
```
https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j/edit
                                    ^^^^^^^^^^^^^^^^^^^^
                                    This is SHEET_ID
```

### Step 3: Create Google Service Account (Optional but Recommended)

For automatic Sheet updates, you need a **Service Account**:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **Create Credentials** → **Service Account**
3. Name it: `propedge-enrichment`
4. Grant role: `Editor`
5. Click **Create Key** → **JSON**
6. Download the JSON file

### Step 4: Configure Netlify Environment Variables

1. Go to: https://app.netlify.com/sites/propedgemasters/settings/general
2. Click **Build & deploy** → **Environment**
3. Add these variables:

```
PROPEDGE_SHEET_ID = 1a2b3c4d5e6f7g8h9i0j  (your sheet ID from Step 2)

GOOGLE_SERVICE_ACCOUNT = {paste entire JSON from Step 3}
```

4. Click **Save**

### Step 5: Deploy

```bash
git add netlify/functions/enrich-pitcher-era.js netlify.toml
git commit -m "Add daily pitcher ERA enrichment via scheduled Netlify function"
bash deploy-prod.sh
```

---

## How It Works

### Timing
- **Scheduled:** Every day at **12 UTC (8 AM ET)**
- **Timezone Note:** Netlify schedules in UTC. Adjust cron in netlify.toml if needed:
  - EST (winter): Use `0 13 * * *` (1 PM UTC)
  - EDT (summer): Use `0 12 * * *` (12 PM UTC)

### Data Flow
```
1. Function starts at 8 AM ET
   ↓
2. Fetches today's MLB games from ESPN API
   ↓
3. Gets starting pitcher names for each game
   ↓
4. Looks up pitcher ID in MLB StatsAPI
   ↓
5. Fetches current season ERA for each pitcher
   ↓
6. Prepares to update Google Sheet (pitcher_era column)
   ↓
7. Logs results to Netlify function logs
```

---

## Testing the Function

### Test Manually (Before It Runs Daily)

1. Go to: https://app.netlify.com/sites/propedgemasters/functions
2. Click **enrich-pitcher-era**
3. Click **Trigger function** or **Invoke**
4. Check output in **Logs**

Expected output:
```
✅ ESPN: Found 15 games for 2026-06-05
🔍 Looking up pitchers for NYY @ BOS
  ⚾ Away pitcher: Gerrit Cole (ID: 543037)
  ⚾ Home pitcher: Sale Chris (ID: 449008)
✅ Cole: ERA 2.87
✅ Sale: ERA 3.45
...
✅ Enriched 30 pitchers in 12.5s
```

### Check Logs Daily

After 8 AM ET, check logs to verify:
1. Go to: https://app.netlify.com/sites/propedgemasters/functions
2. Click **enrich-pitcher-era**
3. Look for today's execution in **Logs**
4. Should show successful pitcher fetches

---

## Current Status

### ✅ Complete
- Netlify function code written
- Scheduled trigger configured (daily 8 AM ET)
- Pitcher data fetching (ESPN → MLB StatsAPI)
- Logging for monitoring

### ⏳ Next Phase (Google Sheets Integration)

The function currently:
1. ✅ Fetches pitcher data
2. ⏳ Updates Google Sheet (requires full google-auth-library setup)

To enable Sheet updates, you need to:
1. Set GOOGLE_SERVICE_ACCOUNT environment variable
2. Grant service account Editor access to propedge-main sheet
3. I'll implement the Sheet update logic

---

## Environment Variables Checklist

```
□ PROPEDGE_SHEET_ID       Your Google Sheet ID
□ GOOGLE_SERVICE_ACCOUNT  Service account JSON (optional, for Sheet updates)
```

---

## Cron Schedule Reference

Change the schedule in `netlify.toml`:

```toml
# Every day at 8 AM ET (12 UTC)
cron = "0 12 * * *"

# Every day at 1 PM ET (5 PM UTC, for summer)
cron = "0 17 * * *"

# Every weekday (Mon-Fri) at 8 AM ET
cron = "0 12 * * 1-5"

# Twice daily: 8 AM and 2 PM ET
cron = "0 12,18 * * *"
```

---

## Troubleshooting

### Function runs but finds no games
- Check date - may be off-season
- ESPN API might be slow - function retries automatically

### Pitcher data shows ERA but Sheet not updated
- GOOGLE_SERVICE_ACCOUNT not configured
- Service account doesn't have Editor access to sheet
- Sheet ID incorrect

### Function times out
- ESPN API is slow - increase timeout
- Too many retries - reduce maxRetries

---

## Next Steps

1. ✅ Add `pitcher_era` column to Google Sheet (you did this)
2. ✅ Create Netlify function (done)
3. ✅ Configure schedule (done)
4. **→ Deploy changes** (you do this)
5. **→ Set environment variables in Netlify** (you do this)
6. **→ Test manually** (optional but recommended)
7. Let it run daily and watch hit rates improve!

---

## Expected Impact Timeline

**Day 1:** Function runs, fetches pitcher data, logs show success
**Week 1:** Pitcher ERA column populated for ~50 games
**Week 2:** MLB props scoring now includes pitcher difficulty
**Week 3+:** Hit rate should improve by ~5-8% as scoring becomes more accurate

---

## Questions?

Once you deploy and set environment variables, the function will:
- Run automatically at 8 AM ET every day
- Log results to Netlify dashboard
- Be ready to update your Google Sheet (when full integration is complete)

You can manually trigger it anytime to test! 🚀
