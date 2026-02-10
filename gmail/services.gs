function getJwtToken() {
  const props = PropertiesService.getScriptProperties();
  var token = props.getProperty("JWT_TOKEN");
  var expiresAt = Number(props.getProperty("JWT_EXPIRES_AT"));

  if (token && expiresAt && Date.now() < expiresAt - 60000) {
    return token;
  }

  // Pedir novo token ao backend
  var response = UrlFetchApp.fetch(`${API_URL}/auth/token`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({}),
    headers: {
      "x-api-secret": API_SECRET
    },
    muteHttpExceptions: true
  });


  if (response.getResponseCode() !== 200) {
    throw new Error("Erro ao obter JWT");
  }

  var data = JSON.parse(response.getContentText());

  props.setProperty("JWT_TOKEN", data.token);
  props.setProperty(
    "JWT_EXPIRES_AT",
    String(Date.now() + 60 * 60 * 1000)
  );

  return data.token;
}

function fetchWithAuth(url, options) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers.Authorization = "Bearer " + getJwtToken();
  options.muteHttpExceptions = true;

  let response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() === 401) {
    // Limpar token antigo
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty("JWT_TOKEN");
    props.deleteProperty("JWT_EXPIRES_AT");

    // Gerar um novo token e repetir a request
    options.headers.Authorization = "Bearer " + getJwtToken();
    response = UrlFetchApp.fetch(url, options);
  }

  return response;
}

function fetchAllWithAuth(requests) {
  if (!requests || !requests.length) return [];

  let token = getJwtToken();

  const authorizedRequests = requests.map(req => {
    req.headers = req.headers || {};
    req.headers.Authorization = "Bearer " + token;
    req.muteHttpExceptions = true;
    return req;
  });

  let responses = UrlFetchApp.fetchAll(authorizedRequests);

  const retryIndexes = [];
  for (let i = 0; i < responses.length; i++) {
    if (responses[i].getResponseCode() === 401) {
      retryIndexes.push(i);
    }
  }

  if (retryIndexes.length === 0) {
    return responses;
  }

  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("JWT_TOKEN");
  props.deleteProperty("JWT_EXPIRES_AT");

  token = getJwtToken();

  const retryRequests = retryIndexes.map(i => {
    const req = authorizedRequests[i];
    req.headers.Authorization = "Bearer " + token;
    return req;
  });

  const retryResponses = UrlFetchApp.fetchAll(retryRequests);

  retryIndexes.forEach((reqIndex, i) => {
    responses[reqIndex] = retryResponses[i];
  });

  return responses;
}


function categorizarEmails(e) {
  let implementationId = String(e.parameters.implementationId || "");
  const CATEGORIZADO_LABEL = "1. Categorizado";
  const MAX_PROCESS = 100;
  let processedCount = 0;

  const threads = GmailApp.search("is:unread");
  threads.sort((a, b) => a.getLastMessageDate() - b.getLastMessageDate());

  const requests = [];
  const emailMetadata = [];

  for (const thread of threads) {
    if (processedCount >= MAX_PROCESS) break;

    const alreadyCategorized = thread.getLabels().some(
      label => label.getName() === CATEGORIZADO_LABEL
    );

    if (alreadyCategorized) continue;

    for (const msg of thread.getMessages()) {
      if (processedCount >= MAX_PROCESS) break;

      processedCount++;

      const messageId = msg.getId();
      const threadId = thread.getId();
      const sender = msg.getFrom();
      const subject = msg.getSubject();
      const content = msg.getPlainBody().trim();

      const url = `${API_URL}/implementacao/${implementationId}/thread/${threadId}/email/${messageId}/categorizar`;

      requests.push({
        url: url,
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          message_id: messageId,
          thread_id: threadId,
          remetente: sender,
          assunto: subject,
          corpo: content
        }),
        headers: { "ngrok-skip-browser-warning": "true" }
      });

      emailMetadata.push({ thread, messageId });
    }
  }

  const responses = fetchAllWithAuth(requests);

  const categorizadoLabel =
    GmailApp.getUserLabelByName(CATEGORIZADO_LABEL) ||
    GmailApp.createLabel(CATEGORIZADO_LABEL);

  for (let i = 0; i < responses.length; i++) {
    const { thread } = emailMetadata[i];
    const response = responses[i];

    try {
      if (response.getResponseCode() !== 200) continue;

      const body = JSON.parse(response.getContentText());
      const category = body.categoria;

      if (!category) continue;

      const categoryLabel =
        GmailApp.getUserLabelByName(category) ||
        GmailApp.createLabel(category);

      thread.addLabel(categorizadoLabel);
      thread.addLabel(categoryLabel);

    } catch (err) {
      Logger.log("Erro processando resposta paralela: " + err);
    }
  }

  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation().updateCard(showHomePage(implementationId)[0])
    )
    .setNotification(
      CardService.newNotification()
        .setText(`⏳ Categorização terminada. Processados: ${processedCount} emails.`)
    )
    .build();
}


