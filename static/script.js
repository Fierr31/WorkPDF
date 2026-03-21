// js/main.js
import { loadFonts, onFontChange } from "./fonts.js";

/* ═══ pdf.js worker setup ═══ */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* ═══ Format dimension map (points → aspect ratio) ═══ */
const FORMAT_MAP = {
  a4_land: { label: "A4 Landscape", w: 842, h: 595 },
  a4_vert: { label: "A4 Vertical",  w: 595, h: 842 },
  oficio:  { label: "Oficio",       w: 612, h: 1008 },
};
const DEFAULT_FORMAT = "a4_land";

/* ═══ DOM refs ═══ */
const pdfInput       = document.getElementById("pdf");
const pdfUploadBox   = document.getElementById("pdf-upload-box");
const pdfStatus      = document.getElementById("pdf-status");
const formatSelect   = document.getElementById("modelo");
const canvas         = document.getElementById("pdf-canvas");
const canvasWrap     = document.getElementById("preview-canvas-wrap");
const placeholder    = document.getElementById("preview-placeholder");
const formatBadge    = document.getElementById("preview-format-badge");
const previewPanel   = document.getElementById("preview-panel");

let currentPdfUrl = null;
let currentPdfDoc = null;

/* ═══ Initialisation ═══ */
document.addEventListener("DOMContentLoaded", () => {
  loadFonts("fonts");

  onFontChange("fonts", font => {
    document.documentElement.style.setProperty("--font-preview", font);
  });

  // Upload on file select
  pdfInput.addEventListener("change", handlePdfSelect);

  // Re-render on format change
  formatSelect.addEventListener("change", () => {
    updateFormatBadge();
    if (currentPdfDoc) renderPage(currentPdfDoc);
  });

  updateFormatBadge();
});

/* ═══ PDF Upload ═══ */
async function handlePdfSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate client-side
  if (file.type !== "application/pdf") {
    setUploadStatus("error", "Solo archivos PDF");
    return;
  }

  setUploadStatus("uploading", "Subiendo…");

  try {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/upload-pdf", { method: "POST", body: form });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al subir");
    }

    const data = await res.json();
    setUploadStatus("uploaded", file.name);
    currentPdfUrl = data.url;

    // Load and render preview
    await loadPdf(data.url);
  } catch (err) {
    setUploadStatus("error", err.message);
  }
}

/* ═══ Upload status indicator ═══ */
function setUploadStatus(state, message) {
  // state: "uploading" | "uploaded" | "error" | ""
  pdfUploadBox.classList.remove("uploading", "uploaded", "error");
  if (state) pdfUploadBox.classList.add(state);

  pdfStatus.textContent = message || "";
  pdfStatus.className = `upload-status ${state}`;
}

/* ═══ PDF Loading & Rendering ═══ */
async function loadPdf(url) {
  const loadingTask = pdfjsLib.getDocument(url);
  currentPdfDoc = await loadingTask.promise;
  renderPage(currentPdfDoc);
}

async function renderPage(pdfDoc) {
  const page = await pdfDoc.getPage(1);

  // Determine desired aspect ratio from selected format
  const fmt = FORMAT_MAP[formatSelect.value] || FORMAT_MAP[DEFAULT_FORMAT];

  // Calculate scale so the canvas fills the preview container width
  const containerWidth = canvasWrap.clientWidth - 32; // padding
  const aspectRatio = fmt.h / fmt.w;
  const displayWidth = Math.min(containerWidth, 720);
  const displayHeight = displayWidth * aspectRatio;

  // Use the pdf page's own viewport to calculate a matching scale
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = displayWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  // Set canvas size
  canvas.width  = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width  = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Show canvas, hide placeholder
  placeholder.style.display = "none";
  canvas.style.display = "block";
  previewPanel.classList.add("active");
}

/* ═══ Format badge ═══ */
function updateFormatBadge() {
  const fmt = FORMAT_MAP[formatSelect.value] || FORMAT_MAP[DEFAULT_FORMAT];
  formatBadge.textContent = fmt.label;
}
