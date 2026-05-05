from __future__ import annotations

from pathlib import Path


def _escape_pdf_text(value: str) -> str:
    return str(value or "").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


class PDFGenerator:
    def render_lines(self, title: str, lines: list[str]) -> bytes:
        safe_title = _escape_pdf_text(title)
        safe_lines = [_escape_pdf_text(line) for line in lines]

        content_lines = ["BT", "/F1 22 Tf", "50 780 Td", f"({safe_title}) Tj", "0 -28 Td", "/F1 12 Tf"]
        for line in safe_lines:
            content_lines.append(f"({line}) Tj")
            content_lines.append("0 -18 Td")
        content_lines.append("ET")
        content_stream = "\n".join(content_lines).encode("latin-1", errors="replace")

        objects: list[bytes] = []
        objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
        objects.append(b"<< /Type /Pages /Count 1 /Kids [3 0 R] >>")
        objects.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>")
        objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        objects.append(f"<< /Length {len(content_stream)} >>\nstream\n".encode("latin-1") + content_stream + b"\nendstream")

        pdf = bytearray(b"%PDF-1.4\n")
        offsets = [0]
        for index, obj in enumerate(objects, start=1):
            offsets.append(len(pdf))
            pdf.extend(f"{index} 0 obj\n".encode("latin-1"))
            pdf.extend(obj)
            pdf.extend(b"\nendobj\n")

        xref_start = len(pdf)
        pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
        pdf.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            pdf.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))
        pdf.extend(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
                f"startxref\n{xref_start}\n%%EOF"
            ).encode("latin-1")
        )
        return bytes(pdf)

    def generate_report(self, title: str, sections: dict[str, object]) -> bytes:
        lines = [f"{key}: {value}" for key, value in sections.items()]
        return self.render_lines(title, lines)

    def save(self, pdf_bytes: bytes, output_path: str | Path) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(pdf_bytes)
        return str(path)


pdf_generator = PDFGenerator()
