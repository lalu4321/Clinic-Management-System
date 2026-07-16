"""
Lab Report PDF Generation
Secure, professional medical report generation.
Consolidated per appointment: includes ALL test results across every
lab request ordered for the same appointment.
"""
import io
from datetime import datetime

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from labtechinician.models import LabTestResult, LabReport
from doctor.models import LabTestRequest


class LabReportPDFView(APIView):
    """
    Generate secure PDF for finalized lab reports.
    Access: Doctor (own patients), LabTechnician, Admin.

    The PDF consolidates ALL test results for the appointment — not just
    the single request the LabReport record is linked to.
    """

    permission_classes = [IsAuthenticated]

    def _has_access(self, user, lab_request):
        if user.is_superuser or user.groups.filter(name="Admin").exists():
            return True
        if user.groups.filter(name="LabTechnician").exists():
            return True
        if user.groups.filter(name="Doctor").exists():
            try:
                return lab_request.appointment.doctor.staff.user == user
            except AttributeError:
                return False
        return False

    def get(self, request, request_id):
        user = request.user
        has_role = (
            user.is_superuser
            or user.groups.filter(name__in=["Admin", "Doctor", "LabTechnician"]).exists()
        )
        if not has_role:
            return Response(
                {"error": "Permission denied."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            lab_request = LabTestRequest.objects.select_related(
                "appointment__patient",
                "appointment__doctor__staff__user",
                "appointment__doctor__specialization",
                "lab_test",
            ).get(lab_test_request_id=request_id, is_deleted=False)
        except LabTestRequest.DoesNotExist:
            return Response(
                {"error": "Lab request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not self._has_access(user, lab_request):
            return Response(
                {"error": "You do not have permission to access this report."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Only FINAL reports can be downloaded
        try:
            report = lab_request.report
        except LabReport.DoesNotExist:
            return Response(
                {"error": "No lab report found for this request."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if report.status != "FINAL":
            return Response(
                {"error": "PDF is only available for finalized reports."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Consolidate: fetch ALL results for the entire appointment ─────────
        appointment = lab_request.appointment
        results = LabTestResult.objects.filter(
            request__appointment=appointment,
            is_deleted=False,
        ).select_related(
            "request__lab_test",
        ).order_by("request__lab_test__test_name", "parameter_name")

        if not results.exists():
            return Response(
                {"error": "No results available for this appointment."},
                status=status.HTTP_404_NOT_FOUND,
            )

        pdf_buffer = self._generate_pdf(lab_request, report, results)
        ist_now = timezone.localtime(timezone.now())
        filename = (
            f"lab_report_{appointment.appointment_code}_"
            f"{ist_now.strftime('%Y%m%d')}.pdf"
        )
        response = HttpResponse(pdf_buffer, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    def _generate_pdf(self, lab_request, report, results):
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20 * mm,
            leftMargin=20 * mm,
            topMargin=20 * mm,
            bottomMargin=20 * mm,
        )

        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            name="ClinicName", fontSize=20, fontName="Helvetica-Bold",
            alignment=TA_CENTER, spaceAfter=4,
            textColor=colors.HexColor("#1e40af"),
        ))
        styles.add(ParagraphStyle(
            name="ClinicAddress", fontSize=10, fontName="Helvetica",
            alignment=TA_CENTER, spaceAfter=20,
            textColor=colors.HexColor("#64748b"),
        ))
        styles.add(ParagraphStyle(
            name="SectionHeader", fontSize=11, fontName="Helvetica-Bold",
            spaceAfter=8, spaceBefore=16,
            textColor=colors.HexColor("#334155"),
        ))
        styles.add(ParagraphStyle(
            name="ReportTitle", fontSize=16, fontName="Helvetica-Bold",
            alignment=TA_CENTER, spaceAfter=20, spaceBefore=10,
            textColor=colors.HexColor("#0f172a"),
        ))
        styles.add(ParagraphStyle(
            name="FooterText", fontSize=8, fontName="Helvetica",
            alignment=TA_CENTER, textColor=colors.HexColor("#94a3b8"),
        ))

        elements = []

        # ── Header ──────────────────────────────────────────────────────────────
        elements.append(Paragraph("CRESCENT VALLEY HOSPITAL", styles["ClinicName"]))
        elements.append(Paragraph(
            "123 Medical Center Drive, Crescent Valley, CA 94000<br/>"
            "Phone: 1800-000-000 | Email: info@crescentvalley.com",
            styles["ClinicAddress"],
        ))

        divider = Table([[""]], colWidths=[170 * mm])
        divider.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 2, colors.HexColor("#3b82f6")),
        ]))
        elements.append(divider)
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("LABORATORY TEST REPORT", styles["ReportTitle"]))

        # ── Patient / Doctor info ────────────────────────────────────────────────
        patient = lab_request.appointment.patient
        doctor = lab_request.appointment.doctor
        appointment = lab_request.appointment

        today = datetime.now().date()
        dob = patient.date_of_birth
        age = today.year - dob.year - (
            (today.month, today.day) < (dob.month, dob.day)
        )

        ist_now = timezone.localtime(timezone.now())
        report_date_str = ist_now.strftime("%d-%b-%Y %I:%M %p IST")

        info_data = [
            ["Report ID:", f"REP-{report.report_id}",
             "Appointment:", appointment.appointment_code],
            ["Patient Name:", f"{patient.first_name} {patient.last_name}",
             "Patient ID:", patient.patient_code],
            ["Age / Gender:", f"{age} yrs / {patient.gender}",
             "Blood Group:", patient.blood_group or "N/A"],
            ["Referred By:",
             f"Dr. {doctor.staff.user.first_name} {doctor.staff.user.last_name}",
             "Department:", doctor.specialization.name],
            ["Report Date:", report_date_str, "", ""],
        ]

        info_table = Table(
            info_data, colWidths=[35 * mm, 55 * mm, 35 * mm, 45 * mm]
        )
        info_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#64748b")),
            ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#64748b")),
            ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (3, 0), (3, -1), colors.HexColor("#1e293b")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 15))

        # ── Test summary (all tests ordered for this appointment) ────────────────
        elements.append(Paragraph("TESTS ORDERED", styles["SectionHeader"]))
        all_requests = LabTestRequest.objects.filter(
            appointment=appointment,
            is_deleted=False,
        ).exclude(
            status="CANCELLED"
        ).select_related("lab_test").order_by("lab_test__test_name")

        test_summary_data = [["Test Name", "Test Code", "Status", "Completed At"]]
        for req in all_requests:
            completed_at_str = "—"
            if req.status == "COMPLETED":
                # Use report completed_at as proxy (report covers the appointment)
                if report.completed_at:
                    completed_at_str = timezone.localtime(report.completed_at).strftime(
                        "%d-%b-%Y %I:%M %p"
                    )
            test_summary_data.append([
                req.lab_test.test_name if req.lab_test else "N/A",
                req.lab_test.lab_test_code if req.lab_test else "N/A",
                req.status,
                completed_at_str,
            ])

        test_summary_table = Table(
            test_summary_data, colWidths=[60 * mm, 35 * mm, 35 * mm, 40 * mm]
        )
        test_summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3b82f6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        elements.append(test_summary_table)
        elements.append(Spacer(1, 15))

        # ── Results table (all parameters, all tests) ─────────────────────────────
        elements.append(Paragraph("TEST RESULTS", styles["SectionHeader"]))

        results_data = [["Test", "Parameter", "Result Value", "Unit", "Reference Range", "Status"]]
        current_test = None
        for result in results:
            test_label = ""
            if result.request and result.request.lab_test:
                test_label = result.request.lab_test.test_name

            ref_range = result.reference_range or ""
            if not ref_range and result.reference_min is not None and result.reference_max is not None:
                ref_range = f"{result.reference_min} – {result.reference_max}"

            status_text = "Normal"
            is_abn = False
            if result.reference_min is not None and result.value is not None:
                if float(result.value) < float(result.reference_min):
                    is_abn = True
                    status_text = "Low ▼"
            if result.reference_max is not None and result.value is not None:
                if float(result.value) > float(result.reference_max):
                    is_abn = True
                    status_text = "High ▲"
            if not is_abn and result.is_abnormal:
                is_abn = True
                status_text = "Abnormal"

            results_data.append([
                test_label,
                result.parameter_name,
                str(result.value) if result.value is not None else result.result_value,
                result.unit or "",
                ref_range,
                status_text,
            ])

        results_table = Table(
            results_data, colWidths=[35 * mm, 35 * mm, 28 * mm, 20 * mm, 32 * mm, 20 * mm]
        )
        results_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3b82f6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("ALIGN", (2, 1), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.white, colors.HexColor("#f8fafc")]),
        ]))

        for i, result in enumerate(results, start=1):
            is_abn = result.is_abnormal
            if not is_abn and result.reference_min is not None and result.value is not None:
                is_abn = (
                    float(result.value) < float(result.reference_min)
                    or (
                        result.reference_max is not None
                        and float(result.value) > float(result.reference_max)
                    )
                )
            if is_abn:
                results_table.setStyle(TableStyle([
                    ("TEXTCOLOR", (2, i), (2, i), colors.HexColor("#dc2626")),
                    ("FONTNAME", (2, i), (2, i), "Helvetica-Bold"),
                    ("TEXTCOLOR", (5, i), (5, i), colors.HexColor("#dc2626")),
                    ("FONTNAME", (5, i), (5, i), "Helvetica-Bold"),
                ]))

        elements.append(results_table)
        elements.append(Spacer(1, 15))

        # ── Interpretation ────────────────────────────────────────────────────────
        if report.overall_interpretation:
            elements.append(Paragraph("INTERPRETATION", styles["SectionHeader"]))
            elements.append(Paragraph(
                report.overall_interpretation,
                styles["Normal"],
            ))
            elements.append(Spacer(1, 15))

        # ── Footer ────────────────────────────────────────────────────────────────
        elements.append(Paragraph("*** End of Report ***", styles["FooterText"]))
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(
            "This is a computer-generated report. For queries, contact the laboratory.",
            styles["FooterText"],
        ))
        elements.append(Paragraph(
            f"Generated on: {report_date_str}", styles["FooterText"]
        ))

        doc.build(elements)
        buffer.seek(0)
        return buffer