function categorizarEmailManualmente(e) {
  const { messageId, threadId, id_implementacao } = e.parameters;
  const id_categoria = e.formInput.id_categoria;

  if (!id_categoria) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("Selecione uma categoria antes de guardar.")
      )
      .build();
  }

  const url = `${API_URL}/implementacao/${id_implementacao}/thread/${threadId}/categorizar/manual`;

  const payload = { id_categoria: Number(id_categoria) };

  try {
    const response = fetchWithAuth(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    });

    const code = response.getResponseCode();

    if (code === 200) {
      // Atualizar labels no Gmail
      const message = GmailApp.getMessageById(messageId);
      const thread = message.getThread();

      const categorias = getCategories(id_implementacao);
      const categoriaEscolhida = categorias.find(c => c.id_categoria == id_categoria);

      if (categoriaEscolhida) {
        const novaLabel = categoriaEscolhida.nome;

        categorias.forEach(cat => {
          try {
            const labelObj = GmailApp.getUserLabelByName(cat.nome);
            if (labelObj) thread.removeLabel(labelObj);
          } catch (e) {}
        });

        const labelObj = GmailApp.createLabel(novaLabel);
        thread.addLabel(labelObj);
      }

      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Categoria atualizada com sucesso!"))
        .setNavigation(
          CardService.newNavigation().updateCard(
            showEmailContextCard({ gmail: { messageId: messageId } }, id_implementacao)[0]
          )
        )
        .build();
    }

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Erro ao atualizar categoria."))
      .build();

  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Erro de rede ao tentar atualizar."))
      .build();
  }
}


function generateResponseFromRag(e) {
  const { id_implementacao, threadId, messageId } = e.parameters;
  const message = GmailApp.getMessageById(messageId);

  const payload = {
    remetente: message.getFrom(),
    assunto: message.getSubject(),
    corpo: message.getPlainBody()
  };

  const url = `${API_URL}/implementacao/${id_implementacao}/thread/${threadId}/email/${messageId}/resposta/rag`;

  fetchWithAuth(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });

  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText("✨ A resposta está a ser gerada...")
    )
    .build();
}



function approveAndSendResponse(e) {
  try {
    const { id_implementacao, threadId, messageId, id_resposta } = e.parameters;

    const url = `${API_URL}/implementacao/${id_implementacao}/thread/${threadId}/email/${messageId}/resposta/${id_resposta}/validar`;

    const apiResponse = fetchWithAuth(url, {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify({})
    });

    const code = apiResponse.getResponseCode();
    const body = apiResponse.getContentText();
    let data = null;

    try {
      data = JSON.parse(body);
    } catch {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("⚠️ Resposta inválida do servidor."))
        .build();
    }

    if (code !== 200 || !data?.resposta) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("⚠️ Erro ao validar resposta no servidor."))
        .build();
    }

    const respostaTexto = data.resposta;
    const thread = GmailApp.getThreadById(threadId);
    if (!thread) throw new Error("Thread não encontrada.");

    thread.reply(respostaTexto);

    const labelValidada =
      GmailApp.getUserLabelByName("3. Resposta Validada")
    const labelRespondido =
      GmailApp.getUserLabelByName("4. Respondido")
      
    thread.addLabel(labelValidada);
    thread.addLabel(labelRespondido);


    const lastMessageId = thread.getMessages().slice(-1)[0].getId();

    return CardService.newActionResponseBuilder()
      .setNavigation(
        CardService.newNavigation().updateCard(
          showEmailContextCard({ gmail: { messageId: lastMessageId } }, id_implementacao)[0]
        )
      )
      .setNotification(CardService.newNotification().setText("📨 Resposta validada e enviada com sucesso!"))
      .build();

  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("❌ Erro inesperado: " + err.message))
      .build();
  }
}


