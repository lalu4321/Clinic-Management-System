"""
Integration Tests for Critical Flows
Tests end-to-end prescription workflow from Doctor to Pharmacist
"""
import json
from decimal import Decimal
from datetime import date, time
from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework import status

from administration.models import Staff, DoctorProfile, Specialization
from reception.models import Patient, Appointment, ConsultationBill
from doctor.models import Prescription, PrescriptionItem, LabTestRequest, PrescriptionStatus
from pharmacist.models import Medicine, MedicineInventory, PharmacyBill, PharmacyBillItem
from labtechinician.models import LabTestCatalog


class PrescriptionFlowIntegrationTest(TransactionTestCase):
    """
    Integration test for the complete prescription flow:
    1. Doctor creates prescription
    2. Prescription stored in DB with DRAFT status
    3. Doctor activates prescription (DRAFT → ACTIVE)
    4. Pharmacist retrieves prescription
    5. Pharmacist generates bill (inventory deducted)
    6. Status updates reflected correctly
    """
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        
        # Create groups
        self.doctor_group = Group.objects.create(name='Doctor')
        self.pharmacist_group = Group.objects.create(name='Pharmacist')
        self.receptionist_group = Group.objects.create(name='Receptionist')
        
        # Create doctor
        self.doctor_user = User.objects.create_user(
            username='test_doctor',
            email='doctor@test.com',
            password='testpass123',
            first_name='Test',
            last_name='Doctor'
        )
        self.doctor_user.groups.add(self.doctor_group)
        
        self.doctor_staff = Staff.objects.create(
            user=self.doctor_user,
            gender='MALE',
            date_of_birth=date(1980, 1, 1),
            phone='1234567890',
            address='Doctor Address',
            qualification='MBBS',
            salary=100000,
            is_active=True
        )
        
        self.specialization = Specialization.objects.create(
            name='General Medicine',
            description='General Medicine'
        )
        
        self.doctor_profile = DoctorProfile.objects.create(
            staff=self.doctor_staff,
            specialization=self.specialization,
            qualification='MBBS, MD',
            consultation_fee=500,
            max_patient_per_day=25,
            is_active=True
        )
        
        # Create pharmacist
        self.pharmacist_user = User.objects.create_user(
            username='test_pharmacist',
            email='pharmacist@test.com',
            password='testpass123',
            first_name='Test',
            last_name='Pharmacist'
        )
        self.pharmacist_user.groups.add(self.pharmacist_group)
        
        self.pharmacist_staff = Staff.objects.create(
            user=self.pharmacist_user,
            gender='MALE',
            date_of_birth=date(1985, 1, 1),
            phone='0987654321',
            address='Pharmacist Address',
            qualification='B.Pharm',
            salary=50000,
            is_active=True
        )
        
        # Create patient
        self.patient = Patient.objects.create(
            first_name='Test',
            last_name='Patient',
            gender='MALE',
            date_of_birth=date(1990, 1, 1),
            phone='5555555555',
            emergency_contact_number='6666666666',
            address='Patient Address',
            blood_group='O+'
        )
        
        # Create appointment
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor_profile,
            appointment_date=date.today(),
            appointment_time=time(10, 0),
            status='SCHEDULED'
        )
        
        # Create consultation bill and mark as paid
        self.consultation_bill = ConsultationBill.objects.create(
            appointment=self.appointment,
            total_amount=500,
            status='PAID'
        )
        
        # Create medicine
        self.medicine = Medicine.objects.create(
            med_name='Paracetamol 500mg',
            generic_name='Paracetamol',
            company_name='Test Pharma',
            status='ACTIVE'
        )
        
        # Create inventory
        self.inventory = MedicineInventory.objects.create(
            medicine=self.medicine,
            batch_number='BATCH001',
            quantity_available=100,
            unit_price=Decimal('10.00'),
            purchased_date=date.today(),
            expiry_date=date(2026, 12, 31),
            status='AVAILABLE'
        )
    
    def test_complete_prescription_flow(self):
        """Test the complete flow from prescription creation to dispensing"""
        
        # ============================================
        # STEP 1: Doctor creates prescription (DRAFT)
        # ============================================
        self.client.force_authenticate(user=self.doctor_user)
        
        prescription_data = {
            'appointment': self.appointment.appointment_id,
            'symptoms': 'Fever and headache',
            'diagnosis': 'Viral infection'
        }
        
        response = self.client.post('/api/doctor/prescriptions/', prescription_data, format='json')
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        
        prescription_id = response.data.get('data', {}).get('prescription_id')
        self.assertIsNotNone(prescription_id)
        
        # Verify prescription is in DRAFT status
        prescription = Prescription.objects.get(prescription_id=prescription_id)
        self.assertEqual(prescription.status, PrescriptionStatus.DRAFT)
        
        # ============================================
        # STEP 2: Doctor adds prescription items
        # ============================================
        item_data = {
            'prescription': prescription_id,
            'medicine': self.medicine.med_id,
            'dosage': '500mg',
            'frequency': '3 times daily',
            'quantity': 10
        }
        
        response = self.client.post('/api/doctor/prescription-items/', item_data, format='json')
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        
        # ============================================
        # STEP 3: Doctor activates prescription
        # ============================================
        response = self.client.patch(f'/api/doctor/prescriptions/{prescription_id}/activate/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify prescription is now ACTIVE
        prescription.refresh_from_db()
        self.assertEqual(prescription.status, PrescriptionStatus.ACTIVE)
        
        # ============================================
        # STEP 4: Pharmacist retrieves pending prescriptions
        # ============================================
        self.client.force_authenticate(user=self.pharmacist_user)
        
        response = self.client.get('/api/pharmacy/prescriptions/pending/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify our prescription is in the pending list
        prescriptions = response.data.get('data', {}).get('results', []) or response.data.get('data', [])
        prescription_ids = [p.get('prescription_id') for p in prescriptions]
        self.assertIn(prescription_id, prescription_ids)
        
        # ============================================
        # STEP 5: Pharmacist views prescription details
        # ============================================
        response = self.client.get(f'/api/pharmacy/prescriptions/{prescription_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        detail = response.data.get('data', response.data)
        self.assertEqual(detail.get('prescription_id'), prescription_id)
        
        # ============================================
        # STEP 6: Pharmacist generates bill
        # ============================================
        initial_inventory = self.inventory.quantity_available
        
        response = self.client.post(f'/api/pharmacy/prescriptions/{prescription_id}/generate-bill/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        bill_data = response.data.get('data', response.data)
        self.assertIn('bill_id', bill_data)
        self.assertIn('total_amount', bill_data)
        
        # ============================================
        # STEP 7: Verify inventory deducted
        # ============================================
        self.inventory.refresh_from_db()
        expected_remaining = initial_inventory - 10  # 10 units were prescribed
        self.assertEqual(self.inventory.quantity_available, expected_remaining)
        
        # ============================================
        # STEP 8: Verify prescription status is COMPLETED
        # ============================================
        prescription.refresh_from_db()
        self.assertEqual(prescription.status, PrescriptionStatus.COMPLETED)
        
        # ============================================
        # STEP 9: Verify bill created correctly
        # ============================================
        bill = PharmacyBill.objects.get(prescription=prescription)
        self.assertEqual(bill.total_amount, Decimal('100.00'))  # 10 units × ₹10
        
        # Verify bill items
        bill_items = PharmacyBillItem.objects.filter(pharmacy_bill=bill)
        self.assertEqual(bill_items.count(), 1)
        self.assertEqual(bill_items.first().quantity, 10)
    
    def test_doctor_cannot_access_other_doctor_appointments(self):
        """Test IDOR prevention - doctor cannot see other doctor's data"""
        
        # Create another doctor
        other_doctor_user = User.objects.create_user(
            username='other_doctor',
            email='other@test.com',
            password='testpass123'
        )
        other_doctor_user.groups.add(self.doctor_group)
        
        other_staff = Staff.objects.create(
            user=other_doctor_user,
            gender='MALE',
            date_of_birth=date(1980, 1, 1),
            phone='1111111111',
            address='Other Address',
            qualification='MBBS',
            salary=100000,
            is_active=True
        )
        
        other_doctor = DoctorProfile.objects.create(
            staff=other_staff,
            specialization=self.specialization,
            qualification='MBBS',
            consultation_fee=500,
            max_patient_per_day=25,
            is_active=True
        )
        
        # Create prescription for first doctor
        self.client.force_authenticate(user=self.doctor_user)
        prescription = Prescription.objects.create(
            appointment=self.appointment,
            symptoms='Test',
            diagnosis='Test',
            status=PrescriptionStatus.DRAFT
        )
        
        # Login as other doctor and try to access
        self.client.force_authenticate(user=other_doctor_user)
        
        response = self.client.get('/api/doctor/prescriptions/')
        prescriptions = response.data.get('data', {}).get('results', [])
        
        # Other doctor should not see first doctor's prescription
        prescription_ids = [p.get('prescription_id') for p in prescriptions]
        self.assertNotIn(prescription.prescription_id, prescription_ids)
    
    def test_prescription_cannot_be_deleted_when_completed(self):
        """Test that completed prescriptions cannot be deleted"""
        self.client.force_authenticate(user=self.doctor_user)
        
        prescription = Prescription.objects.create(
            appointment=self.appointment,
            symptoms='Test',
            diagnosis='Test',
            status=PrescriptionStatus.COMPLETED
        )
        
        response = self.client.delete(f'/api/doctor/prescriptions/{prescription.prescription_id}/')
        
        # Should fail - completed prescriptions cannot be deleted
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_204_NO_CONTENT])
        
        # Verify prescription still exists
        self.assertTrue(Prescription.objects.filter(prescription_id=prescription.prescription_id).exists())
    
    def test_pharmacist_cannot_generate_bill_for_draft_prescription(self):
        """Test that pharmacist cannot dispense draft prescriptions"""
        self.client.force_authenticate(user=self.doctor_user)
        
        # Create draft prescription
        prescription = Prescription.objects.create(
            appointment=self.appointment,
            symptoms='Test',
            diagnosis='Test',
            status=PrescriptionStatus.DRAFT
        )
        
        PrescriptionItem.objects.create(
            prescription=prescription,
            medicine=self.medicine,
            dosage='500mg',
            frequency='Daily',
            quantity=5
        )
        
        # Try to generate bill as pharmacist
        self.client.force_authenticate(user=self.pharmacist_user)
        
        response = self.client.post(f'/api/pharmacy/prescriptions/{prescription.prescription_id}/generate-bill/')
        
        # Should fail - can only dispense ACTIVE prescriptions
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_insufficient_inventory_prevents_billing(self):
        """Test that billing fails when inventory is insufficient"""
        self.client.force_authenticate(user=self.doctor_user)
        
        # Create prescription with quantity exceeding inventory
        prescription = Prescription.objects.create(
            appointment=self.appointment,
            symptoms='Test',
            diagnosis='Test',
            status=PrescriptionStatus.ACTIVE
        )
        
        PrescriptionItem.objects.create(
            prescription=prescription,
            medicine=self.medicine,
            dosage='500mg',
            frequency='Daily',
            quantity=1000  # More than available (100)
        )
        
        # Try to generate bill
        self.client.force_authenticate(user=self.pharmacist_user)
        
        response = self.client.post(f'/api/pharmacy/prescriptions/{prescription.prescription_id}/generate-bill/')
        
        # Should fail due to insufficient stock
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ConcurrencyTestCase(TransactionTestCase):
    """Test concurrent prescription handling"""
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        
        # Create pharmacist group and user
        self.pharmacist_group = Group.objects.create(name='Pharmacist')
        self.doctor_group = Group.objects.create(name='Doctor')
        
        self.pharmacist_user = User.objects.create_user(
            username='pharmacist',
            password='testpass123'
        )
        self.pharmacist_user.groups.add(self.pharmacist_group)
        
        Staff.objects.create(
            user=self.pharmacist_user,
            gender='MALE',
            date_of_birth=date(1985, 1, 1),
            phone='1234567890',
            address='Test',
            qualification='B.Pharm',
            salary=50000,
            is_active=True
        )
        
        # Create doctor
        self.doctor_user = User.objects.create_user(
            username='doctor',
            password='testpass123'
        )
        self.doctor_user.groups.add(self.doctor_group)
        
        doctor_staff = Staff.objects.create(
            user=self.doctor_user,
            gender='MALE',
            date_of_birth=date(1980, 1, 1),
            phone='0987654321',
            address='Test',
            qualification='MBBS',
            salary=100000,
            is_active=True
        )
        
        specialization = Specialization.objects.create(
            name='General',
            description='General'
        )
        
        self.doctor = DoctorProfile.objects.create(
            staff=doctor_staff,
            specialization=specialization,
            qualification='MBBS',
            consultation_fee=500,
            max_patient_per_day=25,
            is_active=True
        )
        
        # Create patient and appointment
        self.patient = Patient.objects.create(
            first_name='Test',
            last_name='Patient',
            gender='MALE',
            date_of_birth=date(1990, 1, 1),
            phone='5555555555',
            emergency_contact_number='6666666666',
            address='Test',
            blood_group='O+'
        )
        
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            appointment_date=date.today(),
            appointment_time=time(10, 0),
            status='SCHEDULED'
        )
        
        ConsultationBill.objects.create(
            appointment=self.appointment,
            total_amount=500,
            status='PAID'
        )
        
        # Create medicine with limited inventory
        self.medicine = Medicine.objects.create(
            med_name='Rare Medicine',
            generic_name='Rare',
            company_name='Test',
            status='ACTIVE'
        )
        
        MedicineInventory.objects.create(
            medicine=self.medicine,
            batch_number='BATCH001',
            quantity_available=5,  # Only 5 units
            unit_price=Decimal('100.00'),
            purchased_date=date.today(),
            expiry_date=date(2026, 12, 31),
            status='AVAILABLE'
        )
    
    def test_duplicate_bill_generation_prevented(self):
        """Test that same prescription cannot be billed twice"""
        # Create prescription
        prescription = Prescription.objects.create(
            appointment=self.appointment,
            symptoms='Test',
            diagnosis='Test',
            status=PrescriptionStatus.ACTIVE
        )
        
        PrescriptionItem.objects.create(
            prescription=prescription,
            medicine=self.medicine,
            dosage='100mg',
            frequency='Daily',
            quantity=2
        )
        
        self.client.force_authenticate(user=self.pharmacist_user)
        
        # First bill generation should succeed
        response1 = self.client.post(f'/api/pharmacy/prescriptions/{prescription.prescription_id}/generate-bill/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        # Second attempt should fail
        response2 = self.client.post(f'/api/pharmacy/prescriptions/{prescription.prescription_id}/generate-bill/')
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)


class AuthenticationSecurityTest(TestCase):
    """Test authentication security measures"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
    
    def test_sql_injection_in_login_blocked(self):
        """Test SQL injection attempt in login is blocked"""
        response = self.client.post('/api/auth/login/', {
            'username': "admin' OR '1'='1",
            'password': "test"
        }, format='json')
        
        # Should fail with 401, not expose data
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_xss_payload_in_login_sanitized(self):
        """Test XSS payload in login doesn't execute"""
        response = self.client.post('/api/auth/login/', {
            'username': "<script>alert('xss')</script>",
            'password': "test"
        }, format='json')
        
        # Should fail normally, no script execution
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('<script>', str(response.data))
    
    def test_protected_route_requires_auth(self):
        """Test that protected routes require authentication"""
        response = self.client.get('/api/admin/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_invalid_token_rejected(self):
        """Test that invalid JWT tokens are rejected"""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_here')
        response = self.client.get('/api/admin/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
