function getGeneratedResponse(implementationId, threadId, messageId) {
  const url = `${API_URL}/implementacao/${implementationId}/thread/${threadId}/email/${messageId}/resposta`;

  try {
    const response = fetchWithAuth(url, {
      method: 'GET',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });

    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      try {
        return JSON.parse(response.getContentText());
      } catch (e) {
        Logger.log("Erro ao processar JSON da resposta gerada: " + e);
        return null;
      }
    } else {
      Logger.log(`Erro ao buscar resposta gerada: ${responseCode}`);
      return null;
    }

  } catch (e) {
    Logger.log(`Erro de rede ao buscar resposta gerada: ${e}`);
    return null;
  }
}
