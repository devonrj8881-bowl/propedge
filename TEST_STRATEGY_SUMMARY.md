# PropEdge Scraper — Test Strategy Summary

**Goal:** Validate scraper before tomorrow's first automated run
**Risk:** High (data goes to production Google Sheet)
**Approach:** 5-step validation with fallback plans

---

## Quick Start (10 min)

```bash
cd ~/Documents/Claude/Projects/PropEdge
./test-scraper.sh
node scraper-multi-sport-v1.js --visible
```

Then verify Google Sheet has enrichment columns.

---

## 5-Step Test Strategy

### Step 1: Pre-Flight Checks (5 min)
**Command:** `./test-scraper.sh`

**Verifies:**
- ✅ Syntax is valid
- ✅ .env file loaded (PROPFINDER_EMAIL, GOOGLE_SHEET_ID)
- ✅ credentials.json exists (Google OAuth)
- ✅ Chrome installed

**Risk:** LOW (read-only checks)

---

### Step 2: Visible Dry-Run (15 min)
**Command:** `node scraper-multi-sport-v1.js --visible`

**Watch for:**
- Chrome opens and logs into PropFinder
- All 4 league pages load
- CSVs appear in ~/Downloads/ (briefly)
- Console shows all 4 leagues processed
- No red ❌ error messages

**Risk:** MEDIUM (writes to Google Sheet, but test sheet first)

**If PropFinder Login Fails:**
- Check credentials in .env
- Try manually logging in at propfinder.com
- Disable 2FA temporarily if enabled
- Update password if changed

**If CSV Not Downloading:**
- PropFinder UI may have changed
- Check CSS selector for download button (line 507 in scraper)
- May need to adjust `.click()` target
- Contact PropFinder support if persistent

---

### Step 3: Google Sheets Validation (5 min)

**Open your Google Sheet and verify:**

| Tab | Check | Result |
|-----|-------|--------|
| NBA | Has ≥5 rows of prop data | ✅ or ❌ |
| NHL | Has `corsi_per_60` & `xg_per_60` columns | ✅ or ❌ |
| MLB | Has `avg_velocity` & `pitches_per_ab` columns | ✅ or ❌ |
| NFL | Has ≥5 rows of prop data | ✅ or ❌ |
| Props_History | Has timestamped entries from dry-run | ✅ or ❌ |

**If enrichment columns are missing:**
- Pace fetchers may have failed (check console for warnings)
- Natural Stat Trick or Baseball Savant may be down
- Script logs "Enriching NHL props" — if you don't see it, pace data was empty
- Fallback: Script works fine without enrichment, just run again tomorrow

**If Props_History is empty:**
- appendToHistory() function failed
- Check Google Sheets API permissions
- Verify GOOGLE_SHEET_ID is correct

---

### Step 4: Data Integrity Check (5 min)

**Run scraper twice in a row:**

```bash
node scraper-multi-sport-v1.js --visible
# Wait 5 seconds
node scraper-multi-sport-v1.js --visible
```

**Verify in Google Sheet:**
- Props_History has TWO sets of timestamped entries (different timestamps)
- Each league tab shows latest run's data (can identify by most recent prop line)
- No duplicate rows or corruption
- Column count is consistent across all rows

**If duplicates appear:**
- appendToHistory() is appending correctly (expected behavior)
- Props_History should grow with each run

**If data overwrites:**
- This is normal — each league tab gets overwritten with latest data
- Props_History preserves history for 48 hours

---

### Step 5: Headless Mode Test (5 min)

**After visible run passes, test headless (for cron):**

```bash
node scraper-multi-sport-v1.js
```

(No `--visible` flag)

**Expected:**
- No browser window opens
- Console output identical to visible run
- Data writes to Sheets same as visible run

**If headless fails but visible passed:**
- Rare but possible — may indicate Puppeteer config issue
- Headless mode uses different Chrome launch flags
- Check Chrome process: `ps aux | grep chrome`
- May need to add `--disable-dev-shm-usage` flag to scraper

