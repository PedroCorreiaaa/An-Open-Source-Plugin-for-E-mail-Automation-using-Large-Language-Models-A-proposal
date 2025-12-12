function checkOrCreateImplementation(email) {
  const url = `${API_URL}/${email}`; 
  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_SECRET}`,
      'ngrok-skip-browser-warning': 'true',
    },
    muteHttpExceptions: true,
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
  const createResponse = UrlFetchApp.fetch(API_URL, {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${API_SECRET}`,
   },
    payload: payload,
  });

  const createData = JSON.parse(createResponse.getContentText());
  
  // Assumimos que o JSON retornado é: { implementacao: { id: 123, ... } }
  Logger.log(`Implementação criada ID: ${createData.implementacao.id}`);

  // Retorna o objeto completo da implementação
  return createData.implementacao;
}
