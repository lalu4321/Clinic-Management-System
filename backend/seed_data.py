import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CMS.settings')
django.setup()

from django.contrib.auth.models import User, Group
from administration.models import Staff, Specialization, DoctorProfile, DoctorSchedule
from reception.models import Patient
from labtechinician.models import LabTestCatalog
from pharmacist.models import Medicine
from datetime import date, time
from django.core.files.base import ContentFile
import io
from PIL import Image

def create_placeholder_image():
    """Create a small placeholder image for profile pictures"""
    img = Image.new('RGB', (100, 100), color=(0, 100, 124))
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return ContentFile(buffer.read(), name='placeholder.png')

def seed():
    # Create groups
    groups = {}
    for name in ['Admin', 'Doctor', 'Receptionist', 'Pharmacist', 'LabTechnician']:
        g, _ = Group.objects.get_or_create(name=name)
        groups[name] = g

    # Create admin user
    admin_user, created = User.objects.get_or_create(
        username='admin',
        defaults={'email': 'admin@clinic.com', 'is_staff': True, 'is_superuser': True}
    )
    if created:
        admin_user.set_password('admin123')
        admin_user.save()
    admin_user.groups.add(groups['Admin'])
    
    # Create admin staff profile (bypass validation)
    if not Staff.all_objects.filter(user=admin_user).exists():
        staff = Staff.__new__(Staff)
        staff.__dict__.update({
            'staff_code': 'ST001',
            'user_id': admin_user.id,
            'gender': 'MALE',
            'date_of_birth': date(1985, 1, 15),
            'phone': '9000000001',
            'address': 'Admin Office, Crescent Valley Hospital',
            'qualification': 'MBA Healthcare',
            'salary': 80000.00,
            'is_active': True,
            'is_deleted': False,
            'version': 1,
        })
        Staff.all_objects.create(
            staff_code='ST001', user=admin_user, gender='MALE',
            date_of_birth=date(1985, 1, 15), phone='9000000001',
            address='Admin Office, Crescent Valley Hospital',
            qualification='MBA Healthcare', salary=80000.00,
            is_active=True, profile_picture=create_placeholder_image()
        )
    
    # Create specializations
    spec_names = ['General Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 
                  'Dermatology', 'Neurology', 'ENT', 'Ophthalmology', 'Gynecology', 'Radiology']
    specs = {}
    for name in spec_names:
        try:
            s = Specialization.all_objects.get(name__iexact=name)
        except Specialization.DoesNotExist:
            s = Specialization(name=name)
            s.save()
        specs[name] = s

    # Create doctors
    doctors_data = [
        {'username': 'dr.sharma', 'first_name': 'Rajesh', 'last_name': 'Sharma', 'email': 'dr.sharma@clinic.com', 'spec': 'General Medicine', 'fee': 500, 'phone': '9100000001'},
        {'username': 'dr.patel', 'first_name': 'Amit', 'last_name': 'Patel', 'email': 'dr.patel@clinic.com', 'spec': 'Cardiology', 'fee': 800, 'phone': '9100000002'},
        {'username': 'dr.kumar', 'first_name': 'Vikram', 'last_name': 'Kumar', 'email': 'dr.kumar@clinic.com', 'spec': 'Orthopedics', 'fee': 700, 'phone': '9100000003'},
        {'username': 'dr.reddy', 'first_name': 'Priya', 'last_name': 'Reddy', 'email': 'dr.reddy@clinic.com', 'spec': 'Pediatrics', 'fee': 600, 'phone': '9100000004'},
        {'username': 'dr.singh', 'first_name': 'Harpreet', 'last_name': 'Singh', 'email': 'dr.singh@clinic.com', 'spec': 'Dermatology', 'fee': 650, 'phone': '9100000005'},
    ]
    
    for d in doctors_data:
        user, created = User.objects.get_or_create(
            username=d['username'],
            defaults={'email': d['email'], 'first_name': d['first_name'], 'last_name': d['last_name']}
        )
        if created:
            user.set_password('doctor123')
            user.save()
        user.groups.add(groups['Doctor'])
        
        if not Staff.all_objects.filter(user=user).exists():
            staff = Staff.all_objects.create(
                user=user, gender='MALE', date_of_birth=date(1980, 6, 15),
                phone=d['phone'], address='Doctor Quarters, Crescent Valley Hospital',
                qualification='MBBS, MD', salary=120000.00,
                is_active=True, profile_picture=create_placeholder_image()
            )
            if not staff.staff_code:
                staff.staff_code = f"ST{staff.staff_id:03d}"
                Staff.all_objects.filter(pk=staff.pk).update(staff_code=staff.staff_code)
        
        staff = Staff.all_objects.get(user=user)
        if not DoctorProfile.all_objects.filter(staff=staff).exists():
            dp = DoctorProfile.all_objects.create(
                staff=staff, specialization=specs[d['spec']],
                consultation_fee=d['fee'], max_patient_per_day=25, is_active=True
            )
            if not dp.doctor_code:
                dp.doctor_code = f"DR{dp.doctor_profile_id:03d}"
                DoctorProfile.all_objects.filter(pk=dp.pk).update(doctor_code=dp.doctor_code)

    # Create receptionists
    for i, (uname, fname) in enumerate([('receptionist1', 'Anjali'), ('receptionist2', 'Meera')], 1):
        user, created = User.objects.get_or_create(
            username=uname,
            defaults={'email': f'{uname}@clinic.com', 'first_name': fname, 'last_name': 'Desai'}
        )
        if created:
            user.set_password('receptionist123')
            user.save()
        user.groups.add(groups['Receptionist'])
        
        if not Staff.all_objects.filter(user=user).exists():
            staff = Staff.all_objects.create(
                user=user, gender='FEMALE', date_of_birth=date(1990, 3, 20),
                phone=f'920000000{i}', address='Reception Desk, Crescent Valley Hospital',
                qualification='BA, Diploma in Hospital Admin', salary=35000.00,
                is_active=True, profile_picture=create_placeholder_image()
            )
            if not staff.staff_code:
                staff.staff_code = f"ST{staff.staff_id:03d}"
                Staff.all_objects.filter(pk=staff.pk).update(staff_code=staff.staff_code)

    # Create pharmacists
    for i, (uname, fname) in enumerate([('pharmacist1', 'Suresh'), ('pharmacist2', 'Rakesh')], 1):
        user, created = User.objects.get_or_create(
            username=uname,
            defaults={'email': f'{uname}@clinic.com', 'first_name': fname, 'last_name': 'Nair'}
        )
        if created:
            user.set_password('pharmacist123')
            user.save()
        user.groups.add(groups['Pharmacist'])
        
        if not Staff.all_objects.filter(user=user).exists():
            staff = Staff.all_objects.create(
                user=user, gender='MALE', date_of_birth=date(1988, 7, 10),
                phone=f'930000000{i}', address='Pharmacy Wing, Crescent Valley Hospital',
                qualification='B.Pharm', salary=40000.00,
                is_active=True, profile_picture=create_placeholder_image()
            )
            if not staff.staff_code:
                staff.staff_code = f"ST{staff.staff_id:03d}"
                Staff.all_objects.filter(pk=staff.pk).update(staff_code=staff.staff_code)

    # Create lab technicians
    for i, (uname, fname) in enumerate([('labtech1', 'Ravi'), ('labtech2', 'Sanjay')], 1):
        user, created = User.objects.get_or_create(
            username=uname,
            defaults={'email': f'{uname}@clinic.com', 'first_name': fname, 'last_name': 'Menon'}
        )
        if created:
            user.set_password('labtechnician123')
            user.save()
        user.groups.add(groups['LabTechnician'])
        
        if not Staff.all_objects.filter(user=user).exists():
            staff = Staff.all_objects.create(
                user=user, gender='MALE', date_of_birth=date(1992, 11, 5),
                phone=f'940000000{i}', address='Lab Wing, Crescent Valley Hospital',
                qualification='B.Sc MLT', salary=35000.00,
                is_active=True, profile_picture=create_placeholder_image()
            )
            if not staff.staff_code:
                staff.staff_code = f"ST{staff.staff_id:03d}"
                Staff.all_objects.filter(pk=staff.pk).update(staff_code=staff.staff_code)

    # Create lab test catalog
    tests = [
        ('Complete Blood Count (CBC)', 300), ('Lipid Profile', 500), ('Blood Sugar Fasting', 150),
        ('Thyroid Profile', 600), ('Liver Function Test', 450), ('Kidney Function Test', 500),
        ('Urine Analysis', 200), ('ECG', 300), ('X-Ray Chest', 400), ('CT Scan', 800),
        ('MRI Brain', 800), ('HbA1c', 350), ('Vitamin D', 500),
    ]
    for name, charge in tests:
        try:
            LabTestCatalog.all_objects.get(test_name=name)
        except LabTestCatalog.DoesNotExist:
            t = LabTestCatalog(test_name=name, test_charge=charge, status='ACTIVE')
            t.save()

    # Create medicines
    medicines = [
        'Paracetamol 500mg', 'Amoxicillin 500mg', 'Ibuprofen 400mg', 'Metformin 500mg',
        'Atorvastatin 10mg', 'Omeprazole 20mg', 'Ciprofloxacin 500mg', 'Azithromycin 500mg',
        'Cetirizine 10mg', 'Pantoprazole 40mg', 'Amlodipine 5mg', 'Metoprolol 50mg',
        'Losartan 50mg', 'Aspirin 75mg', 'Vitamin B Complex',
    ]
    for med in medicines:
        try:
            Medicine.all_objects.get(med_name=med)
        except Medicine.DoesNotExist:
            m = Medicine(med_name=med, company_name='Generic Pharma', generic_name=med.split(' ')[0], status='ACTIVE')
            m.save()

    # Create patients
    patients_data = [
        ('Arun', 'Kumar', 'MALE', date(1985, 3, 15), 'O+', '9800000001', '9800000011'),
        ('Priya', 'Nair', 'FEMALE', date(1990, 7, 22), 'A+', '9800000002', '9800000012'),
        ('Mohammed', 'Ali', 'MALE', date(1978, 11, 8), 'B+', '9800000003', '9800000013'),
        ('Lakshmi', 'Devi', 'FEMALE', date(1965, 5, 30), 'AB+', '9800000004', '9800000014'),
        ('Rahul', 'Sharma', 'MALE', date(2000, 1, 10), 'O-', '9800000005', '9800000015'),
    ]
    for fname, lname, gender, dob, blood, phone, emergency in patients_data:
        try:
            Patient.all_objects.get(phone=phone)
        except Patient.DoesNotExist:
            p = Patient(
                first_name=fname, last_name=lname, gender=gender,
                date_of_birth=dob, blood_group=blood, phone=phone,
                emergency_contact_number=emergency,
                address='Crescent Valley, Kerala',
            )
            p.save()

    # Create doctor schedules
    for dp in DoctorProfile.objects.all():
        for day in ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']:
            DoctorSchedule.objects.get_or_create(
                doctor=dp, day_of_week=day,
                defaults={
                    'start_time': time(9, 0), 'end_time': time(17, 0), 'is_active': True
                }
            )

    print("Database seeded successfully!")

if __name__ == '__main__':
    seed()
