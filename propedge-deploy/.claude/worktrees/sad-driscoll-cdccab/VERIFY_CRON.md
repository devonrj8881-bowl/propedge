# Verify Cron Jobs — Step by Step

## 1. Confirm Jobs Are Installed

```bash
crontab -l
```

You should see output like:
```
30 11 * * * cd ~/Documents/Claude/Projects/PropEdge && node scraper-multi-sport-v1.js >> /tmp/propedge-11am.log 2>&1
0 18 * * * cd ~/Documents/Claude/Projects/PropEdge && node scraper-multi-sport-v1.js >> /tmp/propedge-6pm.log 2>&1
```

✅ If you see these two lines, the jobs are installed correctly.
❌ If you see nothing, the jobs weren't added (go back and run `crontab -e` again).

---

## 2. Check Cron Daemon Status

Verify the cron service is running:

```bash
ps aux | grep cron
```

You should see output that includes `/usr/sbin/cron` or similar.

✅ If you see cron running, you're good.

---

## 3. Monitor the Log Files

The scraper writes logs to `/tmp/propedge-11am.log` and `/tmp/propedge-6pm.log`.

### Before the first run (now until 11:30 AM)
The files won't exist yet. That's normal.

### After 11:30 AM (and 6 PM)
Check the logs:

```bash
# Check morning run log
cat /tmp/propedge-11am.log

# Check evening run log (after 6 PM)
cat /tmp/propedge-6pm.log
```

Expected output should end with:
```
[HH:MM:SS] ========================================
[HH:MM:SS] ✅ SYNC COMPLETE
[HH:MM:SS] ========================================
```

✅ If you see "✅ SYNC COMPLETE", the run succeeded.
❌ If you see errors, check the log content for what failed.

---

## 4. Watch Logs in Real-Time

To see logs as they're being written (watch live):

```bash
tail -f /tmp/propedge-11am.log
```

This will show you the last 10 lines and wait for new lines to appear.

Press `Ctrl+C` to stop watching.

---

## 5. Check Google Sheet

**This is the best verification!**

### At 11:35 AM (5 min after scheduled run)
1. Open your PropEdge Google Sheet
2. Check these tabs:
   - **NBA:** Should have 850+ rows
   - **NHL:** Should have 5+ rows
   - **MLB:** Should have 750+ rows
   - **Props_History:** Should have new timestamped entries

If data is fresh and the timestamp matches 11:30 AM, ✅ the job ran successfully.

### At 6:05 PM (5 min after evening run)
Same check - data should be updated with evening run data.

---

## 6. Tail Log (Last 50 Lines)

To see just the last 50 lines (good for quick check):

```bash
tail -50 /tmp/propedge-11am.log
```

Look for:
- ✅ "PropEdge Multi-Sport Scraper v2 Starting" (run started)
- ✅ "Google Sheets client ready" (login and setup working)
- ✅ "Browser launched" (Chrome automation working)
- ✅ "PropFinder login successful" (authentication working)
- ✅ "NBA: 856 props processed" (NBA run succeeded)
- ✅ "NHL: 5 props processed" (NHL run succeeded)
- ✅ "MLB: 763 props processed" (MLB run succeeded)
- ✅ "SYNC COMPLETE" (run finished successfully)

---

## 7. Check for Errors

If the run failed, look for:
- ❌ Error messages (will say "Error:" or show stack trace)
- ⚠️ Warnings (will say "⚠️" but may not be fatal)
- ❌ "SYNC COMPLETE" missing (run didn't finish)

### Common errors:

**"Cannot find module 'dotenv'"**
```
Fix: cd ~/Documents/Claude/Projects/PropEdge && npm install
```

**"Cannot find Chrome"**
```
Fix: Verify Chrome is installed at /Applications/Google Chrome.app
```

**"PropFinder login failed"**
```
Fix: Check credentials in .env file (email/password may be wrong)
```

**"Google Sheets write failed"**
```
Fix: Check credentials.json (may have expired, regenerate OAuth token)
```

---

## 8. Full Verification Checklist

- [ ] `crontab -l` shows both cron jobs
- [ ] `/usr/sbin/cron` is running (`ps aux | grep cron`)
- [ ] Log file exists after 11:30 AM: `/tmp/propedge-11am.log`
- [ ] Log shows "✅ SYNC COMPLETE" at the end
- [ ] Google Sheet NBA tab has 850+ rows
- [ ] Google Sheet NHL tab has 5+ rows
- [ ] Google Sheet MLB tab has 750+ rows
- [ ] Props_History has new entries with today's timestamp
- [ ] Evening log appears at 6 PM with fresh data

---

## 9. Manual Test (Optional)

If you want to test before 11:30 AM:

```bash
cd ~/Documents/Claude/Projects/PropEdge
node scraper-multi-sport-v1.js >> /tmp/propedge-manual-test.log 2>&1
```

Wait ~2 minutes, then check:
```bash
tail -50 /tmp/propedge-manual-test.log
```

Should see "✅ SYNC COMPLETE" if it works.

---

## Timeline

| Time | What to Check | What You'll See |
|------|---------------|-----------------|
| **Now** | `crontab -l` | Two cron lines |
| **11:30 AM** | Logs appear | `/tmp/propedge-11am.log` created |
| **11:35 AM** | Google Sheet | NBA/NHL/MLB tabs updated |
| **6:00 PM** | Logs appear | `/tmp/propedge-6pm.log` created |
| **6:05 PM** | Google Sheet | Data updated with evening run |

---

## Quick Commands (Save These)

```bash
# List cron jobs
crontab -l

# Watch morning log live
tail -f /tmp/propedge-11am.log

# Watch evening log live
tail -f /tmp/propedge-6pm.log

# Quick check last 50 lines of morning log
tail -50 /tmp/propedge-11am.log

# Check if cron daemon running
ps aux | grep cron

# Manual test run (optional)
cd ~/Documents/Claude/Projects/PropEdge && node scraper-multi-sport-v1.js
```

---

## Summary

✅ **Jobs installed:** `crontab -l`
✅ **Jobs running:** Check logs at 11:30 AM & 6 PM
✅ **Jobs working:** Check Google Sheet for fresh data
✅ **Success indicator:** "✅ SYNC COMPLETE" in log + data in Sheet

**Next step:** Wait until 11:35 AM and check your Google Sheet. If you see fresh data in NBA/NHL/MLB tabs, the jobs are working perfectly! 🚀