---

## Abort Criteria (When NOT to Deploy to Cron)

❌ **STOP if:**

1. **PropFinder login fails consistently**
   - Credentials invalid
   - PropFinder API changed
   - 2FA blocking automation
   - → Fix: Update credentials, contact PropFinder

2. **CSV never downloads**
   - Download button selector is wrong
   - PropFinder UI restructured
   - → Fix: Update CSS selector in line 507

3. **Google Sheets write fails**
   - credentials.json expired
   - GOOGLE_SHEET_ID incorrect
   - Sheet is read-only
   - → Fix: Regenerate OAuth, verify sheet ID

4. **Data corruption detected**
   - Rows have mismatched column counts
   - Enrichment columns have garbled data
   - Props_History rows missing
   - → Fix: Investigate parseCSV() and enrichment logic

5. **Scraper crashes mid-run**
   - Unhandled exception in any function
   - Memory leak/infinite loop
   - → Fix: Check error message, debug in isolation

---

## Success Path (When Everything Works)

✅ **PROCEED to cron IF:**

- [x] Pre-flight checks pass (5/5)
- [x] Visible dry-run completes (all 4 leagues logged)
- [x] Google Sheet has all 4 league tabs with data
- [x] NHL tab has Corsi/xG enrichment columns
- [x] MLB tab has velocity/pitch enrichment columns
- [x] Props_History tab has timestamped entries
- [x] Second run doesn't corrupt data
- [x] Headless mode works identically to visible

**Once all passed:**
1. Copy scraper to cron location: `/usr/local/bin/propedge-scraper.js`
2. Set up cron jobs for 11:30 AM & 6 PM EST
3. Monitor first automated run tomorrow morning
4. Check Google Sheet for data integrity

---

## Troubleshooting Quick Reference

| Problem | Check | Solution |
|---------|-------|----------|
| Syntax error | Console message | Check scraper file for typos |
| .env not found | `ls -la .env` | Create .env in project root |
| Chrome not found | `which google-chrome` | Install Chrome or update path in scraper |
| Login fails | Test propfinder.com manually | Update credentials in .env |
| CSV not downloading | Check ~/Downloads/ | Update CSS selector in scraper line 507 |
| Google Sheets write fails | Check logs for 403 error | Regenerate credentials.json |
| Enrichment columns missing | Check console warnings | Pace fetchers may be down, continue anyway |
| Props_History empty | Check Sheets API quota | Wait and retry, Google has rate limits |
| Headless fails | Test visible mode first | Check for Chrome process: `ps aux \| grep chrome` |

---

## Timeline

**Today (Apr 5):**
- Run pre-flight checks (5 min)
- Run visible dry-run (15 min)
- Verify Google Sheet (5 min)
- Run integrity checks (5 min)
- Test headless mode (5 min)
- **Total: 35 min**

**Tomorrow (Apr 6):**
- Monitor first automated run at 11:30 AM
- Check Google Sheet for data
- If issues, disable cron and debug

**If All Good:**
- Enable daily 11:30 AM & 6 PM EST runs

---

## Emergency Abort

If scraper breaks the site or corrupts data:

```bash
# Immediately stop cron
crontab -e
# Comment out or delete scraper lines

# Restore last known good data
# (Google Sheets has version history — revert if needed)

# Debug in isolation
node scraper-multi-sport-v1.js --visible
# Check console for errors

# Contact PropFinder support if their API changed
```

---

## Next Steps

1. **Run:** `./test-scraper.sh`
2. **If pass:** Continue to visible dry-run
3. **If fail:** Fix error, re-run pre-flight
4. **Document:** Note any issues for cron setup
5. **Deploy:** Proceed to cron setup once all tests pass

---

**Confidence Level:** HIGH (comprehensive validation before automation)
**Time Investment:** 35 minutes
**Risk Mitigation:** Full dry-run eliminates surprises tomorrow
