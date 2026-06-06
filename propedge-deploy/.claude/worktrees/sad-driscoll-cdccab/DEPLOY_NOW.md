# Deploy Now — Cron Setup Instructions

**Status:** Scraper v2 is ready for production 🚀

---

## Setup: 5 Minutes

### Step 1: Open crontab editor
```bash
crontab -e
```

### Step 2: Add these two lines at the bottom

```bash
30 11 * * * cd ~/Documents/Claude/Projects/PropEdge && node scraper-multi-sport-v1.js >> /tmp/propedge-11am.log 2>&1
0 18 * * * cd ~/Documents/Claude/Projects/PropEdge && node scraper-multi-sport-v1.js >> /tmp/propedge-6pm.log 2>&1
```

### Step 3: Save and exit
- Press `Ctrl+X` (or `Cmd+X` on Mac in some editors)
- Type `y` to confirm save
- Press Enter

### Step 4: Verify installation
```bash
crontab -l
```

You should see your two new lines.

---

## What This Does

| Time | What Happens |
|------|--------------|
| **11:30 AM EST** | Scraper runs, downloads all props, filters, writes to Sheets |
| **6:00 PM EST** | Scraper runs again with updated data |

Logs are saved to:
- `/tmp/propedge-11am.log` (morning run)
- `/tmp/propedge-6pm.log` (evening run)

---

## Monitor Your Runs

### Check morning run log
```bash
tail -50 /tmp/propedge-11am.log
```

### Check evening run log
```bash
tail -50 /tmp/propedge-6pm.log
```

### Watch live log (will wait for next run)
```bash
tail -f /tmp/propedge-11am.log
```

Press `Ctrl+C` to stop watching.

---

## Verify It's Working

1. **Check Sheets at 11:35 AM** — NBA/NHL/MLB tabs should have fresh data
2. **Check Sheets at 6:05 PM** — Data updated with evening run
3. **Check Props_History** — Should grow with each run (new timestamped entries)

---

## If Something Goes Wrong

### Read the log
```bash
cat /tmp/propedge-11am.log
```

Look for:
- ❌ Error messages (red flags in output)
- ⚠️ Warnings (may not be fatal)
- ✅ Success lines (should see "SYNC COMPLETE")

### Common Issues

**Issue:** `Cannot find module 'dotenv'`
- **Fix:** Run `npm install` in the PropEdge directory

**Issue:** `ENOENT: no such file or directory`
- **Fix:** Verify .env and credentials.json exist in PropEdge directory

**Issue:** `PropFinder login failed`
- **Fix:** Check credentials in .env (email/password may have changed)

**Issue:** Google Sheets write failed
- **Fix:** Check credentials.json hasn't expired (may need to regenerate OAuth)

---

## Data Format in Google Sheets

After runs, you'll see:

### NBA Tab
- 856 rows of combined OVER + UNDER props
- Columns: PF Rating | Team | Pos | Player | Prop | L10 Avg | L5 Avg | Odds | ...

### NHL Tab
- 5 rows (very selective filter)
- Same columns as NBA

### MLB Tab
- 763 rows of combined OVER + UNDER props
- Same columns as NBA (different stat columns for baseball)

### Props_History Tab
- Grows with each run
- Format: timestamp | league | player | prop_type | line | direction | odds | pf_rating | l10_avg | l5_avg
- Never cleared (only appends)
- Auto-prunes rows >48 hours old

---

## Disable Cron (If Needed)

```bash
crontab -e
```

Comment out the two lines with `#`:
```bash
# 30 11 * * * cd ~/Documents/Claude/Projects/PropEdge && node scraper-multi-sport-v1.js >> /tmp/propedge-11am.log 2>&1
# 0 18 * * * cd ~/Documents/Claude/Projects/PropEdge && node scraper-multi-sport-v1.js >> /tmp/propedge-6pm.log 2>&1
```

Save and exit. Jobs won't run but you can re-enable later by removing the `#`.

---

## Done!

Your PropEdge scraper is now **live and automated**.

- ✅ Runs 2x daily (11:30 AM & 6 PM EST)
- ✅ Updates your Google Sheet automatically
- ✅ Captures OVER + UNDER for all leagues
- ✅ Filters to high-quality props
- ✅ Maintains rolling 48-hour history

**Next check:** Monitor your Google Sheet at 11:35 AM tomorrow and watch the data flow in! 🚀
