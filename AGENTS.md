# Repository Guidelines

## Project Structure & Module Organization

Full-stack clinic management system with a Django REST Framework backend and a React + Vite frontend. Each backend Django app maps 1-to-1 to a frontend module by user role.

**Backend** (`backend/`):
- `CMS/` — Django project settings, root URL config, WSGI/ASGI entry points
- `authentication/` — JWT login/logout/token refresh
- `administration/` — Admin management of staff and doctors
- `reception/` — Patient registration, appointment booking, slot validation
- `doctor/` — Prescriptions, lab requests, patient history
- `pharmacist/` — Medicine dispensing and inventory
- `labtechinician/` — Lab test processing and PDF report generation (ReportLab)
- `common/` — Shared role-based permission classes, security middleware, audit logging, email service, standardized JSON renderer
- `tests/` — Integration and security tests that span multiple apps (`test_integration.py`, `test_security.py`, `test_status_enums.py`)

**Frontend** (`frontend/src/`):
- `modules/` — Role-scoped feature pages: `admin/`, `doctor/`, `receptionist/`, `pharmacist/`, `labTechnician/`
- `components/ui/` — Shadcn UI components (do not edit directly; regenerate with `npx shadcn@latest add <component>`)
- `api/axiosInstance.js` — Axios client with JWT interceptors for auto token refresh
- `routes/` — React Router v7 config with `ProtectedRoute` and role-based guards
- `context/` — Auth and toast state via React Context

The `@/` path alias resolves to `frontend/src/` (configured in both `vite.config.js` and `jsconfig.json`).

## Build, Test, and Development Commands

**Backend** (from `backend/`):
```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver          # Dev server on port 8000
python manage.py seed_data          # Seed default roles, staff, and patients (also: python seed_data.py)
python manage.py test               # Run all Django tests
python manage.py test reception     # Run tests for a single app
python manage.py test tests         # Run integration/security tests in backend/tests/
gunicorn CMS.wsgi:application       # Production server
```

**Frontend** (from `frontend/`):
```bash
yarn install
yarn dev        # Dev server on port 3000
yarn build      # Production build to dist/
yarn preview    # Preview production build
```

Frontend requires `VITE_BACKEND_URL=http://localhost:8000` in `frontend/.env`.

## Coding Style & Naming Conventions

No formatter is configured. No active ESLint config file exists despite multiple ESLint plugins in devDependencies (`eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import`). Follow existing patterns:

- **Python**: Standard Django conventions; apps use `models.py`, `serializers.py`, `views.py`, `urls.py`
- **JavaScript**: `.jsx` for React components, `.js` for utilities and hooks; no TypeScript
- **CSS**: Tailwind utility classes only; custom design tokens use the `clinical-*` color prefix (e.g., `clinical-primary: #00647c`) defined in `tailwind.config.js`
- **Forms**: Use `react-hook-form` with Zod schemas for validation — see `src/utils/validation.js` for existing schemas
- **API responses**: All backend responses go through `common/renderers.py` for a standardized JSON envelope

## Architecture Constraints

**All new models must inherit from `common.models.BaseModel`**, which provides `created_at`, `updated_at`, `is_deleted` (soft delete), and `version` fields. The default manager excludes soft-deleted records; use `all_objects` to include them.

**`BaseModel.save()` calls `full_clean()` before every save** — model-level validators run automatically on all writes. This is non-standard Django behavior; account for it in serializer/test logic.

**Never call `queryset.delete()` on BaseModel subclasses** — that bypasses the soft-delete override and hard-deletes rows. Always call `.delete()` on a model instance.

**All new views must declare a permission class** from `common/permissions.py` (e.g., `IsAdmin`, `IsDoctor`). The default DRF permission is `IsAuthenticated`; role classes additionally check `user.groups`. Group names are exact strings: `"Admin"`, `"Doctor"`, `"Receptionist"`, `"Pharmacist"`, `"LabTechnician"` (no space — differs from display name "Lab Technician").

**Do not set model statuses directly** — several models (`Prescription`, `Appointment`, `LabRequest`, `LabTest`) enforce valid transitions via a `STATE_MACHINE` dict. Use the model's transition methods to update status, or you'll bypass validation.

**Appointment slot logic in `reception/slot_validator.py` uses IST (Asia/Kolkata)** for past-time rejection — any new date/time comparison must convert to IST first. `SLOT_MINUTES = 10` in `slot_validator.py` must stay in sync with `APPOINTMENT_SLOT_MINUTES` in `reception/models.py`.

**Do not modify signal handlers without tracing downstream effects** — `doctor/signals.py` auto-creates a `PharmacyBill` when a `Prescription` is saved. Similar cross-app signals exist in `pharmacist/` and `labtechinician/`. Breaking a signal silently corrupts dependent workflows.

## Testing Guidelines

**Backend**: Django's built-in test runner. Each app has a `tests.py`. Integration tests are in `backend/tests/`.

```bash
python manage.py test                     # All tests
python manage.py test authentication      # Single app
python manage.py test tests               # Cross-app integration and security tests
```

No frontend test framework is configured.

## Security Notes

The following settings in `backend/CMS/settings.py` are for **development only** and must be overridden via environment variables before any deployment:

- `SECRET_KEY` — hardcoded insecure value
- `DEBUG = True`
- `ALLOWED_HOSTS = ['*']`
- `CORS_ORIGIN_ALLOW_ALL = True`

Sensitive operations are audit-logged via `common/audit.py`. Role-based access is enforced by permission classes in `common/permissions.py` — all new views must declare an appropriate permission class.
