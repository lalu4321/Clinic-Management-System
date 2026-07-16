# Clinic Management System (CMS)

A full-stack **Clinic Management System** built with **Django REST Framework** (backend) and **React + Vite** (frontend).  
Multi-role support: **Admin, Doctor, Receptionist, Pharmacist, Lab Technician**.

---

## Tech Stack

| Layer     | Technology                                              |
|-----------|---------------------------------------------------------|
| Backend   | Python 3.13+, Django 5.2, Django REST Framework, SimpleJWT |
| Frontend  | Node 24+, React 18, Vite 8, Tailwind CSS 3             |
| Database  | SQLite (default) — can be swapped for PostgreSQL/MySQL  |
| PDF       | ReportLab (lab report generation)                       |
| Auth      | JWT (Access + Refresh tokens via SimpleJWT)             |

---

## Project Structure

```
Clinic_Management_System/
├── backend/                       # Django DRF API
│   ├── CMS/                       # Django project settings
│   │   ├── settings.py            # Main config (DB, JWT, CORS, Middleware)
│   │   ├── urls.py                # Root URL routing (/api/...)
│   │   ├── wsgi.py                # WSGI entry point
│   │   └── asgi.py                # ASGI entry point
│   ├── authentication/            # Login, Logout, Token refresh
│   ├── administration/            # Staff, Doctor, Specialization, Schedule CRUD
│   ├── reception/                 # Patients, Appointments, Slot Validation, Billing
│   ├── doctor/                    # Prescriptions, Lab Requests, Patient History
│   ├── pharmacist/                # Prescription Dispensing, Medicine Inventory
│   ├── labtechinician/            # Lab Catalog, Results, PDF Reports, Lab Billing
│   ├── common/                    # Shared: Security middleware, Email service, Permissions
│   ├── seed_data.py               # Standalone seed script
│   ├── manage.py                  # Django management CLI
│   └── requirements.txt           # Python dependencies
├── frontend/                      # React + Vite SPA
│   ├── src/
│   │   ├── api/                   # Axios instance & auth API
│   │   ├── components/ui/         # Shared UI components (AutoSuggest, StatusBadge, etc.)
│   │   ├── context/               # Auth context provider
│   │   ├── modules/               # Role-based feature modules
│   │   │   ├── admin/             # Admin dashboard, Staff/Doctor management
│   │   │   ├── doctor/            # Doctor appointments, prescriptions, lab requests
│   │   │   ├── receptionist/      # Patient registration, appointment booking
│   │   │   ├── pharmacist/        # Prescription dispensing
│   │   │   └── labtech/           # Lab test processing
│   │   ├── pages/                 # Public pages (Home, Login)
│   │   └── utils/                 # Validation helpers
│   ├── package.json               # Node dependencies
│   ├── vite.config.js             # Vite configuration
│   ├── tailwind.config.js         # Tailwind CSS config
│   └── .env                       # Frontend environment variables
├── README.md                      # This file
├── OPERATIONS_MANUAL.md           # Deployment & operations guide
└── CREDENTIALS.md                 # Default login credentials
```

---

## Prerequisites

Before starting, make sure you have:

```bash
python --version    # Python 3.13+ required
node --version      # Node 24+ required
npm --version       # npm (comes with Node)
```

---

## Setup & Run — Step by Step

### STEP 1: Clone / Extract the project

```bash
# If from ZIP:
unzip Clinic_Management_System.zip
cd Clinic_Management_System
```

---

### STEP 2: Backend Setup

```bash
# Navigate to backend
cd backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Run database migrations (creates SQLite database)
python manage.py migrate

# Seed the database with sample data (doctors, patients, medicines, etc.)
python manage.py seed_data

# Verify seed data loaded
python manage.py shell -c "from django.contrib.auth.models import User; print(f'Users created: {User.objects.count()}')"

# Start the Django development server
python manage.py runserver
```

The backend will be running at: **http://127.0.0.1:8000**

You can verify by opening: http://127.0.0.1:8000/api/auth/login/ in your browser (should show DRF browsable API).

---

### STEP 3: Frontend Setup

Open a **new terminal** (keep backend running):

```bash
# Navigate to frontend
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend will be running at: **http://localhost:3000** (or the port Vite assigns).

---

### STEP 4: Configure Frontend API URL

The frontend needs to know where the backend is. Edit `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:8000
```

> If you changed the backend port, update this accordingly.

The frontend uses this variable in `src/api/axiosInstance.js` as the base URL for all API calls.

---

### STEP 5: Login & Use

Open **http://localhost:3000** in your browser. Click **"Staff Login"** and use one of these credentials:

| Role           | Username       | Password       |
|----------------|----------------|----------------|
| Admin          | admin          | admin123       |
| Receptionist   | receptionist1  | receptionist123|
| Doctor         | dr.sharma      | doctor123      |
| Pharmacist     | pharmacist1    | pharmacist123  |
| Lab Technician | labtech1       | labtech123     |

---

## Complete Workflow — How the Clinic Operates

### 1. Admin Sets Up the System
```
Admin Login → Dashboard
  ├── Manage Staff (Add/Edit/Deactivate/Set Status: ACTIVE/INACTIVE/ON_LEAVE)
  ├── Manage Doctors (Add/Edit/Set Duty Status: AVAILABLE/ON_DUTY/OFF_DUTY)
  ├── Manage Specializations (Cardiology, Pediatrics, etc.)
  └── Manage Doctor Schedules (Day + Time slots)
