import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import httpx
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

def admin_get(
    path: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    timeout: float = 120.0,
) -> tuple[httpx.Response, dict[str, str]]:
    """GET wrapper for query-only OpenAI endpoints (no body/JSON)"""
    api_key = os.getenv("OPENAI_ADMIN_KEY")
    if not api_key:
        raise ValueError("Set OPENAI_ADMIN_KEY first (must be an *admin* key).")
    try:
        resp = httpx.get(
            f"https://api.openai.com/v1/{path}",
            headers={"Authorization": f"Bearer {api_key}"},
            params=params,
            timeout=timeout,
        )
        hdrs = dict(resp.headers)
        resp.raise_for_status()
        return resp, hdrs
    except httpx.HTTPStatusError as err:
        body_text = err.response.text.strip() or "<no body>"
        print(f"[Admin API] HTTP {err.response.status_code}: {body_text}", flush=True)
        logger.error("HTTP %s: %s", err.response.status_code, body_text)
        raise
    except httpx.RequestError as err:
        logger.error("Request error: %s", err)
        raise

def get_recent_completions_usage(
    past_days: int = 14,
    *,
    debug: bool = False,
) -> dict[str, Any]:
    """
    Retrieve organisation-level completions usage daily buckets up to today.

    Parameters
    ----------
    past_days
        Number of 24-hour buckets (1 – 30). The most recent (partial) day is
        included in addition to this count.
    debug
        • True - send only the required `start_time` and max `limit`
    """
    # Add one extra day so that we include "today" as a (possibly partial) bucket.
    # Clamp to a maximum of 31, per 1d bucket_width limit.
    past_days = max(1, min(past_days + 1, 31))
    now = datetime.now(tz=timezone.utc)
    start_dt = (now - timedelta(days=past_days)).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    params: dict[str, Any] = {"start_time": int(start_dt.timestamp())}
    if not debug:
        params.update(
            {
                "end_time": int(now.timestamp()),
                "limit": past_days,
                "bucket_width": "1d",
                "group_by": ["model"],
            }
        )
    else:
        params.update(
            {
                "limit": 31,
            }
        )
    # /v1/organization/usage/completions
    resp, _ = admin_get("organization/usage/completions", params=params)
    usage: dict[str, Any] = resp.json()
    # Add ISO8601 UTC datetime string for the bucket start
    for bucket in usage.get("data", []):
        start_ts = bucket.get("start_time")
        if start_ts is None:
            continue
        start_dt = datetime.fromtimestamp(start_ts, tz=timezone.utc)
        bucket["start_datetime"] = start_dt.isoformat().replace("+00:00", "Z")
    return usage

def printable_completions_usage(
    usage: dict[str, Any],
    *,
    max_model_length: int = 30,
) -> str:
    """
    Format organisation completions usage into a Markdown-compatible table.

    Parameters
    ----------
    usage
        The dict returned by ``get_recent_completions_usage()``.
    max_model_length
        Maximum number of characters to display for a model name. Longer names
        are truncated to this length.

    Returns
    -------
    str
        A Markdown table showing daily, per-model token usage.
    """
    headers = ("UTC Date", "Model", "Input", "Output", "Total", "Requests")
    # Track rows as tuples of strings
    rows: list[tuple[str, str, str, str, str, str]] = []
    # Initialise column widths from header labels
    widths = [len(h) for h in headers]
    for bucket in usage.get("data", []):
        # The API documentation is slightly inconsistent between "result" and "results",
        # so support both to be robust.
        results = bucket.get("results")
        if results is None:
            results = bucket.get("result") or []
        if not results:
            continue
        # Convert ISO8601 start datetime ("YYYY-MM-DDT00:00:00Z") to just "YYYY-MM-DD"
        date_iso = bucket.get("start_datetime", "")
        date_str = date_iso[:10] if date_iso else ""
        first_for_day = True
        for result in results:
            # Be defensive in case the endpoint ever returns mixed object types.
            if result.get("object") != "organization.usage.completions.result":
                continue
            model_full = result.get("model") or "(all models)"
            # Truncate model name to a fixed length for better console width
            model_display = model_full
            if max_model_length > 0 and len(model_display) > max_model_length:
                model_display = model_display[:max_model_length]
            input_tokens = int(result.get("input_tokens") or 0)
            output_tokens = int(result.get("output_tokens") or 0)
            total_tokens = input_tokens + output_tokens
            num_requests = int(result.get("num_model_requests") or 0)
            # Only show the date once per day block
            date_cell = date_str if first_for_day else ""
            first_for_day = False
            row = (
                date_cell,
                model_display,
                str(input_tokens),
                str(output_tokens),
                str(total_tokens),
                str(num_requests),
            )
            rows.append(row)
            # Update column widths based on this row
            for i, cell in enumerate(row):
                widths[i] = max(widths[i], len(cell))
    # Build Markdown table lines
    lines: list[str] = []
    # Header row
    header_row = (
        "| "
        + " | ".join(headers[i].ljust(widths[i]) for i in range(len(headers)))
        + " |"
    )
    lines.append(header_row)
    # Separator row, width-aligned with header/body
    separator_row = (
        "| " + " | ".join("-" * widths[i] for i in range(len(headers))) + " |"
    )
    lines.append(separator_row)
    # Data rows
    for row in rows:
        line_cells: list[str] = []
        for i, cell in enumerate(row):
            # Left-align date and model, right-align numeric columns
            if i <= 1:
                line_cells.append(cell.ljust(widths[i]))
            else:
                line_cells.append(cell.rjust(widths[i]))
        line = "| " + " | ".join(line_cells) + " |"
        lines.append(line)
    return "\n".join(lines)

def main() -> None:
    usage = get_recent_completions_usage(past_days=14)
    usage_report = printable_completions_usage(usage)
    print(usage_report)
    # Save report to ~/Downloads/openai usage/usage_report.md
    output_dir = os.path.expanduser("~/Downloads/openai usage")
    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, "usage_report.md"), "w") as f:
        f.write(usage_report)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
