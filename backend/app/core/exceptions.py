"""Custom exception types for the API foundation."""


class AppException(Exception):
    """Base application exception to standardize controlled errors."""

    def __init__(self, message: str, code: str = 'app_error') -> None:
        self.message = message
        self.code = code
        super().__init__(message)
