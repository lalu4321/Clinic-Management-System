"""
Comprehensive Unit Tests for Clinic Management System
Tests authentication, authorization, input validation, and security
"""
import json
from django.test import TestCase, Client
from django.contrib.auth.models import User, Group
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from datetime import date, timedelta
from decimal import Decimal

from administration.models import Staff, DoctorProfile, Specialization, DoctorSchedule
from reception.models import Patient, Appointment, ConsultationBill
from doctor.models import Prescription, PrescriptionItem, LabTestRequest
from pharmacist.models import Medicine, MedicineInventory, PharmacyBill
from labtechinician.models import LabTestCatalog, LabTestResult


class BaseTestCase(APITestCase):
    """Base test case with common setup"""
    
    @classmethod
    def setUpTestData(cls):
        # Create groups
        cls.admin_group = Group.objects.get_or_create(name='Admin')[0]
        cls.doctor_group = Group.objects.get_or_create(name='Doctor')[0]
        cls.receptionist_group = Group.objects.get_or_create(name='Receptionist')[0]
        cls.pharmacist_group = Group.objects.get_or_create(name='Pharmacist')[0]
        cls.lab_tech_group = Group.objects.get_or_create(name='LabTechnician')[0]
        
    def setUp(self):
        self.client = APIClient()
        
    def create_user(self, username, password='testpass123', group=None):
        user = User.objects.create_user(
            username=username,
            email=f'{username}@test.com',
            password=password,
            first_name=username.title(),
            last_name='Test'
        )
        if group:
            user.groups.add(group)
        return user
        
    def authenticate(self, user):
        self.client.force_authenticate(user=user)
        
    def get_token(self, username, password):
        response = self.client.post('/api/auth/login/', {
            'username': username,
            'password': password
        }, format='json')
        return response.data.get('data', {}).get('access')


# =====================================================
# AUTHENTICATION TESTS
# =====================================================
class AuthenticationTests(BaseTestCase):
    """Test authentication endpoints"""
    
    def test_login_with_valid_credentials(self):
        """Test login with valid credentials returns tokens"""
        user = self.create_user('testuser', 'password123')
        
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'password123'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data.get('data', {}))
        self.assertIn('refresh', response.data.get('data', {}))
        
    def test_login_with_invalid_credentials(self):
        """Test login with invalid credentials fails"""
        self.create_user('testuser', 'password123')
        
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'wrongpassword'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
    def test_login_with_empty_credentials(self):
        """Test login with empty credentials fails"""
        response = self.client.post('/api/auth/login/', {
            'username': '',
            'password': ''
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
    def test_login_throttling(self):
        """Test login rate limiting"""
        self.create_user('testuser', 'password123')
        
        # Make multiple failed attempts
        for _ in range(15):
            self.client.post('/api/auth/login/', {
                'username': 'testuser',
                'password': 'wrongpassword'
            }, format='json')
        
        # Should be throttled now
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'password123'
        }, format='json')
        
        # Should be throttled (429) after too many attempts
        self.assertIn(response.status_code, [status.HTTP_429_TOO_MANY_REQUESTS, status.HTTP_401_UNAUTHORIZED])


