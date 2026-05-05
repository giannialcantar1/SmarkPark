from __future__ import annotations

from flask import Request

from utils.jwt_manager import jwt_manager


def extract_bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization", "").strip()
    if not header:
        return None

    parts = header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1].strip()
    return token or None


def verify_jwt_token(token: str):
    return jwt_manager.verify_token(token)


def generate_jwt_token(payload: dict, *, token_type: str = "access") -> str:
    return jwt_manager.generate_token(payload, token_type=token_type)


def refresh_jwt_token(refresh_token: str) -> dict:
    return jwt_manager.refresh_token(refresh_token)
