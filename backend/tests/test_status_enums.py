"""
Test suite for role-specific status ENUMs:
- Staff: ACTIVE/INACTIVE/ON_LEAVE
- Doctor: AVAILABLE/OFF_DUTY  (ON_DUTY removed in migration 0003)
- Patient: REGISTERED/UNDER_CARE/ARCHIVED
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://backend-vault-check.preview.emergentagent.com')

class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_admin_login(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login/", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "access" in data.get("data", {})
        print("✅ Admin login successful")
    
    def test_receptionist_login(self):
        """Test receptionist login"""
        response = requests.post(f"{BASE_URL}/api/auth/login/", json={
            "username": "receptionist1",
            "password": "receptionist123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print("✅ Receptionist login successful")


class TestStaffStatusEnum:
    """Test Staff status ENUM (ACTIVE/INACTIVE/ON_LEAVE)"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login/", json={
            "username": "admin",
            "password": "admin123"
        })
        return response.json()["data"]["access"]
    
    def test_staff_list_returns_staff_status(self, admin_token):
        """API GET /api/administration/staff/ returns staff_status field"""
        response = requests.get(
            f"{BASE_URL}/api/administration/staff/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Get staff list
        staff_list = data.get("data", {}).get("results", data.get("data", []))
        if isinstance(staff_list, dict):
            staff_list = staff_list.get("results", [])
        
        assert len(staff_list) > 0, "No staff found"
        
        # Check first staff has staff_status field
        first_staff = staff_list[0]
        assert "staff_status" in first_staff, "staff_status field missing from staff response"
        assert first_staff["staff_status"] in ["ACTIVE", "INACTIVE", "ON_LEAVE"], \
            f"Invalid staff_status value: {first_staff['staff_status']}"
        print(f"✅ Staff list returns staff_status: {first_staff['staff_status']}")
    
    def test_staff_detail_returns_staff_status(self, admin_token):
        """API GET /api/administration/staff/{id}/ returns staff_status field"""
        response = requests.get(
            f"{BASE_URL}/api/administration/staff/1/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        staff = data.get("data", data)
        assert "staff_status" in staff, "staff_status field missing from staff detail"
        print(f"✅ Staff detail returns staff_status: {staff['staff_status']}")


class TestDoctorDutyStatusEnum:
    """Test Doctor duty_status ENUM (AVAILABLE/OFF_DUTY)"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login/", json={
            "username": "admin",
            "password": "admin123"
        })
        return response.json()["data"]["access"]
    
    @pytest.fixture
    def receptionist_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login/", json={
            "username": "receptionist1",
            "password": "receptionist123"
        })
        return response.json()["data"]["access"]
    
    def test_admin_doctors_list_returns_duty_status(self, admin_token):
        """API GET /api/administration/doctors/ returns duty_status field"""
        response = requests.get(
            f"{BASE_URL}/api/administration/doctors/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Get doctors list
        doctors_list = data.get("data", {}).get("results", data.get("data", []))
        if isinstance(doctors_list, dict):
            doctors_list = doctors_list.get("results", [])
        
        assert len(doctors_list) > 0, "No doctors found"
        
        # Check first doctor has duty_status field
        first_doctor = doctors_list[0]
        assert "duty_status" in first_doctor, "duty_status field missing from doctor response"
        assert first_doctor["duty_status"] in ["AVAILABLE", "OFF_DUTY"], \
            f"Invalid duty_status value: {first_doctor['duty_status']}"
        print(f"✅ Admin doctors list returns duty_status: {first_doctor['duty_status']}")
    
    def test_reception_doctors_list_returns_duty_status_and_is_bookable(self, receptionist_token):
        """API GET /api/reception/doctors/ returns duty_status and is_bookable fields"""
        response = requests.get(
            f"{BASE_URL}/api/reception/doctors/",
            headers={"Authorization": f"Bearer {receptionist_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Get doctors list
        doctors_list = data.get("data", [])
        if isinstance(doctors_list, dict):
            doctors_list = doctors_list.get("results", [])
        
        assert len(doctors_list) > 0, "No doctors found"
        
        # Check first doctor has duty_status and is_bookable fields
        first_doctor = doctors_list[0]
        assert "duty_status" in first_doctor, "duty_status field missing from reception doctors response"
        assert "is_bookable" in first_doctor, "is_bookable field missing from reception doctors response"
        
        # Verify is_bookable logic
        if first_doctor["duty_status"] == "OFF_DUTY":
            assert first_doctor["is_bookable"] == False, "OFF_DUTY doctor should not be bookable"
        else:
            assert first_doctor["is_bookable"] == True, "AVAILABLE doctor should be bookable"
        
        print(f"✅ Reception doctors list returns duty_status: {first_doctor['duty_status']}, is_bookable: {first_doctor['is_bookable']}")
    
    def test_doctor_detail_returns_duty_status(self, admin_token):
        """API GET /api/administration/doctors/{id}/ returns duty_status field"""
        response = requests.get(
            f"{BASE_URL}/api/administration/doctors/1/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        doctor = data.get("data", data)
        assert "duty_status" in doctor, "duty_status field missing from doctor detail"
        print(f"✅ Doctor detail returns duty_status: {doctor['duty_status']}")


class TestPatientStatusEnum:
    """Test Patient status ENUM (REGISTERED/UNDER_CARE/ARCHIVED)"""
    
    @pytest.fixture
    def receptionist_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login/", json={
            "username": "receptionist1",
            "password": "receptionist123"
        })
        return response.json()["data"]["access"]
    
    def test_patients_list_returns_patient_status(self, receptionist_token):
        """API GET /api/reception/patients/ returns patient_status field"""
        response = requests.get(
            f"{BASE_URL}/api/reception/patients/",
            headers={"Authorization": f"Bearer {receptionist_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Get patients list
        patients_list = data.get("data", {}).get("results", data.get("data", []))
        if isinstance(patients_list, dict):
            patients_list = patients_list.get("results", [])
        
        assert len(patients_list) > 0, "No patients found"
        
        # Check first patient has patient_status field
        first_patient = patients_list[0]
        assert "patient_status" in first_patient, "patient_status field missing from patient response"
        assert first_patient["patient_status"] in ["REGISTERED", "UNDER_CARE", "ARCHIVED"], \
            f"Invalid patient_status value: {first_patient['patient_status']}"
        print(f"✅ Patients list returns patient_status: {first_patient['patient_status']}")
    
    def test_patients_list_returns_email_field(self, receptionist_token):
        """API GET /api/reception/patients/ returns email field"""
        response = requests.get(
            f"{BASE_URL}/api/reception/patients/",
            headers={"Authorization": f"Bearer {receptionist_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Get patients list
        patients_list = data.get("data", {}).get("results", data.get("data", []))
        if isinstance(patients_list, dict):
            patients_list = patients_list.get("results", [])
        
        assert len(patients_list) > 0, "No patients found"
        
        # Check first patient has email field
        first_patient = patients_list[0]
        assert "email" in first_patient, "email field missing from patient response"
        print(f"✅ Patients list returns email field: {first_patient.get('email')}")
    
    def test_patient_detail_returns_patient_status_and_email(self, receptionist_token):
        """API GET /api/reception/patients/{id}/ returns patient_status and email fields"""
        response = requests.get(
            f"{BASE_URL}/api/reception/patients/1/",
            headers={"Authorization": f"Bearer {receptionist_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        patient = data.get("data", data)
        assert "patient_status" in patient, "patient_status field missing from patient detail"
        assert "email" in patient, "email field missing from patient detail"
        print(f"✅ Patient detail returns patient_status: {patient['patient_status']}, email: {patient.get('email')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
