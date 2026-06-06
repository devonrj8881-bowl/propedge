# PropEdge Cron Job Setup Instructions

## Quick Start

```bash
cd /Users/devonjohnson/Documents/Claude/Projects/PropEdge
chmod +x setup-cron-jobs.sh
./setup-cron-jobs.sh launchd  # macOS launchd (recommended)
```

**That's it.** Enrichment jobs now run automatically daily.

---

## What Gets Installed

### Option 1: macOS Launchd (Recommended)

Three persistent background agents:

| Agent | Time (EST) | Sport |
|-------|-----------|-------|
| `com.propedge.enrichment.nba` | 11:30 AM | NBA |
| `com.propedge.enrichment.nhl` | 3:00 PM | NHL |
| `com.propedge.enrichment.mlb` | 5:30 PM | MLB |

**Pros:**
- Survives reboots automatically
- More reliable than cron
- Better error logging
- macOS-native

**Cons:**
- Only works on macOS

### Option 2: Standard Cron (Alternative)

If you prefer cron (legacy):
```bash
./setup-cron-jobs.sh cron
```

Same schedule, uses standard `crontab`.

---

## Verification

### Check Launchd Status

```bash
# List all PropEdge agents
launchctl list | grep propedge

# Output should show 3 agents
# Example:
# - com.propedge.enrichment.nba
# - com.propedge.enrichment.nhl
# - com.propedge.enrichment.mlb
```

### Check Cron Status

```bash
# View installed crontab
crontab -l

# Output should show 3 PropEdge entries
```

### Verify Logs

```bash
# Check if enrichment ran
ls -la logs/

# Watch live logs (auto-refreshes)
tail -f logs/enrichment-nba.log
```

---

## Manual Testing

Test the enrichment without waiting for scheduled time:

```bash
# NBA
node run-enrichment.js NBA

# NHL
node run-enrichment.js NHL

# MLB
node run-enrichment.js MLB
```

Check output in `propedge-enriched/` directory.

---

## Management Commands

### Disable All Jobs

**Launchd:**
```bash
launchctl unload ~/Library/LaunchAgents/com.propedge.enrichment.*.plist
```

**Cron:**
```bash
crontab -r
```

### Re-enable All Jobs

**Launchd:**
```bash
launchctl load ~/Library/LaunchAgents/com.propedge.enrichment.*.plist
```

**Cron:**
```bash
./setup-cron-jobs.sh cron
```

### Check Individual Agent Status

```bash
# Get full info about NBA agent
launchctl info com.propedge.enrichment.nba
```

### Uninstall Completely

**Launchd:**
```bash
launchctl unload ~/Library/LaunchAgents/com.propedge.enrichment.*.plist
rm ~/Library/LaunchAgents/com.propedge.enrichment.*.plist
```

**Cron:**
```bash
crontab -r
```

---

## Troubleshooting

### Jobs Not Running

**Check if launchd loaded:**
```bash
launchctl list | grep propedge
```

If empty, reload:
```bash
./setup-cron-jobs.sh launchd
```

**Check stderr log:**
```bash
cat logs/enrichment-nba-stderr.log
```

### Permission Issues

If enrichment fails with permission error:

```bash
# Ensure scripts are executable
chmod +x run-enrichment.js setup-cron-jobs.sh

# Ensure logs directory exists
mkdir -p /Users/devonjohnson/Documents/Claude/Projects/PropEdge/logs

# Re-run setup
./setup-cron-jobs.sh launchd
```

### Node Not Found

If launchd logs show "node: command not found":

```bash
# Get full path to node
which node
# Output example: /usr/local/bin/node

# Edit the plist file to use absolute path
# Or add node to PATH in ~/.bash_profile:
export PATH="/usr/local/bin:$PATH"
```

### Network Timeouts

If ESPN API calls timeout:
- Normal during high traffic (skip that run)
- Check network connectivity
- Enrichment retries next scheduled time
- No manual intervention needed

---

## Schedule Times (EST)

| Sport | Time | Reasoning |
|-------|------|-----------|
| **NBA** | 11:30 AM | Before afternoon games |
| **NHL** | 3:00 PM | Between morning/evening games |
| **MLB** | 5:30 PM | Before evening games |

Adjust times if needed (edit `.plist` files directly).

---

## Log Files

Enrichment creates logs in `logs/` directory:

```
logs/
├── enrichment-nba.log          # NBA enrichment output
├── enrichment-nba-stdout.log   # NBA stdout
├── enrichment-nba-stderr.log   # NBA errors
├── enrichment-nhl.log
├── enrichment-nhl-stdout.log
├── enrichment-nhl-stderr.log
├── enrichment-mlb.log
├── enrichment-mlb-stdout.log
└── enrichment-mlb-stderr.log
```

View real-time logs:
```bash
tail -f logs/enrichment-nba.log
```

Archive old logs:
```bash
gzip logs/enrichment-*.log  # Compress
rm logs/enrichment-*.log.gz # Delete old
```

---

## Advanced: Custom Schedule

To change execution times, edit the launchd plist files:

```bash
nano ~/Library/LaunchAgents/com.propedge.enrichment.nba.plist
```

Find the `StartCalendarInterval` section:
```xml
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key>
  <integer>11</integer>       <!-- Change 11 to desired hour (0-23) -->
  <key>Minute</key>
  <integer>30</integer>       <!-- Change 30 to desired minute (0-59) -->
</dict>
```

Save and reload:
```bash
launchctl unload ~/Library/LaunchAgents/com.propedge.enrichment.nba.plist
launchctl load ~/Library/LaunchAgents/com.propedge.enrichment.nba.plist
```

---

## Daily Workflow

**What happens automatically:**

```
11:30 AM → NBA enrichment runs
  ✓ Fetches game logs from NBA.com
  ✓ Calculates per-min efficiency
  ✓ Fetches matchup defensive ranks
  ✓ Outputs: propedge-enriched-NBA-2026-04-27.csv

3:00 PM  → NHL enrichment runs (same process)

5:30 PM  → MLB enrichment runs (same process)
```

**PropEdge automatically imports** the enriched metrics on next page load.

---

## Summary

- ✅ Run `./setup-cron-jobs.sh launchd` once
- ✅ Check `launchctl list | grep propedge` to verify
- ✅ Enrichment runs 3× daily automatically
- ✅ Logs saved to `logs/` directory
- ✅ No further action needed
