function getCategories(implementationId) {
  if (!implementationId) {
    Logger.log('Erro: ID da implementação não fornecido para buscar categorias.');
    return [];
  }

  const url = `${API_URL}/implementacao/${implementationId}/categorias`; 

  try {
    const response = fetchWithAuth(url, { method: 'GET', headers: { 'ngrok-skip-browser-warning': 'true' } });
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      return JSON.parse(response.getContentText());
    } else if (responseCode === 404) {
      Logger.log('API retornou 404: Nenhuma categoria customizada encontrada.');
      return [];
    } else {
      Logger.log(`Erro ao buscar categorias (Código: ${responseCode}): ${response.getContentText()}`);
      return [];
    }

  } catch (e) {
    Logger.log(`Erro de rede ou parsing ao buscar categorias: ${e}`);
    return [];
  }
}

function createCategory(e) {
  const implementationId = e.parameters.implementationId;

  const categoryName = e.formInput.categoryName;
  const questao = e.formInput.questao;
  const paraQueServe = e.formInput.paraQueServe;

  if (!categoryName) {
    return showCreateCategoryPrompt(e);
  }

  const url = `${API_URL}/implementacao/${implementationId}/categoria`;

  const payload = JSON.stringify({
    nome: categoryName,
    questao: questao,
    paraQueServe: paraQueServe
  });

  try {
    const response = fetchWithAuth(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: payload
    });

    const responseCode = response.getResponseCode();
    const responseBody = JSON.parse(response.getContentText());

    if (responseCode === 201) {
      Logger.log(`Categoria '${categoryName}' criada com sucesso!`);
      return showCategoryManagementPage(e);
    } else {
      Logger.log(`Erro ao criar categoria (${responseCode}): ${responseBody.error}`);
      return showCreateCategoryPrompt(e);
    }

  } catch (err) {
    Logger.log(`Erro de rede ao criar categoria: ${err}`);
    return showCreateCategoryPrompt(e);
  }
}

function deleteCategory(e) {
  const implementationId = e.parameters.implementationId;
  const categoryId = e.parameters.categoryId;

  if (!implementationId || !categoryId) {
    Logger.log('Erro: implementationId ou categoryId não definidos');
    return;
  }

  const url = `${API_URL}/implementacao/${implementationId}/categoria/${categoryId}`;

  try {
    const response = fetchWithAuth(url, { method: 'DELETE', headers: { 'ngrok-skip-browser-warning': 'true' } });
    const responseCode = response.getResponseCode();
    const responseBody = JSON.parse(response.getContentText());

    if (responseCode === 200) {
      Logger.log(`Categoria com ID ${categoryId} eliminada com sucesso!`);

      const labelToRemove = e.parameters.categoryName;
      if (labelToRemove) {
        const threadsWithLabel = GmailApp.search(`label:${labelToRemove}`);
        threadsWithLabel.forEach(thread => {
          thread.removeLabel(GmailApp.getUserLabelByName(labelToRemove));
          thread.addLabel(GmailApp.getUserLabelByName('.Outro'));
        });
        Logger.log(`Todos os emails com a label ${labelToRemove} agora têm a label '.Outro'`);
      }

      const label = GmailApp.getUserLabelByName(labelToRemove);
      if (label) {
        label.deleteLabel();
        Logger.log(`Label ${labelToRemove} removida da lista de labels.`);
      } else {
        Logger.log(`Erro: Label ${labelToRemove} não encontrada na lista de labels.`);
      }

      return showCategoryManagementPage(String(implementationId));
    } else {
      Logger.log(`Erro ao eliminar categoria (Código: ${responseCode}): ${responseBody.error}`);
    }
  } catch (e) {
    Logger.log(`Erro de rede ao eliminar categoria: ${e}`);
  }
}