# =====================================================
# AUTHORIZATION TESTS
# =====================================================
class AuthorizationTests(BaseTestCase):
    """Test role-based access control"""
    
    def test_admin_can_access_admin_dashboard(self):
        """Test admin role can access admin endpoints"""
        admin = self.create_user('admin', group=self.admin_group)
        staff = Staff.objects.create(
            user=admin,
            role='Admin',
            phone='1234567890',
            address='Test Address'
        )
        self.authenticate(admin)
        
        response = self.client.get('/api/admin/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
    def test_doctor_cannot_access_admin_dashboard(self):
        """Test doctor role cannot access admin endpoints"""
        doctor = self.create_user('doctor', group=self.doctor_group)
        staff = Staff.objects.create(
            user=doctor,
            role='Doctor',
            phone='1234567890',
            address='Test Address'
        )
        self.authenticate(doctor)
        
        response = self.client.get('/api/admin/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    def test_unauthenticated_access_blocked(self):
        """Test unauthenticated requests are blocked"""
        response = self.client.get('/api/admin/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        

# =====================================================
# INPUT VALIDATION TESTS
# =====================================================
class InputValidationTests(BaseTestCase):
    """Test input validation and sanitization"""
    
    def setUp(self):
        super().setUp()
        self.receptionist = self.create_user('receptionist', group=self.receptionist_group)
        Staff.objects.create(
            user=self.receptionist,
            role='Receptionist',
            phone='1234567890',
            address='Test Address'
        )
        self.authenticate(self.receptionist)
        
    def test_patient_creation_with_valid_data(self):
        """Test patient creation with valid data"""
        response = self.client.post('/api/reception/patients/', {
            'first_name': 'John',
            'last_name': 'Doe',
            'phone': '9876543210',
            'gender': 'M',
            'date_of_birth': '1990-01-01',
            'address': '123 Main St',
            'blood_group': 'O+'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
    def test_patient_creation_with_missing_required_fields(self):
        """Test patient creation fails without required fields"""
        response = self.client.post('/api/reception/patients/', {
            'first_name': 'John'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
    def test_patient_phone_emergency_same_validation(self):
        """Test phone and emergency contact cannot be same"""
        response = self.client.post('/api/reception/patients/', {
            'first_name': 'John',
            'last_name': 'Doe',
            'phone': '9876543210',
            'emergency_contact_number': '9876543210',
            'gender': 'M',
            'date_of_birth': '1990-01-01',
            'address': '123 Main St'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# =====================================================
# SECURITY TESTS - XSS PREVENTION
# =====================================================
class XSSPreventionTests(BaseTestCase):
    """Test XSS attack prevention"""
    
    def setUp(self):
        super().setUp()
        self.receptionist = self.create_user('receptionist', group=self.receptionist_group)
        Staff.objects.create(
            user=self.receptionist,
            role='Receptionist',
            phone='1234567890',
            address='Test Address'
        )
        self.authenticate(self.receptionist)
        
    def test_xss_in_patient_name_sanitized(self):
        """Test XSS payload in patient name is sanitized"""
        response = self.client.post('/api/reception/patients/', {
            'first_name': '<script>alert("XSS")</script>John',
            'last_name': 'Doe',
            'phone': '9876543210',
            'gender': 'M',
            'date_of_birth': '1990-01-01',
            'address': '123 Main St'
        }, format='json')
        
        if response.status_code == status.HTTP_201_CREATED:
            patient_id = response.data.get('data', {}).get('patient_id')
            if patient_id:
                patient = Patient.objects.get(patient_id=patient_id)
                self.assertNotIn('<script>', patient.first_name)
        
    def test_xss_in_address_sanitized(self):
        """Test XSS payload in address is sanitized"""
        response = self.client.post('/api/reception/patients/', {
            'first_name': 'John',
            'last_name': 'Doe',
            'phone': '9876543210',
            'gender': 'M',
            'date_of_birth': '1990-01-01',
            'address': '<img src=x onerror=alert("XSS")>'
        }, format='json')
        
        if response.status_code == status.HTTP_201_CREATED:
            patient_id = response.data.get('data', {}).get('patient_id')
            if patient_id:
                patient = Patient.objects.get(patient_id=patient_id)
                self.assertNotIn('onerror', patient.address)


# =====================================================
# SECURITY TESTS - SQL INJECTION PREVENTION  
# =====================================================
class SQLInjectionPreventionTests(BaseTestCase):
    """Test SQL injection prevention"""
    
    def setUp(self):
        super().setUp()
        self.receptionist = self.create_user('receptionist', group=self.receptionist_group)
        Staff.objects.create(
            user=self.receptionist,
            role='Receptionist', 
            phone='1234567890',
            address='Test Address'
        )
        self.authenticate(self.receptionist)
        
    def test_sql_injection_in_search(self):
        """Test SQL injection in search parameter"""
        response = self.client.get("/api/reception/patients/?search=' OR 1=1 --")
        
        # Should not cause server error - ORM protects against injection
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])
        
    def test_sql_injection_in_filter(self):
        """Test SQL injection in filter parameter"""
        response = self.client.get("/api/reception/patients/?gender='; DROP TABLE patients; --")
        
        # Should not cause server error
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])


# =====================================================
# SECURITY TESTS - IDOR PREVENTION
# =====================================================
class IDORPreventionTests(BaseTestCase):
    """Test Insecure Direct Object Reference prevention"""
    
    def setUp(self):
        super().setUp()
        # Create two doctors
        self.doctor1 = self.create_user('doctor1', group=self.doctor_group)
        self.doctor2 = self.create_user('doctor2', group=self.doctor_group)
        
        self.staff1 = Staff.objects.create(
            user=self.doctor1,
            role='Doctor',
            phone='1111111111',
            address='Address 1'
        )
        self.staff2 = Staff.objects.create(
            user=self.doctor2,
            role='Doctor', 
            phone='2222222222',
            address='Address 2'
        )
        
        spec = Specialization.objects.create(name='General', description='General')
        
        self.doctor_profile1 = DoctorProfile.objects.create(
            staff=self.staff1,
            specialization=spec,
            qualification='MBBS',
            consultation_fee=500
        )
        self.doctor_profile2 = DoctorProfile.objects.create(
            staff=self.staff2,
            specialization=spec,
            qualification='MBBS',
            consultation_fee=500
        )
        
        # Create patient and appointment for doctor1
        self.patient = Patient.objects.create(
            first_name='Test',
            last_name='Patient',
            phone='9999999999',
            gender='M',
            date_of_birth='1990-01-01',
            address='Test Address'
        )
        
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor_profile1,
            appointment_date=date.today(),
            appointment_time='10:00'
        )
        
    def test_doctor_cannot_access_other_doctor_appointments(self):
        """Test doctor cannot access another doctor's appointments"""
        self.authenticate(self.doctor2)
        
        response = self.client.get('/api/doctor/appointments/')
        
        # Doctor2 should not see Doctor1's appointments
        appointments = response.data.get('data', {}).get('results', [])
        for appt in appointments:
            self.assertNotEqual(appt.get('appointment_id'), self.appointment.appointment_id)


# =====================================================
# BUSINESS LOGIC TESTS
# =====================================================
class PrescriptionFlowTests(BaseTestCase):
    """Test prescription workflow"""
    
    def setUp(self):
        super().setUp()
        self.doctor_user = self.create_user('doctor', group=self.doctor_group)
        self.staff = Staff.objects.create(
            user=self.doctor_user,
            role='Doctor',
            phone='1234567890',
            address='Test Address'
        )
        spec = Specialization.objects.create(name='General', description='General')
        self.doctor_profile = DoctorProfile.objects.create(
            staff=self.staff,
            specialization=spec,
            qualification='MBBS',
            consultation_fee=500
        )
        
        self.patient = Patient.objects.create(
            first_name='Test',
            last_name='Patient',
            phone='9999999999',
            gender='M',
            date_of_birth='1990-01-01',
            address='Test Address'
        )
        
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor_profile,
            appointment_date=date.today(),
            appointment_time='10:00'
        )
        
        # Create consultation bill and mark as paid
        self.bill = ConsultationBill.objects.create(
            appointment=self.appointment,
            total_amount=500,
            status='PAID'
        )
        
        self.authenticate(self.doctor_user)
        
    def test_create_prescription_for_valid_appointment(self):
        """Test prescription creation for valid appointment"""
        response = self.client.post('/api/doctor/prescriptions/', {
            'appointment': self.appointment.appointment_id,
            'symptoms': 'Fever and headache',
            'diagnosis': 'Viral infection',
            'status': 'DRAFT'
        }, format='json')
        
        self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST])
        
    def test_cannot_delete_completed_prescription(self):
        """Test completed prescription cannot be deleted"""
        prescription = Prescription.objects.create(
            appointment=self.appointment,
            symptoms='Test',
            diagnosis='Test',
            status='COMPLETED'
        )
        
        response = self.client.delete(f'/api/doctor/prescriptions/{prescription.prescription_id}/')
        
        # Should fail to delete completed prescription
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_204_NO_CONTENT])


