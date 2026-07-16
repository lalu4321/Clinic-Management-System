"""
Redis-backed access token blacklist.

Design
──────
* Key   : "bl:at:<jti>"   where jti is the JWT ID claim (UUID, guaranteed unique)
* Value : "1"             (presence is the only thing that matters)
* TTL   : remaining token lifetime in seconds (set at blacklist time, not at issue time)
          → Redis auto-expires the key once the token would have expired anyway,
            so the blacklist never accumulates stale entries.

Fail-safe contract
──────────────────
Every public function returns a bool and NEVER raises.
If Redis is unavailable:
  - blacklist_token()  → logs the error and returns False (token is NOT blacklisted
                         in Redis, but the session is cleared client-side anyway)
  - is_blacklisted()   → logs and returns True  (DENY ACCESS — fail-safe)

This means a Redis outage causes a soft denial-of-service (users must re-login)
but NEVER allows a post-logout token to be accepted.

O(1) guarantee
──────────────
Both SET and EXISTS are O(1) in Redis — no scan, no set membership lookup.
"""

import logging
from datetime import datetime, timezone

logger = logging.getLogger("email_service")   # reuse existing audit logger

# Redis key prefix — namespaced so it cannot collide with other cache keys
_PREFIX = "bl:at:"


def _redis():
    """
    Return the configured django-redis cache backend.
    Raises if django-redis is not installed or CACHES is misconfigured
    (intentional — misconfiguration should blow up at startup, not silently).
    """
    from django.core.cache import cache
    return cache


def blacklist_token(token_payload: dict) -> bool:
    """
    Write the token's jti to Redis with a TTL equal to its remaining lifetime.

    Parameters
    ----------
    token_payload : dict
        The decoded JWT payload.  Must contain 'jti' and 'exp'.

    Returns
    -------
    bool
        True if successfully blacklisted, False if Redis was unavailable.
    """
    try:
        jti = token_payload.get("jti")
        exp = token_payload.get("exp")   # Unix timestamp (int)

        if not jti or not exp:
            logger.warning("[BLACKLIST] Token missing jti or exp claim — cannot blacklist.")
            return False

        now_ts = int(datetime.now(timezone.utc).timestamp())
        ttl    = max(1, exp - now_ts)    # seconds until token expires; floor at 1

        key    = f"{_PREFIX}{jti}"
        _redis().set(key, "1", timeout=ttl)

        logger.info(f"[BLACKLIST] Access token jti={jti} blacklisted (TTL={ttl}s).")
        return True

    except Exception as exc:
        logger.error(f"[BLACKLIST] Failed to blacklist access token: {exc}")
        return False


def is_blacklisted(jti: str) -> bool:
    """
    Return True if the jti is present in the Redis blacklist.

    Fail-safe: returns True (deny access) if Redis is unreachable.

    Parameters
    ----------
    jti : str
        The JWT ID claim from the token being authenticated.

    Returns
    -------
    bool
        True  → token is blacklisted (or Redis is unavailable) — REJECT request
        False → token is not blacklisted — allow request to proceed
    """
    if not jti:
        return True   # malformed token → deny

    try:
        key = f"{_PREFIX}{jti}"
        return _redis().get(key) is not None

    except Exception as exc:
        # Redis is down — fail-safe: deny access rather than allow stale tokens
        logger.error(
            f"[BLACKLIST] Redis unavailable during token check (jti={jti}): {exc}. "
            "Denying access (fail-safe)."
        )
        return True
