from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import exceptions
from rest_framework.views import exception_handler


def _extract_message(errors, _depth=0):
    """
    Pull the first human-readable string out of a DRF errors dict/list so the
    top-level ``message`` field is useful rather than always saying "Request failed".
    Recurses into nested dicts (e.g. medicines -> "0" -> quantity -> [...]).
    """
    if isinstance(errors, str):
        return errors
    if isinstance(errors, list):
        first = errors[0] if errors else "Validation error"
        return str(first)
    if isinstance(errors, dict) and _depth < 5:
        for key in ("non_field_errors", *errors.keys()):
            val = errors.get(key)
            if not val:
                continue
            if isinstance(val, list) and val:
                return str(val[0])
            if isinstance(val, str):
                return val
            if isinstance(val, dict):
                nested = _extract_message(val, _depth + 1)
                if nested and nested != "Validation error":
                    return nested
    return "Validation error"


def custom_exception_handler(exc, context):

    # Convert Django's model-level ValidationError to a DRF 400 so it never
    # reaches Django's 500 handler.  The message(s) from clean() are preserved.
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(detail=exc.messages)

    response = exception_handler(exc, context)

    if response is None:
        return response

    response.data = {
        "success": False,
        "message": _extract_message(response.data),
        "errors": response.data,
    }

    return response