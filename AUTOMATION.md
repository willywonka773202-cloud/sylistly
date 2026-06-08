# Auto-expand automation — clothing catalog & pre-made outfits

Keeps the app growing on its own: periodically **grow the clothing catalog**, then
**regenerate the coordinated, gendered outfit library** from it, verify, and deploy.

## What runs

| Step | Command | Needs a key? | What it does |
|---|---|---|---|
| 1. Grow catalog | `npm run catalog:expand` | **Yes — `SEARCHAPI_KEY`** | Finds new shoppable products via SearchAPI, merges into `data/generated-catalog.json` (backs up first). |
| 2. Rebuild client catalog | `npm run catalog:client` | No | Quality-gates the catalog (only products with usable transparent images survive) → `data/client-catalog.json`. |
| 3. Regenerate outfit library | `npm run library:generate` | No | Rebuilds the 15k coordinated, gendered outfits → `data/outfit-library.json`. |

Orchestrated by **`npm run auto:expand`** (steps 1–3) and **`npm run auto:ship`** (1–3 + verify + commit + `vercel --prod`).

**Safety:** new products only reach prod if they pass the quality gate (transparent cutout, real link, etc.), so growth can't inject junk. `auto:ship` runs `tsc` + a production build and **only deploys if green**. A run with no new products is a no-op.

## Option A — Local schedule (works today, matches the current deploy flow)

Everything currently ships via the **local Vercel CLI** (the feature branch isn't pushed to GitHub), so a local scheduled job is the zero-setup path.

1. Put your key where the job can see it (only needed for *growth*; regeneration works without it):
   ```sh
   echo 'SEARCHAPI_KEY=sk-...' >> ~/.sylistly-autoexpand.env
   ```
2. Schedule it weekly with launchd. Create `~/Library/LaunchAgents/com.sylistly.autoexpand.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0"><dict>
     <key>Label</key><string>com.sylistly.autoexpand</string>
     <key>ProgramArguments</key>
     <array>
       <string>/bin/zsh</string><string>-lc</string>
       <string>set -a; source ~/.sylistly-autoexpand.env 2>/dev/null; cd ~/Documents/GitHub/sylistly && /usr/bin/env npm run auto:ship >> /tmp/sylistly-autoexpand.log 2>&1</string>
     </array>
     <key>StartCalendarInterval</key><dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>17</integer></dict>
   </dict></plist>
   ```
   ```sh
   launchctl load ~/Library/LaunchAgents/com.sylistly.autoexpand.plist
   ```
   Runs Mondays 09:17 (Mac must be awake). Logs to `/tmp/sylistly-autoexpand.log`.
3. Run once now to test: `npm run auto:ship`.

## Option B — GitHub Actions (always-on, no Mac required)

A workflow is committed at `.github/workflows/auto-expand.yml`. To activate:

1. **Push the branch** (currently local-only — 197 commits ahead of `origin/main`):
   `git push origin overhaul/ai-redesign`
2. Add repo **secrets** (Settings → Secrets → Actions): `VERCEL_TOKEN` (required to deploy), `SEARCHAPI_KEY` (optional, enables catalog growth).
3. For the **weekly cron** to fire, the workflow file must be on the **default branch** — either set `overhaul/ai-redesign` as default, or merge it to `main`. `workflow_dispatch` (manual / `gh workflow run auto-expand.yml`) works from any branch immediately.

## Caveat — new products need transparent cutouts

SearchAPI returns merchant image URLs, not transparent PNG cutouts. The app only shows products with usable transparent images, so newly-found products won't appear until cutouts are generated (`scripts/generate-cutouts-local.py` / the cutout pipeline). Until then, growth quietly adds candidates without changing the live experience — safe, but yield depends on the cutout step.
