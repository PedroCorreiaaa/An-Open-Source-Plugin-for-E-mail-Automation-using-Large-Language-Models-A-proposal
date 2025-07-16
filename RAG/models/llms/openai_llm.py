from langchain_openai import ChatOpenAI
import os

def get_openai_llm():
    """Devolve um modelo de chat OpenAI com a API Key do .env."""
    return ChatOpenAI(openai_api_key=os.getenv("OPENAI_API_KEY"))
