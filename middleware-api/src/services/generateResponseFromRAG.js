import axios from "axios";  // Se você estiver usando ES Modules

async function generateResponseFromRAG(emailContent) {
    try {
        const payload = {
            question: emailContent,
            embedding_model: "ollama"
        };

        const response = await axios.post(
            "http://127.0.0.1:5000/query_rag",
            payload
        );

        const json = response.data;

        if (json.error) {
            console.error("Erro do RAG:", json);
            return "⚠️ Não foi possível obter uma resposta baseada nos PDFs.";
        }

        let respostaGerada = json.response;
        const sources = json.sources || [];

        if (sources.length > 0) {
            const fontesTexto = sources
                .map(s => `- ${s.filename}, página ${s.page}`)
                .join("\n");

            respostaGerada += `\n\nFontes consultadas:\n${fontesTexto}`;
        }

        return respostaGerada;

    } catch (e) {
        console.error("Erro ao contactar RAG:", e.toString());
        return "⚠️ Erro ao contactar o sistema RAG.";
    }
}

export default generateResponseFromRAG; 
