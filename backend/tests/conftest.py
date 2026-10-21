"""Global pytest configuration and fixtures for CareerPilot AI.

Disables rate limits and AI quotas by default so existing unit and integration
tests can run without unexpected throttling.
"""

import os
import pytest

# Disable rate limiting by default in tests
os.environ["RATE_LIMIT_ENABLED"] = "false"

from app import config
from app.core import rate_limit

config.RATE_LIMIT_ENABLED = False
rate_limit.limiter.enabled = False


@pytest.fixture(autouse=True)
def reset_rate_limit_state():
    """Ensure in-memory rate limiting state is reset between test executions."""
    rate_limit._offline_usage_counters.clear()
    rate_limit._offline_login_attempts.clear()
    rate_limit._llm_call_timestamps.clear()
    rate_limit._demo_user_ids.clear()
    yield
