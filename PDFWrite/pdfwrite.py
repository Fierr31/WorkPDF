from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, portrait, A4, legal
import io
import os

# Mapa de formatos soportados (coincide con las opciones del frontend)
PAGESIZE_MAP = {
    "a4_land": landscape(A4),
    "a4_vert": portrait(A4),
    "oficio":  legal,
}

# Mapa de fuentes del navegador → fuentes incorporadas de ReportLab
FONT_MAP = {
    "Arial":           "Helvetica-Bold",
    "Verdana":         "Helvetica-Bold",
    "Georgia":         "Times-Bold",
    "Times New Roman": "Times-Bold",
    "Courier New":     "Courier-Bold",
}


def makeconst(nombres, cord_x, cord_y, input_pagesize, font, size,
              plantilla_path="constanciapart.pdf", output_dir="Salidas"):
    """
    Genera una constancia PDF por cada nombre de la lista,
    fusionando el texto sobre la plantilla dada.

    Parámetros:
        nombres         – list[str] de nombres a imprimir.
        cord_x, cord_y  – coordenadas para drawCentredString (puntos PDF).
        input_pagesize  – clave del formato ("a4_land", "a4_vert", "oficio").
        font            – nombre del font para ReportLab.
        size            – tamaño del font en puntos.
        plantilla_path  – ruta al PDF plantilla.
        output_dir      – carpeta donde se guardan los PDFs generados.

    Retorna:
        list[str] – rutas de los archivos generados.
    """
    os.makedirs(output_dir, exist_ok=True)

    pagesize_ = PAGESIZE_MAP.get(input_pagesize, landscape(A4))
    rl_font = FONT_MAP.get(font, "Helvetica-Bold")

    archivos_generados = []

    for nombre in nombres:
        # Crear un PDF temporal con el nombre
        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=pagesize_)
        c.setFont(rl_font, size)
        c.drawCentredString(cord_x, cord_y, nombre)
        c.save()

        # Mover puntero al inicio
        packet.seek(0)

        # Leer ambos PDFs
        with open(plantilla_path, "rb") as f:
            plantilla = PdfReader(f)
            nombre_pdf = PdfReader(packet)
            salida = PdfWriter()

            # Tomar la primera página de la plantilla
            pagina = plantilla.pages[0]
            # Fusionar con la del nombre
            pagina.merge_page(nombre_pdf.pages[0])
            salida.add_page(pagina)

            # Guardar PDF final
            safe_name = nombre.replace(' ', '_').replace('/', '_').replace('\\', '_')
            archivo_salida = os.path.join(output_dir, f"Constancia_{safe_name}.pdf")
            with open(archivo_salida, "wb") as out:
                salida.write(out)

        archivos_generados.append(archivo_salida)
        print(f"Constancia generada: {archivo_salida}")

    print(f"Todas las constancias se han generado correctamente ({len(archivos_generados)}).")
    return archivos_generados