function startAutoReply(e) {
  let implementationId = String(e.parameters.implementationId);
  const CATEGORIZADO_LABEL = "1. Categorizado";
  const MAX_PROCESS = 3;
  let processedCount = 0;

  // Buscar emails não lidos
  const threads = GmailApp.search("is:unread");
  threads.sort((a, b) => a.getLastMessageDate() - b.getLastMessageDate());

  const requests = [];
  const emailMetadata = [];

  for (const thread of threads) {
    if (processedCount >= MAX_PROCESS) break;

    const alreadyCategorized = thread.getLabels().some(
      label => label.getName() === CATEGORIZADO_LABEL
    );
    if (alreadyCategorized) continue;

    for (const msg of thread.getMessages()) {
      if (processedCount >= MAX_PROCESS) break;

      processedCount++;

      const messageId = msg.getId();
      const threadId = thread.getId();
      const sender = msg.getFrom();
      const subject = msg.getSubject();
      const content = msg.getPlainBody().trim();

      const url = `${API_URL}/implementacao/${implementationId}/thread/${threadId}/email/${messageId}/categorizar`;

      requests.push({
        url: url,
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          message_id: messageId,
          thread_id: threadId,
          remetente: sender,
          assunto: subject,
          corpo: content
        }),
        headers: { "ngrok-skip-browser-warning": "true" }
      });

      emailMetadata.push({ thread, messageId });
    }
  }

  // Categorizar todos de uma vez
  const responses = fetchAllWithAuth(requests);

  const categorizadoLabel =
    GmailApp.getUserLabelByName(CATEGORIZADO_LABEL) ||
    GmailApp.createLabel(CATEGORIZADO_LABEL);

  const messagesForRag = [];

  for (let i = 0; i < responses.length; i++) {
    const { thread, messageId } = emailMetadata[i];
    const response = responses[i];

    try {
      if (response.getResponseCode() !== 200) continue;

      const body = JSON.parse(response.getContentText());
      const category = body.categoria;
      if (!category) continue;

      const categoryLabel =
        GmailApp.getUserLabelByName(category) ||
        GmailApp.createLabel(category);

      thread.addLabel(categorizadoLabel);
      thread.addLabel(categoryLabel);

      // Adicionar à lista para gerar resposta
      messagesForRag.push({ threadId: thread.getId(), messageId });

    } catch (err) {
      Logger.log("Erro processando resposta paralela: " + err);
    }
  }

  // Gerar resposta RAG para cada email categorizado
  for (const msg of messagesForRag) {
    try {
      const message = GmailApp.getMessageById(msg.messageId);
      const payload = {
        remetente: message.getFrom(),
        assunto: message.getSubject(),
        corpo: message.getPlainBody()
      };
      const url = `${API_URL}/implementacao/${implementationId}/thread/${msg.threadId}/email/${msg.messageId}/resposta/rag`;

      fetchWithAuth(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload)
      });
    } catch (err) {
      Logger.log("Erro ao gerar resposta RAG: " + err);
    }
  }

  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText(
        `⏳ Auto-reply iniciado. Processados e respostas solicitadas para ${processedCount} emails.`
      )
    )
    .build();
}