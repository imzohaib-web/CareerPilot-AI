"""Career profile routes: GET/POST/PUT /api/profile (all authenticated)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.profile import ProfileResponse, ProfileUpsertRequest
from app.services import profile_service
from app.services.dependencies import get_current_user

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
async def get_profile(current_user: dict = Depends(get_current_user)) -> ProfileResponse:
    profile = await profile_service.get_profile(str(current_user["_id"]))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )
    return profile


@router.post(
    "", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED
)
async def create_profile(
    body: ProfileUpsertRequest,
    current_user: dict = Depends(get_current_user),
) -> ProfileResponse:
    existing = await profile_service.get_profile(str(current_user["_id"]))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Career profile already exists; use PUT to update it",
        )
    return await profile_service.upsert_profile(str(current_user["_id"]), body)


@router.put("", response_model=ProfileResponse)
async def update_profile(
    body: ProfileUpsertRequest,
    current_user: dict = Depends(get_current_user),
) -> ProfileResponse:
    return await profile_service.upsert_profile(str(current_user["_id"]), body)
