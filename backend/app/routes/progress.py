"""Progress dashboard routes: GET /api/progress (authenticated)."""

from fastapi import APIRouter, Depends

from app.schemas.progress import DashboardResponse
from app.services import progress_service
from app.services.dependencies import get_current_user

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    current_user: dict = Depends(get_current_user),
) -> DashboardResponse:
    """Return an aggregated progress dashboard for the authenticated user."""
    return await progress_service.get_dashboard(str(current_user["_id"]))
