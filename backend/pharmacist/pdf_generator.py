"""
Pharmacy Bill PDF Generation
Professional receipt generation using ReportLab.
Mirrors the visual style of LabReportPDFView (same clinic branding).
Only PAID pharmacy bills produce a PDF receipt.
"""
import io

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status as http_status

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER

from .models import PharmacyBill, PharmacyBillStatus
from common.permissions import IsPharmacist


class PharmacyBillPDFView(APIView):
    """
    GET /api/pharmacy/pharmacy-bills/<bill_id>/pdf/

    Generate a PDF receipt for a fully-paid pharmacy bill.
    Returns HTTP 400 if the bill is not yet PAID.
    Access: Pharmacist only (IsPharmacist permission class).
    Content-Disposition: inline so the browser opens the PDF viewer directly.
    """

    permission_classes = [IsAuthenticated, IsPharmacist]

    def get(self, request, bill_id):
        try:
            bill = (
                PharmacyBill.objects
                .select_related(
                    "prescription",
                    "prescription__appointment__patient",
                    "prescription__appointment__doctor__staff__user",
                )
                .prefetch_related("items__inventory__medicine")
                .get(pk=bill_id, is_deleted=False)
            )
        except PharmacyBill.DoesNotExist:
            return Response(
                {"error": "Bill not found."},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        if bill.status != PharmacyBillStatus.PAID:
            return Response(
                {"error": "PDF receipt is only available for paid bills."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        pdf_buffer = self._generate_pdf(bill)
        ist_now = timezone.localtime(timezone.now())
        filename = (
            f"pharmacy_receipt_{bill.pharmacy_bill_code}_"
            f"{ist_now.strftime('%Y%m%d')}.pdf"
        )
        response = HttpResponse(pdf_buffer, content_type="application/pdf")
        # inline → browser PDF viewer; change to 'attachment' to force download
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response

    # ------------------------------------------------------------------
    # Private PDF builder
    # ------------------------------------------------------------------

    def _generate_pdf(self, bill):
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20 * mm,
            leftMargin=20 * mm,
            topMargin=20 * mm,
            bottomMargin=20 * mm,
        )

        clinic_color = colors.HexColor("#00647c")   # matches clinical-primary token
        paid_color   = colors.HexColor("#16a34a")   # green-600

        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            name="ClinicName",
            fontSize=22, fontName="Helvetica-Bold",
            alignment=TA_CENTER, spaceAfter=4,
            textColor=clinic_color,
        ))
        styles.add(ParagraphStyle(
            name="ClinicAddress",
            fontSize=9, fontName="Helvetica",
            alignment=TA_CENTER, spaceAfter=8,
            textColor=colors.HexColor("#64748b"),
        ))
        styles.add(ParagraphStyle(
            name="ReceiptTitle",
            fontSize=14, fontName="Helvetica-Bold",
            alignment=TA_CENTER, spaceAfter=4, spaceBefore=10,
            textColor=colors.HexColor("#0f172a"),
        ))
        styles.add(ParagraphStyle(
            name="BillCode",
            fontSize=9, fontName="Helvetica",
            alignment=TA_CENTER, spaceAfter=16,
            textColor=colors.HexColor("#94a3b8"),
        ))
        styles.add(ParagraphStyle(
            name="SectionHeader",
            fontSize=9, fontName="Helvetica-Bold",
            spaceAfter=6, spaceBefore=14,
            textColor=colors.HexColor("#64748b"),
        ))
        styles.add(ParagraphStyle(
            name="FooterText",
            fontSize=8, fontName="Helvetica",
            alignment=TA_CENTER, textColor=colors.HexColor("#94a3b8"),
        ))

        elements = []

        # ── Clinic header ────────────────────────────────────────────────────────
        elements.append(Paragraph("CRESCENT VALLEY HOSPITAL", styles["ClinicName"]))
        elements.append(Paragraph(
            "123 Medical Center Drive, Crescent Valley, CA 94000<br/>"
            "Phone: 1800-000-000 | Email: info@crescentvalley.com",
            styles["ClinicAddress"],
        ))

        # Horizontal rule under header (matches lab report style)
        divider = Table([[""]], colWidths=[170 * mm])
        divider.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 2, clinic_color),
        ]))
        elements.append(divider)

        elements.append(Paragraph("PHARMACY RECEIPT", styles["ReceiptTitle"]))
        elements.append(Paragraph(bill.pharmacy_bill_code, styles["BillCode"]))

        # ── Patient / prescription metadata ─────────────────────────────────────
        appointment = (
            bill.prescription.appointment if bill.prescription else None
        )
        patient = appointment.patient if appointment else None

        patient_name = (
            f"{patient.first_name} {patient.last_name}".strip()
            if patient else "N/A"
        )
        patient_code = patient.patient_code if patient else "N/A"
        prescription_code = (
            bill.prescription.prescription_code if bill.prescription else "N/A"
        )

        ist_now = timezone.localtime(timezone.now())

        paid_at_str = "—"
        if bill.paid_at:
            paid_at_ist = timezone.localtime(bill.paid_at)
            paid_at_str = paid_at_ist.strftime("%d-%b-%Y %I:%M %p IST")

        info_data = [
            ["Patient Name:", patient_name,       "Patient ID:",    patient_code],
            ["Prescription:", prescription_code,  "Receipt Date:",  ist_now.strftime("%d-%b-%Y")],
            ["Paid On:",      paid_at_str,         "",               ""],
        ]

        info_table = Table(
            info_data,
            colWidths=[35 * mm, 55 * mm, 35 * mm, 45 * mm],
        )
        info_table.setStyle(TableStyle([
            ("FONTNAME",      (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME",      (2, 0), (2, -1), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 9),
            ("TEXTCOLOR",     (0, 0), (0, -1),  colors.HexColor("#64748b")),
            ("TEXTCOLOR",     (2, 0), (2, -1),  colors.HexColor("#64748b")),
            ("TEXTCOLOR",     (1, 0), (1, -1),  colors.HexColor("#1e293b")),
            ("TEXTCOLOR",     (3, 0), (3, -1),  colors.HexColor("#1e293b")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ]))
        elements.append(Spacer(1, 8))
        elements.append(info_table)
        elements.append(Spacer(1, 14))

        # ── Medicines dispensed table ────────────────────────────────────────────
        elements.append(Paragraph("DISPENSED MEDICINES", styles["SectionHeader"]))

        items = (
            bill.items
            .filter(is_deleted=False)
            .select_related("inventory__medicine")
        )

        med_data = [["Medicine", "Qty", "Unit Price", "Total"]]
        for item in items:
            med_name = (
                item.inventory.medicine.med_name
                if item.inventory and item.inventory.medicine
                else "N/A"
            )
            row_total = item.quantity * item.unit_price
            med_data.append([
                med_name,
                str(item.quantity),
                f"\u20b9{item.unit_price:.2f}",
                f"\u20b9{row_total:.2f}",
            ])

        if not items.exists():
            med_data.append(["No medicines dispensed", "", "", ""])

        med_table = Table(
            med_data,
            colWidths=[82 * mm, 20 * mm, 34 * mm, 34 * mm],
        )
        med_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  clinic_color),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 9),
            ("ALIGN",         (0, 0), (-1, 0),  "CENTER"),
            ("ALIGN",         (1, 1), (-1, -1), "RIGHT"),
            ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        elements.append(med_table)
        elements.append(Spacer(1, 10))

        # ── Total amount row ─────────────────────────────────────────────────────
        total_data = [["", "TOTAL AMOUNT", f"\u20b9{bill.total_amount:.2f}"]]
        total_table = Table(
            total_data,
            colWidths=[82 * mm, 54 * mm, 34 * mm],
        )
        total_table.setStyle(TableStyle([
            ("FONTNAME",      (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 11),
            ("ALIGN",         (1, 0), (-1, -1), "RIGHT"),
            ("TEXTCOLOR",     (1, 0), (-1, -1), clinic_color),
            ("LINEABOVE",     (0, 0), (-1, 0),  1.5, clinic_color),
            ("TOPPADDING",    (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        elements.append(total_table)
        elements.append(Spacer(1, 18))

        # ── PAID stamp (centred box, rotated look via text tracking) ─────────────
        stamp_data = [["  P A I D  "]]
        stamp_table = Table(stamp_data, colWidths=[60 * mm])
        stamp_table.setStyle(TableStyle([
            ("FONTNAME",      (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 20),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
            ("TEXTCOLOR",     (0, 0), (-1, -1), paid_color),
            ("BOX",           (0, 0), (-1, -1), 3, paid_color),
            ("TOPPADDING",    (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        # Wrapper table to horizontally centre the stamp on the full page width
        wrapper = Table([[stamp_table]], colWidths=[170 * mm])
        wrapper.setStyle(TableStyle([
            ("ALIGN",  (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(wrapper)
        elements.append(Spacer(1, 22))

        # ── Footer ───────────────────────────────────────────────────────────────
        elements.append(Paragraph(
            "Thank you for choosing Crescent Valley Hospital",
            styles["FooterText"],
        ))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(
            "This is a computer-generated receipt. No signature required.",
            styles["FooterText"],
        ))
        elements.append(Paragraph(
            f"Generated on: {ist_now.strftime('%d-%b-%Y %I:%M %p IST')}",
            styles["FooterText"],
        ))

        doc.build(elements)
        buffer.seek(0)
        return buffer
