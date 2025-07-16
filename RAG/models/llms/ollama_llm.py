from langchain_ollama import OllamaLLM

def get_ollama_llm():
    """Returns Ollama Chat Model."""
    return OllamaLLM(model="mistral")