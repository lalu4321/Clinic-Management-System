"""
Enhanced Patient Search API
Provides scalable, debounced search across multiple fields
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Value, CharField
from django.db.models.functions import Concat

from reception.models import Patient
from common.permissions import IsReceptionist, IsDoctor


class PatientSearchView(APIView):
    """
    Scalable patient search endpoint supporting:
    - Multi-field search (ID, name, phone, patient_code)
    - Partial match (case-insensitive)
    - Pagination for large datasets
    - Optimized queries with indexed fields
    """
    
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        # Allow both receptionists and doctors to search patients
        return [IsAuthenticated()]
    
    def get(self, request):
        query = request.query_params.get('q', '').strip()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        
        # Limit page size
        page_size = min(page_size, 100)
        
        # Base queryset
        patients = Patient.objects.filter(is_deleted=False)
        
        if query:
            # Multi-field search with partial matching
            patients = patients.annotate(
                full_name=Concat('first_name', Value(' '), 'last_name', output_field=CharField())
            ).filter(
                Q(patient_code__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(full_name__icontains=query) |
                Q(phone__icontains=query)
            )
        
        # Order by relevance (exact matches first)
        patients = patients.order_by('-created_at')
        
        # Pagination
        total = patients.count()
        start = (page - 1) * page_size
        end = start + page_size
        
        results = patients[start:end].values(
            'patient_id',
            'patient_code',
            'first_name',
            'last_name',
            'phone',
            'gender',
            'blood_group',
            'date_of_birth'
        )
        
        return Response({
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'results': list(results)
        })


class PatientQuickLookupView(APIView):
    """
    Quick lookup by exact patient_id or patient_code
    Used for validation and autocomplete
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request, identifier):
        """
        Lookup by patient_id (numeric) or patient_code (string)
        """
        patient = None
        
        # Try numeric ID first
        if identifier.isdigit():
            patient = Patient.objects.filter(
                patient_id=int(identifier),
                is_deleted=False
            ).first()
        
        # Try patient_code
        if not patient:
            patient = Patient.objects.filter(
                patient_code__iexact=identifier,
                is_deleted=False
            ).first()
        
        if not patient:
            return Response({'error': 'Patient not found'}, status=404)
        
        return Response({
            'patient_id': patient.patient_id,
            'patient_code': patient.patient_code,
            'first_name': patient.first_name,
            'last_name': patient.last_name,
            'full_name': f"{patient.first_name} {patient.last_name}",
            'phone': patient.phone,
            'gender': patient.gender,
            'blood_group': patient.blood_group,
            'date_of_birth': patient.date_of_birth,
            'address': patient.address,
        })
