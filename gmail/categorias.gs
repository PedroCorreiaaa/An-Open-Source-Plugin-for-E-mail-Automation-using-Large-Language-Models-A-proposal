function getCategories(implementationId) {
    if (!implementationId) {
        Logger.log('Erro: ID da implementação não fornecido para buscar categorias.');
        return [];
    }

    const url = `${API_URL}/${implementationId}/categorias`; 

    try {
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


// Função de criação de categoria
function createCategory(e) {
  const implementationId = e.parameters.implementationId;
  const categoryName = e.formInput.categoryName;

  if (!categoryName) {
    // Se não for fornecido o nome da categoria, pode-se retornar um erro
    return showCreateCategoryPrompt(e); // Exibir novamente o prompt para tentar novamente
  }

  const url = `${API_URL}/${implementationId}/categoria`;

  const payload = JSON.stringify({
    nome: categoryName, // Enviar o nome da categoria
  });

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_SECRET}`,
        'Content-Type': 'application/json',
      },
      payload: payload,
      muteHttpExceptions: true,
    });

    const responseCode = response.getResponseCode();
    const responseBody = JSON.parse(response.getContentText());

    if (responseCode === 201) {
      Logger.log(`Categoria '${categoryName}' criada com sucesso!`);
      return showCategoryManagementPage(e); // Atualiza a página de categorias
    } else {
      Logger.log(`Erro ao criar categoria (Código: ${responseCode}): ${responseBody.error}`);
      // Exibir erro ao utilizador
      return showCreateCategoryPrompt(e); // Exibir novamente o prompt
    }
  } catch (e) {
    Logger.log(`Erro de rede ao criar categoria: ${e}`);
    // Exibir erro ao utilizador
    return showCreateCategoryPrompt(e); // Exibir novamente o prompt
  }
}

function deleteCategory(e) {
  // Verificar os parâmetros
  Logger.log('Parametros recebidos: ', e.parameters);
  
  const implementationId = e.parameters.implementationId;
  const categoryId = e.parameters.categoryId;

  
  if (!implementationId || !categoryId) {
    Logger.log('Erro: implementationId ou categoryId não definidos');
    return;  // Impede que a execução continue se os parâmetros estiverem ausentes
  }

  const url = `${API_URL}/${implementationId}/categoria/${categoryId}`;

  try {
    // 1. Deletar a categoria
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
      Logger.log(`Categoria com ID ${categoryId} eliminada com sucesso!`);
      
      // 2. Buscar emails que possuem a label associada a esta categoria
      const labelToRemove = e.parameters.categoryName;
      
      if (labelToRemove) {
        // 3. Buscar os emails que têm essa label
        const threadsWithLabel = GmailApp.search(`label:${labelToRemove}`);

        // 4. Remover a label antiga e adicionar a nova label ".Outro"
        threadsWithLabel.forEach(thread => {
          // Remover a label antiga
          thread.removeLabel(GmailApp.getUserLabelByName(labelToRemove));
          
          // Adicionar a label ".Outro"
          thread.addLabel(GmailApp.getUserLabelByName('.Outro'));
        });
      
        Logger.log(`Todos os emails com a label ${labelToRemove} agora têm a label '.Outro'`);
      } else {
        Logger.log(`Erro: Label da categoria não encontrada.`);
      }
      const label = GmailApp.getUserLabelByName(labelToRemove);
      if (label) {
        label.deleteLabel();  // Remove a label da lista de labels
        Logger.log(`Label ${labelToRemove} removida da lista de labels.`);
      } else {
        Logger.log(`Erro: Label ${labelToRemove} não encontrada na lista de labels.`);
      }
      // 5. Atualiza a página de categorias após a exclusão
      return showCategoryManagementPage(String(implementationId));  // Atualiza a página de categorias
    } else {
      Logger.log(`Erro ao eliminar categoria (Código: ${responseCode}): ${responseBody.error}`);
      // Exibir erro ao utilizador
    }
  } catch (e) {
    Logger.log(`Erro de rede ao eliminar categoria: ${e}`);
    // Exibir erro ao utilizador
  }
}

