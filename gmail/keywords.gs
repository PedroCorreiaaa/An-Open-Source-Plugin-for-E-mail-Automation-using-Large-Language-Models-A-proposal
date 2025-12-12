function getKeywords(implementationId, categoryId) {
  const url = `${API_URL}/${implementationId}/categoria/${categoryId}/keywords`;
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
    const responseBody = JSON.parse(response.getContentText());
    return responseBody;  // Retorna as keywords
  } else {
    Logger.log(`Erro ao buscar keywords: ${responseCode}`);
    return [];
  }
}


function adicionarKeyword(e) {
  const novaKeyword = e.formInput.novaKeyword;
  const categoryId = e.parameters.categoryId;
  const implementationId = e.parameters.implementationId;

  if (!novaKeyword) {
    Logger.log("Campo 'novaKeyword' está vazio");
    return;
  }

  const url = `${API_URL}/${implementationId}/categoria/${categoryId}/keyword`;

  const payload = JSON.stringify({
    keyword: novaKeyword
  });

  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_SECRET}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    payload: payload,
    muteHttpExceptions: true,
  });

  const responseCode = response.getResponseCode();
  const responseBody = JSON.parse(response.getContentText());

  if (responseCode === 200) {
    Logger.log(`Palavra-chave '${novaKeyword}' adicionada com sucesso!`);
    showCategoryKeywordManager(e);
  } else {
    Logger.log(`Erro ao adicionar palavra-chave: ${responseBody.error}`);
  }
}



// Função para remover uma keyword
function removerKeyword(e) {
  const categoryId = e.parameters.categoryId;
  const keywordId = e.parameters.keywordId;
  const implementationId = e.parameters.implementationId;

  const url = `${API_URL}/${implementationId}/categoria/${categoryId}/keyword/${keywordId}`;

  const response = UrlFetchApp.fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${API_SECRET}`,
      'ngrok-skip-browser-warning': 'true',
    },
    muteHttpExceptions: true,
  });

  const responseCode = response.getResponseCode();
  const responseBody = JSON.parse(response.getContentText());

  if (responseCode === 200) {
    Logger.log(`Keyword com ID ${keywordId} removida com sucesso!`);
    showCategoryKeywordManager(e);
  } else {
    Logger.log(`Erro ao remover keyword: ${responseBody.error}`);
  }
}
