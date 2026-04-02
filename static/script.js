// js/main.js
import { loadFonts, onFontChange } from "./fonts.js";

/* ═══ pdf.js worker setup ═══ */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* ═══ Format dimension map (points → aspect ratio) ═══ */
const FORMAT_MAP = {
  a4_land: { label: "A4 Landscape", w: 842, h: 595 },
  a4_vert: { label: "A4 Vertical", w: 595, h: 842 },
  oficio: { label: "Oficio", w: 612, h: 1008 },
};
const DEFAULT_FORMAT = "a4_land";

/* ═══ DOM refs ═══ */
const pdfInput = document.getElementById("pdf");
const listInput = document.getElementById("listas");
const pdfUploadBox = document.getElementById("pdf-upload-box");
const pdfStatus = document.getElementById("pdf-status");
const listUploadBox = document.getElementById("list-upload-box");
const listStatus = document.getElementById("list-status");
const formatSelect = document.getElementById("modelo");
const canvas = document.getElementById("pdf-canvas");
const canvasWrap = document.getElementById("preview-canvas-wrap");
const placeholder = document.getElementById("preview-placeholder");
const formatBadge = document.getElementById("preview-format-badge");
const previewPanel = document.getElementById("preview-panel");
const coordX = document.getElementById("X");
const coordY = document.getElementById("Y");
const fontSelect = document.getElementById("fonts");
const fontSizeInput = document.getElementById("fontSize");
const btnSubmit = document.getElementById("button_submit");

/* ═══ State ═══ */
let currentPdfUrl = null;
let currentPdfDoc = null;
let currentPdfFilename = null;  // server-side filename for /generate
let firstListName = null;  // first element extracted from the list file
let nombresList = [];     // full list of strings for makeconst
let overlayCanvas = null;   // overlay canvas for cursor + text
let overlayCtx = null;
let cursorAnimId = null;   // requestAnimationFrame id for blinking cursor
let lastRenderInfo = null;   // { scale, pageW, pageH } saved from last render

/* ═══ Initialisation ═══ */
document.addEventListener("DOMContentLoaded", () => {
  loadFonts("fonts");

  onFontChange("fonts", font => {
    document.documentElement.style.setProperty("--font-preview", font);
    drawOverlay();                 // redraw overlay with new font
  });

  // Create the overlay canvas (sits on top of pdf-canvas)
  createOverlayCanvas();

  // Upload on file select
  pdfInput.addEventListener("change", handlePdfSelect);

  // List file upload
  listInput.addEventListener("change", handleListSelect);

  // Re-render on format change
  formatSelect.addEventListener("change", () => {
    updateFormatBadge();
    if (currentPdfDoc) renderPage(currentPdfDoc);
  });

  // Re-draw overlay when coordinates or font size change
  coordX.addEventListener("input", drawOverlay);
  coordY.addEventListener("input", drawOverlay);
  fontSizeInput.addEventListener("input", drawOverlay);

  // Generate & download
  btnSubmit.addEventListener("click", handleGenerate);

  updateFormatBadge();
});

