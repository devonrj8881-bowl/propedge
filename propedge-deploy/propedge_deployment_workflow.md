---
name: PropEdge One-Command Deploy Workflow
description: Simple pd alias for instant Netlify deployment without git or GitHub Actions
type: feedback
---

## Deploy Command Setup (March 28, 2026)

**Why:** Git lock issues on mounted filesystem made git-based deployment unreliable. Direct Netlify API deployment is instant (2-5 seconds) and requires no git operations.

**How to apply:** Use this for all future PropEdge deployments instead of git/GitHub.

## One-Line Setup

Add to `~/.zshrc`:
```bash
alias pd="cd /tmp && rm -rf pe-deploy && mkdir pe-deploy && cp ~/Documents/Claude\ Workspace\ Devon/02\ Projects/PropEdge/propedge_v3.html pe-deploy/index.html && cd pe-deploy && zip -r pe.zip index.html > /dev/null && curl -s -H 'Authorization: Bearer nfp_VediMBiQFFgRzFvYZqubcJw6kESnygEK8e4b' -H 'Content-Type: application/zip' --data-binary '@pe.zip' 'https://api.netlify.com/api/v1/sites/838cca00-a711-4175-b00e-95203cda9900/deploys' && echo '✅ DEPLOYED!'"
```

Then reload shell:
```bash
source ~/.zshrc
```

## Workflow

1. Edit `propedge_v3.html`
2. Save file
3. Type `pd` in terminal
4. ✅ Live in 2-5 seconds at https://propedgemasters.netlify.app

## Credentials Used

- **Netlify Site ID**: `838cca00-a711-4175-b00e-95203cda9900`
- **Netlify Token**: `nfp_VediMBiQFFgRzFvYZqubcJw6kESnygEK8e4b` (stored in alias)
- **File Path**: `~/Documents/Claude Workspace Devon/02 Projects/PropEdge/propedge_v3.html`

## Advantages Over Previous Methods

| Method | Speed | Requires | Issues |
|--------|-------|----------|--------|
| Git + GitHub Actions | 15 min | Git access, auth | Lock files on mounted FS |
| Netlify API (pd alias) | 2-5 sec | None | ✅ Fastest, simplest |
| Manual GitHub web UI | 5-15 min | Browser | Multi-step, slow |

## When to Use

- ✅ After any changes to `propedge_v3.html`
- ✅ Quick iteration and testing
- ✅ Production deployments
- ✅ Anytime you want instant live updates

## Status

**Tested & Working**: March 28, 2026 ✅
**Recommended**: Yes, use `pd` for all future deploys
**Reminder**: See `DEPLOY_REMINDER.md` in PropEdge folder
