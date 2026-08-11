from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "tests" / "fixtures" / "signatures" / "maximum" / "clean-25-page.pdf"


def generate() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = letter
    document = canvas.Canvas(
        str(OUTPUT),
        pagesize=letter,
        pageCompression=1,
        invariant=1,
    )
    document.setAuthor("BorikiPR synthetic test fixture")
    document.setCreator("BorikiPR Phase 2K fixture generator")
    document.setTitle("Synthetic clean 25-page signing fixture")

    for page_number in range(1, 26):
        document.setFillColor(HexColor("#10213F"))
        document.setFont("Helvetica-Bold", 16)
        document.drawString(54, height - 58, f"SYNTHETIC SIGNING TEST - PAGE {page_number:02d} OF 25")
        document.setFont("Helvetica", 9)
        document.drawString(54, height - 76, "TEST / NON-PRODUCTION - no customer or contract content")

        document.setStrokeColor(HexColor("#2E5A9C"))
        document.setLineWidth(0.75)
        document.rect(54, 54, width - 108, height - 132, stroke=1, fill=0)

        document.setFillColor(HexColor("#334155"))
        document.setFont("Helvetica", 10)
        # The signing fixture deliberately reserves the two overlay bands used
        # by the maximum-browser topology. Reference text stays outside those
        # bands so a final render can distinguish geometry drift from source
        # content that was intentionally placed beneath a field.
        for row in (2, 3, 4, 5, 7):
            y = height - 118 - row * 74
            document.drawString(72, y, f"Page {page_number:02d} row {row + 1}: deterministic geometry reference")
            document.setStrokeColor(HexColor("#CBD5E1"))
            document.line(72, y - 12, width - 72, y - 12)

        document.setFillColor(HexColor("#10213F"))
        document.setFont("Helvetica-Bold", 8)
        document.drawString(58, 38, f"P{page_number:02d}-LEFT")
        document.drawRightString(width - 58, 38, f"P{page_number:02d}-RIGHT")
        document.circle(64, height - 98, 3, stroke=1, fill=0)
        document.circle(width - 64, height - 98, 3, stroke=1, fill=0)
        document.showPage()

    document.save()


if __name__ == "__main__":
    generate()
    print(OUTPUT)
