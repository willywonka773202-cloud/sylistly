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
import io
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
REMBG_SESSION = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate real transparent product cutouts with local rembg.")
    parser.add_argument("--limit", type=int, default=5, help="Maximum candidates to consider. Default: 5.")
    parser.add_argument("--apply", action="store_true", help="Actually download images and generate cutout PNGs.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing public/assets/cutouts/<id>.png files.")
    parser.add_argument("--max-input-px", type=int, default=1400, help="Resize source images to this max width/height before rembg. Default: 1400.")
    parser.add_argument("--rembg-model", default=os.environ.get("CUTOUT_REMBG_MODEL", "u2netp"), help="rembg model name. Default: u2netp.")
    parser.add_argument(
        "--candidate-json",
        type=Path,
        default=None,
        help="Optional candidate JSON file. Defaults to invoking scripts/prepare-cutout-candidates.ts.",
    )
    parser.add_argument(
        "--categories",
        default="",
        help="Comma-separated category filter, e.g. bottom,shoes,outer,bag,hat,jewelry.",
    )
    parser.add_argument(
        "--category-quotas",
        default="",
        help="Comma-separated per-category quotas, e.g. eyewear:7,hat:6,jewelry:4,outer:7,shoes:3,bottom:3,bag:0.",
    )
    parser.add_argument(
        "--target-vibes",
        default="",
        help="Comma-separated vibe filter forwarded to prepare-cutout-candidates, e.g. classic,street,work,cozy.",
    )
    parser.add_argument(
        "--vibe-quotas",
        default="",
        help="Comma-separated per-vibe quotas, e.g. classic:12,street:12,work:12.",
    )
    parser.add_argument(
        "--prefer-feed-first",
        type=int,
        default=0,
        help="Hint candidate planning toward products likely to help the first N feed posts.",
    )
    parser.add_argument(
        "--target-frame",
        default="",
        help="Frame filter forwarded to prepare-cutout-candidates, e.g. androgynous.",
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


DEFAULT_CATEGORY_QUOTAS = {
    "bottom": 8,
    "shoes": 8,
    "outer": 6,
    "bag": 4,
    "hat": 2,
    "jewelry": 2,
}


def parse_categories(value: str) -> list[str]:
    allowed = {"hat", "outer", "top", "bottom", "shoes", "bag", "eyewear", "jewelry"}
    categories: list[str] = []
    for raw in value.split(","):
        category = raw.strip().lower()
        if category in allowed and category not in categories:
            categories.append(category)
    return categories


def parse_csv(value: str) -> list[str]:
    values: list[str] = []
    for raw in value.split(","):
        normalized = raw.strip().lower()
        if normalized and normalized not in values:
            values.append(normalized)
    return values


def parse_category_quotas(value: str) -> dict[str, int]:
    allowed = {"hat", "outer", "top", "bottom", "shoes", "bag", "eyewear", "jewelry"}
    quotas: dict[str, int] = {}
    for raw in value.split(","):
        if ":" not in raw:
            continue
        category_raw, quota_raw = raw.split(":", 1)
        category = category_raw.strip().lower()
        if category not in allowed:
            continue
        try:
            quota = int(quota_raw.strip())
        except ValueError:
            continue
        quotas[category] = max(0, quota)
    return quotas


def parse_vibe_quotas(value: str) -> dict[str, int]:
    quotas: dict[str, int] = {}
    for raw in value.split(","):
        if ":" not in raw:
            continue
        vibe_raw, quota_raw = raw.split(":", 1)
        vibe = vibe_raw.strip().lower()
        if not vibe:
            continue
        try:
            quota = int(quota_raw.strip())
        except ValueError:
            continue
        quotas[vibe] = max(0, quota)
    return quotas


def select_category_batch(
    candidates: list[dict[str, Any]],
    limit: int,
    categories: list[str],
    category_quotas: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    if not categories:
        return candidates[: max(0, limit)]

    quotas = category_quotas or DEFAULT_CATEGORY_QUOTAS
    category_set = set(categories)
    grouped: dict[str, list[dict[str, Any]]] = {category: [] for category in categories}
    for candidate in candidates:
        category = str(candidate.get("category", "")).strip().lower()
        if category in category_set:
            grouped.setdefault(category, []).append(candidate)

    selected: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for category in categories:
        quota = quotas.get(category, 0)
        if quota <= 0:
            if category_quotas is not None:
                continue
            quota = max(1, limit // max(1, len(categories)))
        for candidate in grouped.get(category, [])[:quota]:
            product_id = str(candidate.get("id", ""))
            if product_id in seen_ids:
                continue
            selected.append(candidate)
            seen_ids.add(product_id)
            if len(selected) >= limit:
                return selected

    # Redistribute remaining slots to the requested weak categories, but never
    # add categories outside the explicit filter.
    while len(selected) < limit:
        added = False
        for category in categories:
            for candidate in grouped.get(category, []):
                product_id = str(candidate.get("id", ""))
                if product_id in seen_ids:
                    continue
                selected.append(candidate)
                seen_ids.add(product_id)
                added = True
                break
            if len(selected) >= limit:
                return selected
        if not added:
            break

    return selected


def load_candidates(
    limit: int,
    candidate_json: Path | None,
    categories: list[str],
    category_quotas: dict[str, int] | None = None,
    target_vibes: list[str] | None = None,
    vibe_quotas: dict[str, int] | None = None,
    target_frame: str = "",
    prefer_feed_first: int = 0,
) -> list[dict[str, Any]]:
    if candidate_json:
        payload = json.loads(candidate_json.read_text(encoding="utf-8"))
    else:
        npx = shutil.which("npx") or shutil.which("npx.cmd")
        if not npx:
            raise RuntimeError("npx was not found on PATH; pass --candidate-json with a prepared report instead.")
        requested_quota_total = sum(category_quotas.values()) if category_quotas else 0
        planner_limit = max(limit, requested_quota_total * 2, 60) if (categories or target_vibes or target_frame) else limit
        command = [npx, "jiti", "scripts/prepare-cutout-candidates.ts", f"--limit={planner_limit}", "--json"]
        if categories:
            command.append(f"--categories={','.join(categories)}")
        if target_vibes:
            command.append(f"--target-vibes={','.join(target_vibes)}")
        if vibe_quotas:
            command.append("--vibe-quotas=" + ",".join(f"{vibe}:{quota}" for vibe, quota in vibe_quotas.items()))
        if target_frame:
            command.append(f"--target-frame={target_frame}")
        if prefer_feed_first > 0:
            command.append(f"--prefer-feed-first={prefer_feed_first}")
        with tempfile.NamedTemporaryFile("w+b", delete=False) as output_file:
            output_path = Path(output_file.name)
            subprocess.run(
                command,
                cwd=ROOT,
                stdout=output_file,
                check=True,
            )
        try:
            payload = json.loads(output_path.read_text(encoding="utf-8"))
        finally:
            output_path.unlink(missing_ok=True)
    candidates = payload.get("candidates", [])
    return select_category_batch(candidates, limit, categories, category_quotas)


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


def normalize_input_image(input_bytes: bytes, max_input_px: int) -> bytes:
    from PIL import Image, ImageOps

    with Image.open(io.BytesIO(input_bytes)) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA")
        limit = max(320, max_input_px)
        if max(image.size) > limit:
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="PNG", optimize=True)
        return output.getvalue()


def get_rembg_session(model_name: str):
    global REMBG_SESSION
    if REMBG_SESSION is None:
        from rembg import new_session

        REMBG_SESSION = new_session(model_name)
    return REMBG_SESSION


def generate_cutout(input_bytes: bytes, model_name: str, max_input_px: int) -> bytes:
    from rembg import remove

    normalized_bytes = normalize_input_image(input_bytes, max_input_px)
    return remove(normalized_bytes, session=get_rembg_session(model_name))


def write_report(report: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    categories = parse_categories(args.categories)
    target_vibes = parse_csv(args.target_vibes)
    vibe_quotas = parse_vibe_quotas(args.vibe_quotas)
    target_frame = args.target_frame.strip().lower()
    category_quotas = parse_category_quotas(args.category_quotas)
    if category_quotas:
        for category in category_quotas:
            if category not in categories:
                categories.append(category)
    CUTOUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    has_rembg, rembg_error = rembg_available()
    candidates = load_candidates(
        args.limit,
        args.candidate_json,
        categories,
        category_quotas or None,
        target_vibes,
        vibe_quotas or None,
        target_frame,
        args.prefer_feed_first,
    )
    report: dict[str, Any] = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mode": "apply" if args.apply else "dry-run",
        "limit": args.limit,
        "categoryFilter": categories,
        "categoryQuotas": {category: (category_quotas or DEFAULT_CATEGORY_QUOTAS).get(category, 0) for category in categories},
        "targetVibes": target_vibes,
        "vibeQuotas": vibe_quotas,
        "targetFrame": target_frame,
        "preferFeedFirst": args.prefer_feed_first,
        "rembgAvailable": has_rembg,
        "rembgError": rembg_error,
        "rembgModel": args.rembg_model,
        "maxInputPx": args.max_input_px,
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
                output_bytes = generate_cutout(source_bytes, args.rembg_model, args.max_input_px)
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
