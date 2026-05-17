#!/usr/bin/env python3
"""Generate review-only cutouts from hydrated merchant candidates.

This script is intentionally separate from the live catalog cutout generator.
It reads hydrated SearchAPI candidate reports, selects high/medium merchant
image candidates, writes transparent PNGs under data/catalog/candidates/cutouts,
and never registers them into the runtime catalog.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "catalog" / "reports" / "merchant-hydration-report.json"
OUTPUT_DIR = ROOT / "data" / "catalog" / "candidates" / "cutouts"
REPORT_PATH = ROOT / "data" / "catalog" / "reports" / "candidate-cutout-review-report.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate review-only candidate cutouts from hydrated merchant images.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Hydrated candidate JSON/report path.")
    parser.add_argument("--limit", type=int, default=10, help="Maximum candidate cutouts. Default: 10.")
    parser.add_argument("--apply", action="store_true", help="Actually download images and generate PNG cutouts.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing candidate cutout PNGs.")
    parser.add_argument("--json", action="store_true", help="Print JSON report.")
    return parser.parse_args()


def safe_id(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "-", value).strip("-")[:120]


def rembg_available() -> tuple[bool, str | None]:
    try:
        import rembg  # noqa: F401

        return True, None
    except Exception as exc:  # pragma: no cover - environment dependent
        return False, str(exc)


def load_items(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict) and isinstance(payload.get("items"), list):
        return payload["items"]
    if isinstance(payload, list):
        return payload
    return []


def is_safe_candidate_image(url: str) -> bool:
    lower = url.strip().lower()
    return (
        lower.startswith("https://")
        and "${" not in lower
        and "%7b" not in lower
        and "%7d" not in lower
        and "encrypted-tbn" not in lower
        and "googleusercontent" not in lower
        and "placeholder" not in lower
        and not lower.endswith(".svg")
    )


def rank_candidate(item: dict[str, Any]) -> int:
    score = 0
    readiness = str(item.get("cutoutReadiness", ""))
    if readiness == "high":
        score += 100
    elif readiness == "medium":
        score += 70
    elif readiness == "reviewOnly":
        score += 20
    if item.get("replacementProductId"):
        score += 35
    if str(item.get("targetFrame", "")) == "androgynous":
        score += 20
    vibe = str(item.get("targetVibe", ""))
    if vibe in {"classic", "street", "work", "cozy"}:
        score += 15
    image_type = str(item.get("imageUrlType", ""))
    if image_type == "merchantCdn":
        score += 12
    elif image_type == "merchantImage":
        score += 8
    flags = item.get("qualityFlags") if isinstance(item.get("qualityFlags"), list) else []
    if any("unsafe" in str(flag) for flag in flags):
        score -= 100
    return score


def select_candidates(items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    eligible = []
    for item in items:
        if str(item.get("hydrationStatus")) != "hydrated":
            continue
        if str(item.get("cutoutReadiness")) not in {"high", "medium"}:
            continue
        if str(item.get("imageUrlType")) not in {"merchantCdn", "merchantImage"}:
            continue
        image_url = str(item.get("extractedImageUrl", ""))
        if not is_safe_candidate_image(image_url):
            continue
        eligible.append(item)
    return sorted(eligible, key=rank_candidate, reverse=True)[: max(0, limit)]


def download_bytes(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "SylistlyCandidateCutoutPipeline/1.0 (+review-only)",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
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


def has_alpha_channel(path: Path) -> bool:
    try:
        from PIL import Image

        with Image.open(path) as image:
            return image.mode in {"RGBA", "LA"} or "transparency" in image.info
    except Exception:
        return False


def main() -> int:
    args = parse_args()
    has_rembg, rembg_error = rembg_available()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    items = load_items(args.input)
    selected = select_candidates(items, args.limit)
    report: dict[str, Any] = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mode": "apply" if args.apply else "dry-run",
        "input": str(args.input.relative_to(ROOT) if args.input.is_absolute() and args.input.is_relative_to(ROOT) else args.input),
        "limit": args.limit,
        "rembgAvailable": has_rembg,
        "rembgError": rembg_error,
        "outputDir": str(OUTPUT_DIR.relative_to(ROOT)).replace("\\", "/"),
        "selectedCount": len(selected),
        "items": [],
        "notes": [
            "Review-only candidate cutouts. These are not registered into the runtime catalog.",
            "Live catalog product data and catalog cutout overrides are not modified by this script.",
        ],
    }

    if args.apply and not has_rembg:
        report["blockedReason"] = "rembg is not installed in the active Python environment."
        REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2) if args.json else "BLOCKED: rembg unavailable.")
        return 2

    for item in selected:
        original_id = safe_id(str(item.get("originalCandidateId", "")))
        title_part = safe_id(str(item.get("title", "candidate")))[:50]
        output_path = OUTPUT_DIR / f"{original_id}-{title_part}.png"
        item_report = {
            "originalCandidateId": item.get("originalCandidateId", ""),
            "title": item.get("title", ""),
            "merchant": item.get("merchant", ""),
            "domain": item.get("domain", ""),
            "targetCategory": item.get("targetCategory", ""),
            "targetVibe": item.get("targetVibe", ""),
            "targetFrame": item.get("targetFrame", ""),
            "replacementProductId": item.get("replacementProductId", ""),
            "cutoutReadiness": item.get("cutoutReadiness", ""),
            "extractedImageUrl": item.get("extractedImageUrl", ""),
            "outputPath": str(output_path.relative_to(ROOT)).replace("\\", "/"),
            "status": "planned",
        }
        if output_path.exists() and not args.force:
            item_report["status"] = "skipped"
            item_report["reason"] = "candidate cutout already exists; pass --force to overwrite"
            report["items"].append(item_report)
            continue
        if not args.apply:
            item_report["status"] = "dry-run"
            report["items"].append(item_report)
            continue
        try:
            source_bytes = download_bytes(str(item.get("extractedImageUrl", "")))
            output_bytes = generate_cutout(source_bytes)
            output_path.write_bytes(output_bytes)
            item_report["status"] = "generated"
            item_report["bytes"] = len(output_bytes)
            item_report["hasAlpha"] = has_alpha_channel(output_path)
        except Exception as exc:  # pragma: no cover - network/model dependent
            item_report["status"] = "failed"
            item_report["reason"] = str(exc)
        report["items"].append(item_report)

    report["generatedCount"] = sum(1 for item in report["items"] if item.get("status") == "generated")
    report["alphaVerifiedCount"] = sum(1 for item in report["items"] if item.get("hasAlpha") is True)
    report["failedCount"] = sum(1 for item in report["items"] if item.get("status") in {"failed", "blocked"})
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print("Sylistly candidate cutout pipeline")
        print("==================================")
        print(f"Mode: {report['mode']}")
        print(f"Selected: {report['selectedCount']}")
        print(f"Generated: {report['generatedCount']}")
        print(f"Alpha verified: {report['alphaVerifiedCount']}")
        print(f"Failed/blocked: {report['failedCount']}")
        print(f"Report written: {REPORT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
