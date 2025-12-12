function categorizarEmails(e) {
  let implementationId = e.parameters.implementationId;
  if (typeof implementationId !== 'string') {
    implementationId = String(implementationId);
  }

  const CATEGORIZADO_LABEL = "1. Categorizado";
  const MAX_PROCESS = 20; // <<< LIMITE DE 20 EMAILS
  let processedCount = 0;

  const threads = GmailApp.search("is:unread");

  // Ordenar por antiguidade
  threads.sort((a, b) => a.getLastMessageDate() - b.getLastMessageDate());

  for (const thread of threads) {

    if (processedCount >= MAX_PROCESS) break; // <<< PARAR A EXECUÇÃO

    const alreadyCategorized = thread.getLabels().some(
      label => label.getName() === CATEGORIZADO_LABEL
    );

    if (alreadyCategorized) continue;

    for (const msg of thread.getMessages()) {
      
      if (processedCount >= MAX_PROCESS) break;
      
      processedCount++;

      const content = msg.getPlainBody().trim();
      const subject = msg.getSubject();
      const sender = msg.getFrom();
      const messageId = msg.getId();
      const threadId = thread.getId();

      try {
        const apiResponse = categorizarEmailViaAPI(
          String(implementationId),
          messageId,
          threadId,
          sender,
          subject,
          content
        );

        if (apiResponse && apiResponse.categoria) {
          const category = apiResponse.categoria;

          const categorizadoLabel =
            GmailApp.getUserLabelByName(CATEGORIZADO_LABEL) ||
            GmailApp.createLabel(CATEGORIZADO_LABEL);

          const categoryLabel =
            GmailApp.getUserLabelByName(category) ||
            GmailApp.createLabel(category);

          thread.addLabel(categorizadoLabel);
          thread.addLabel(categoryLabel);
        }
      } catch (error) {
        Logger.log(`Erro ao categorizar o email ${messageId}: ${error.message}`);
      }
    }
  }

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(showHomePage(implementationId)[0]))
    .setNotification(CardService.newNotification()
      .setText(`⏳ Categorização terminada. Processados: ${processedCount} emails.`))
    .build();
}


// Função para chamar o endpoint da API e categorizar o email
function categorizarEmailViaAPI(implementationId, messageId, threadId, sender, subject, content) {
  // Certifique-se de que o implementationId está sendo passado corretamente
  const url = `${API_URL}/${implementationId}/email/${messageId}/categorizar`;
  
  const payload = JSON.stringify({
    message_id: messageId,
    thread_id: threadId,
    remetente: sender,
    assunto: subject,
    corpo: content
  });

  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_SECRET}`,
      'Content-Type': 'application/json',
    },
    payload: payload,
    muteHttpExceptions: true,
  };
  Logger.log(`Enviando requisição para: ${url}`);  // Log da URL antes de enviar a requisição

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const responseBody = JSON.parse(response.getContentText());
      return responseBody;  // Retorna a resposta da API com a categoria
    } else {
      Logger.log(`Erro ao categorizar o email ${messageId}: ${response.getContentText()}`);
      return null;  // Retorna nulo se houver erro
    }
  } catch (error) {
    Logger.log(`Erro de requisição ao categorizar o email ${messageId}: ${error}`);
    return null;  // Retorna nulo se houver exceção
  }
}


function categorizarEmailManualmente(e) {
  const { messageId, id_implementacao } = e.parameters;
  const id_categoria = e.formInput.id_categoria;

  if (!id_categoria) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("Selecione uma categoria antes de guardar.")
      )
      .build();
  }

  const url = `${API_URL}/${id_implementacao}/email/${messageId}/categorizar/manual`;

  const payload = {
    id_categoria: Number(id_categoria)
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: {
        "Authorization": `Bearer ${API_SECRET}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();

    if (code === 200) {

      // --------------------------------------------
      // 1️⃣ Atualizar labels no Gmail
      // --------------------------------------------
      const message = GmailApp.getMessageById(messageId);
      const thread = message.getThread();

      // Carregar lista de categorias
      const categorias = getCategories(id_implementacao);

      // Nome da categoria selecionada
      const categoriaEscolhida = categorias.find(c => c.id_categoria == id_categoria);

      if (categoriaEscolhida) {
        const novaLabel = categoriaEscolhida.nome; // <-- Assumindo que a label = nome da categoria

        // Remover labels de categorias antigas
        categorias.forEach(cat => {
          try {
            const labelObj = GmailApp.getUserLabelByName(cat.nome);
            if (labelObj) thread.removeLabel(labelObj);
          } catch (e) {}
        });

        // Adicionar a nova label
        const labelObj = GmailApp.createLabel(novaLabel);
        thread.addLabel(labelObj);
      }

      // --------------------------------------------
      // 2️⃣ Atualizar UI (refresh do card)
      // --------------------------------------------
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText("Categoria atualizada com sucesso!")
        )
        .setNavigation(
          CardService.newNavigation()
            .updateCard(
              showEmailContextCard(
                { gmail: { messageId: messageId } },
                id_implementacao
              )[0]
            )
        )
        .build();
    }

    // Erro da API
    else {
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText("Erro ao atualizar categoria.")
        )
        .build();
    }

  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("Erro de rede ao tentar atualizar.")
      )
      .build();
  }
}


