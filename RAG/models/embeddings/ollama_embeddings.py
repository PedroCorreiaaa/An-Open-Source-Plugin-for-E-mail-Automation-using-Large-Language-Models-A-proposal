from langchain_ollama.embeddings import OllamaEmbeddings

def get_ollama_embeddings():
    return OllamaEmbeddings(model="nomic-embed-text")