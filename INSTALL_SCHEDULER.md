# PropEdge Scheduler Installation Guide

Your scraper isn't running automatically because the old cron setup is broken. This guide will set up a reliable **macOS LaunchAgent** (the modern replacement for cron).

## Prerequisites Checklist

Before proceeding, **you MUST have** on your Mac:

✅ **Google Chrome** installed at `/Applications/Google Chrome.app`
  - Check: Open Finder → Applications → look for "Google Chrome"
  - If missing: Download from https://www.google.com/chrome

✅ **Node.js** installed (v14+)
  - Check in Terminal: `node --version`
  - If missing: Install via https://nodejs.org or `brew install node`

✅ **PropFinder credentials** working
  - Your .env file has PROPFINDER_EMAIL and PROPFINDER_PASSWORD

✅ **Google Sheets credentials** (credentials.json)
  - Check: `/Users/devonjohnson/Documents/Claude/Projects/PropEdge/credentials.json` exists
  - If missing: Re-authenticate with: `node scraper-multi-sport-v1.js --setup`

---

## Installation Steps

### Step 1: Copy LaunchAgent File

Run this command in Terminal:

```bash
cp /sessions/jolly-clever-mccarthy/mnt/PropEdge/com.propedge.scraper.plist ~/Library/LaunchAgents/
```

### Step 2: Make Scraper Script Executable

```bash
chmod +x /sessions/jolly-clever-mccarthy/mnt/PropEdge/run-scraper-daemon.sh
```

### Step 3: Load the LaunchAgent

```bash
launchctl load ~/Library/LaunchAgents/com.propedge.scraper.plist
```

If you get "already loaded", that's fine. If you get "permission denied", use `sudo`:

```bash
sudo launchctl load ~/Library/LaunchAgents/com.propedge.scraper.plist
```

### Step 4: Verify Installation

```bash
launchctl list | grep propedge
```

Should show: `com.propedge.scraper` with a process ID (PID)

---

## Testing

### Test 1: Manual Dry-Run (Visible Mode)

```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
node scraper-multi-sport-v1.js --visible
```

Watch the browser open and scrape. It should:
1. Login to PropFinder
2. Download CSVs for NBA/NHL/MLB/NFL
3. Write to your Google Sheet

If this fails, **stop and fix the issue before proceeding.**

### Test 2: Daemon Dry-Run

```bash
/bin/bash /sessions/jolly-clever-mccarthy/mnt/PropEdge/run-scraper-daemon.sh
```

This simulates exactly what launchd will run. Watch for errors.

### Test 3: Check Logs

After running, check logs:

```bash
cat /sessions/jolly-clever-mccarthy/mnt/PropEdge/logs/scraper-daemon.log
cat /sessions/jolly-clever-mccarthy/mnt/PropEdge/logs/scraper-daemon-error.log
```

---

## Schedule

Your scraper will run automatically at:
- **11:30 AM EST** (every day)
- **6:00 PM EST** (every day)

All output goes to: `/sessions/jolly-clever-mccarthy/mnt/PropEdge/logs/`

---

## Troubleshooting

### ❌ "Chrome not found"
Install Google Chrome from https://www.google.com/chrome

### ❌ "Connection blocked by network allowlist"
This is a sandbox restriction. The error should go away once you install this on your real Mac (not in the Cowork sandbox).

### ❌ "An `executablePath` or `channel` must be specified"
The scraper couldn't find Chrome. Make sure it's installed at `/Applications/Google Chrome.app`

### ❌ Logs show "EACCES: permission denied"
The scraper can't write to logs. Fix permissions:
```bash
mkdir -p /sessions/jolly-clever-mccarthy/mnt/PropEdge/logs
chmod 755 /sessions/jolly-clever-mccarthy/mnt/PropEdge/logs
```

### ✅ Everything Working?
Check your Google Sheet — new data should appear within 1-2 hours of scheduled times.

---

## Uninstall (If Needed)

To disable the scheduler:

```bash
launchctl unload ~/Library/LaunchAgents/com.propedge.scraper.plist
rm ~/Library/LaunchAgents/com.propedge.scraper.plist
```

---

## Important Notes

- **Paths are hardcoded** to `/sessions/jolly-clever-mccarthy/mnt/PropEdge` — if you move PropEdge, update all paths in:
  - `run-scraper-daemon.sh`
  - `com.propedge.scraper.plist`

- **Environment variables** — launchd doesn't inherit your shell `.bashrc`/`.zshrc`. All needed env vars are set in:
  - The plist file (PATH, HOME)
  - Your `.env` file (sourced by the script)

- **Logs rotate** — each run creates a new log file with timestamp. Clean old logs manually:
  ```bash
  rm /sessions/jolly-clever-mccarthy/mnt/PropEdge/logs/scraper-run-*.log
  ```

---

## Next Steps

1. **On your Mac:** Follow Installation Steps 1-4 above
2. **Test:** Run Test 1 (manual --visible mode)
3. **Verify:** Check logs to confirm it works
4. **Monitor:** Check logs tomorrow morning at 11:35 AM to see if scheduler ran

Come back if you hit issues.
