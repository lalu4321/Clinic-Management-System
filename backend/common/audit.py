"""
Audit Logging System for Clinic Management System
Tracks security-sensitive operations for compliance and forensics
"""
import json
import logging
from datetime import datetime
from functools import wraps
from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings

User = get_user_model()

# Configure audit logger
audit_logger = logging.getLogger('audit')
audit_logger.setLevel(logging.INFO)

# File handler for audit logs
handler = logging.FileHandler('audit.log')
handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
audit_logger.addHandler(handler)


class AuditAction:
    """Audit action types"""
    LOGIN_SUCCESS = 'LOGIN_SUCCESS'
    LOGIN_FAILED = 'LOGIN_FAILED'
    LOGOUT = 'LOGOUT'
    TOKEN_REFRESH = 'TOKEN_REFRESH'
    
    CREATE = 'CREATE'
    READ = 'READ'
    UPDATE = 'UPDATE'
    DELETE = 'DELETE'
    
    PRESCRIPTION_CREATE = 'PRESCRIPTION_CREATE'
    PRESCRIPTION_ACTIVATE = 'PRESCRIPTION_ACTIVATE'
    PRESCRIPTION_COMPLETE = 'PRESCRIPTION_COMPLETE'
    
    BILL_GENERATE = 'BILL_GENERATE'
    BILL_PAID = 'BILL_PAID'
    
    PERMISSION_DENIED = 'PERMISSION_DENIED'
    INVALID_INPUT = 'INVALID_INPUT'
    SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'


class AuditLog(models.Model):
    """Database model for persistent audit logs"""
    
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    user_id = models.IntegerField(null=True, blank=True, db_index=True)
    username = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=50, db_index=True)
    resource_type = models.CharField(max_length=100, blank=True)
    resource_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, default='SUCCESS')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    details = models.JSONField(default=dict, blank=True)
    
    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['action', 'timestamp']),
            models.Index(fields=['user_id', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.timestamp} - {self.action} - {self.username or 'anonymous'}"


def get_client_ip(request):
    """Extract client IP from request headers"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '')
    return ip


def sanitize_for_log(data):
    """Remove sensitive data from log entries"""
    if not isinstance(data, dict):
        return data
    
    sensitive_fields = {'password', 'token', 'access', 'refresh', 'secret', 'key', 'auth'}
    sanitized = {}
    
    for key, value in data.items():
        key_lower = key.lower()
        if any(s in key_lower for s in sensitive_fields):
            sanitized[key] = '[REDACTED]'
        elif isinstance(value, dict):
            sanitized[key] = sanitize_for_log(value)
        else:
            sanitized[key] = value
    
    return sanitized


def log_audit(request, action, resource_type='', resource_id='', status='SUCCESS', details=None):
    """
    Log an audit event both to file and database.
    
    Args:
        request: Django request object
        action: AuditAction constant
        resource_type: Type of resource (e.g., 'Patient', 'Prescription')
        resource_id: ID of the resource
        status: 'SUCCESS' or 'FAILURE'
        details: Additional context (dict)
    """
    user = getattr(request, 'user', None)
    user_id = user.id if user and user.is_authenticated else None
    username = user.username if user and user.is_authenticated else 'anonymous'
    
    ip_address = get_client_ip(request)
    user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
    
    # Sanitize details
    safe_details = sanitize_for_log(details or {})
    
    log_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'user_id': user_id,
        'username': username,
        'action': action,
        'resource_type': resource_type,
        'resource_id': str(resource_id),
        'status': status,
        'ip_address': ip_address,
        'details': safe_details,
    }
    
    # Log to file
    audit_logger.info(json.dumps(log_entry))
    
    # Log to database (async-safe)
    try:
        AuditLog.objects.create(
            user_id=user_id,
            username=username,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            status=status,
            ip_address=ip_address,
            user_agent=user_agent,
            details=safe_details,
        )
    except Exception as e:
        # Don't let audit failures break the application
        audit_logger.error(f"Failed to save audit log to DB: {e}")


def audit_action(action, resource_type=''):
    """
    Decorator to automatically log view actions.
    
    Usage:
        @audit_action(AuditAction.CREATE, 'Patient')
        def create(self, request, *args, **kwargs):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            resource_id = kwargs.get('pk', '')
            try:
                response = view_func(self, request, *args, **kwargs)
                status = 'SUCCESS' if response.status_code < 400 else 'FAILURE'
                
                # Extract resource ID from response if created
                if hasattr(response, 'data') and isinstance(response.data, dict):
                    resource_id = response.data.get('data', {}).get('id', resource_id) or resource_id
                
                log_audit(request, action, resource_type, resource_id, status)
                return response
            except Exception as e:
                log_audit(request, action, resource_type, resource_id, 'FAILURE', {'error': str(e)})
                raise
        return wrapper
    return decorator


def log_login_attempt(request, username, success, details=None):
    """Log authentication attempts"""
    action = AuditAction.LOGIN_SUCCESS if success else AuditAction.LOGIN_FAILED
    log_audit(request, action, 'Authentication', username, 
              'SUCCESS' if success else 'FAILURE', details)


def log_permission_denied(request, resource_type='', resource_id='', details=None):
    """Log permission denied events"""
    log_audit(request, AuditAction.PERMISSION_DENIED, resource_type, resource_id, 
              'FAILURE', details)


def log_suspicious_activity(request, activity_type, details=None):
    """Log suspicious activities (SQL injection attempts, etc.)"""
    log_audit(request, AuditAction.SUSPICIOUS_ACTIVITY, activity_type, '', 
              'BLOCKED', details)


def log_prescription_flow(request, action, prescription_id, details=None):
    """Log prescription-related actions"""
    log_audit(request, action, 'Prescription', prescription_id, 'SUCCESS', details)


def log_billing(request, action, bill_type, bill_id, details=None):
    """Log billing-related actions"""
    log_audit(request, action, bill_type, bill_id, 'SUCCESS', details)
