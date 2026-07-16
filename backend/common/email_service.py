"""
Email Notification Service for Clinic Management System

Handles all internal workflow notifications:
  1. Appointment created      → Doctor
  2. Lab test requested       → Lab Technicians (all active)
  3. Lab result completed     → Doctor
  4. Lab bill generated       → Patient + Receptionists (all active)
  5. Lab bill paid            → Patient + Lab Technician (who processed)
  6. Prescription activated   → Pharmacists (all active)
  7. Medicine dispensed       → Doctor

Legacy patient-facing emails (appointment confirmation, prescription ready,
lab results available) are preserved unchanged.

Design principles:
  - Every send is dispatched on a daemon thread → never blocks the request.
  - Any exception inside a send method is caught and logged; it never
    propagates to the caller.
  - If SMTP is not configured the email is printed to the console instead
    (console-mode, safe for local development).
"""
import os
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import List, Optional, Dict, Any
import logging

from django.conf import settings
from django.utils import timezone
import pytz

logger = logging.getLogger('email_service')

IST = pytz.timezone('Asia/Kolkata')


# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

class EmailConfig:
    """Email configuration drawn from environment variables."""

    SMTP_HOST     = os.environ.get('EMAIL_HOST',          'smtp.gmail.com')
    SMTP_PORT     = int(os.environ.get('EMAIL_PORT',      587))
    SMTP_USER     = os.environ.get('EMAIL_HOST_USER',     '')
    SMTP_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
    FROM_EMAIL    = os.environ.get('DEFAULT_FROM_EMAIL',  'noreply@cmsclinic.com')
    FROM_NAME     = os.environ.get('EMAIL_FROM_NAME',     'CMS Clinic')

    CLINIC_NAME    = os.environ.get('CLINIC_NAME',    'CMS Clinic')
    CLINIC_ADDRESS = os.environ.get('CLINIC_ADDRESS', '123 Healthcare Avenue, Medical District')
    CLINIC_PHONE   = os.environ.get('CLINIC_PHONE',   '+91-1234567890')
    CLINIC_EMAIL   = os.environ.get('CLINIC_EMAIL',   'info@cmsclinic.com')

    # Set EMAIL_NOTIFICATIONS_ENABLED=false in env to silence all emails.
    ENABLED = os.environ.get('EMAIL_NOTIFICATIONS_ENABLED', 'true').lower() != 'false'

    @classmethod
    def is_configured(cls):
        """True when real SMTP credentials are present."""
        return bool(cls.SMTP_USER and cls.SMTP_PASSWORD)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_ist_timestamp() -> str:
    """Return current time as a human-readable IST string."""
    return timezone.localtime(timezone.now()).strftime('%d %b %Y, %I:%M %p IST')


def _get_emails_by_role(role_name: str) -> List[str]:
    """
    Return all non-empty email addresses for active users who belong to the
    Django auth group identified by *role_name*.
    """
    from django.contrib.auth.models import User
    return list(
        User.objects.filter(
            groups__name=role_name,
            is_active=True,
        ).exclude(email='').values_list('email', flat=True)
    )


def _row(label: str, value: str) -> str:
    """Render a single label/value row for an HTML info-box."""
    return (
        f'<div style="margin:10px 0;">'
        f'<div style="color:#64748b;font-size:11px;text-transform:uppercase;font-weight:600;">{label}</div>'
        f'<div style="font-size:15px;font-weight:600;color:#1e293b;margin-top:2px;">{value}</div>'
        f'</div>'
    )


