from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
from app.api.items import router as items_router
from app.api.errors import handle_validation_error
from app.core.config import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(items_router, prefix="/items", tags=["items"])

@app.exception_handler(ValueError)
async def validation_exception_handler(request, exc):
    return await handle_validation_error(request, exc)

@app.on_event("startup")
async def startup_event():
    # Initialize database connection here
    pass

@app.on_event("shutdown")
async def shutdown_event():
    # Close database connection here
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)