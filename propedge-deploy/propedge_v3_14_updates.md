---
name: PropEdge v3.14 Major Updates - March 30, 2026
description: Significant updates including Ticket Watchlist and OneSignal Push Notifications integration
type: project
---

## PropEdge v3.14 — Major Release

**Release Date:** March 30, 2026
**Status:** ✅ Live and operational

### 🎯 Key Updates

#### 1. **Ticket Watchlist Feature**
- Persistent watchlist stored in localStorage
- Cross-reference watchlist against latest injury data
- Users can save/monitor specific prop tickets for tracking
- Real-time updates as injury/player status changes

#### 2. **OneSignal Push Notifications**
- **OneSignal App ID:** `1f3c8cb5-b8b4-4c1b-8bb1-adc70785db57`
- **Safari Web ID:** `web.onesignal.auto.1f3c8cb5-b8b4-4c1b-8bb1-adc70785db57`
- **SDK Version:** v16 (OneSignalSDK.page.js + OneSignalSDK.sw.js)
- Custom notification UI (notifyButton disabled, custom bell implementation)
- Handlers for push and notification click events
- Localhost support for testing

#### 3. **Service Worker Integration**
- **File:** `sw.js` (production service worker)
- Handles both PropEdge custom notifications and OneSignal passthrough
- Push event listeners for notification display
- Notification click handlers for app refocus/navigation
- Imports OneSignal SDK worker: `https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js`

#### 4. **Updated Icon**
- **File:** `icon.svg`
- New target emoji (🎯) design
- Dark background (#22263a) with 38px border radius
- 192x192 viewBox for PWA compatibility

#### 5. **Navigation & UI Enhancements**
- 5-section bottom navigation bar (nav-tabs)
- Enhanced filter pills with category-specific styling
- Responsive grid layouts (1 col mobile → 3 col desktop)
- Performance optimizations for notification handling

### 📁 Files Updated

| File | Purpose | Status |
|------|---------|--------|
| `index.html` | Main app file (v3.14) | ✅ Ready |
| `sw.js` | Service worker (push + OneSignal) | ✅ Ready |
| `OneSignalSDKWorker.js` | OneSignal worker imports | ✅ Ready |
| `OneSignalSDKUpdaterWorker.js` | OneSignal updater | ✅ Ready |
| `icon.svg` | PWA icon (target emoji) | ✅ Ready |

### 🚀 Deployment Considerations

- Service worker scope: `/` (site-wide)
- Safe area insets for mobile (notch support)
- Secure HTTPS required for OneSignal
- localStorage for watchlist persistence
- PWA-ready with manifest support

### 📝 Implementation Notes

**Why:** Push notifications enable real-time alerts for important prop changes (line movements, injuries, injury status updates on watched tickets)

**How to apply:** Reference these files as the canonical production versions for future updates. The watchlist + notification system is core functionality now.