/* ═══ Overlay Canvas Setup ═══ */
function createOverlayCanvas() {
  overlayCanvas = document.createElement("canvas");
  overlayCanvas.id = "overlay-canvas";
  overlayCanvas.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    pointer-events: none;
    border-radius: var(--radius-sm);
  `;
  canvasWrap.style.position = "relative";
  canvasWrap.appendChild(overlayCanvas);
}

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
    currentPdfFilename = data.filename;  // save for /generate

    // Load and render preview
    await loadPdf(data.url);
  } catch (err) {
    setUploadStatus("error", err.message);
  }
}

/* ═══ List File Upload ═══ */
async function handleListSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  setListStatus("uploading", "Subiendo…");

  try {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/upload-list", { method: "POST", body: form });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al subir lista");
    }

    const data = await res.json();
    nombresList = data.nombres;
    firstListName = data.first_element;
    setListStatus("uploaded", `${file.name} (${data.count} nombres)`);
    drawOverlay();
  } catch (err) {
    console.error("Error al subir lista:", err);
    setListStatus("error", err.message);
    nombresList = [];
    firstListName = null;
  }
}

/* ═══ List status indicator ═══ */
function setListStatus(state, message) {
  listUploadBox.classList.remove("uploading", "uploaded", "error");
  if (state) listUploadBox.classList.add(state);
  listStatus.textContent = message || "";
  listStatus.className = `upload-status ${state}`;
}

/* ═══ Upload status indicator ═══ */
function setUploadStatus(state, message) {
  // state: "uploading" | "uploaded" | "error" | ""
  pdfUploadBox.classList.remove("uploading", "uploaded", "error");
  if (state) pdfUploadBox.classList.add(state);

  pdfStatus.textContent = message || "";
  pdfStatus.className = `upload-status ${state}`;
}

/* ═══ Generate & Download ═══ */
async function handleGenerate() {
  // Validate all inputs
  if (!currentPdfFilename) {
    alert("Sube un PDF plantilla primero.");
    return;
  }
  if (!nombresList.length) {
    alert("Sube un archivo de listas (CSV o XLSX) con los nombres.");
    return;
  }

  const cordXVal = parseFloat(coordX.value);
  const cordYVal = parseFloat(coordY.value);
  if (isNaN(cordXVal) || isNaN(cordYVal)) {
    alert("Ingresa las coordenadas X e Y.");
    return;
  }

  const font = fontSelect.value || "Arial";
  const size = Math.max(6, Math.min(120, parseInt(fontSizeInput.value) || 22));
  const formato = formatSelect.value;

  if (!formato) {
    alert("Por favor selecciona un formato de la lista para continuar.");
    return;
  }

  // Show loading state
  const originalText = btnSubmit.textContent;
  btnSubmit.textContent = "Generando…";
  btnSubmit.disabled = true;

  try {
    const res = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombres: nombresList,
        cord_x: cordXVal,
        cord_y: cordYVal,
        formato,
        font,
        size,
        pdf_filename: currentPdfFilename,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al generar");
    }

    // Trigger download from the response blob
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Constancias.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    btnSubmit.textContent = originalText;
    btnSubmit.disabled = false;
  }
}

/* ═══ PDF Loading & Rendering ═══ */
async function loadPdf(url) {
  const loadingTask = pdfjsLib.getDocument(url);
  currentPdfDoc = await loadingTask.promise;
  renderPage(currentPdfDoc);
}

async function renderPage(pdfDoc) {
  const page = await pdfDoc.getPage(1);

  // Use the pdf page's own viewport to calculate a matching scale
  const baseViewport = page.getViewport({ scale: 1 });

  // Determine desired aspect ratio from selected format, or fallback to native PDF ratio
  const fmt = FORMAT_MAP[formatSelect.value];
  const aspectRatio = fmt ? (fmt.h / fmt.w) : (baseViewport.height / baseViewport.width);

  // Calculate scale so the canvas fills the preview container width
  const containerWidth = canvasWrap.clientWidth - 32; // padding
  const displayWidth = Math.min(containerWidth, 720);
  const displayHeight = displayWidth * aspectRatio;

  const scale = displayWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  // Set canvas size
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Save render info for the overlay coordinate mapping
  lastRenderInfo = {
    scale,
    pageW: baseViewport.width,    // PDF native page width in points
    pageH: baseViewport.height,   // PDF native page height in points
    displayWidth,
    displayHeight,
    canvasW: viewport.width,
    canvasH: viewport.height,
  };

  // Size the overlay canvas to match
  overlayCanvas.width = viewport.width;
  overlayCanvas.height = viewport.height;
  overlayCanvas.style.width = `${displayWidth}px`;
  overlayCanvas.style.height = `${displayHeight}px`;

  // Position overlay exactly on top of pdf-canvas
  overlayCanvas.style.top = canvas.offsetTop + "px";
  overlayCanvas.style.left = canvas.offsetLeft + "px";

  // Show canvas, hide placeholder
  placeholder.style.display = "none";
  canvas.style.display = "block";
  overlayCanvas.style.display = "block";
  previewPanel.classList.add("active");

  drawOverlay();
}

/* ═══ Overlay: Cursor + Text ═══ *
 *
 * ReportLab's drawCentredString(cord_x, cord_y, text) uses PDF coordinate
 * space: origin at bottom-left, Y grows upward, units in points.
 *
 * The preview canvas has origin at top-left, Y grows downward.
 * Conversion:
 *   canvas_x = cord_x * scale
 *   canvas_y = (pageH - cord_y) * scale
 *
 * "CentredString" means the text is centred horizontally on cord_x.
 */
function drawOverlay() {
  if (!lastRenderInfo || !overlayCanvas) return;

  const ctx = overlayCanvas.getContext("2d");
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  // Cancel any running cursor blink
  if (cursorAnimId) cancelAnimationFrame(cursorAnimId);

  // Don't draw text/cursor until a format has been selected
  if (!formatSelect.value) return;

  const cordX = parseFloat(coordX.value);
  const cordY = parseFloat(coordY.value);
  if (isNaN(cordX) || isNaN(cordY)) return;

  const { scale, pageH } = lastRenderInfo;

  // Convert ReportLab coordinates → canvas coordinates
  // Y_CORRECTION: compensates the rendering offset between pdf.js
  // and ReportLab's drawCentredString (empirically measured at 8 pts).
  const Y_CORRECTION = 8;
  const cx = cordX * scale;
  const cy = (pageH - cordY + Y_CORRECTION) * scale;

  // Determine font for preview — fontSize in PDF points, same as makeconst's `size`
  const selectedFont = fontSelect.value || "Arial";
  const fontSize = Math.max(6, Math.min(120, parseInt(fontSizeInput.value) || 22));
  const scaledFontSize = fontSize * scale;

  if (firstListName) {
    // ── Draw text (centred on cx, like drawCentredString) ──
    ctx.save();
    ctx.font = `bold ${scaledFontSize}px "${selectedFont}", sans-serif`;
    ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(firstListName, cx, cy);

    // Measure text to place cursor after
    const textWidth = ctx.measureText(firstListName).width;
    const cursorX = cx + textWidth / 2 + 2;
    ctx.restore();

    // Blinking cursor after text
    startCursorBlink(ctx, cursorX, cy, scaledFontSize);
  } else {
    // ── No text: just show blinking cursor at coordinates ──
    startCursorBlink(ctx, cx, cy, scaledFontSize);
  }
}

/* ═══ Blinking Cursor Animation ═══ */
function startCursorBlink(ctx, x, y, fontHeight) {
  const cursorH = fontHeight * 1.1;
  const cursorW = 2;
  let lastToggle = performance.now();
  let visible = true;

  function animate(now) {
    // Toggle every 530ms
    if (now - lastToggle > 530) {
      visible = !visible;
      lastToggle = now;
    }

    // Clear only the cursor region (with extra margin)
    ctx.clearRect(x - 4, y - cursorH - 4, cursorW + 8, cursorH + 8);

    if (visible) {
      ctx.save();
      ctx.fillStyle = "#dc2626";
      ctx.shadowColor = "rgba(220, 38, 38, 0.6)";
      ctx.shadowBlur = 6;
      // Draw cursor line
      ctx.fillRect(x, y - cursorH + 4, cursorW, cursorH);
      ctx.restore();
    }

    cursorAnimId = requestAnimationFrame(animate);
  }

  cursorAnimId = requestAnimationFrame(animate);
}

/* ═══ Format badge ═══ */
function updateFormatBadge() {
  const fmt = FORMAT_MAP[formatSelect.value];
  formatBadge.textContent = fmt ? fmt.label : "Original";
}
