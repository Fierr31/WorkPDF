from flask import Flask, request, render_template
from werkzeug.utils import secure_filename
from PDFWrite.pdfwrite import makeconst

app = Flask("WorkPDF")


@app.route("/")
def home():
    return render_template("index.html")

@app.route("/uploadPDF", methods=["POST"])
def upload_pdf():
    file = request.files["pdf"]
    filename = secure_filename(file.filename)
    path = os.path.join(UPLOAD_FOLDER, filename)

    file.save(path)

    resultado = modificar_pdf(
        plantilla_path=path,
        variable_a=10
    )

@app.route("/uploadLists")
def uplpoad_lists():

    return