#!/usr/bin/env python3
"""Generate transparent product cutouts with local rembg.

Default mode is dry-run. It reads the existing TypeScript candidate planner,
prints the products that would be processed, and writes a run report. It only
downloads source images and writes PNG assets when --apply is passed.

Install/runtime note:
  - On this Windows workspace, use `py` if `python` points to the Store alias.
  - Requires rembg in the active Python environment for --apply.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CUTOUT_DIR = ROOT / "public" / "assets" / "cutouts"
REPORT_DIR = ROOT / "data" / "catalog" / "cutout-reviewed"
REPORT_PATH = REPORT_DIR / "cutout-run-report.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate real transparent product cutouts with local rembg.")
    parser.add_argument("--limit", type=int, default=5, help="Maximum candidates to consider. Default: 5.")
    parser.add_argument("--apply", action="store_true", help="Actually download images and generate cutout PNGs.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing public/assets/cutouts/<id>.png files.")
    parser.add_argument(
        "--candidate-json",
        type=Path,
        default=None,
        help="Optional candidate JSON file. Defaults to invoking scripts/prepare-cutout-candidates.ts.",
    )
    return parser.parse_args()


def safe_id(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "-", value).strip("-")[:120]


def rembg_available() -> tuple[bool, str | None]:
    try:
        import rembg  # noqa: F401

        return True, None
    except Exception as exc:  # pragma: no cover - environment dependent
        return False, str(exc)


def load_candidates(limit: int, candidate_json: Path | None) -> list[dict[str, Any]]:
    if candidate_json:
        payload = json.loads(candidate_json.read_text(encoding="utf-8"))
    else:
        npx = shutil.which("npx") or shutil.which("npx.cmd")
        if not npx:
            raise RuntimeError("npx was not found on PATH; pass --candidate-json with a prepared report instead.")
        raw = subprocess.check_output(
            [npx, "jiti", "scripts/prepare-cutout-candidates.ts", f"--limit={limit}", "--json"],
            cwd=ROOT,
            text=True,
            encoding="utf-8",
        )
        payload = json.loads(raw)
    candidates = payload.get("candidates", [])
    return candidates[: max(0, limit)]


def is_safe_image_url(url: str) -> bool:
    lower = url.strip().lower()
    return (
        lower.startswith("https://")
        and not lower.startswith("data:")
        and ".svg" not in lower
        and "google.com/search" not in lower
    )


def download_bytes(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "SylistlyCutoutPipeline/1.0 (+local dry-run controlled)",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        content_type = response.headers.get("content-type", "")
        if "image" not in content_type:
            raise RuntimeError(f"URL did not return image content-type: {content_type}")
        return response.read()


def generate_cutout(input_bytes: bytes) -> bytes:
    from rembg import remove

    return remove(input_bytes)


def write_report(report: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    CUTOUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    has_rembg, rembg_error = rembg_available()
    candidates = load_candidates(args.limit, args.candidate_json)
    report: dict[str, Any] = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mode": "apply" if args.apply else "dry-run",
        "limit": args.limit,
        "rembgAvailable": has_rembg,
        "rembgError": rembg_error,
        "outputDir": str(CUTOUT_DIR.relative_to(ROOT)).replace(os.sep, "/"),
        "items": [],
    }

    if args.apply and not has_rembg:
        report["blockedReason"] = "rembg is not installed in the active Python environment."
        write_report(report)
        print("BLOCKED: rembg is not installed. No images were downloaded or generated.")
        print("Install later with: py -m pip install rembg pillow onnxruntime")
        print(f"Report written: {REPORT_PATH.relative_to(ROOT)}")
        return 2

    for candidate in candidates:
        product_id = safe_id(str(candidate.get("id", "")))
        image_url = str(candidate.get("imageUrl", ""))
        output_path = CUTOUT_DIR / f"{product_id}.png"
        item_report: dict[str, Any] = {
            "id": product_id,
            "brand": candidate.get("brand"),
            "name": candidate.get("name"),
            "category": candidate.get("category"),
            "imageUrl": image_url,
            "outputPath": str(output_path.relative_to(ROOT)).replace(os.sep, "/"),
            "status": "planned",
        }

        if not product_id or not is_safe_image_url(image_url):
            item_report["status"] = "blocked"
            item_report["reason"] = "unsafe or missing image URL"
            report["items"].append(item_report)
            continue

        if output_path.exists() and not args.force:
            item_report["status"] = "skipped"
            item_report["reason"] = "cutout already exists; pass --force to overwrite"
            report["items"].append(item_report)
            continue

        if not args.apply:
            item_report["status"] = "dry-run"
            item_report["reason"] = "pass --apply after installing rembg to generate this PNG"
            report["items"].append(item_report)
            continue

        try:
            with tempfile.TemporaryDirectory(prefix="sylistly-cutout-") as tmp:
                _tmp_dir = Path(tmp)
                source_bytes = download_bytes(image_url)
                output_bytes = generate_cutout(source_bytes)
                output_path.write_bytes(output_bytes)
                item_report["status"] = "generated"
                item_report["bytes"] = len(output_bytes)
        except Exception as exc:  # pragma: no cover - network/model dependent
            item_report["status"] = "failed"
            item_report["reason"] = str(exc)

        report["items"].append(item_report)

    write_report(report)
    generated = sum(1 for item in report["items"] if item["status"] == "generated")
    planned = sum(1 for item in report["items"] if item["status"] in {"dry-run", "planned"})
    failed = sum(1 for item in report["items"] if item["status"] in {"failed", "blocked"})

    print("Sylistly local cutout pipeline")
    print("==============================")
    print(f"Mode: {report['mode']}")
    print(f"rembg available: {has_rembg}")
    if rembg_error:
        print(f"rembg error: {rembg_error}")
    print(f"Candidates considered: {len(candidates)}")
    print(f"Generated: {generated}")
    print(f"Planned/skipped dry-run: {planned}")
    print(f"Failed/blocked: {failed}")
    print(f"Report written: {REPORT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
