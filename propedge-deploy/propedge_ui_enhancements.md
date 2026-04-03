---
name: PropEdge UI Enhancements - March 2026
description: Dark theme visual improvements including games bar and SMS button enhancements
type: project
---

## Enhancements Completed (March 28, 2026)

**Games Bar Improvements:**
- Increased padding (12px → 16-24px) with green gradient background
- Added glowing green top/bottom borders (2px, semi-transparent)
- Made cards bigger: 140px → 160px min-width
- Enhanced styling with gradients, shadows, and glow on hover
- Larger, bolder text: teams 12→13-14px, scores 14→16-18px
- Uppercase, bold status labels with letter spacing

**Parlay SMS Button:**
- Replaced small text link with prominent full-width button
- Added orange gradient styling (matching other CTAs)
- Larger font (11px → 15px, bold)
- Functional textPicks() handler for SMS opening on mobile
- Better visual hierarchy on parlay view

**Overall Dark Theme Polish:**
- Prop cards: gradient overlays, glowing borders on hover, better shadows
- Score badges: larger (50→58px), gradient fills, colored glow shadows
- All badges: enhanced gradients and glowing effects
- Filter pills & sport tabs: gradient fills and glow on active state
- Subtle background gradient on page
- Better spacing (16→22-26px gaps on desktop)
- Smooth cubic-bezier animations throughout

**File Modified:** propedge_v3.html (deployed live)

## Deployment Workflow Going Forward

**Simple Deploy Method:**
Just ask "deploy" or "push to live" → I run: `bash "[C] deploy.sh"`
- Deploys directly to Netlify via SSH/SCP
- No git needed, instant deploy to https://propedgemasters.netlify.app

**Optional Git Workflow:**
- GitHub repo: https://github.com/devonrj8881-bowl/propedge
- SSH key set up on Mac
- GitHub Actions auto-deploys within ~15 mins

**Preferred going forward:** Use deploy script for speed, git for version control (optional)
