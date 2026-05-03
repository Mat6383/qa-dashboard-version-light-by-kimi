"""CSV & Excel generation."""

from __future__ import annotations

import csv
import io
from typing import Any

import openpyxl
from openpyxl.styles import Font


class ExportService:
    async def generate_csv(self, payload: dict[str, Any]) -> bytes:
        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        rows = payload.get("rows", [])
        if rows:
            writer.writerow(rows[0].keys())
            for row in rows:
                writer.writerow(row.values())
        return output.getvalue().encode("utf-8-sig")

    async def generate_excel(self, payload: dict[str, Any]) -> bytes:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Export"
        rows = payload.get("rows", [])
        if rows:
            headers = list(rows[0].keys())
            ws.append(headers)
            for cell in ws[1]:
                cell.font = Font(bold=True)
            for row in rows:
                ws.append(list(row.values()))
        buffer = io.BytesIO()
        wb.save(buffer)
        return buffer.getvalue()


export_service = ExportService()
