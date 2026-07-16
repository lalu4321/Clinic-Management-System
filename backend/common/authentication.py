"""
BlacklistAwareJWTAuthentication
────────────────────────────────
Drop-in replacement for rest_framework_simplejwt.authentication.JWTAuthentication.

After the standard signature + expiry validation passes, this class performs one
additional O(1) Redis lookup to check whether the token's jti has been blacklisted
(i.e. the user already logged out).

If the jti IS in Redis → 401 AuthenticationFailed is raised immediately.
If Redis is DOWN      → 401 is raised (fail-safe — see token_blacklist.py).

This makes token reuse after logout impossible regardless of remaining lifetime.
"""

import logging
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.exceptions import AuthenticationFailed

from common.token_blacklist import is_blacklisted

logger = logging.getLogger("email_service")


class BlacklistAwareJWTAuthentication(JWTAuthentication):
    """
    Identical to JWTAuthentication except it rejects blacklisted access tokens.

    Flow
    ────
    1. Parent class validates header format, signature, expiry → raises if invalid.
    2. Extract jti from the validated payload.
    3. Check Redis blacklist via is_blacklisted(jti).
    4. If blacklisted (or Redis is down) → raise AuthenticationFailed(401).
    5. Otherwise → return (user, validated_token) as normal.
    """

    def authenticate(self, request):
        # Step 1: run the standard simplejwt validation
        # Returns None (no token in header) or raises InvalidToken/TokenError
        result = super().authenticate(request)

        if result is None:
            # No Authorization header — let DRF's permission classes handle this
            return None

        user, validated_token = result

        # Step 2: extract jti — simplejwt always includes it
        jti = validated_token.get("jti")

        # Step 3 + 4: Redis blacklist check (O(1), fail-safe)
        if is_blacklisted(jti):
            logger.warning(
                f"[AUTH] Rejected blacklisted access token "
                f"jti={jti} for user={getattr(user, 'username', '?')}"
            )
            raise AuthenticationFailed(
                detail="Token has been revoked. Please log in again.",
                code="token_blacklisted",
            )

        # Step 5: token is valid and not blacklisted
        return (user, validated_token)
