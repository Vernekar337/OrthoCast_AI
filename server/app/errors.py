from typing import Optional


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, hint: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.hint = hint


class PipelineError(ApiError):
    def __init__(self, code: str, message: str, hint: Optional[str] = None, status: int = 422):
        super().__init__(status, code, message, hint)


def not_found(what: str) -> ApiError:
    return ApiError(404, "not_found", f"{what} not found")