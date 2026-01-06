from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette import status

def error_response(request: Request, status_code: int, message: str, details=None):
	# Ensure details is serializable
	if isinstance(details, Exception):
		details = str(details)
	return JSONResponse(
		status_code=status_code,
		content={
			"error": {
				"message": message,
				"details": details,
				"request_id": getattr(request.state, "request_id", None),
			}
		},
	)

def _sanitize_error_details(details):
	if isinstance(details, Exception):
		return str(details)
	if isinstance(details, list):
		sanitized = []
		for item in details:
			if isinstance(item, dict):
				new_item = {}
				for key, value in item.items():
					if key == "ctx" and isinstance(value, dict):
						new_ctx = {}
						for ctx_key, ctx_value in value.items():
							new_ctx[ctx_key] = str(ctx_value)
						new_item[key] = new_ctx
					else:
						new_item[key] = value
				sanitized.append(new_item)
			else:
				sanitized.append(item)
		return sanitized
	return details

async def validation_exception_handler(request: Request, exc: RequestValidationError):
	return error_response(
		request,
		status.HTTP_422_UNPROCESSABLE_ENTITY,
		"Validation error",
		details=_sanitize_error_details(exc.errors()),
	)
