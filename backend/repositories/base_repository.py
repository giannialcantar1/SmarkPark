from __future__ import annotations

from typing import Any, Callable

from utils.supabase_client import get_user_table_client, insert_row, select_rows, update_rows, utcnow_iso


Normalizer = Callable[[dict[str, Any]], dict[str, Any]]


class BaseRepository:
    def __init__(self, table_name: str, *, normalizer: Normalizer | None = None) -> None:
        self.table_name = table_name
        self.normalizer = normalizer

    def _normalize_one(self, row: dict[str, Any] | None) -> dict[str, Any] | None:
        if not row:
            return None
        if self.normalizer is None:
            return row
        return self.normalizer(row)

    def _normalize_many(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [item for item in (self._normalize_one(row) for row in rows) if item]

    def create(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        now = utcnow_iso()
        row = insert_row(
            self.table_name,
            {
                **payload,
                "created_at": payload.get("created_at") or now,
                "updated_at": payload.get("updated_at") or now,
            },
        )
        return self._normalize_one(row)

    def get_by_id(self, record_id: str) -> dict[str, Any] | None:
        rows = select_rows(
            self.table_name,
            filters=[{"column": "id", "value": record_id, "optional": False}],
            limit=1,
        )
        return self._normalize_one(rows[0]) if rows else None

    def get_first(
        self,
        *,
        filters: list[dict] | None = None,
        order_candidates: list[str] | None = None,
        desc: bool = False,
    ) -> dict[str, Any] | None:
        rows = select_rows(
            self.table_name,
            filters=filters,
            order_candidates=order_candidates,
            desc=desc,
            limit=1,
        )
        return self._normalize_one(rows[0]) if rows else None

    def get_all(
        self,
        *,
        filters: list[dict] | None = None,
        order_candidates: list[str] | None = None,
        desc: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        rows = select_rows(
            self.table_name,
            filters=filters,
            order_candidates=order_candidates,
            desc=desc,
            limit=limit,
            offset=offset,
        )
        return self._normalize_many(rows)

    def update(self, record_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        rows = update_rows(
            self.table_name,
            payload={**payload, "updated_at": utcnow_iso()},
            filters=[{"column": "id", "value": record_id, "optional": False}],
        )
        if rows:
            return self._normalize_one(rows[0])
        return self.get_by_id(record_id)

    def delete(self, record_id: str) -> bool:
        try:
            get_user_table_client(use_admin=True).table(self.table_name).delete().eq("id", record_id).execute()
            return True
        except Exception:
            return False
