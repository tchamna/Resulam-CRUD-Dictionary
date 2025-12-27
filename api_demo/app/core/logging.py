import json
import logging
import uuid
from fastapi import Request

logger = logging.getLogger("api")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(handler)

async def request_id_middleware(request: Request, call_next):
	request.state.request_id = str(uuid.uuid4())
	response = await call_next(request)
	response.headers["X-Request-Id"] = request.state.request_id
	return response

def log_event(event: str, **kwargs):
	payload = {"event": event, **kwargs}
	logger.info(json.dumps(payload, ensure_ascii=False))
