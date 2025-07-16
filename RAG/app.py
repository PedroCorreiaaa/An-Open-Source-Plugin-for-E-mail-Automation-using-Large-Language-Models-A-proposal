import os
from flask import Flask, render_template, request, jsonify, send_from_directory
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from utils.pdf_processing import get_pdf_text_with_page_info
from utils.text_processing import get_text_chunks_openai, get_text_chunks_ollama
from utils.vector_store import get_vector_store, check_vector_store_exists
from models.retriever.faiss_retriever import get_conversational_chain
from models.llms.openai_llm import get_openai_llm
from models.llms.ollama_llm import get_ollama_llm

load_dotenv()

app = Flask(__name__)

chat_history = []
UPLOAD_FOLDER = "data/raw_pdfs"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

pdf_files = []

@app.route("/")
def index():
    return render_template("index.html", pdf_files=pdf_files)

@app.route("/upload", methods=["POST"])
def upload_files():
    global pdf_files
    if "pdfs" not in request.files:
        return jsonify({"message": "Nenhum arquivo enviado!"}), 400
    files = request.files.getlist("pdfs")
    for file in files:
        if file.filename == "":
            continue
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(filepath)
        if filename not in pdf_files:
            pdf_files.append(filename)
    return jsonify({"message": "PDFs enviados com sucesso!", "pdfs": pdf_files})

@app.route("/process_pdfs", methods=["POST"])
def process_pdfs():
    global pdf_files
    if not pdf_files:
        return jsonify({"message": "Nenhum PDF carregado!"}), 400

    all_text_chunks = []
    all_text_with_info = []

    for filename in pdf_files:
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        with open(filepath, "rb") as f:
            pdf_text_with_info = get_pdf_text_with_page_info([f], filename)
            all_text_with_info.extend(pdf_text_with_info)

    embedding_model = request.form.get("embedding_model", "openai")
    text_chunks = get_text_chunks_openai(all_text_with_info) if embedding_model == "openai" else get_text_chunks_ollama(all_text_with_info)

    for chunk in text_chunks:
        if 'filename' not in chunk:
            chunk['filename'] = filename
        all_text_chunks.append(chunk)

    get_vector_store(all_text_chunks, embedding_model)
    return jsonify({"message": "Processamento concluído!"})

@app.route("/list_pdfs", methods=["GET"])
def list_pdfs():
    return jsonify({"pdfs": pdf_files})

@app.route("/view/<filename>")
def view_pdf(filename):
    return render_template("view_pdf.html", filename=filename)

@app.route("/download/<filename>")
def download_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.route("/chat", methods=["POST"])
def chat():
    user_question = request.json.get("question")
    if not user_question:
        return jsonify({"error": "No question provided"}), 400

    embedding_model = request.json.get("embedding_model", "openai")
    use_rag = bool(int(request.json.get("use_rag", 0)))

    try:
        if use_rag and check_vector_store_exists(embedding_model):
            chain = get_conversational_chain(embedding_model)
            response = chain.invoke({"query": user_question})
            answer = response["result"] if response else "I couldn't find a specific answer in the PDFs."
            source_documents = response.get("source_documents", [])
            sources = [
                {"filename": doc.metadata.get('filename'), "page": doc.metadata.get('page')}
                for doc in source_documents if doc.metadata.get('filename') and doc.metadata.get('page')
            ]
        else:
            model = get_openai_llm() if embedding_model == "openai" else get_ollama_llm()
            answer = model.invoke(user_question)
            answer = answer.content if hasattr(answer, 'content') else str(answer)
            sources = []
    except Exception as e:
        answer = f"An error occurred: {str(e)}"
        sources = []

    chat_history.append({"role": "user", "content": user_question})
    chat_history.append({"role": "assistant", "content": answer})

    return jsonify({"response": answer, "chat_history": chat_history, "sources": sources})

@app.route("/query_rag", methods=["POST"])
def query_rag():
    data = request.get_json()
    question = data.get("question")
    model = data.get("embedding_model", "ollama")

    if not question:
        return jsonify({"error": "Pergunta ausente"}), 400

    try:
        if not check_vector_store_exists(model):
            return jsonify({"error": "Base vetorial não processada para este modelo."}), 400

        chain = get_conversational_chain(model)
        response = chain.invoke({"query": question})
        answer = response["result"]
        source_documents = response.get("source_documents", [])
        sources = [
            {"filename": doc.metadata.get('filename'), "page": doc.metadata.get('page')}
            for doc in source_documents if doc.metadata.get('filename') and doc.metadata.get('page')
        ]
        return jsonify({"response": answer, "sources": sources})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def auto_process_pdfs_on_startup():
    embedding_model = os.environ.get("DEFAULT_EMBEDDING_MODEL", "ollama")
    if check_vector_store_exists(embedding_model):
        print(f"[INFO] Vector store já existe para o modelo '{embedding_model}', não é necessário reprocessar.")
        return
    print(f"[INFO] Vector store não encontrado. Iniciando processamento automático dos PDFs...")
    all_text_with_info = []
    raw_pdf_folder = app.config["UPLOAD_FOLDER"]
    pdf_files_on_disk = [f for f in os.listdir(raw_pdf_folder) if f.endswith(".pdf")]
    if not pdf_files_on_disk:
        print("[AVISO] Nenhum PDF encontrado em data/raw_pdfs/.")
        return
    for filename in pdf_files_on_disk:
        filepath = os.path.join(raw_pdf_folder, filename)
        with open(filepath, "rb") as f:
            text_with_info = get_pdf_text_with_page_info([f], filename)
            all_text_with_info.extend(text_with_info)
    if not all_text_with_info:
        print("[AVISO] Nenhum conteúdo extraído dos PDFs.")
        return
    if embedding_model == "openai":
        text_chunks = get_text_chunks_openai(all_text_with_info)
    else:
        text_chunks = get_text_chunks_ollama(all_text_with_info)
    for chunk in text_chunks:
        chunk['filename'] = chunk.get('filename', filename)
    get_vector_store(text_chunks, embedding_model)
    print(f"[✅] Vector store criado com sucesso para o modelo '{embedding_model}'.")

if __name__ == "__main__":
    auto_process_pdfs_on_startup()
    app.run(debug=True)