#!/usr/bin/env bash
# One-off background catalog expansion: generate higher-quality transparent
# cutouts for the thinnest slots, register them, and rebuild the client catalog.
# Logs to /tmp/sylistly-cutout-expand.log. Safe to re-run.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
LOG=/tmp/sylistly-cutout-expand.log
LIMIT="${1:-240}"
MODEL="${CUTOUT_REMBG_MODEL:-isnet-general-use}"

echo "[$(date '+%H:%M:%S')] START expand: limit=$LIMIT model=$MODEL" | tee "$LOG"

echo "[$(date '+%H:%M:%S')] before: client-catalog products = $(python3 -c "import json;print(len(json.load(open('data/client-catalog.json'))))" 2>/dev/null || echo '?')" | tee -a "$LOG"

echo "[$(date '+%H:%M:%S')] STEP 1/3 generate cutouts (rembg, may download model ~170MB)..." | tee -a "$LOG"
python3 scripts/generate-cutouts-local.py --apply --limit="$LIMIT" --rembg-model "$MODEL" --max-input-px 1600 >> "$LOG" 2>&1
GEN=$?
echo "[$(date '+%H:%M:%S')] generate exit=$GEN; cutout PNGs on disk = $(ls public/assets/cutouts/*.png 2>/dev/null | wc -l | tr -d ' ')" | tee -a "$LOG"

echo "[$(date '+%H:%M:%S')] STEP 2/3 register cutouts..." | tee -a "$LOG"
npx jiti scripts/register-cutouts.ts --apply >> "$LOG" 2>&1
echo "[$(date '+%H:%M:%S')] register exit=$?" | tee -a "$LOG"

echo "[$(date '+%H:%M:%S')] STEP 3/3 rebuild client catalog..." | tee -a "$LOG"
npx jiti scripts/build-client-catalog.ts >> "$LOG" 2>&1
echo "[$(date '+%H:%M:%S')] build exit=$?" | tee -a "$LOG"

echo "[$(date '+%H:%M:%S')] after: client-catalog products = $(python3 -c "import json;print(len(json.load(open('data/client-catalog.json'))))" 2>/dev/null || echo '?')" | tee -a "$LOG"
echo "[$(date '+%H:%M:%S')] DONE" | tee -a "$LOG"