def _html_email(header_color: str, subtitle: str, body_html: str) -> str:
    """Wrap *body_html* in the standard clinic email shell."""
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body{{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f1f5f9;}}
  .wrap{{max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);}}
  .hdr{{background:{header_color};color:#fff;padding:24px 30px;}}
  .hdr h2{{margin:0;font-size:20px;}}
  .hdr p{{margin:4px 0 0;opacity:.9;font-size:13px;}}
  .body{{padding:28px 30px;}}
  .box{{background:#f8fafc;border-left:4px solid {header_color};border-radius:0 6px 6px 0;padding:16px 20px;margin:18px 0;}}
  .med-list{{background:#f8fafc;border-radius:6px;padding:14px 20px;margin:14px 0;}}
  .med-list li{{margin:6px 0;color:#334155;}}
  .badge{{display:inline-block;background:{header_color};color:#fff;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;}}
  .ftr{{background:#f8fafc;text-align:center;padding:18px 20px;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h2>{EmailConfig.CLINIC_NAME}</h2>
    <p>{subtitle}</p>
  </div>
  <div class="body">
    {body_html}
  </div>
  <div class="ftr">
    <strong>{EmailConfig.CLINIC_NAME}</strong> &nbsp;|&nbsp;
    {EmailConfig.CLINIC_ADDRESS}<br>
    Phone: {EmailConfig.CLINIC_PHONE} &nbsp;|&nbsp; {EmailConfig.CLINIC_EMAIL}<br>
    <span style="margin-top:6px;display:block;">This is an automated notification. Please do not reply.</span>
  </div>
</div>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────────────
# TEMPLATES
# ─────────────────────────────────────────────────────────────────────────────

class EmailTemplate:
    """
    Each static method returns (subject, html_content, plain_content).
    All internal-workflow templates are defined here alongside the legacy
    patient-facing ones.
    """

    # ── LEGACY: patient-facing ────────────────────────────────────────────────

    @staticmethod
    def appointment_confirmation(data: Dict[str, Any]) -> tuple:
        """Patient appointment confirmation (legacy, unchanged)."""
        subject = f"Appointment Confirmed - {EmailConfig.CLINIC_NAME}"
        html = f"""<!DOCTYPE html>
<html><head><style>
  body{{font-family:Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#2563eb;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{background:#f8fafc;padding:30px;border:1px solid #e2e8f0;}}
  .info-box{{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #2563eb;}}
  .info-row{{margin:10px 0;}}
  .label{{color:#64748b;font-size:12px;text-transform:uppercase;}}
  .value{{font-size:16px;font-weight:600;color:#1e293b;}}
  .footer{{text-align:center;padding:20px;color:#64748b;font-size:12px;}}
  .token{{background:#2563eb;color:white;padding:10px 20px;border-radius:4px;display:inline-block;font-size:24px;font-weight:bold;}}
</style></head>
<body><div class="container">
  <div class="header"><h1 style="margin:0;">{EmailConfig.CLINIC_NAME}</h1>
    <p style="margin:5px 0 0;">Appointment Confirmation</p></div>
  <div class="content">
    <p>Dear <strong>{data['patient_name']}</strong>,</p>
    <p>Your appointment has been successfully booked. Please find the details below:</p>
    <div class="info-box">
      <div class="info-row"><div class="label">Token Number</div>
        <div class="token">#{data['token_number']}</div></div>
    </div>
    <div class="info-box">
      <div class="info-row"><div class="label">Appointment Code</div>
        <div class="value">{data['appointment_code']}</div></div>
      <div class="info-row"><div class="label">Date</div>
        <div class="value">{data['appointment_date']}</div></div>
      <div class="info-row"><div class="label">Time</div>
        <div class="value">{data['appointment_time']} IST</div></div>
      <div class="info-row"><div class="label">Doctor</div>
        <div class="value">Dr. {data['doctor_name']}</div></div>
      <div class="info-row"><div class="label">Specialization</div>
        <div class="value">{data.get('specialization', 'General')}</div></div>
    </div>
    <p><strong>Important Instructions:</strong></p>
    <ul>
      <li>Please arrive 15 minutes before your appointment time</li>
      <li>Bring your Token Number and ID proof</li>
      <li>Carry any previous medical reports if available</li>
    </ul>
    <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
  </div>
  <div class="footer">
    <p><strong>{EmailConfig.CLINIC_NAME}</strong></p>
    <p>{EmailConfig.CLINIC_ADDRESS}</p>
    <p>Phone: {EmailConfig.CLINIC_PHONE} | Email: {EmailConfig.CLINIC_EMAIL}</p>
    <p style="margin-top:20px;font-size:10px;">This is an automated message. Please do not reply to this email.</p>
  </div>
</div></body></html>"""
        plain = (
            f"{EmailConfig.CLINIC_NAME} – Appointment Confirmation\n\n"
            f"Dear {data['patient_name']},\n\n"
            f"Your appointment has been successfully booked.\n\n"
            f"Token Number   : #{data['token_number']}\n"
            f"Appointment Code: {data['appointment_code']}\n"
            f"Date           : {data['appointment_date']}\n"
            f"Time           : {data['appointment_time']} IST\n"
            f"Doctor         : Dr. {data['doctor_name']}\n"
            f"Specialization : {data.get('specialization', 'General')}\n\n"
            f"Please arrive 15 minutes before your appointment time.\n\n"
            f"{EmailConfig.CLINIC_NAME}\n{EmailConfig.CLINIC_ADDRESS}\n"
            f"Phone: {EmailConfig.CLINIC_PHONE}"
        )
        return subject, html, plain

    @staticmethod
    def prescription_ready(data: Dict[str, Any]) -> tuple:
        """Patient prescription-ready notification (legacy, unchanged)."""
        subject = f"Your Prescription is Ready - {EmailConfig.CLINIC_NAME}"
        html = f"""<!DOCTYPE html>
<html><head><style>
  body{{font-family:Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#059669;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{background:#f8fafc;padding:30px;border:1px solid #e2e8f0;}}
  .info-box{{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #059669;}}
  .label{{color:#64748b;font-size:12px;text-transform:uppercase;}}
  .value{{font-size:16px;font-weight:600;color:#1e293b;}}
  .footer{{text-align:center;padding:20px;color:#64748b;font-size:12px;}}
  .highlight{{background:#ecfdf5;padding:15px;border-radius:8px;text-align:center;}}
</style></head>
<body><div class="container">
  <div class="header"><h1 style="margin:0;">{EmailConfig.CLINIC_NAME}</h1>
    <p style="margin:5px 0 0;">Prescription Ready</p></div>
  <div class="content">
    <p>Dear <strong>{data['patient_name']}</strong>,</p>
    <div class="highlight"><p style="margin:0;font-size:18px;">Your prescription is now ready!</p></div>
    <div class="info-box">
      <div style="margin:10px 0;"><div class="label">Prescription Code</div>
        <div class="value">{data['prescription_code']}</div></div>
      <div style="margin:10px 0;"><div class="label">Date</div>
        <div class="value">{data['date']}</div></div>
      <div style="margin:10px 0;"><div class="label">Prescribed By</div>
        <div class="value">Dr. {data['doctor_name']}</div></div>
      <div style="margin:10px 0;"><div class="label">Diagnosis</div>
        <div class="value">{data.get('diagnosis', 'As discussed')}</div></div>
    </div>
    <p>Please visit our pharmacy counter to collect your medicines.</p>
    <p><strong>Pharmacy Hours:</strong> 9:00 AM – 8:00 PM (Monday to Saturday)</p>
  </div>
  <div class="footer">
    <p><strong>{EmailConfig.CLINIC_NAME}</strong></p>
    <p>{EmailConfig.CLINIC_ADDRESS}</p>
    <p>Phone: {EmailConfig.CLINIC_PHONE}</p>
  </div>
</div></body></html>"""
        plain = (
            f"{EmailConfig.CLINIC_NAME} – Prescription Ready\n\n"
            f"Dear {data['patient_name']},\n\n"
            f"Your prescription is now ready!\n\n"
            f"Prescription Code: {data['prescription_code']}\n"
            f"Date             : {data['date']}\n"
            f"Prescribed By    : Dr. {data['doctor_name']}\n"
            f"Diagnosis        : {data.get('diagnosis', 'As discussed')}\n\n"
            f"Please visit our pharmacy counter to collect your medicines.\n\n"
            f"{EmailConfig.CLINIC_NAME}\n{EmailConfig.CLINIC_ADDRESS}\n"
            f"Phone: {EmailConfig.CLINIC_PHONE}"
        )
        return subject, html, plain

    @staticmethod
    def lab_results_ready(data: Dict[str, Any]) -> tuple:
        """Patient lab-results-available notification (legacy, unchanged)."""
        subject = f"Lab Results Available - {EmailConfig.CLINIC_NAME}"
        html = f"""<!DOCTYPE html>
<html><head><style>
  body{{font-family:Arial,sans-serif;line-height:1.6;color:#333;}}
  .container{{max-width:600px;margin:0 auto;padding:20px;}}
  .header{{background:#7c3aed;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;}}
  .content{{background:#f8fafc;padding:30px;border:1px solid #e2e8f0;}}
  .info-box{{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #7c3aed;}}
  .label{{color:#64748b;font-size:12px;text-transform:uppercase;}}
  .value{{font-size:16px;font-weight:600;color:#1e293b;}}
  .footer{{text-align:center;padding:20px;color:#64748b;font-size:12px;}}
  .warning{{background:#fef3c7;padding:15px;border-radius:8px;margin:20px 0;border-left:4px solid #f59e0b;}}
</style></head>
<body><div class="container">
  <div class="header"><h1 style="margin:0;">{EmailConfig.CLINIC_NAME}</h1>
    <p style="margin:5px 0 0;">Lab Results Available</p></div>
  <div class="content">
    <p>Dear <strong>{data['patient_name']}</strong>,</p>
    <p>Your lab test results are now available!</p>
    <div class="info-box">
      <div style="margin:10px 0;"><div class="label">Test Name</div>
        <div class="value">{data['test_name']}</div></div>
      <div style="margin:10px 0;"><div class="label">Report Date</div>
        <div class="value">{data['date']}</div></div>
      <div style="margin:10px 0;"><div class="label">Referring Doctor</div>
        <div class="value">Dr. {data['doctor_name']}</div></div>
    </div>
    <div class="warning">
      <p style="margin:0;"><strong>Important:</strong> Please consult your doctor for interpretation of
      the results. Do not self-medicate based on lab reports.</p>
    </div>
    <p>You can collect your printed report from our lab counter.</p>
    <p><strong>Lab Hours:</strong> 7:00 AM – 7:00 PM (Monday to Saturday)</p>
  </div>
  <div class="footer">
    <p><strong>{EmailConfig.CLINIC_NAME}</strong></p>
    <p>{EmailConfig.CLINIC_ADDRESS}</p>
    <p>Phone: {EmailConfig.CLINIC_PHONE}</p>
    <p style="font-size:10px;">This email is confidential and intended only for the named recipient.</p>
  </div>
</div></body></html>"""
        plain = (
            f"{EmailConfig.CLINIC_NAME} – Lab Results Available\n\n"
            f"Dear {data['patient_name']},\n\n"
            f"Your lab test results are now available!\n\n"
            f"Test Name      : {data['test_name']}\n"
            f"Report Date    : {data['date']}\n"
            f"Referring Doctor: Dr. {data['doctor_name']}\n\n"
            f"IMPORTANT: Please consult your doctor for interpretation. Do not self-medicate.\n\n"
            f"{EmailConfig.CLINIC_NAME}\n{EmailConfig.CLINIC_ADDRESS}\n"
            f"Phone: {EmailConfig.CLINIC_PHONE}"
        )
        return subject, html, plain

    # ── TRIGGER 1: Appointment created → Doctor ───────────────────────────────

    @staticmethod
    def appointment_to_doctor(data: Dict[str, Any]) -> tuple:
        subject = f"New Appointment: {data['patient_name']} | {data['appointment_code']}"
        body = (
            f"<p>Dear <strong>Dr. {data['doctor_name']}</strong>,</p>"
            f"<p>A new appointment has been booked for you.</p>"
            f'<div class="box">'
            f"{_row('Patient', data['patient_name'])}"
            f"{_row('Appointment Code', data['appointment_code'])}"
            f"{_row('Date', data['appointment_date'])}"
            f"{_row('Time', data['appointment_time'] + ' IST')}"
            f"{_row('Token No.', '#' + str(data['token_number']))}"
            f"{_row('Booked By', data['receptionist_name'] + ' (Receptionist)')}"
            f"{_row('Timestamp', data['timestamp'])}"
            f'</div>'
            f"<p>Please review your schedule accordingly.</p>"
        )
        html = _html_email('#2563eb', 'New Appointment Notification', body)
        plain = (
            f"Dear Dr. {data['doctor_name']},\n\n"
            f"A new appointment has been booked for you.\n\n"
            f"Patient          : {data['patient_name']}\n"
            f"Appointment Code : {data['appointment_code']}\n"
            f"Date             : {data['appointment_date']}\n"
            f"Time             : {data['appointment_time']} IST\n"
            f"Token No.        : #{data['token_number']}\n"
            f"Booked By        : {data['receptionist_name']} (Receptionist)\n"
            f"Timestamp        : {data['timestamp']}\n\n"
            f"{EmailConfig.CLINIC_NAME}"
        )
        return subject, html, plain

    # ── TRIGGER 2: Lab test requested → Lab Technicians ──────────────────────

    @staticmethod
    def lab_test_request_to_lab_tech(data: Dict[str, Any]) -> tuple:
        subject = f"New Lab Test Request – {data['appointment_code']}"
        tests_html = ''.join(f'<li>{t}</li>' for t in data['tests'])
        tests_plain = '\n'.join(f'  - {t}' for t in data['tests'])
        body = (
            f"<p>A new lab test request has been placed and requires your attention.</p>"
            f'<div class="box">'
            f"{_row('Appointment Code', data['appointment_code'])}"
            f"{_row('Patient', data['patient_name'])}"
            f"{_row('Requested By', 'Dr. ' + data['doctor_name'])}"
            f"{_row('Timestamp', data['timestamp'])}"
            f'</div>'
            f'<div class="med-list"><strong>Requested Tests:</strong>'
            f'<ul style="margin:8px 0 0 0;padding-left:20px;">{tests_html}</ul></div>'
            f"<p>Please process these tests at your earliest convenience.</p>"
        )
        html = _html_email('#7c3aed', 'Lab Test Request', body)
        plain = (
            f"New lab test request placed.\n\n"
            f"Appointment Code : {data['appointment_code']}\n"
            f"Patient          : {data['patient_name']}\n"
            f"Requested By     : Dr. {data['doctor_name']}\n"
            f"Timestamp        : {data['timestamp']}\n\n"
            f"Requested Tests:\n{tests_plain}\n\n"
            f"{EmailConfig.CLINIC_NAME}"
        )
        return subject, html, plain

    # ── TRIGGER 3: Lab result completed → Doctor ──────────────────────────────

    @staticmethod
    def lab_result_to_doctor(data: Dict[str, Any]) -> tuple:
        subject = f"Lab Results Ready – {data['appointment_code']} | {data['test_name']}"
        abnormal_badge = (
            '<span class="badge">⚠ Abnormal Results Found</span>'
            if data['has_abnormal'] else
            '<span style="color:#059669;font-weight:600;">All results within normal range</span>'
        )
        body = (
            f"<p>Dear <strong>Dr. {data['doctor_name']}</strong>,</p>"
            f"<p>Lab test results are now available for your patient.</p>"
            f'<div class="box">'
            f"{_row('Appointment Code', data['appointment_code'])}"
            f"{_row('Patient', data['patient_name'])}"
            f"{_row('Test', data['test_name'])}"
            f"{_row('Result Status', abnormal_badge)}"
            f"{_row('Completed By', data['technician_name'] + ' (Lab Technician)')}"
            f"{_row('Timestamp', data['timestamp'])}"
            f'</div>'
            f"<p>Please log in to view the full result details and update your treatment plan.</p>"
        )
        html = _html_email('#0891b2', 'Lab Results Notification', body)
        plain = (
            f"Dear Dr. {data['doctor_name']},\n\n"
            f"Lab results are now available for your patient.\n\n"
            f"Appointment Code : {data['appointment_code']}\n"
            f"Patient          : {data['patient_name']}\n"
            f"Test             : {data['test_name']}\n"
            f"Abnormal Results : {'Yes' if data['has_abnormal'] else 'No'}\n"
            f"Completed By     : {data['technician_name']} (Lab Technician)\n"
            f"Timestamp        : {data['timestamp']}\n\n"
            f"{EmailConfig.CLINIC_NAME}"
        )
        return subject, html, plain

    # ── TRIGGER 4: Lab bill generated → Patient + Receptionists ──────────────

    @staticmethod
    def lab_bill_generated(data: Dict[str, Any]) -> tuple:
        subject = f"Lab Bill Created – Appointment {data['appointment_code']}"
        body = (
            f"<p>Dear <strong>{data['recipient_name']}</strong>,</p>"
            f"<p>A lab bill has been created for the following appointment.</p>"
            f'<div class="box">'
            f"{_row('Patient', data['patient_name'])}"
            f"{_row('Appointment Code', data['appointment_code'])}"
            f"{_row('Lab Bill Code', data['lab_bill_code'])}"
            f"{_row('Status', '<span class=\"badge\" style=\"background:#d97706;\">PENDING</span>')}"
            f"{_row('Amount', '&#8377;' + str(data['total_amount']) + ' (updated as each test completes)')}"
            f"{_row('Timestamp', data['timestamp'])}"
            f'</div>'
            f"<p>The bill amount will be updated automatically as each lab test is completed.</p>"
        )
        html = _html_email('#d97706', 'Lab Bill Generated', body)
        plain = (
            f"Dear {data['recipient_name']},\n\n"
            f"A lab bill has been created.\n\n"
            f"Patient          : {data['patient_name']}\n"
            f"Appointment Code : {data['appointment_code']}\n"
            f"Lab Bill Code    : {data['lab_bill_code']}\n"
            f"Status           : PENDING\n"
            f"Amount           : Rs.{data['total_amount']} (updated as tests complete)\n"
            f"Timestamp        : {data['timestamp']}\n\n"
            f"{EmailConfig.CLINIC_NAME}"
        )
        return subject, html, plain

    # ── TRIGGER 5: Lab bill paid → Patient + Lab Technician ──────────────────

    @staticmethod
    def lab_payment_completed(data: Dict[str, Any]) -> tuple:
        subject = f"Lab Bill Payment Confirmed – {data['appointment_code']}"
        body = (
            f"<p>Dear <strong>{data['recipient_name']}</strong>,</p>"
            f"<p>The lab bill payment has been successfully recorded.</p>"
            f'<div class="box">'
            f"{_row('Patient', data['patient_name'])}"
            f"{_row('Appointment Code', data['appointment_code'])}"
            f"{_row('Lab Bill Code', data['lab_bill_code'])}"
            f"{_row('Payment Amount', '&#8377;' + str(data['payment_amount']))}"
            f"{_row('Payment Date &amp; Time', data['paid_at'])}"
            f"{_row('Processed By', data['technician_name'] + ' (Lab Technician)')}"
            f'</div>'
        )
        html = _html_email('#059669', 'Payment Confirmed', body)
        plain = (
            f"Dear {data['recipient_name']},\n\n"
            f"Lab bill payment confirmed.\n\n"
            f"Patient          : {data['patient_name']}\n"
            f"Appointment Code : {data['appointment_code']}\n"
            f"Lab Bill Code    : {data['lab_bill_code']}\n"
            f"Payment Amount   : Rs.{data['payment_amount']}\n"
            f"Payment Date/Time: {data['paid_at']}\n"
            f"Processed By     : {data['technician_name']} (Lab Technician)\n\n"
            f"{EmailConfig.CLINIC_NAME}"
        )
        return subject, html, plain

    # ── TRIGGER 6: Prescription activated → Pharmacists ──────────────────────

    @staticmethod
    def prescription_to_pharmacist(data: Dict[str, Any]) -> tuple:
        subject = f"New Prescription Ready – {data['patient_name']} | {data['prescription_code']}"
        meds_html = ''.join(
            f'<li><strong>{m["name"]}</strong> – {m["dosage"]}, {m["frequency"]} &times; {m["quantity"]}</li>'
            for m in data['medicines']
        )
        meds_plain = '\n'.join(
            f'  - {m["name"]} | {m["dosage"]} | {m["frequency"]} | Qty: {m["quantity"]}'
            for m in data['medicines']
        )
        body = (
            f"<p>A new prescription has been activated and is ready for dispensing.</p>"
            f'<div class="box">'
            f"{_row('Patient', data['patient_name'])}"
            f"{_row('Prescription Code', data['prescription_code'])}"
            f"{_row('Prescribed By', 'Dr. ' + data['doctor_name'])}"
            f"{_row('Timestamp', data['timestamp'])}"
            f'</div>'
            f'<div class="med-list"><strong>Medicines to Dispense:</strong>'
            f'<ul style="margin:8px 0 0 0;padding-left:20px;">{meds_html}</ul></div>'
            f"<p>Please prepare the medicines and await patient collection.</p>"
        )
        html = _html_email('#4f46e5', 'Prescription Ready for Dispensing', body)
        plain = (
            f"New prescription activated and ready for dispensing.\n\n"
            f"Patient          : {data['patient_name']}\n"
            f"Prescription Code: {data['prescription_code']}\n"
            f"Prescribed By    : Dr. {data['doctor_name']}\n"
            f"Timestamp        : {data['timestamp']}\n\n"
            f"Medicines:\n{meds_plain}\n\n"
            f"{EmailConfig.CLINIC_NAME}"
        )
        return subject, html, plain

    # ── TRIGGER 7: Medicine dispensed → Doctor ───────────────────────────────

    @staticmethod
    def medicine_dispensed_to_doctor(data: Dict[str, Any]) -> tuple:
        subject = f"Prescription Dispensed – {data['prescription_code']}"
        meds_html = ''.join(
            f'<li><strong>{m["name"]}</strong> &times; {m["quantity"]}</li>'
            for m in data['medicines']
        )
        meds_plain = '\n'.join(
            f'  - {m["name"]} x {m["quantity"]}'
            for m in data['medicines']
        )
        body = (
            f"<p>Dear <strong>Dr. {data['doctor_name']}</strong>,</p>"
            f"<p>The prescription for your patient has been dispensed.</p>"
            f'<div class="box">'
            f"{_row('Prescription Code', data['prescription_code'])}"
            f"{_row('Patient', data['patient_name'])}"
            f"{_row('Status', '<span class=\"badge\" style=\"background:#059669;\">DISPENSED</span>')}"
            f"{_row('Dispensed By', data['pharmacist_name'] + ' (Pharmacist)')}"
            f"{_row('Timestamp', data['timestamp'])}"
            f'</div>'
            f'<div class="med-list"><strong>Medicines Dispensed:</strong>'
            f'<ul style="margin:8px 0 0 0;padding-left:20px;">{meds_html}</ul></div>'
        )
        html = _html_email('#0f766e', 'Prescription Dispensed', body)
        plain = (
            f"Dear Dr. {data['doctor_name']},\n\n"
            f"The prescription for your patient has been dispensed.\n\n"
            f"Prescription Code: {data['prescription_code']}\n"
            f"Patient          : {data['patient_name']}\n"
            f"Status           : DISPENSED\n"
            f"Dispensed By     : {data['pharmacist_name']} (Pharmacist)\n"
            f"Timestamp        : {data['timestamp']}\n\n"
            f"Medicines Dispensed:\n{meds_plain}\n\n"
            f"{EmailConfig.CLINIC_NAME}"
        )
        return subject, html, plain


# ─────────────────────────────────────────────────────────────────────────────
# EMAIL SERVICE
# ─────────────────────────────────────────────────────────────────────────────

class EmailService:
    """
    Public interface for sending all email notifications.
    Every public method is safe to call without a try/except — failures are
    caught internally and logged; they never raise.
    """

    # ── Core send primitives ──────────────────────────────────────────────────

    @staticmethod
    def send_email_async(to_email: str, subject: str, html_content: str, plain_content: str):
        """Dispatch a single email on a daemon thread (non-blocking)."""
        if not EmailConfig.ENABLED:
            return
        thread = threading.Thread(
            target=EmailService._send_email,
            args=(to_email, subject, html_content, plain_content),
            daemon=True,
        )
        thread.start()

    @staticmethod
    def send_emails_to_role(
        role_name: str,
        subject: str,
        html_content: str,
        plain_content: str,
    ):
        """Send the same email to every active user who holds *role_name*."""
        if not EmailConfig.ENABLED:
            return
        emails = _get_emails_by_role(role_name)
        if not emails:
            logger.info(
                f"[EMAIL] No active '{role_name}' users have email addresses. Skipping."
            )
            return
        for email in emails:
            EmailService.send_email_async(email, subject, html_content, plain_content)

    @staticmethod
    def _send_email(
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: str,
    ) -> bool:
        """Internal: actually deliver one email via SMTP or print to console."""
        if not EmailConfig.is_configured():
            logger.info(f"[CONSOLE EMAIL] To: {to_email} | Subject: {subject}")
            print(f"\n{'='*60}")
            print(f"  EMAIL NOTIFICATION (Console Mode)")
            print(f"{'='*60}")
            print(f"  To     : {to_email}")
            print(f"  Subject: {subject}")
            print(f"  Body   :\n{plain_content[:400].strip()}")
            print(f"{'='*60}\n")
            return True
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From']    = f"{EmailConfig.FROM_NAME} <{EmailConfig.FROM_EMAIL}>"
            msg['To']      = to_email
            msg.attach(MIMEText(plain_content, 'plain'))
            msg.attach(MIMEText(html_content,  'html'))
            with smtplib.SMTP(EmailConfig.SMTP_HOST, EmailConfig.SMTP_PORT) as server:
                server.starttls()
                server.login(EmailConfig.SMTP_USER, EmailConfig.SMTP_PASSWORD)
                server.sendmail(EmailConfig.FROM_EMAIL, to_email, msg.as_string())
            logger.info(f"[EMAIL] Sent to {to_email}: {subject}")
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] Failed to send to {to_email}: {exc}")
            return False

    # ── LEGACY: patient-facing sends (preserved) ──────────────────────────────

    @classmethod
    def send_appointment_confirmation(cls, appointment) -> bool:
        """Send appointment confirmation to the patient (legacy)."""
        try:
            patient = appointment.patient
            patient_email = getattr(patient, 'email', None)
            if not patient_email:
                logger.info(f"Patient {patient.patient_id} has no email. Skipping.")
                return False
            appt_date = appointment.appointment_date.strftime('%B %d, %Y')
            appt_time = appointment.appointment_time.strftime('%I:%M %p')
            doctor = appointment.doctor
            data = {
                'patient_name':     patient.full_name,
                'token_number':     appointment.token_number,
                'appointment_code': appointment.appointment_code,
                'appointment_date': appt_date,
                'appointment_time': appt_time,
                'doctor_name':      doctor.staff.user.get_full_name() or doctor.staff.user.username,
                'specialization':   doctor.specialization.name if doctor.specialization else 'General',
            }
            subject, html, plain = EmailTemplate.appointment_confirmation(data)
            cls.send_email_async(patient_email, subject, html, plain)
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] send_appointment_confirmation failed: {exc}")
            return False

    @classmethod
    def send_prescription_ready(cls, prescription) -> bool:
        """Send prescription-ready notification to the patient (legacy)."""
        try:
            patient = prescription.appointment.patient
            patient_email = getattr(patient, 'email', None)
            if not patient_email:
                logger.info(f"Patient has no email. Skipping prescription email.")
                return False
            doctor = prescription.appointment.doctor
            data = {
                'patient_name':      patient.full_name,
                'prescription_code': prescription.prescription_code,
                'date':              prescription.created_at.astimezone(IST).strftime('%B %d, %Y'),
                'doctor_name':       doctor.staff.user.get_full_name() or doctor.staff.user.username,
                'diagnosis':         prescription.diagnosis or 'As discussed',
            }
            subject, html, plain = EmailTemplate.prescription_ready(data)
            cls.send_email_async(patient_email, subject, html, plain)
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] send_prescription_ready failed: {exc}")
            return False

    @classmethod
    def send_lab_results_ready(cls, lab_request) -> bool:
        """Send lab-results-available notification to the patient (legacy)."""
        try:
            patient = lab_request.appointment.patient
            patient_email = getattr(patient, 'email', None)
            if not patient_email:
                logger.info(f"Patient has no email. Skipping lab results email.")
                return False
            doctor = lab_request.appointment.doctor
            data = {
                'patient_name': patient.full_name,
                'test_name':    lab_request.lab_test.test_name if lab_request.lab_test else 'Lab Test',
                'date':         timezone.localtime(timezone.now()).strftime('%B %d, %Y'),
                'doctor_name':  doctor.staff.user.get_full_name() or doctor.staff.user.username,
            }
            subject, html, plain = EmailTemplate.lab_results_ready(data)
            cls.send_email_async(patient_email, subject, html, plain)
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] send_lab_results_ready failed: {exc}")
            return False

    # ── TRIGGER 1: Appointment created → Doctor ───────────────────────────────

    @classmethod
    def send_appointment_notification_to_doctor(
        cls,
        appointment,
        receptionist_name: str,
    ) -> bool:
        """
        Notify the assigned doctor when a receptionist books an appointment.
        Called from reception/views.py::AppointmentViewSet.perform_create.
        """
        try:
            doctor = appointment.doctor
            doctor_email = doctor.staff.user.email
            if not doctor_email:
                logger.info(f"Doctor {doctor.doctor_code} has no email. Skipping.")
                return False

            patient = appointment.patient
            data = {
                'doctor_name':      doctor.staff.user.get_full_name() or doctor.staff.user.username,
                'patient_name':     patient.full_name,
                'appointment_code': appointment.appointment_code,
                'appointment_date': appointment.appointment_date.strftime('%d %b %Y'),
                'appointment_time': appointment.appointment_time.strftime('%I:%M %p'),
                'token_number':     appointment.token_number,
                'receptionist_name': receptionist_name,
                'timestamp':        _get_ist_timestamp(),
            }
            subject, html, plain = EmailTemplate.appointment_to_doctor(data)
            cls.send_email_async(doctor_email, subject, html, plain)
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] send_appointment_notification_to_doctor failed: {exc}")
            return False

    # ── TRIGGER 2: Lab test requested → Lab Technicians ──────────────────────

    @classmethod
    def send_lab_test_request_notification(cls, lab_request) -> bool:
        """
        Notify all active lab technicians when a doctor places a lab test request.
        Called from doctor/signals.py on LabTestRequest post_save (created=True).
        """
        try:
            appointment = lab_request.appointment
            patient     = appointment.patient
            doctor      = appointment.doctor
            test_name   = lab_request.lab_test.test_name if lab_request.lab_test else 'Lab Test'

            data = {
                'appointment_code': appointment.appointment_code,
                'patient_name':     patient.full_name,
                'doctor_name':      doctor.staff.user.get_full_name() or doctor.staff.user.username,
                'tests':            [test_name],
                'timestamp':        _get_ist_timestamp(),
            }
            subject, html, plain = EmailTemplate.lab_test_request_to_lab_tech(data)
            cls.send_emails_to_role('LabTechnician', subject, html, plain)
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] send_lab_test_request_notification failed: {exc}")
            return False

    # ── TRIGGER 3: Lab result completed → Doctor ──────────────────────────────

    @classmethod
    def send_lab_result_completed_to_doctor(
        cls,
        lab_request,
        technician_name: str,
    ) -> bool:
        """
        Notify the responsible doctor when a lab test result is marked COMPLETED.
        Called from labtechinician/views.py::LabTestRequestViewSet.perform_update.
        """
        try:
            appointment    = lab_request.appointment
            doctor         = appointment.doctor
            doctor_email   = doctor.staff.user.email
            if not doctor_email:
                logger.info(f"Doctor {doctor.doctor_code} has no email. Skipping.")
                return False

            patient     = appointment.patient
            results     = lab_request.results.filter(is_deleted=False)
            has_abnormal = results.filter(is_abnormal=True).exists()

            data = {
                'doctor_name':      doctor.staff.user.get_full_name() or doctor.staff.user.username,
                'appointment_code': appointment.appointment_code,
                'patient_name':     patient.full_name,
                'test_name':        lab_request.lab_test.test_name if lab_request.lab_test else 'Lab Test',
                'has_abnormal':     has_abnormal,
                'technician_name':  technician_name,
                'timestamp':        _get_ist_timestamp(),
            }
            subject, html, plain = EmailTemplate.lab_result_to_doctor(data)
            cls.send_email_async(doctor_email, subject, html, plain)
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] send_lab_result_completed_to_doctor failed: {exc}")
            return False

    # ── TRIGGER 4: Lab bill generated → Patient + Receptionists ──────────────

    @classmethod
    def send_lab_bill_generated_notification(cls, lab_bill) -> bool:
        """
        Notify the patient (if email exists) and all active receptionists when a
        new lab bill is created.
        Called via transaction.on_commit in labtechinician/signals.py::create_lab_bill.
        """
        try:
            patient     = lab_bill.patient
            appointment = lab_bill.appointment
            appt_code   = appointment.appointment_code if appointment else 'N/A'
            timestamp   = _get_ist_timestamp()

            base_data = {
                'patient_name':     patient.full_name,
                'appointment_code': appt_code,
                'lab_bill_code':    lab_bill.lab_bill_code,
                'total_amount':     lab_bill.total_amount,
                'timestamp':        timestamp,
            }

            # → Patient
            patient_email = getattr(patient, 'email', None)
            if patient_email:
                data = dict(base_data, recipient_name=patient.full_name)
                subject, html, plain = EmailTemplate.lab_bill_generated(data)
                cls.send_email_async(patient_email, subject, html, plain)

            # → All receptionists
            receptionist_data = dict(base_data, recipient_name='Receptionist')
            subject, html, plain = EmailTemplate.lab_bill_generated(receptionist_data)
            cls.send_emails_to_role('Receptionist', subject, html, plain)
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] send_lab_bill_generated_notification failed: {exc}")
            return False

    # ── TRIGGER 5: Lab bill paid → Patient + Lab Technician ──────────────────

    @classmethod
    def send_lab_payment_completed_notification(
        cls,
        lab_bill,
        technician_name: str,
        technician_email: Optional[str] = None,
    ) -> bool:
        """
        Notify the patient and the lab technician who processed the payment.
        Called from labtechinician/views.py::LabBillViewSet.perform_update.
        """
        try:
            patient     = lab_bill.patient
            appointment = lab_bill.appointment
            appt_code   = appointment.appointment_code if appointment else 'N/A'
            paid_at_str = (
                lab_bill.paid_at.astimezone(IST).strftime('%d %b %Y, %I:%M %p IST')
                if lab_bill.paid_at else _get_ist_timestamp()
            )

            base_data = {
                'patient_name':     patient.full_name,
                'appointment_code': appt_code,
                'lab_bill_code':    lab_bill.lab_bill_code,
                'payment_amount':   lab_bill.total_amount,
                'paid_at':          paid_at_str,
                'technician_name':  technician_name,
            }

            # → Patient
            patient_email = getattr(patient, 'email', None)
            if patient_email:
                data = dict(base_data, recipient_name=patient.full_name)
                subject, html, plain = EmailTemplate.lab_payment_completed(data)
                cls.send_email_async(patient_email, subject, html, plain)

            # → Lab technician who processed the payment
            if technician_email:
                data = dict(base_data, recipient_name=technician_name)
                subject, html, plain = EmailTemplate.lab_payment_completed(data)
                cls.send_email_async(technician_email, subject, html, plain)
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] send_lab_payment_completed_notification failed: {exc}")
            return False

    # ── TRIGGER 6: Prescription activated → Pharmacists ──────────────────────

    @classmethod
    def send_prescription_to_pharmacist(cls, prescription) -> bool:
        """
        Notify all active pharmacists when a prescription is activated (ACTIVE).
        Called from doctor/views.py in both activate action and
        CreatePrescriptionWithItemsView.post.
        """
        try:
            appointment = prescription.appointment
            patient     = appointment.patient
            doctor      = appointment.doctor

            items = prescription.items.filter(is_deleted=False).select_related('medicine')
            medicines = [
                {
                    'name':      item.medicine.med_name,
                    'dosage':    item.dosage,
                    'frequency': item.frequency,
                    'quantity':  item.quantity,
                }
                for item in items
            ]

            if not medicines:
                logger.info(
                    f"Prescription {prescription.prescription_code} has no items. "
                    f"Skipping pharmacist notification."
                )
                return False

            data = {
                'patient_name':      patient.full_name,
                'prescription_code': prescription.prescription_code,
                'doctor_name':       doctor.staff.user.get_full_name() or doctor.staff.user.username,
                'medicines':         medicines,
                'timestamp':         _get_ist_timestamp(),
            }
            subject, html, plain = EmailTemplate.prescription_to_pharmacist(data)
            cls.send_emails_to_role('Pharmacist', subject, html, plain)
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] send_prescription_to_pharmacist failed: {exc}")
            return False

    # ── TRIGGER 7: Medicine dispensed → Doctor ───────────────────────────────

    @classmethod
    def send_medicine_dispensed_to_doctor(
        cls,
        pharmacy_bill,
        pharmacist_name: str,
    ) -> bool:
        """
        Notify the prescribing doctor when the pharmacist dispenses medicines.
        Called from pharmacist/views.py::GenerateBillFromPrescription.post.
        """
        try:
            prescription  = pharmacy_bill.prescription
            appointment   = prescription.appointment
            doctor        = appointment.doctor
            doctor_email  = doctor.staff.user.email
            if not doctor_email:
                logger.info(f"Doctor {doctor.doctor_code} has no email. Skipping.")
                return False

            patient = appointment.patient
            items   = pharmacy_bill.items.filter(is_deleted=False).select_related(
                'inventory__medicine'
            )
            medicines = [
                {
                    'name':     item.inventory.medicine.med_name,
                    'quantity': item.quantity,
                }
                for item in items
            ]

            data = {
                'doctor_name':       doctor.staff.user.get_full_name() or doctor.staff.user.username,
                'prescription_code': prescription.prescription_code,
                'patient_name':      patient.full_name,
                'medicines':         medicines,
                'pharmacist_name':   pharmacist_name,
                'timestamp':         _get_ist_timestamp(),
            }
            subject, html, plain = EmailTemplate.medicine_dispensed_to_doctor(data)
            cls.send_email_async(doctor_email, subject, html, plain)
            return True
        except Exception as exc:
            logger.error(f"[EMAIL] send_medicine_dispensed_to_doctor failed: {exc}")
            return False
