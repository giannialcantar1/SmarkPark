from __future__ import annotations

import re


EMAIL_RE = re.compile(r"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$", re.IGNORECASE)
PLATE_RE = re.compile(r"^[A-Z0-9-]{5,10}$", re.IGNORECASE)


class Validators:
    @staticmethod
    def validate_email(email: str) -> bool:
        return bool(EMAIL_RE.fullmatch(str(email or "").strip()))

    @staticmethod
    def normalize_email(email: str) -> str:
        return str(email or "").strip().lower()

    @staticmethod
    def validate_password(password: str) -> bool:
        value = str(password or "")
        if len(value) < 6:
            return False
        has_letter = any(char.isalpha() for char in value)
        has_number = any(char.isdigit() for char in value)
        return has_letter and has_number

    @staticmethod
    def password_errors(password: str) -> list[str]:
        value = str(password or "")
        errors: list[str] = []
        if len(value) < 6:
            errors.append("Debe tener al menos 6 caracteres")
        if not any(char.isalpha() for char in value):
            errors.append("Debe incluir al menos una letra")
        if not any(char.isdigit() for char in value):
            errors.append("Debe incluir al menos un numero")
        return errors

    @staticmethod
    def validate_plate(plate: str) -> bool:
        return bool(PLATE_RE.fullmatch(str(plate or "").strip().upper()))

    @staticmethod
    def normalize_plate(plate: str) -> str:
        return str(plate or "").strip().upper()

    @staticmethod
    def email_errors(email: str) -> list[str]:
        if Validators.validate_email(email):
            return []
        return ["Email invalido"]

    @staticmethod
    def plate_errors(plate: str) -> list[str]:
        if Validators.validate_plate(plate):
            return []
        return ["La placa debe tener entre 5 y 10 caracteres alfanumericos"]

    @staticmethod
    def validate_required_fields(payload: dict, *fields: str) -> tuple[bool, list[str]]:
        missing = [field for field in fields if str(payload.get(field) or "").strip() == ""]
        return (not missing, missing)


def validate_email(email: str) -> bool:
    return Validators.validate_email(email)


def validate_password(password: str) -> bool:
    return Validators.validate_password(password)


def validate_plate(plate: str) -> bool:
    return Validators.validate_plate(plate)


def normalize_email(email: str) -> str:
    return Validators.normalize_email(email)


def normalize_plate(plate: str) -> str:
    return Validators.normalize_plate(plate)
