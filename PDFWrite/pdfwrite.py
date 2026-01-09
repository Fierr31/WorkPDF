from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
ancho, alto = landscape(A4)
import io
import os

# Lista de nombres
# nombres = ["Alan Sanchez"]


# Coordenadas donde aparecerá el nombre (ajusta a tu plantilla)
#x_nombre = 480  # Horizontal (desde izquierda)
#y_nombre = 245  # Vertical (desde abajo)

def makeconst(nombres, cord_x, cord_y, input_pagesize, font, size):

    # Crear carpeta de salida
    os.makedirs("Salidas", exist_ok=True)

    if input_pagesize == "A4":
        pagesize_ = landscape(A4)

    for nombre in nombres:
    # Crear un PDF temporal con el nombre
        packet = io.BytesIO()
        # c = canvas.Canvas(packet, pagesize=landscape(A4)) Referencia del input para pagesize
        c = canvas.Canvas(packet, pagesize=pagesize_)

        #c.setFont("Helvetica-Bold", 22) Referencia del input para font
        c.setFont(font, size)
        c.drawCentredString(cord_x, cord_y, nombre)
        c.save()

        # Mover puntero al inicio
        packet.seek(0)

        # Leer ambos PDFs
        plantilla = PdfReader(open("constanciapart.pdf", "rb"))
        nombre_pdf = PdfReader(packet)
        salida = PdfWriter()

        # Tomar la primera página de la plantilla
        pagina = plantilla.pages[0]
        # Fusionar con la del nombre
        pagina.merge_page(nombre_pdf.pages[0])
        salida.add_page(pagina)

        # Guardar PDF final
        archivo_salida = f"Salidas/Constancia_{nombre.replace(' ', '_')}.pdf"
        with open(archivo_salida, "wb") as f:
            salida.write(f)

        print(f"Constancia generada: {archivo_salida}")

    return print("Todas las constancias se han generado correctamente.")