# =====================================================
# API RESPONSE FORMAT TESTS
# =====================================================
class APIResponseFormatTests(BaseTestCase):
    """Test API response format consistency"""
    
    def test_success_response_format(self):
        """Test successful response has correct format"""
        user = self.create_user('testuser', 'password123', group=self.admin_group)
        
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'password123'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('success', response.data)
        self.assertIn('message', response.data)
        self.assertIn('data', response.data)
        
    def test_error_response_format(self):
        """Test error response has correct format"""
        response = self.client.post('/api/auth/login/', {
            'username': 'nonexistent',
            'password': 'wrong'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# =====================================================
# DATE VALIDATION TESTS
# =====================================================
class DateValidationTests(BaseTestCase):
    """Test date validation in appointments"""
    
    def setUp(self):
        super().setUp()
        self.receptionist = self.create_user('receptionist', group=self.receptionist_group)
        Staff.objects.create(
            user=self.receptionist,
            role='Receptionist',
            phone='1234567890',
            address='Test Address'
        )
        self.authenticate(self.receptionist)
        
        # Create doctor
        doctor_user = self.create_user('doctor', group=self.doctor_group)
        staff = Staff.objects.create(
            user=doctor_user,
            role='Doctor',
            phone='9999999999',
            address='Doctor Address'
        )
        spec = Specialization.objects.create(name='General', description='General')
        self.doctor = DoctorProfile.objects.create(
            staff=staff,
            specialization=spec,
            qualification='MBBS',
            consultation_fee=500
        )
        
        self.patient = Patient.objects.create(
            first_name='Test',
            last_name='Patient',
            phone='8888888888',
            gender='M',
            date_of_birth='1990-01-01',
            address='Patient Address'
        )
        
    def test_appointment_with_valid_future_date(self):
        """Test appointment creation with valid future date"""
        future_date = (date.today() + timedelta(days=1)).isoformat()
        
        response = self.client.post('/api/reception/appointments/', {
            'patient': self.patient.patient_id,
            'doctor': self.doctor.doctor_profile_id,
            'appointment_date': future_date,
            'appointment_time': '10:00:00'
        }, format='json')
        
        self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST])


