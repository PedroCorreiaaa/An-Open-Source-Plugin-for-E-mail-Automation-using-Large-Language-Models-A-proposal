function checkOrCreateImplementation(email) {
  const url = `${API_URL}/implementacao/${email}`; 
  const response = fetchWithAuth(url, {
    method: 'GET',
    headers: {
      'ngrok-skip-browser-warning': 'true',
    }
  });

  const responseCode = response.getResponseCode();

  if (responseCode === 200) {
    try {
      const contentText = response.getContentText();
      return JSON.parse(contentText); // Deve retornar {id: 123, ...}
    } catch (e) {
      Logger.log(`Erro ao fazer o parsing do JSON (código 200): ${e}`);
      return null; 
    }
  } else if (responseCode === 404) {
    return createImplementation(email);
  } else {
    Logger.log(`Erro ao verificar a implementação: ${responseCode}`);
    return null;
  }
}



function createImplementation(email) {
  const payload = JSON.stringify({ email });
  const createResponse = fetchWithAuth(`${API_URL}/implementacao`, {
    method: 'POST',
    contentType: 'application/json',
    payload: payload
  });

  const createData = JSON.parse(createResponse.getContentText());
  
  // Assumimos que o JSON retornado é: { implementacao: { id: 123, ... } }
  Logger.log(`Implementação criada ID: ${createData.implementacao.id}`);

  // Retorna o objeto completo da implementação
  return createData.implementacao;
}
