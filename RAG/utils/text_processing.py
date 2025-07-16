from langchain.text_splitter import RecursiveCharacterTextSplitter
from config.config import CHUNK_SIZE_OPENAI, CHUNK_OVERLAP_OPENAI, CHUNK_SIZE_OLLAMA, CHUNK_OVERLAP_OLLAMA

def get_text_chunks_openai(text_with_page_info):
    chunk_size = CHUNK_SIZE_OPENAI
    chunk_overlap = CHUNK_OVERLAP_OPENAI
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    all_chunks = []
    for item in text_with_page_info:
        # Adicionando filename no dicionário de cada chunk
        filename = item.get('filename', 'Unknown')  # O 'filename' vem de text_with_page_info
        chunks = splitter.split_text(item['text'])
        for chunk in chunks:
            all_chunks.append({
                'text': chunk,
                'page': item['page'],
                'filename': filename  # Inclui o 'filename' no chunk
            })
    return all_chunks

def get_text_chunks_ollama(text_with_page_info):
    chunk_size = CHUNK_SIZE_OLLAMA
    chunk_overlap = CHUNK_OVERLAP_OLLAMA
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    all_chunks = []
    for item in text_with_page_info:
        # Adicionando filename no dicionário de cada chunk
        filename = item.get('filename', 'Unknown')  # O 'filename' vem de text_with_page_info
        chunks = splitter.split_text(item['text'])
        for chunk in chunks:
            all_chunks.append({
                'text': chunk,
                'page': item['page'],
                'filename': filename  # Inclui o 'filename' no chunk
            })
    return all_chunks
