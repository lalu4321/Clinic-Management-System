# Operations Manual — Clinic Management System

## Deployment Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ / Yarn
- SQLite (dev) or PostgreSQL (production)

### Backend Setup
1. Navigate to `backend/` directory
2. Create virtual environment: `python -m venv venv && source venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Configure environment variables in `backend/.env`:
   ```
   SECRET_KEY=your-django-secret-key
   DEBUG=False
   ALLOWED_HOSTS=your-domain.com
   DATABASE_URL=postgres://user:pass@host:5432/clinic_db
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_HOST_USER=clinic@example.com
   EMAIL_HOST_PASSWORD=app-password
   EMAIL_USE_TLS=True
   ```
5. Run migrations: `python manage.py migrate`
6. Create superuser: `python manage.py createsuperuser`
7. Start server: `gunicorn CMS.wsgi:application --bind 0.0.0.0:8000`

### Frontend Setup
1. Navigate to `frontend/` directory
2. Install dependencies: `yarn install`
3. Configure `frontend/.env`:
   ```
   VITE_BACKEND_URL=https://your-api-domain.com
   ```
4. Build for production: `yarn build`
5. Serve the `dist/` folder with Nginx or any static server

### Email Configuration
The system supports email notifications for:
- Appointment confirmations
- Prescription ready alerts
- Lab results notifications

When SMTP is not configured, emails are logged to console (safe fallback).
To enable real emails, set the EMAIL_* environment variables listed above.

## Role-Specific Status Management

### Doctor Duty Status
| Status | Description | Can Book Appointments? |
|--------|-------------|----------------------|
| AVAILABLE | Ready to see patients | Yes |
| ON_DUTY | Currently seeing patients | Yes |
| OFF_DUTY | Not available | No (blocked in UI and API) |

### Staff Status
| Status | Description |
|--------|-------------|
| ACTIVE | Currently working |
| INACTIVE | Employment ended or suspended |
| ON_LEAVE | Temporarily absent |

### Patient Status
| Status | Description |
|--------|-------------|
| REGISTERED | New patient, no active treatment |
| UNDER_CARE | Currently receiving treatment |
| ARCHIVED | Discharged or inactive |

## Security Features
- JWT tokens (access + refresh) with expiration
- Role-based API access (IsAdmin, IsDoctor, IsReceptionist, etc.)
- IDOR protection (users can only access their own role's data)
- Input sanitization middleware
- Audit logging for sensitive operations
- Double-booking prevention with DB-level constraints
- Strict 10-minute interval slot validation (prevents past dates)

## Troubleshooting
- **Login fails**: Ensure the user exists and password is correct. Check `python manage.py shell` to verify.
- **Appointments not showing**: Check timezone settings (IST by default in settings.py).
- **PDF not generating**: Ensure `reportlab` is installed (`pip install reportlab`).
- **Emails not sending**: Check EMAIL_* env vars. Console fallback is active when unconfigured.
