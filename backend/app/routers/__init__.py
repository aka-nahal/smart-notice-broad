from fastapi import APIRouter

from app.routers import ai as ai_router
from app.routers import display as display_router
from app.routers import layouts as layouts_router
from app.routers import media as media_router
from app.routers import notices as notices_router
from app.routers import periods as periods_router
from app.routers import presence as presence_router
from app.routers import settings as settings_router
from app.routers import teachers as teachers_router
from app.routers import timetables as timetables_router
from app.routers import weather as weather_router

api_router = APIRouter(prefix="/api")
api_router.include_router(notices_router.router, prefix="/notices", tags=["notices"])
api_router.include_router(layouts_router.router, prefix="/layouts", tags=["layouts"])
api_router.include_router(display_router.router, prefix="/display", tags=["display"])
api_router.include_router(media_router.router, prefix="/media", tags=["media"])
api_router.include_router(ai_router.router, prefix="/ai", tags=["ai"])
api_router.include_router(weather_router.router, prefix="/weather", tags=["weather"])
api_router.include_router(teachers_router.router, prefix="/teachers", tags=["teachers"])
api_router.include_router(periods_router.router, prefix="/periods", tags=["periods"])
api_router.include_router(presence_router.router, prefix="/presence", tags=["presence"])
api_router.include_router(timetables_router.router, prefix="/timetables", tags=["timetables"])
api_router.include_router(settings_router.router, prefix="/settings", tags=["settings"])
