import os
from langchain_community.vectorstores import FAISS
from models.embeddings.openai_embeddings import get_openai_embeddings
from models.embeddings.ollama_embeddings import get_ollama_embeddings

def get_vector_store(chunks, model):
    """Cria um vetor store FAISS com embeddings."""
    if model == "openai":
        embeddings = get_openai_embeddings()
        vector_store_dir = "data/faiss_index_openai"
    else:
        embeddings = get_ollama_embeddings()
        vector_store_dir = "data/faiss_index_ollama"

    # Garante que o diretório existe
    os.makedirs(vector_store_dir, exist_ok=True)

    # Garante que o subdiretório 'index' existe
    index_dir = os.path.join(vector_store_dir, "index")
    os.makedirs(index_dir, exist_ok=True)

    if isinstance(chunks[0], dict):
        texts = [chunk['text'] for chunk in chunks]
        metadatas = [{'page': chunk['page'], 'filename': chunk['filename']} for chunk in chunks]
    else:
        texts = chunks
        metadatas = None

    vector_store = FAISS.from_texts(texts, embedding=embeddings, metadatas=metadatas)
    vector_store.save_local(index_dir)  # Salva dentro da pasta 'index'
    return vector_store

def check_vector_store_exists(model):
    """Checks if the vector store directory and index file exist for the given model."""
    if model == "openai":
        vector_store_dir = "data/faiss_index_openai/index"
        index_file = os.path.join(vector_store_dir, "index.faiss")
    elif model == "ollama":
        vector_store_dir = "data/faiss_index_ollama/index"
        index_file = os.path.join(vector_store_dir, "index.faiss")
    else:
        return False

    return os.path.exists(vector_store_dir) and os.path.isdir(vector_store_dir) and os.path.exists(index_file)

def load_vector_store(model):
    """Carrega o vetor store FAISS do diretório correto baseado no modelo."""
    if model == "openai":
        embeddings = get_openai_embeddings()
        vector_store_dir = "data/faiss_index_openai" 
    elif model == "ollama":
        embeddings = get_ollama_embeddings()
        vector_store_dir = "data/faiss_index_ollama" 
    else:
        raise ValueError(f"Modelo desconhecido: {model}")

    if not os.path.exists(vector_store_dir):
        raise FileNotFoundError(f"O diretório {vector_store_dir} não existe.")

    index_dir = os.path.join(vector_store_dir, "index")

    if not os.path.isdir(index_dir):
        raise FileNotFoundError(f"O diretório {index_dir} não existe.")

    return FAISS.load_local(index_dir, embeddings, allow_dangerous_deserialization=True)