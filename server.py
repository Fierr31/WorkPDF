"""
WorkPDF — FastAPI server
Serves the SPA, handles PDF upload, and exposes uploaded files for preview.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
import uuid

# ── Paths ──────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ── App ────────────────────────────────────────────────
app = FastAPI(title="WorkPDF")

# Static files (css, js, fonts)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

# Serve uploaded PDFs so the frontend can fetch them for preview
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# ── Routes ─────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve the main page."""
    html_path = BASE_DIR / "templates" / "index.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Receive a PDF file, save it with a unique name, and return the URL
    so the frontend can render a preview with pdf.js.
    """
    # Validate content type
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos PDF.")

    # Generate a unique filename to avoid collisions
    ext = Path(file.filename).suffix or ".pdf"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / unique_name

    # Save file
    with open(dest, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    return {
        "ok": True,
        "filename": unique_name,
        "url": f"/uploads/{unique_name}",
    }


# ── Run ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=3900, reload=True)
