"""
Security Middleware for Clinic Management System
Provides request sanitization and security headers
"""
import json
import re
from django.http import JsonResponse
from django.conf import settings
from common.security import InputSanitizer, SQLInjectionValidator


class CustomSecurityMiddleware:
    """
    Middleware for security enhancements:
    - Input sanitization
    - SQL injection detection
    - Security headers
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Pre-process request
        if request.method in ['POST', 'PUT', 'PATCH']:
            # Check for SQL injection in query params
            for key, value in request.GET.items():
                if isinstance(value, str) and not SQLInjectionValidator.is_safe(value):
                    return JsonResponse(
                        {"error": "Invalid request parameters"},
                        status=400
                    )
        
        response = self.get_response(request)
        
        # Add security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        # Content Security Policy
        response['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
        
        return response


class RequestSanitizationMiddleware:
    """
    Sanitize all incoming request data to prevent XSS
    """
    
    EXEMPT_PATHS = [
        '/admin/',
        '/api/auth/',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Skip exempt paths
        for path in self.EXEMPT_PATHS:
            if request.path.startswith(path):
                return self.get_response(request)
        
        # Sanitize query parameters
        if request.GET:
            sanitized_get = {}
            for key, value in request.GET.items():
                if isinstance(value, str):
                    sanitized_get[key] = InputSanitizer.sanitize_string(value)
                else:
                    sanitized_get[key] = value
            request.GET = request.GET.copy()
            for key, value in sanitized_get.items():
                request.GET[key] = value
        
        return self.get_response(request)
