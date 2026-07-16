"""
Security Utilities for Clinic Management System
Provides input sanitization, XSS protection, and security helpers
"""
import re
import html
from typing import Any, Dict, List, Optional
from django.utils.html import strip_tags


# =====================================================
# XSS PROTECTION - Input Sanitization
# =====================================================
class InputSanitizer:
    """Sanitize user inputs to prevent XSS attacks"""
    
    # Dangerous HTML tags and patterns
    DANGEROUS_PATTERNS = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe[^>]*>.*?</iframe>',
        r'<object[^>]*>.*?</object>',
        r'<embed[^>]*>',
        r'<link[^>]*>',
        r'<style[^>]*>.*?</style>',
        r'expression\s*\(',
        r'url\s*\(',
        r'data:text/html',
    ]
    
    @classmethod
    def sanitize_string(cls, value: str) -> str:
        """Remove dangerous HTML and scripts from string"""
        if not isinstance(value, str):
            return value
            
        # HTML escape special characters
        value = html.escape(value)
        
        # Remove any remaining dangerous patterns
        for pattern in cls.DANGEROUS_PATTERNS:
            value = re.sub(pattern, '', value, flags=re.IGNORECASE | re.DOTALL)
        
        return value.strip()
    
    @classmethod
    def sanitize_dict(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively sanitize all string values in a dictionary"""
        sanitized = {}
        for key, value in data.items():
            if isinstance(value, str):
                sanitized[key] = cls.sanitize_string(value)
            elif isinstance(value, dict):
                sanitized[key] = cls.sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = cls.sanitize_list(value)
            else:
                sanitized[key] = value
        return sanitized
    
    @classmethod
    def sanitize_list(cls, data: List[Any]) -> List[Any]:
        """Sanitize all items in a list"""
        sanitized = []
        for item in data:
            if isinstance(item, str):
                sanitized.append(cls.sanitize_string(item))
            elif isinstance(item, dict):
                sanitized.append(cls.sanitize_dict(item))
            elif isinstance(item, list):
                sanitized.append(cls.sanitize_list(item))
            else:
                sanitized.append(item)
        return sanitized


# =====================================================
# SQL INJECTION PROTECTION - Validation
# =====================================================
class SQLInjectionValidator:
    """Detect potential SQL injection patterns"""
    
    DANGEROUS_PATTERNS = [
        r"('|\")\s*OR\s+.*=.*",
        r"('|\")\s*AND\s+.*=.*",
        r";\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)",
        r"--\s*$",
        r"\/\*.*\*\/",
        r"UNION\s+(ALL\s+)?SELECT",
        r"EXEC\s*\(",
        r"xp_\w+",
    ]
    
    @classmethod
    def is_safe(cls, value: str) -> bool:
        """Check if value contains SQL injection patterns"""
        if not isinstance(value, str):
            return True
            
        for pattern in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return False
        return True
    
    @classmethod
    def validate_input(cls, value: str, field_name: str = "input") -> None:
        """Raise ValidationError if SQL injection detected"""
        from rest_framework.exceptions import ValidationError
        
        if not cls.is_safe(value):
            raise ValidationError({field_name: "Invalid characters detected."})


# =====================================================
# URL MANIPULATION PROTECTION - ID Validation
# =====================================================
class IDValidator:
    """Validate and sanitize IDs to prevent IDOR attacks"""
    
    @staticmethod
    def validate_numeric_id(value: Any, field_name: str = "id") -> int:
        """Ensure ID is a valid positive integer"""
        from rest_framework.exceptions import ValidationError
        
        try:
            id_value = int(value)
            if id_value <= 0:
                raise ValueError("ID must be positive")
            return id_value
        except (TypeError, ValueError):
            raise ValidationError({field_name: "Invalid ID format."})
    
    @staticmethod
    def validate_uuid(value: str, field_name: str = "id") -> str:
        """Validate UUID format"""
        from rest_framework.exceptions import ValidationError
        import uuid
        
        try:
            uuid.UUID(str(value))
            return str(value)
        except ValueError:
            raise ValidationError({field_name: "Invalid UUID format."})


# =====================================================
# RATE LIMITING HELPERS
# =====================================================
def get_client_ip(request) -> str:
    """Extract client IP from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


# =====================================================
# DATA VALIDATION UTILITIES
# =====================================================
class DataValidator:
    """Common data validation utilities"""
    
    @staticmethod
    def validate_phone(phone: str) -> bool:
        """Validate phone number format"""
        pattern = r'^[\d\s\-\+\(\)]{7,20}$'
        return bool(re.match(pattern, phone))
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    @staticmethod
    def validate_date_format(date_str: str, format_str: str = "%Y-%m-%d") -> bool:
        """Validate date string format"""
        from datetime import datetime
        try:
            datetime.strptime(date_str, format_str)
            return True
        except ValueError:
            return False


# =====================================================
# OWNERSHIP VERIFICATION MIXIN
# =====================================================
class OwnershipMixin:
    """Mixin for verifying resource ownership"""
    
    def verify_ownership(self, obj, user, owner_field='user'):
        """
        Verify that the user owns the object.
        Raises PermissionDenied if not owner.
        """
        from rest_framework.exceptions import PermissionDenied
        
        owner = getattr(obj, owner_field, None)
        if owner is None:
            return True  # No owner field, allow access
            
        if hasattr(owner, 'user'):
            owner = owner.user
            
        if owner != user and not user.is_superuser:
            raise PermissionDenied("You don't have permission to access this resource.")
        
        return True
