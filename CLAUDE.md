# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack clinic management system with a Django REST Framework backend and a React + Vite frontend. Five user roles each map to a dedicated backend Django app and frontend module: Admin, Doctor, Receptionist, Pharmacist, Lab Technician.

## Tech Stack Versions

- **Python**: 3.13+ required; **Django**: 5.2; **DRF**: 3.15
- **Node**: 24+ required; **React**: 18; **Vite**: 8; **React Router**: v7

## Development Commands

### Backend (from `backend/`)
```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver          # Dev server on port 8000
python manage.py seed_data          # Seed default roles, staff, and patients (also runnable as: python seed_data.py)
python manage.py test               # Run all Django tests
python manage.py test reception     # Run tests for a single app
python manage.py test tests         # Run integration/security tests in backend/tests/
gunicorn CMS.wsgi:application       # Production WSGI server
python server.py                    # Alternative: ASGI server via uvicorn on port 8001
```

### Frontend (from `frontend/`)
```bash
yarn install        # or: npm install
yarn dev            # Dev server on port 3000 (host: 0.0.0.0); or: npm run dev
yarn build          # Production build to dist/; or: npm run build
yarn preview        # Preview production build; or: npm run preview
```

Frontend requires `VITE_BACKEND_URL=http://localhost:8000` in `frontend/.env`.

## Architecture

### Backend

Each Django app follows the standard `models.py` / `serializers.py` / `views.py` / `urls.py` pattern:

- `CMS/` — Django project settings, root URL config (`/api/...`), WSGI/ASGI
- `authentication/` — JWT login/logout/token refresh
- `administration/` — Staff, doctor, specialization, schedule CRUD
- `reception/` — Patient registration, appointment booking, slot validation
- `doctor/` — Prescriptions, lab requests, patient history
- `pharmacist/` — Medicine dispensing and inventory
- `labtechinician/` — Lab test processing and PDF report generation (ReportLab)
- `common/` — Shared permission classes, security middleware, audit logging, email service, standardized JSON renderer

Integration and security tests live in `backend/tests/` (not in app-level `tests.py`):
- `test_integration.py` — End-to-end prescription workflow (`TransactionTestCase`)
- `test_security.py` — Permission and auth boundary tests
- `test_status_enums.py` — Status enum/state machine validation

**All models inherit from `common.models.BaseModel`**, which provides `created_at`, `updated_at`, `is_deleted` (soft delete), and `version` fields. The default manager filters out soft-deleted records; use `all_objects` to include them. `BaseModel.save()` calls `full_clean()` before every save — model-level validators run automatically on all writes, which is non-standard Django behavior. `BaseModel.delete()` is overridden: it never removes the DB row — it sets `is_deleted=True` and increments `version`, then calls `super().save()` directly (bypassing `full_clean`). Do not call `queryset.delete()` on BaseModel subclasses — that bypasses the override and hard-deletes rows.

**All API responses use `common/renderers.py`** for a standardized JSON envelope:
```json
{ "success": true, "message": "...", "data": {...} }
```
Errors use `"success": false` and `"errors": {...}`. The exception handler in `common/exceptions.py` extracts the first validation error for the `message` field.

**All new views must declare a permission class** from `common/permissions.py` (e.g., `IsAdmin`, `IsDoctor`, `IsReceptionist`). The default REST_FRAMEWORK permission is `IsAuthenticated`; role classes additionally check `user.groups` membership. Group names are: `"Admin"`, `"Doctor"`, `"Receptionist"`, `"Pharmacist"`, `"LabTechnician"` (no space — note the difference from the display name "Lab Technician").

### API Endpoint Prefixes

| Role/Domain      | URL prefix          | Django app        |
|------------------|---------------------|-------------------|
| Auth             | `/api/auth/`        | `authentication`  |
| Admin            | `/api/admin/`       | `administration`  |
| Reception        | `/api/reception/`   | `reception`       |
| Doctor           | `/api/doctor/`      | `doctor`          |
| Pharmacy         | `/api/pharmacy/`    | `pharmacist`      |
| Lab              | `/api/lab/`         | `labtechinician`  |
| Shared appts     | `/api/appointments/`| `common`          |

### Domain Status ENUMs

These ENUMs are used across the system in UI badges, API filters, and booking logic:

| Entity  | Values | Notes |
|---------|--------|-------|
| Doctor duty status | `AVAILABLE`, `ON_DUTY`, `OFF_DUTY` | `OFF_DUTY` blocks appointment booking in both UI and API |
| Staff status | `ACTIVE`, `INACTIVE`, `ON_LEAVE` | Managed by Admin |
| Patient status | `REGISTERED`, `UNDER_CARE`, `ARCHIVED` | Transitions driven by appointment/prescription events |

### Status State Machines

Several models enforce valid status transitions via a `STATE_MACHINE` dict on the model:
- `PrescriptionStatus`: `DRAFT → ACTIVE → COMPLETED | CANCELLED`
- `AppointmentStatus`: `SCHEDULED → COMPLETED | CANCELLED`
- `LabRequestStatus`, `LabTestStatus`, `ReportStatus` follow similar patterns

Do not set statuses directly—use the model's transition methods to respect these rules.