```

### 2. Receptionist Registers Patients & Books Appointments
```
Receptionist Login → Dashboard
  ├── Register New Patient (name, DOB, phone, email, blood group, address)
  ├── Search Patients (debounced search by name/code/phone)
  ├── Book Appointment
  │     ├── Select Patient
  │     ├── Select Doctor (OFF_DUTY doctors are disabled/grayed out)
  │     ├── Select Date (cannot book past dates)
  │     ├── Select Time Slot (10-min intervals, prevents double-booking)
  │     └── Confirm → Email notification sent to patient (console mode)
  └── View/Manage Consultation Bills
```

### 3. Doctor Sees Patients & Creates Prescriptions
```
Doctor Login → Dashboard
  ├── View Today's Appointments (with token numbers)
  ├── Write Prescription for an Appointment
  │     ├── Enter Symptoms & Diagnosis
  │     ├── Add Medicines (AutoSuggest typeahead — type to search)
  │     │     ├── Medicine name (searchable dropdown)
  │     │     ├── Dosage (e.g., 500mg)
  │     │     ├── Frequency (e.g., 3x daily)
  │     │     └── Quantity
  │     ├── Add Lab Tests (AutoSuggest typeahead — type to search)
  │     ├── + Add / - Remove rows dynamically
  │     └── Submit → Prescription sent to Pharmacy, Lab requests sent to Lab
  ├── View Prescription History
  └── View Patient History (isolated, aggregated timeline)
```

### 4. Pharmacist Dispenses Medicines
```
Pharmacist Login → Dashboard
  ├── View Active Prescriptions (from doctors)
  ├── Dispense Medicines (mark items as dispensed)
  ├── Manage Medicine Inventory
  └── View Dispensing History
```

### 5. Lab Technician Processes Lab Tests
```
Lab Tech Login → Dashboard
  ├── View Pending Lab Requests (from doctors)
  ├── Enter Lab Results
  │     └── When marked COMPLETED → Email sent to patient (console mode)
  ├── Generate PDF Lab Report (downloadable)
  ├── Manage Lab Test Catalog
  └── Manage Lab Billing
```

---

## API Endpoints Reference

All endpoints require JWT authentication (except login). Include header:  
`Authorization: Bearer <access_token>`

### Authentication
| Method | Endpoint              | Description      |
|--------|-----------------------|------------------|
| POST   | /api/auth/login/      | Login (returns JWT tokens) |
| POST   | /api/auth/logout/     | Logout (blacklist token) |
| POST   | /api/auth/refresh/    | Refresh access token |

### Administration (Admin only)
| Method | Endpoint                        | Description           |
|--------|----------------------------------|-----------------------|
| GET    | /api/administration/staff/       | List all staff (includes staff_status) |
| POST   | /api/administration/staff/       | Create staff member   |
| GET    | /api/administration/staff/{id}/  | Get staff details     |
| PATCH  | /api/administration/staff/{id}/  | Update staff (incl. staff_status) |
| DELETE | /api/administration/staff/{id}/  | Soft-delete staff     |
| GET    | /api/administration/doctors/     | List doctors (includes duty_status) |
| POST   | /api/administration/doctors/     | Create doctor profile |
| PATCH  | /api/administration/doctors/{id}/| Update doctor (incl. duty_status) |
| GET    | /api/administration/specializations/ | List specializations |
| GET    | /api/administration/schedules/   | List doctor schedules |

### Reception (Receptionist only)
| Method | Endpoint                           | Description              |
|--------|-------------------------------------|--------------------------|
| GET    | /api/reception/patients/            | List patients (includes patient_status, email) |
| POST   | /api/reception/patients/            | Register patient         |
| GET    | /api/reception/patients/{id}/       | Get patient details      |
| PATCH  | /api/reception/patients/{id}/       | Update patient           |
| GET    | /api/reception/doctors/             | List bookable doctors (includes is_bookable) |
| GET    | /api/reception/available-slots/     | Get available time slots |
| POST   | /api/reception/appointments/        | Book appointment         |
| GET    | /api/reception/consultation-bills/  | List bills               |

### Doctor
| Method | Endpoint                                | Description                |
|--------|-----------------------------------------|----------------------------|
| GET    | /api/doctor/appointments/               | Doctor's appointments      |
| POST   | /api/doctor/prescriptions/              | Create prescription        |
| POST   | /api/doctor/prescription-items/         | Add medicine to prescription|
| POST   | /api/doctor/lab-requests/               | Create lab test request    |
| PATCH  | /api/doctor/prescriptions/{id}/activate/| Activate draft prescription|
| GET    | /api/doctor/patient-history/            | Patient history timeline   |

### Pharmacy (Pharmacist only)
| Method | Endpoint                       | Description             |
|--------|--------------------------------|-------------------------|
| GET    | /api/pharmacy/prescriptions/   | Active prescriptions    |
| PATCH  | /api/pharmacy/prescriptions/{id}/| Update dispense status |
| GET    | /api/pharmacy/medicines/       | Medicine inventory      |

### Lab (Lab Technician only)
| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | /api/lab/requests/                | Pending lab requests     |
| PATCH  | /api/lab/requests/{id}/           | Update results (triggers email on COMPLETED) |
| GET    | /api/lab/report/{id}/pdf/         | Download PDF lab report  |
| GET    | /api/lab/catalog/                 | Lab test catalog         |
| GET    | /api/lab/bills/                   | Lab billing              |

---

## API Testing with cURL

```bash
# 1. Login and get token
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Response: { "success": true, "data": { "access": "eyJ...", "refresh": "eyJ..." } }

