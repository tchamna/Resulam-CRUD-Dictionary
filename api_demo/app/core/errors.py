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

async def validation_exception_handler(request: Request, exc: RequestValidationError):
	return error_response(
		request,
		status.HTTP_422_UNPROCESSABLE_ENTITY,
		"Validation error",
		details=exc.errors(),
	)