### Appointment Slot Logic

All slot generation and booking validation is isolated in `reception/slot_validator.py` (not in views or models). Slot times use **IST (Asia/Kolkata)** for past-time rejection — any new date/time logic must convert to IST before comparing. `SLOT_MINUTES = 10` in `slot_validator.py` must stay in sync with `APPOINTMENT_SLOT_MINUTES` in `reception/models.py`. Patient search logic lives in `reception/search.py`, aggregated patient history in `doctor/patient_history.py`, and PDF generation in `labtechinician/pdf_generator.py`.

### Cross-App Signal Handlers

Post-save signals create records across app boundaries:
- `doctor/signals.py`: Creating a `Prescription` auto-creates a `PharmacyBill` (via `transaction.on_commit`)
- `labtechinician/signals.py`: Creating a `LabTestRequest` auto-creates a `LabBill` (one per appointment, scoped by appointment FK not patient); marking a `LabTestRequest` `COMPLETED` appends a `LabBillItem` and recalculates the bill total
- `pharmacist/signals.py`: Any save to `MedicineInventory` triggers `update_stock_status()` to sync the status field

Modifying these signals can silently break downstream workflows. Always trace all three signal files when changing `Prescription`, `LabTestRequest`, or `MedicineInventory`.

### JWT / Auth Flow

- Tokens contain custom claims: `role`, `staff_id`, `username`
- Access token lifetime: 30 min; refresh: 1 day
- Logout blacklists the refresh token (`rest_framework_simplejwt.token_blacklist`)
- Frontend stores tokens in `sessionStorage` (key: `user` as JSON) — cleared on browser close

### Frontend

- `src/modules/` — Role-scoped feature pages: `admin/`, `doctor/`, `receptionist/`, `pharmacist/`, `labTechnician/`
- `src/components/ui/` — Shadcn/ui components; **do not edit directly** — regenerate with `npx shadcn@latest add <component>`
- `src/components/layout/` — `ModuleLayout.jsx`, `Navbar.jsx`, `Header.jsx`, `Footer.jsx` — shared structural wrappers used by all role modules
- `src/components/shared/` — Cross-role components (e.g., `LiveAppointmentDashboard.jsx`)
- `src/components/common/` — Small reusable atoms (e.g., `BackButton.jsx`)
- `src/components/sections/` — Public landing page sections (Hero, Departments, CTA, etc.)
- `src/api/axiosInstance.js` — Axios client: adds `Authorization: Bearer` header, auto-refreshes on 401, redirects to `/login` on refresh failure
- `src/api/authApi.js` — Auth-specific API calls (login, logout, token refresh)
- `src/hooks/` — Custom hooks: `useFormValidation.js`, `use-toast.js`
- `src/lib/utils.js` — Shadcn utility helper (`cn()` for class merging)
- `src/routes/` — React Router v7 config with `ProtectedRoute` and role-based guards
- `src/context/` — Auth and toast state via React Context
- `src/utils/validation.js` — Existing Zod schemas; add new form schemas here

The `@/` path alias resolves to `frontend/src/` (configured in `vite.config.js` and `jsconfig.json`).

## Coding Conventions

- **Python**: Standard Django conventions; no enforced formatter
- **JavaScript**: `.jsx` for React components, `.js` for utilities/hooks; no TypeScript. ESLint and `eslint-plugin-react-hooks` are in devDependencies but there is no active config file — no linting runs automatically
- **CSS**: Tailwind utility classes only; custom tokens use the `clinical-*` prefix (e.g., `clinical-primary: #00647c`) defined in `tailwind.config.js`
- **Forms**: `react-hook-form` + Zod schemas for all form validation

## Dev Login Credentials

Default seeded accounts are listed in `CREDENTIALS.md`. Quick reference: `admin / admin123`, `dr.sharma / doctor123`, `receptionist1 / receptionist123`, `pharmacist1 / pharmacist123`, `labtech1 / labtech123`.

## Infrastructure Notes

- **Database**: SQLite (`db.sqlite3`) hardcoded in `settings.py`; no `DATABASE_URL` parsing — must be changed manually for production
- **Media files**: Uploaded/generated files (e.g., PDF lab reports) are stored in `backend/media/`
- **Cache / Redis**: At startup, `settings.py` auto-detects `django_redis`: if importable it tries Redis at `REDIS_URL` (default `redis://localhost:6379/1`); on connection failure it degrades silently to LocMemCache. Set `USE_REDIS=1` to force Redis and fail loudly. Without Redis, the token blacklist (logout) does not persist across server restarts — acceptable for dev, not for production.
- **Rate limiting**: 10 req/min anonymous/login, 100 req/min authenticated
- **Audit log**: Written to `backend/audit.log` (file-based)
- **Pagination**: Default 100 items/page (`PageNumberPagination`); no per-view overrides currently

## Security (Development vs Production)

The following `backend/CMS/settings.py` values are **development-only** and must be overridden via environment variables before deployment:
- `SECRET_KEY` — hardcoded insecure value
- `DEBUG = True`
- `ALLOWED_HOSTS = ['*']`
- `CORS_ORIGIN_ALLOW_ALL = True`
