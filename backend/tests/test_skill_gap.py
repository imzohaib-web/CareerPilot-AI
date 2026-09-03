import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.skill_gap import SkillGapAnalysis, SkillGapResponse
from app.services.dependencies import get_current_user

FAKE_USER_ID = ObjectId()
FAKE_USER = {
    "_id": FAKE_USER_ID,
    "name": "Test User",
    "email": "test@example.com",
    "password_hash": "hash",
    "created_at": datetime.now(timezone.utc),
}

VALID_SKILL_GAP_JSON = json.dumps(
    {
        "summary": "Strong Python and API experience, but lacks cloud deployment depth.",
        "missing_technical_skills": ["AWS Lambda", "Docker", "Kubernetes"],
        "missing_soft_skills": ["Cross-functional communication", "Stakeholder management"],
        "required_proficiencies": [
            {"area": "backend", "skills": ["FastAPI", "REST APIs", "Python"]},
            {"area": "cloud", "skills": ["AWS", "Docker", "Kubernetes"]},
            {"area": "communication", "skills": ["Documentation", "Stakeholder communication"]},
        ],
        "match_score": 68,
    }
)


def _override_user():
    return {get_current_user: lambda: FAKE_USER}


def _make_api_client(overrides: dict | None = None) -> AsyncClient:
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://testserver")
    if overrides:
        app.dependency_overrides.update(overrides)
    return client


class TestSkillGapSchema:
    def test_valid_skill_gap_schema(self):
        payload = SkillGapAnalysis.model_validate(json.loads(VALID_SKILL_GAP_JSON))
        assert payload.match_score == 68
        assert "AWS Lambda" in payload.missing_technical_skills
        assert "Cross-functional communication" in payload.missing_soft_skills

    def test_response_schema(self):
        response = SkillGapResponse(
            id=str(ObjectId()),
            user_id=str(FAKE_USER_ID),
            target_role="Backend Engineer",
            target_job_description="Design API systems and deploy cloud services.",
            analysis=SkillGapAnalysis.model_validate(json.loads(VALID_SKILL_GAP_JSON)),
            created_at=datetime.now(timezone.utc),
        )
        assert response.target_role == "Backend Engineer"
        assert response.analysis.missing_technical_skills[0] == "AWS Lambda"


@pytest.mark.asyncio
async def test_analyze_gap_route_success():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    with patch("app.services.skill_gap_service.analyze_gap", new=AsyncMock(return_value={
        "id": str(ObjectId()),
        "user_id": str(FAKE_USER_ID),
        "target_role": "Backend Engineer",
        "target_job_description": "Design APIs and deploy to AWS.",
        "analysis": json.loads(VALID_SKILL_GAP_JSON),
        "created_at": datetime.now(timezone.utc),
    })):
        async with _make_api_client() as client:
            response = await client.post(
                "/api/analyze-gap",
                json={
                    "resume_data": "Python, FastAPI, SQL, PostgreSQL",
                    "target_role": "Backend Engineer",
                    "target_job_description": "Design APIs and deploy to AWS.",
                },
            )

    assert response.status_code == 200
    payload = response.json()
    assert payload["target_role"] == "Backend Engineer"
    assert payload["analysis"]["match_score"] == 68

    app.dependency_overrides.clear()
