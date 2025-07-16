from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from utils.vector_store import load_vector_store
from models.llms.openai_llm import get_openai_llm
from models.llms.ollama_llm import get_ollama_llm

def get_conversational_chain(model_name):
    """
    Cria uma cadeia RetrievalQA com FAISS retriever e um prompt personalizado
    para gerar respostas automáticas em português, no formato padronizado de
    email institucional da Câmara Municipal de Viana do Castelo.
    """

    prompt_template = PromptTemplate(
        template="""Com base no contexto abaixo, redija uma resposta automática em formato de email institucional da Câmara Municipal de Viana do Castelo.

    A resposta deve seguir obrigatoriamente a estrutura abaixo, com linguagem formal, clara e objetiva.
    A resposta deve ser escrita em português europeu (Portugal), com vocabulário, ortografia e construções gramaticais próprias de Portugal.
    Se a resposta não estiver no contexto, escreva: "A resposta não está disponível no contexto." Não invente informações.

    Formato do email (não altere):

    Exmo./a Sr./a,

    [corpo da resposta baseado no contexto]

    Com os melhores cumprimentos,  
    Câmara Municipal de Viana do Castelo

    Contexto:
    {context}

    Pergunta:
    {question}

    Email de resposta:
    """,
        input_variables=["context", "question"]
    )


    if model_name == "openai":
        model = get_openai_llm()
    elif model_name == "ollama":
        model = get_ollama_llm()
    else:
        raise ValueError(f"Modelo desconhecido: {model_name}")

    retriever = load_vector_store(model_name).as_retriever()

    return RetrievalQA.from_chain_type(
        llm=model,
        chain_type="stuff",
        retriever=retriever,
        chain_type_kwargs={"prompt": prompt_template},
        return_source_documents=True
    )
