from langchain_openai import OpenAIEmbeddings
import os

def get_openai_embeddings():
    return OpenAIEmbeddings(openai_api_key=os.getenv("OPENAI_API_KEY"))