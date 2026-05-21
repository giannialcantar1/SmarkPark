from __future__ import annotations

from math import ceil

from flask import Request, request


DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 50


def _to_positive_int(value, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def get_pagination_params(
    req: Request | None = None,
    *,
    default_page: int = DEFAULT_PAGE,
    default_page_size: int = DEFAULT_PAGE_SIZE,
    max_page_size: int = MAX_PAGE_SIZE,
) -> dict[str, int]:
    current_request = req or request
    has_requested_pagination = any(
        current_request.args.get(key) not in (None, "")
        for key in ("page", "page_size", "limit")
    )
    page = _to_positive_int(current_request.args.get("page"), default_page)
    requested_page_size = current_request.args.get("page_size", current_request.args.get("limit"))
    page_size = min(_to_positive_int(requested_page_size, default_page_size), max_page_size)
    offset = max(0, (page - 1) * page_size)
    return {
        "enabled": has_requested_pagination,
        "page": page,
        "page_size": page_size,
        "offset": offset,
    }


def paginate_items(items: list, *, page: int, page_size: int) -> tuple[list, dict[str, int | bool]]:
    total = len(items)
    start = max(0, (page - 1) * page_size)
    end = start + page_size
    page_count = max(1, ceil(total / page_size)) if page_size else 1
    visible = items[start:end]
    meta = {
        "page": page,
        "page_size": page_size,
        "total": total,
        "page_count": page_count,
        "has_more": end < total,
    }
    return visible, meta