# 2. Use the access token for authenticated requests
TOKEN="eyJ..."   # paste the access token from step 1

# 3. List all staff
curl -X GET http://localhost:8000/api/administration/staff/ \
  -H "Authorization: Bearer $TOKEN"

# 4. List all doctors with duty_status
curl -X GET http://localhost:8000/api/administration/doctors/ \
  -H "Authorization: Bearer $TOKEN"

# 5. List all patients with patient_status
curl -X GET http://localhost:8000/api/reception/patients/ \
  -H "Authorization: Bearer $TOKEN"

# 6. Get available appointment slots
curl -X GET "http://localhost:8000/api/reception/available-slots/?doctor_id=1&date=2026-04-01" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Role-Based Status System (ENUMs)

### Doctor Duty Status
| Status     | Can Take Appointments? | Badge Color |
|------------|----------------------|-------------|
| AVAILABLE  | Yes                  | Green       |
| ON_DUTY    | Yes                  | Blue        |
| OFF_DUTY   | No (blocked in UI + API) | Red     |

### Staff Status
| Status   | Description                    |
|----------|--------------------------------|
| ACTIVE   | Currently employed & working   |
| INACTIVE | Employment ended or suspended  |
| ON_LEAVE | Temporarily absent             |

### Patient Status
| Status      | Description                        |
|-------------|------------------------------------|
| REGISTERED  | New patient, no active treatment   |
| UNDER_CARE  | Currently receiving treatment      |
| ARCHIVED    | Discharged or no longer active     |

---

## Email Notifications

The system sends email notifications for:
- **Appointment booked** → Patient receives confirmation
- **Prescription created** → Patient notified
- **Lab results completed** → Patient notified

**Current mode: Console (mock)**  
Emails are printed to the terminal/console output. To enable real email delivery, configure SMTP in `backend/CMS/settings.py`:

```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your-clinic@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'
DEFAULT_FROM_EMAIL = 'Clinic CMS <your-clinic@gmail.com>'
```

---

## Security Features

- JWT authentication with token expiry (30 min access / 1 day refresh)
- Role-based API permissions (IsAdmin, IsDoctor, IsReceptionist, etc.)
- IDOR prevention — users can only access data within their role
- Custom security middleware (XSS filter, content-type sniffing, clickjacking)
- Input sanitization on all API endpoints
- Rate limiting (10 req/min anonymous, 100 req/min authenticated)
- Double-booking prevention (database-level unique constraints)
- Slot validation (no past dates, 10-minute intervals only)
- Audit logging for sensitive operations

---

## Common Commands Reference

```bash
# ─── BACKEND ──────────────────────────────────────────

# Activate virtual environment
source backend/venv/bin/activate          # macOS/Linux
backend\venv\Scripts\activate             # Windows

# Install dependencies
pip install -r backend/requirements.txt

# Run migrations
python backend/manage.py migrate

# Seed sample data
python backend/manage.py seed_data

# Create a superuser manually
python backend/manage.py createsuperuser

# Start development server
python backend/manage.py runserver

# Start on custom port
python backend/manage.py runserver 0.0.0.0:8080

# Open Django shell
python backend/manage.py shell

# Run Django admin panel: http://localhost:8000/admin/

# ─── FRONTEND ─────────────────────────────────────────

# Install dependencies
cd frontend && npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Production Deployment

### Backend (Gunicorn)
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
gunicorn CMS.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

### Frontend (Nginx)
```bash
cd frontend
npm install
npm run build
# Serve the `dist/` folder with Nginx
```

**Nginx config snippet:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /media/ {
        alias /path/to/backend/media/;
    }
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` | Make sure virtual env is activated: `source venv/bin/activate` |
| Login fails | Run `python manage.py seed_data` to create default users |
| CORS errors | Backend `CORS_ORIGIN_ALLOW_ALL = True` is set in settings.py |
| Port in use | Kill existing process: `lsof -i :8000` then `kill <PID>` |
| Frontend can't reach API | Check `VITE_BACKEND_URL` in `frontend/.env` matches backend URL |
| Migrations error | Delete `db.sqlite3` and re-run `python manage.py migrate && python manage.py seed_data` |
| PDF not generating | Ensure `reportlab` is installed: `pip install reportlab` |
