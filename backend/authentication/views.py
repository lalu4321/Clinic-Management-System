import logging

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView
)

from rest_framework.throttling import AnonRateThrottle

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken, AccessToken

from .serializers import CustomTokenSerializer
from common.token_blacklist import blacklist_token

# Import audit logging
try:
    from common.audit import log_login_attempt, log_audit, AuditAction
    AUDIT_ENABLED = True
except ImportError:
    AUDIT_ENABLED = False

logger = logging.getLogger("email_service")


class LoginThrottle(AnonRateThrottle):
    scope = "login"


class LoginView(TokenObtainPairView):
    """Login view with audit logging"""
    
    serializer_class = CustomTokenSerializer
    throttle_classes = [LoginThrottle]
    
    def post(self, request, *args, **kwargs):
        username = request.data.get('username', 'unknown')
        response = super().post(request, *args, **kwargs)
        
        # Log authentication attempt
        if AUDIT_ENABLED:
            success = response.status_code == 200
            log_login_attempt(request, username, success, {
                'status_code': response.status_code
            })
        
        return response


class RefreshTokenView(TokenRefreshView):
    """Token refresh view with audit logging"""
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if AUDIT_ENABLED and response.status_code == 200:
            log_audit(request, AuditAction.TOKEN_REFRESH, 'Authentication', '', 'SUCCESS')
        
        return response


class LogoutView(APIView):
    """Logout view with audit logging"""

    permission_classes = [IsAuthenticated]

    def post(self, request):

        try:
            refresh_token = request.data.get("refresh")

            if not refresh_token:
                return Response(
                    {"error": "Refresh token is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ── Step 1: Blacklist the ACCESS token in Redis ───────────────────
            # Must happen before clearing anything so the token is written to
            # Redis while it is still structurally valid (signature + expiry).
            # Failures are swallowed — a decode error or Redis outage must never
            # block the logout response; the client-side session is cleared
            # regardless, and is_blacklisted() already fails-safe on Redis down.
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                raw_access = auth_header.split(" ", 1)[1].strip()
                try:
                    access_token = AccessToken(raw_access)
                    # AccessToken payload is dict-accessible via token[key]
                    blacklisted = blacklist_token({
                        "jti": access_token["jti"],
                        "exp": access_token["exp"],
                    })
                    if blacklisted:
                        logger.info(
                            f"[LOGOUT] Access token revoked for user={request.user.username} "
                            f"jti={access_token['jti']}"
                        )
                    else:
                        logger.warning(
                            f"[LOGOUT] Access token could not be written to Redis "
                            f"for user={request.user.username} — token will expire naturally."
                        )
                except Exception as exc:
                    # Malformed token, already expired, or Redis error — safe to ignore.
                    logger.warning(
                        f"[LOGOUT] Access token blacklist failed for "
                        f"user={request.user.username}: {exc}"
                    )

            # ── Step 2: Blacklist the REFRESH token (DB-backed via simplejwt) ─
            token = RefreshToken(refresh_token)
            token.blacklist()

            # ── Step 3: Audit log ─────────────────────────────────────────────
            if AUDIT_ENABLED:
                log_audit(request, AuditAction.LOGOUT, 'Authentication', '', 'SUCCESS')

            return Response(
                {"message": "Logout successful"},
                status=status.HTTP_205_RESET_CONTENT
            )

        except Exception:
            return Response(
                {"error": "Invalid token"},
                status=status.HTTP_400_BAD_REQUEST
            )