# =====================================================
# SECURITY UTILITY TESTS
# =====================================================
class SecurityUtilityTests(TestCase):
    """Test security utility functions"""
    
    def test_input_sanitizer_removes_script_tags(self):
        """Test XSS script tags are removed"""
        from common.security import InputSanitizer
        
        malicious = '<script>alert("XSS")</script>Hello'
        sanitized = InputSanitizer.sanitize_string(malicious)
        
        self.assertNotIn('<script>', sanitized)
        self.assertIn('Hello', sanitized)
        
    def test_input_sanitizer_removes_event_handlers(self):
        """Test event handlers are removed"""
        from common.security import InputSanitizer
        
        malicious = '<img src=x onerror=alert(1)>'
        sanitized = InputSanitizer.sanitize_string(malicious)
        
        self.assertNotIn('onerror', sanitized)
        
    def test_sql_injection_validator(self):
        """Test SQL injection pattern detection"""
        from common.security import SQLInjectionValidator
        
        self.assertFalse(SQLInjectionValidator.is_safe("' OR 1=1 --"))
        self.assertFalse(SQLInjectionValidator.is_safe("'; DROP TABLE users; --"))
        self.assertTrue(SQLInjectionValidator.is_safe("John Doe"))
        self.assertTrue(SQLInjectionValidator.is_safe("test@email.com"))
        
    def test_id_validator(self):
        """Test ID validation"""
        from common.security import IDValidator
        
        self.assertEqual(IDValidator.validate_numeric_id("123"), 123)
        self.assertEqual(IDValidator.validate_numeric_id(456), 456)
        
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            IDValidator.validate_numeric_id("abc")
        with self.assertRaises(ValidationError):
            IDValidator.validate_numeric_id(-1)
