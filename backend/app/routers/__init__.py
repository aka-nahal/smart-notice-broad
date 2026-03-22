from fastapi import APIRouter

from app.routers import ai as ai_router
from app.routers import display as display_router
from app.routers import layouts as layouts_router
from app.routers import notices as notices_router

api_router = APIRouter(prefix="/api")
api_router.include_router(notices_router.router, prefix="/notices", tags=["notices"])
api_router.include_router(layouts_router.router, prefix="/layouts", tags=["layouts"])
api_router.include_router(display_router.router, prefix="/display", tags=["display"])
api_router.include_router(ai_router.router, prefix="/ai", tags=["ai"])
