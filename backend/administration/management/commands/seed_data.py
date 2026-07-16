from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
from django.utils import timezone
from datetime import datetime, timedelta, time
from decimal import Decimal
import random

from administration.models import Staff, Specialization, DoctorProfile, DoctorSchedule, GenderChoices, DayOfWeekChoices
from reception.models import Patient, Appointment, ConsultationBill, GenderChoices as PatientGenderChoices, BloodGroupChoices, AppointmentStatus, BillStatus
from pharmacist.models import Medicine, MedicineInventory, MedicineStatus, InventoryStatus
from labtechinician.models import LabTestCatalog, LabTestStatus
from doctor.models import Prescription, PrescriptionItem, LabTestRequest, PrescriptionStatus, LabRequestStatus


class Command(BaseCommand):
    help = 'Seeds the database with comprehensive sample data for clinic management system'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.SUCCESS('Starting database seeding...'))
        
        # Clear existing data
        self.stdout.write('Clearing existing data...')
        self.clear_data()
        
        # Create groups
        self.stdout.write('Creating user groups...')
        self.create_groups()
        
        # Create users and staff
        self.stdout.write('Creating admin user...')
        self.create_admin()
        
        self.stdout.write('Creating specializations...')
        self.create_specializations()
        
        self.stdout.write('Creating doctors...')
        self.create_doctors()
        
        self.stdout.write('Creating other staff...')
        self.create_other_staff()
        
        self.stdout.write('Creating medicines...')
        self.create_medicines()
        
        self.stdout.write('Creating medicine inventory...')
        self.create_inventory()
        
        self.stdout.write('Creating lab test catalog...')
        self.create_lab_tests()
        
        self.stdout.write('Creating patients...')
        self.create_patients()
        
        self.stdout.write('Creating appointments...')
        self.create_appointments()
        
        self.stdout.write('Creating prescriptions...')
        self.create_prescriptions()
        
        self.stdout.write('Creating lab test requests...')
        self.create_lab_requests()
        
        self.stdout.write(self.style.SUCCESS('\n' + '='*60))
        self.stdout.write(self.style.SUCCESS('Database seeding completed successfully!'))
        self.stdout.write(self.style.SUCCESS('='*60))
        self.print_credentials()

    def clear_data(self):
        """Clear existing data except superusers"""
        User.objects.filter(is_superuser=False).delete()
        
    def create_groups(self):
        """Create user role groups"""
        groups = ['Admin', 'Doctor', 'Receptionist', 'Pharmacist', 'LabTechnician']
        for group_name in groups:
            Group.objects.get_or_create(name=group_name)
    
    def create_admin(self):
        """Create admin user"""
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@clinic.com',
                'first_name': 'System',
                'last_name': 'Administrator',
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()
            admin_group = Group.objects.get(name='Admin')
            admin_user.groups.add(admin_group)
    
    def create_specializations(self):
        """Create medical specializations"""
        specializations = [
            'General Medicine',
            'Cardiology',
            'Dermatology',
            'Orthopedics',
            'Pediatrics',
            'Gynecology',
            'ENT',
            'Neurology',
            'Psychiatry',
            'Ophthalmology'
        ]
        for spec in specializations:
            Specialization.objects.get_or_create(name=spec)
    
    def create_doctors(self):
        """Create doctor users and profiles"""
        doctors_data = [
            {'username': 'dr.sharma', 'first': 'Rajesh', 'last': 'Sharma', 'spec': 'General Medicine', 'fee': 500},
            {'username': 'dr.patel', 'first': 'Priya', 'last': 'Patel', 'spec': 'Cardiology', 'fee': 800},
            {'username': 'dr.kumar', 'first': 'Amit', 'last': 'Kumar', 'spec': 'Orthopedics', 'fee': 700},
            {'username': 'dr.reddy', 'first': 'Lakshmi', 'last': 'Reddy', 'spec': 'Pediatrics', 'fee': 600},
            {'username': 'dr.singh', 'first': 'Harpreet', 'last': 'Singh', 'spec': 'Dermatology', 'fee': 650},
        ]
        
        for doc in doctors_data:
            user = User.objects.create_user(
                username=doc['username'],
                password='doctor123',
                email=f"{doc['username']}@clinic.com",
                first_name=doc['first'],
                last_name=doc['last']
            )
            doctor_group = Group.objects.get(name='Doctor')
            user.groups.add(doctor_group)
            
            # Create staff profile
            staff = Staff.objects.create(
                user=user,
                gender=random.choice(['MALE', 'FEMALE']),
                date_of_birth=datetime(1980 + random.randint(0, 15), random.randint(1, 12), random.randint(1, 28)).date(),
                phone=f"+919{random.randint(100000000, 999999999)}",
                address=f"{random.randint(1, 999)} Medical Plaza, Healthcare District, Mumbai",
                qualification=random.choice(['MBBS, MD', 'MBBS, MS', 'MBBS, DNB']),
                salary=Decimal(random.randint(80000, 150000)),
                profile_picture='staff/profile_pictures/default.jpg'
            )
            
            # Create doctor profile
            specialization = Specialization.objects.get(name=doc['spec'])
            doctor = DoctorProfile.objects.create(
                staff=staff,
                specialization=specialization,
                consultation_fee=Decimal(doc['fee']),
                max_patient_per_day=25
            )
            
            # Create schedules (Monday to Saturday, 9 AM to 5 PM)
            days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
            for day in days:
                DoctorSchedule.objects.create(
                    doctor=doctor,
                    day_of_week=day,
                    start_time=time(9, 0),
                    end_time=time(17, 0)
                )
    
    def create_other_staff(self):
        """Create receptionist, pharmacist, and lab technician staff"""
        staff_data = [
            {'username': 'receptionist1', 'first': 'Anjali', 'last': 'Desai', 'role': 'Receptionist'},
            {'username': 'receptionist2', 'first': 'Neha', 'last': 'Verma', 'role': 'Receptionist'},
            {'username': 'pharmacist1', 'first': 'Suresh', 'last': 'Nair', 'role': 'Pharmacist'},
            {'username': 'pharmacist2', 'first': 'Meera', 'last': 'Iyer', 'role': 'Pharmacist'},
            {'username': 'labtech1', 'first': 'Ravi', 'last': 'Menon', 'role': 'LabTechnician'},
            {'username': 'labtech2', 'first': 'Kavya', 'last': 'Pillai', 'role': 'LabTechnician'},
        ]
        
        for staff_info in staff_data:
            user = User.objects.create_user(
                username=staff_info['username'],
                password=f"{staff_info['role'].lower()}123",
                email=f"{staff_info['username']}@clinic.com",
                first_name=staff_info['first'],
                last_name=staff_info['last']
            )
            group = Group.objects.get(name=staff_info['role'])
            user.groups.add(group)
            
            Staff.objects.create(
                user=user,
                gender=random.choice(['MALE', 'FEMALE']),
                date_of_birth=datetime(1985 + random.randint(0, 10), random.randint(1, 12), random.randint(1, 28)).date(),
                phone=f"+919{random.randint(100000000, 999999999)}",
                address=f"{random.randint(1, 999)} Staff Colony, Healthcare District, Mumbai",
                qualification=random.choice(['B.Sc', 'B.Pharma', 'Diploma']),
                salary=Decimal(random.randint(30000, 60000)),
                profile_picture='staff/profile_pictures/default.jpg'
            )
    
    def create_medicines(self):
        """Create medicine catalog"""
        medicines_data = [
            ('Paracetamol 500mg', 'PharmaCorp', 'Acetaminophen'),
            ('Amoxicillin 250mg', 'MediLife', 'Amoxicillin'),
            ('Ibuprofen 400mg', 'HealthPlus', 'Ibuprofen'),
            ('Azithromycin 500mg', 'BioMed', 'Azithromycin'),
            ('Omeprazole 20mg', 'GastroCare', 'Omeprazole'),
            ('Metformin 500mg', 'DiabeCure', 'Metformin'),
            ('Amlodipine 5mg', 'CardioHealth', 'Amlodipine'),
            ('Cetirizine 10mg', 'AllergyFree', 'Cetirizine'),
            ('Ciprofloxacin 500mg', 'AntiBioTech', 'Ciprofloxacin'),
            ('Aspirin 75mg', 'HeartCare', 'Acetylsalicylic Acid'),
            ('Atorvastatin 10mg', 'LipidControl', 'Atorvastatin'),
            ('Losartan 50mg', 'BPMed', 'Losartan'),
            ('Pantoprazole 40mg', 'AcidControl', 'Pantoprazole'),
            ('Levothyroxine 50mcg', 'ThyroBalance', 'Levothyroxine'),
            ('Salbutamol Inhaler', 'RespiroCare', 'Salbutamol'),
        ]
        
        for med_name, company, generic in medicines_data:
            Medicine.objects.get_or_create(
                med_name=med_name,
                defaults={
                    'company_name': company,
                    'generic_name': generic,
                    'status': MedicineStatus.ACTIVE
                }
            )
    
    def create_inventory(self):
        """Create medicine inventory batches"""
        medicines = Medicine.objects.all()
        today = timezone.now().date()
        
        for medicine in medicines:
            # Create 2-3 batches per medicine
            for i in range(random.randint(2, 3)):
                purchased_date = today - timedelta(days=random.randint(30, 180))
                expiry_date = today + timedelta(days=random.randint(180, 730))
                
                MedicineInventory.objects.create(
                    medicine=medicine,
                    batch_number=f"BATCH{medicine.med_id:03d}{i+1:02d}{random.randint(100, 999)}",
                    supplier_name=random.choice(['MediSupply Co.', 'PharmaDist Ltd.', 'HealthWholesale Inc.']),
                    purchased_date=purchased_date,
                    expiry_date=expiry_date,
                    unit_price=Decimal(random.randint(5, 100)),
                    quantity_available=random.randint(100, 1000),
                    status=InventoryStatus.AVAILABLE
                )
    
    def create_lab_tests(self):
        """Create lab test catalog"""
        tests_data = [
            ('Complete Blood Count (CBC)', 300, 'Comprehensive blood analysis'),
            ('Lipid Profile', 500, 'Cholesterol and triglycerides analysis'),
            ('Liver Function Test (LFT)', 400, 'Liver enzyme analysis'),
            ('Kidney Function Test (KFT)', 400, 'Renal function assessment'),
            ('Thyroid Profile (T3, T4, TSH)', 600, 'Thyroid hormone levels'),
            ('HbA1c (Glycated Hemoglobin)', 350, 'Diabetes monitoring'),
            ('Vitamin D Test', 800, 'Vitamin D levels'),
            ('Vitamin B12 Test', 600, 'Vitamin B12 levels'),
            ('X-Ray Chest PA', 300, 'Chest radiography'),
            ('ECG (Electrocardiogram)', 200, 'Heart electrical activity'),
            ('Urine Routine', 150, 'Urinalysis'),
            ('Blood Sugar Fasting', 100, 'Fasting glucose level'),
            ('Blood Sugar PP', 100, 'Post-prandial glucose'),
        ]
        
        for test_name, charge, description in tests_data:
            LabTestCatalog.objects.get_or_create(
                test_name=test_name,
                defaults={
                    'description': description,
                    'test_charge': Decimal(charge),
                    'status': LabTestStatus.ACTIVE
                }
            )
    
    def create_patients(self):
        """Create patient records"""
        first_names = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Rohan', 'Divya', 
                      'Arjun', 'Kavya', 'Sanjay', 'Pooja', 'Karan', 'Isha', 'Nikhil', 'Riya',
                      'Aditya', 'Shruti', 'Varun', 'Nisha', 'Akash', 'Tanvi', 'Gaurav', 'Meera',
                      'Harsh', 'Ananya', 'Suresh', 'Deepika', 'Manoj', 'Simran']
        
        last_names = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Nair', 'Gupta', 'Iyer',
                     'Verma', 'Desai', 'Shah', 'Agarwal', 'Joshi', 'Rao', 'Menon']
        
        for i in range(30):
            first = random.choice(first_names)
            last = random.choice(last_names)
            
            Patient.objects.create(
                first_name=first,
                last_name=last,
                gender=random.choice(['MALE', 'FEMALE']),
                blood_group=random.choice(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
                date_of_birth=datetime(random.randint(1950, 2015), random.randint(1, 12), random.randint(1, 28)).date(),
                phone=f"+919{random.randint(100000000, 999999999)}",
                emergency_contact_number=f"+919{random.randint(100000000, 999999999)}",
                address=f"{random.randint(1, 999)}, {random.choice(['MG Road', 'Park Street', 'Main Street', 'Gandhi Nagar'])}, Mumbai"
            )
    
    def create_appointments(self):
        """Create appointment records"""
        patients = list(Patient.objects.all())
        doctors = list(DoctorProfile.objects.all())
        today = timezone.now().date()
        
        # Create appointments for last 7 days and next 7 days
        for days_offset in range(-7, 8):
            appointment_date = today + timedelta(days=days_offset)
            weekday = appointment_date.strftime("%A").upper()
            
            # Skip Sunday
            if weekday == 'SUNDAY':
                continue
            
            # Create 3-5 appointments per day
            for _ in range(random.randint(3, 5)):
                doctor = random.choice(doctors)
                patient = random.choice(patients)
                
                # Get random schedule for the doctor
                schedules = DoctorSchedule.objects.filter(doctor=doctor, day_of_week=weekday)
                if not schedules.exists():
                    continue
                    
                schedule = random.choice(schedules)
                
                # Generate appointment time within schedule
                start_minutes = schedule.start_time.hour * 60 + schedule.start_time.minute
                end_minutes = schedule.end_time.hour * 60 + schedule.end_time.minute
                slot_minutes = random.randrange(start_minutes, end_minutes, 10)
                appointment_time = time(slot_minutes // 60, slot_minutes % 60)
                
                # Determine status based on date
                if days_offset < -1:
                    status = AppointmentStatus.COMPLETED
                elif days_offset == -1:
                    status = random.choice([AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED])
                else:
                    status = AppointmentStatus.SCHEDULED
                
                try:
                    appointment = Appointment.objects.create(
                        patient=patient,
                        doctor=doctor,
                        appointment_date=appointment_date,
                        appointment_time=appointment_time,
                        status=status
                    )
                    
                    # Pay consultation bills for past appointments
                    if days_offset < 0:
                        bill = ConsultationBill.objects.get(appointment=appointment)
                        bill.status = BillStatus.PAID
                        bill.paid_at = timezone.now()
                        bill.save()
                        
                        # Complete appointment if bill is paid
                        if status == AppointmentStatus.COMPLETED:
                            appointment.completed_at = timezone.now()
                            appointment.save()
                except Exception as e:
                    continue
    
    def create_prescriptions(self):
        """Create prescription records for completed appointments"""
        completed_appointments = Appointment.objects.filter(status=AppointmentStatus.COMPLETED)
        medicines = list(Medicine.objects.all())
        
        for appointment in completed_appointments[:10]:  # Create prescriptions for first 10 completed appointments
            try:
                prescription = Prescription.objects.create(
                    appointment=appointment,
                    symptoms=random.choice([
                        'Fever and headache',
                        'Cough and cold',
                        'Body pain and fatigue',
                        'Stomach ache and nausea',
                        'Back pain',
                        'Joint pain'
                    ]),
                    diagnosis=random.choice([
                        'Viral fever',
                        'Upper respiratory infection',
                        'Muscle strain',
                        'Gastritis',
                        'Lower back pain',
                        'Arthritis'
                    ]),
                    status=PrescriptionStatus.ACTIVE
                )
                
                # Add 2-4 medicines to prescription
                prescription_medicines = random.sample(medicines, random.randint(2, 4))
                for medicine in prescription_medicines:
                    PrescriptionItem.objects.create(
                        prescription=prescription,
                        medicine=medicine,
                        dosage=random.choice(['1 tablet', '2 tablets', '1 teaspoon']),
                        frequency=random.choice(['Once daily', 'Twice daily', 'Thrice daily', 'As needed']),
                        quantity=random.randint(5, 30)
                    )
            except Exception as e:
                continue
    
    def create_lab_requests(self):
        """Create lab test requests"""
        completed_appointments = Appointment.objects.filter(status=AppointmentStatus.COMPLETED)
        lab_tests = list(LabTestCatalog.objects.all())
        
        for appointment in completed_appointments[:8]:  # Create lab requests for first 8 completed appointments
            try:
                # Create 1-2 lab test requests per appointment
                for _ in range(random.randint(1, 2)):
                    lab_test = random.choice(lab_tests)
                    LabTestRequest.objects.create(
                        appointment=appointment,
                        lab_test=lab_test,
                        notes=random.choice([
                            'Routine checkup',
                            'Pre-operative screening',
                            'Follow-up test',
                            'Diagnostic purpose'
                        ]),
                        status=random.choice([LabRequestStatus.ORDERED, LabRequestStatus.COMPLETED])
                    )
            except Exception as e:
                continue
    
    def print_credentials(self):
        """Print login credentials"""
        self.stdout.write('\n' + self.style.SUCCESS('LOGIN CREDENTIALS:'))
        self.stdout.write(self.style.SUCCESS('-' * 60))
        
        credentials = [
            ('Admin', 'admin', 'admin123'),
            ('Doctor', 'dr.sharma', 'doctor123'),
            ('Receptionist', 'receptionist1', 'receptionist123'),
            ('Pharmacist', 'pharmacist1', 'pharmacist123'),
            ('Lab Technician', 'labtech1', 'labtechnician123'),
        ]
        
        for role, username, password in credentials:
            self.stdout.write(f"\n{role}:")
            self.stdout.write(f"  Username: {username}")
            self.stdout.write(f"  Password: {password}")
        
        self.stdout.write('\n' + self.style.SUCCESS('-' * 60))
        self.stdout.write(self.style.SUCCESS(f"\nTotal Patients Created: {Patient.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"Total Appointments Created: {Appointment.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"Total Doctors: {DoctorProfile.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"Total Medicines: {Medicine.objects.count()}"))
        self.stdout.write(self.style.SUCCESS(f"Total Lab Tests: {LabTestCatalog.objects.count()}"))
        self.stdout.write('\n')
