function getKeywords(implementationId, categoryId) {
  const url = `${API_URL}/implementacao/${implementationId}/categoria/${categoryId}/keywords`;
  const response = fetchWithAuth(url, {
    method: 'GET',
    headers: {
      'ngrok-skip-browser-warning': 'true'
    }
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

  const url = `${API_URL}/implementacao/${implementationId}/categoria/${categoryId}/keyword`;

  const payload = JSON.stringify({ keyword: novaKeyword });

  const response = fetchWithAuth(url, {
    method: 'POST',
    contentType: 'application/json',
    payload: payload,
    headers: {
      'ngrok-skip-browser-warning': 'true'
    }
  });

  const responseCode = response.getResponseCode();
  const responseBody = JSON.parse(response.getContentText());

  if (responseCode === 200) {
    Logger.log(`Palavra-chave '${novaKeyword}' adicionada com sucesso!`);
    return showCategoryKeywordManager(e);
  } else {
    Logger.log(`Erro ao adicionar palavra-chave: ${responseBody.error}`);
  }
}



function removerKeyword(e) {
  const categoryId = e.parameters.categoryId;
  const keywordId = e.parameters.keywordId;
  const implementationId = e.parameters.implementationId;

  const url = `${API_URL}/implementacao/${implementationId}/categoria/${categoryId}/keyword/${keywordId}`;

  const response = fetchWithAuth(url, {
    method: 'DELETE',
    headers: {
      'ngrok-skip-browser-warning': 'true'
    }
  });

  const responseCode = response.getResponseCode();
  const responseBody = JSON.parse(response.getContentText());

  if (responseCode === 200) {
    Logger.log(`Keyword com ID ${keywordId} removida com sucesso!`);
    return showCategoryKeywordManager(e);
  } else {
    Logger.log(`Erro ao remover keyword: ${responseBody.error}`);
  }
}
