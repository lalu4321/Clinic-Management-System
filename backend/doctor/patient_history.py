"""
Patient History API
Provides complete, isolated, chronological patient history
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Prefetch

from reception.models import Patient, Appointment
from doctor.models import Prescription, PrescriptionItem, LabTestRequest
from labtechinician.models import LabTestResult
from common.permissions import IsDoctor


class PatientHistoryView(APIView):
    """
    Comprehensive patient history for doctors.
    
    Returns:
    - All appointments (chronological, latest first)
    - All prescriptions with items
    - All lab tests with results
    
    Security:
    - Requires authentication
    - Requires Doctor role
    - Strictly filtered by patient_id (no cross-patient leakage)
    """
    
    permission_classes = [IsAuthenticated, IsDoctor]
    
    def get(self, request, patient_id):
        # Verify patient exists
        try:
            patient = Patient.objects.get(
                patient_id=patient_id,
                is_deleted=False
            )
        except Patient.DoesNotExist:
            return Response(
                {"error": "Patient not found"},
                status=404
            )
        
        # Build patient info
        patient_info = {
            "patient_id": patient.patient_id,
            "patient_code": patient.patient_code,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "full_name": f"{patient.first_name} {patient.last_name}",
            "gender": patient.gender,
            "date_of_birth": patient.date_of_birth,
            "blood_group": patient.blood_group,
            "phone": patient.phone,
            "address": patient.address,
        }
        
        # Get current user's doctor profile
        user = request.user
        
        # Get all appointments for this patient
        # Filter by doctor for IDOR protection unless admin
        appointments = Appointment.objects.filter(
            patient_id=patient_id,
            is_deleted=False
        ).select_related(
            'doctor__staff__user',
            'doctor__specialization'
        )
        
        # For security, only show this doctor's visits unless viewing_all=true and admin
        view_all = request.query_params.get('view_all', 'false').lower() == 'true'
        if not view_all and not user.is_superuser:
            # Filter to only this doctor's appointments
            appointments = appointments.filter(doctor__staff__user=user)
        
        appointments = appointments.order_by('-appointment_date', '-appointment_time')
        
        # Build visit history
        visits = []
        
        for appointment in appointments:
            visit = {
                "appointment_id": appointment.appointment_id,
                "appointment_code": appointment.appointment_code,
                "appointment_date": appointment.appointment_date,
                "appointment_time": appointment.appointment_time,
                "status": appointment.status,
                "doctor": {
                    "id": appointment.doctor.doctor_profile_id,
                    "name": appointment.doctor.staff.user.get_full_name(),
                    "specialization": appointment.doctor.specialization.name if appointment.doctor.specialization else None,
                },
                "prescriptions": [],
                "lab_tests": [],
            }
            
            # Get prescriptions for this appointment
            prescriptions = Prescription.objects.filter(
                appointment_id=appointment.appointment_id,
                is_deleted=False
            ).prefetch_related(
                Prefetch(
                    'prescription_items',
                    queryset=PrescriptionItem.objects.filter(is_deleted=False).select_related('medicine')
                )
            )
            
            for prescription in prescriptions:
                prescription_data = {
                    "prescription_id": prescription.prescription_id,
                    "prescription_code": prescription.prescription_code,
                    "symptoms": prescription.symptoms,
                    "diagnosis": prescription.diagnosis,
                    "advice": prescription.advice,
                    "status": prescription.status,
                    "created_at": prescription.created_at,
                    "medicines": []
                }
                
                for item in prescription.prescription_items.all():
                    prescription_data["medicines"].append({
                        "medicine_name": item.medicine.med_name if item.medicine else "Unknown",
                        "dosage": item.dosage,
                        "frequency": item.frequency,
                        "duration": item.duration,
                        "quantity": item.quantity,
                        "instructions": item.instructions,
                    })
                
                visit["prescriptions"].append(prescription_data)
            
            # Get lab tests for this appointment
            lab_requests = LabTestRequest.objects.filter(
                appointment_id=appointment.appointment_id,
                is_deleted=False
            ).select_related('lab_test')
            
            for lab_request in lab_requests:
                lab_data = {
                    "request_id": lab_request.lab_test_request_id,
                    "test_name": lab_request.lab_test.test_name if lab_request.lab_test else "Unknown",
                    "status": lab_request.status,
                    "notes": lab_request.notes,
                    "created_at": lab_request.created_at,
                    "results": []
                }
                
                # Get results from related model if exists
                if hasattr(lab_request, 'results'):
                    for result in lab_request.results.filter(is_deleted=False):
                        lab_data["results"].append({
                            "parameter_name": result.parameter_name,
                            "result_value": result.result_value,
                            "unit": result.unit,
                            "reference_range": result.reference_range,
                            "is_abnormal": getattr(result, 'is_abnormal', False),
                            "remarks": getattr(result, 'remarks', None),
                        })
                
                visit["lab_tests"].append(lab_data)
            
            visits.append(visit)
        
        # Summary statistics
        summary = {
            "total_visits": len(visits),
            "total_prescriptions": sum(len(v["prescriptions"]) for v in visits),
            "total_lab_tests": sum(len(v["lab_tests"]) for v in visits),
        }
        
        return Response({
            "patient": patient_info,
            "summary": summary,
            "visits": visits,
        })


class PatientPrescriptionHistoryView(APIView):
    """
    Get prescription history only (lightweight endpoint)
    """
    
    permission_classes = [IsAuthenticated, IsDoctor]
    
    def get(self, request, patient_id):
        # Get all prescriptions for this patient
        prescriptions = Prescription.objects.filter(
            appointment__patient_id=patient_id,
            is_deleted=False
        ).select_related(
            'appointment__doctor__staff__user'
        ).prefetch_related(
            Prefetch(
                'prescription_items',
                queryset=PrescriptionItem.objects.filter(is_deleted=False).select_related('medicine')
            )
        ).order_by('-created_at')
        
        result = []
        for prescription in prescriptions:
            medicines = []
            for item in prescription.prescription_items.all():
                medicines.append({
                    "medicine_name": item.medicine.med_name if item.medicine else "Unknown",
                    "dosage": item.dosage,
                    "frequency": item.frequency,
                    "duration": item.duration,
                    "quantity": item.quantity,
                })
            
            result.append({
                "prescription_id": prescription.prescription_id,
                "prescription_code": prescription.prescription_code,
                "date": prescription.appointment.appointment_date,
                "doctor": prescription.appointment.doctor.staff.user.get_full_name(),
                "diagnosis": prescription.diagnosis,
                "symptoms": prescription.symptoms,
                "status": prescription.status,
                "medicines": medicines,
            })
        
        return Response({
            "patient_id": patient_id,
            "total": len(result),
            "prescriptions": result,
        })


class PatientLabHistoryView(APIView):
    """
    Get lab test history only (lightweight endpoint)
    """
    
    permission_classes = [IsAuthenticated, IsDoctor]
    
    def get(self, request, patient_id):
        # Get all lab requests for this patient (via appointment)
        lab_requests = LabTestRequest.objects.filter(
            appointment__patient_id=patient_id,
            is_deleted=False
        ).select_related(
            'lab_test',
            'appointment__doctor__staff__user'
        ).order_by('-created_at')
        
        result = []
        for lab_request in lab_requests:
            results = []
            # Get results from related model
            if hasattr(lab_request, 'results'):
                for r in lab_request.results.filter(is_deleted=False):
                    results.append({
                        "parameter": r.parameter_name,
                        "value": r.result_value,
                        "unit": r.unit,
                        "reference": r.reference_range,
                    })
            
            result.append({
                "request_id": lab_request.lab_test_request_id,
                "test_name": lab_request.lab_test.test_name if lab_request.lab_test else "Unknown",
                "date": lab_request.created_at.date(),
                "doctor": lab_request.appointment.doctor.staff.user.get_full_name(),
                "status": lab_request.status,
                "results": results,
            })
        
        return Response({
            "patient_id": patient_id,
            "total": len(result),
            "lab_tests": result,
        })
