const scriptProps = PropertiesService.getScriptProperties();
const API_URL = scriptProps.getProperty('API_URL');
const API_SECRET = scriptProps.getProperty('API_SECRET');

function buildAddOn(e) {
  Logger.log(JSON.stringify(e, null, 2));
  const email = Session.getActiveUser().getEmail();
  const implementation = checkOrCreateImplementation(email); // Retorna o objeto {id_implementacao: 1, ...}
    
  ensureBaseLabelsExist(implementation.id_implementacao);

  if (e.gmail && e.gmail.messageId) {
    return showEmailContextCard(e,implementation.id_implementacao);
  } else {
    return showHomePage(implementation.id_implementacao);  }
}

function ensureBaseLabelsExist(implementationId) {
    
    const baseLabels = [
        "1. Categorizado",
        "2. Resposta Gerada",
        "3. Resposta Validada",
        "4. Respondido"
    ];

    const categories = getCategories(implementationId); 
    
    if (!Array.isArray(categories)) {
        Logger.log('Erro: getCategories não retornou um array. Prosseguindo apenas com baseLabels.');
    } else {
        categories.forEach(cat => {
            if (cat.nome) {
                baseLabels.push(cat.nome);
            }
        });
    }
    
    if (baseLabels.length === 0) {
        Logger.log('Nenhum label (base ou customizado) para criar.');
        return;
    }


    baseLabels.forEach(labelName => {
        try {
            if (!GmailApp.getUserLabelByName(labelName)) {
                GmailApp.createLabel(labelName);
                Logger.log(`✅ Label criado: ${labelName}`);
            }
        } catch (e) {
            Logger.log(`❌ Erro ao criar label "${labelName}": ${e}`);
        }
    });

    Logger.log('Verificação de labels concluída.');
}

function showHomePage(implementationId) {
  const card = CardService.newCardBuilder();

  // Secção de Função Extra
  const sendEmailsSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextButton()
        .setText("🚀 Enviar Emails de Teste")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("enviarEmailsDeTeste")
            .setParameters({ implementationId: String(implementationId) })
        )
    );

  // Secção de Auto-Resposta
  const autoReplySection = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph()
        .setText("Clique para iniciar um ciclo de sugestão de resposta automática com categorização incluída.")
    )
    .addWidget(
      CardService.newTextButton()
        .setText("🤖 Ativar Auto-Resposta")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("startAutoReply")
            .setParameters({
              implementationId: String(implementationId)
            })
        )
    );


  // Nova Secção de Categorização Manual
  const categorizarSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Clique para iniciar um ciclo de categorização automática de emails por palavras-chave."))
    .addWidget(
      CardService.newTextButton()
        .setText("🏷️ Categorizar Emails")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("categorizarEmails")
            .setParameters({ implementationId: String(implementationId) })
        )  
    );

  // Secção de Gestão de Categorias
  const categorySection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Gerir categorias e respetivas palavras-chave"));
  categorySection.addWidget(
    CardService.newTextButton()
      .setText("⚙️ Gerir Categorias")
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName("showCategoryManagementPage")
          .setParameters({ implementationId: String(implementationId) })
      )
  );

  // Botão Suporte
  const supportButton = CardService.newTextButton()
    .setText("🛠️ Info")
    .setOpenLink(
      CardService.newOpenLink()
        .setUrl("https://medium.com/@pedromartinscorreia/ai4apgovernance-gmail-add-on-6d1cff48d259")
        .setOpenAs(CardService.OpenAs.NEW_TAB)
    );

  const supportSection = CardService.newCardSection()
    .addWidget(supportButton);

  card
    .addSection(categorySection)
    .addSection(categorizarSection)
    .addSection(autoReplySection)
    .addSection(supportSection)
  return [card.build()];
}

function showCategoryManagementPage(e) {
  const implementationId = e.parameters.implementationId;
  const card = CardService.newCardBuilder();
  const categorias = getCategories(implementationId);

  // Secção de "Voltar à Home" (sempre no topo)
  const backButtonSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextButton()
        .setText("🏠 Home")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("showHomePage")
            .setParameters({ implementationId: String(implementationId) })
        )
    );

  card.addSection(backButtonSection);

  card.setHeader(CardService.newCardHeader()
    .setTitle("⚙️ Gestão de Categorias") 
  );

  if (categorias.length > 0) {
    categorias.forEach((cat) => {
      if (cat.nome === ".Outro") return;

      const sec = CardService.newCardSection();

      sec.addWidget(
        CardService.newTextParagraph().setText(`<b>${cat.nome}</b>`)
      );

      const btns = CardService.newButtonSet();

      btns.addButton(
        CardService.newTextButton()
          .setText("🔧")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("showCategoryKeywordManager")
              .setParameters({
                labelName: String(cat.nome),
                implementationId: String(implementationId)
              })
          )
      );

      btns.addButton(
        CardService.newTextButton()
          .setText("🗑️")
          .setTextButtonStyle(CardService.TextButtonStyle.DESTRUCTIVE)
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("deleteCategory")
              .setParameters({
                implementationId: String(implementationId),
                categoryId: String(cat.id_categoria),
                categoryName: String(cat.nome)
              })
          )
      );

      sec.addWidget(btns);

      card.addSection(sec);
    });
  } else {
    const emptySection = CardService.newCardSection()
      .addWidget(
        CardService.newTextParagraph().setText("Nenhuma categoria encontrada.")
      );
    card.addSection(emptySection);
  }

  const createSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextButton()
        .setText("➕ Criar Nova Categoria")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("showCreateCategoryPrompt")
            .setParameters({ implementationId: String(implementationId) })
        )
    );

  card.addSection(createSection);

  return [card.build()];
}

function showCreateCategoryPrompt(e) {
  if (!e || !e.parameters || !e.parameters.implementationId) {
    const card = CardService.newCardBuilder();
    const section = CardService.newCardSection();

    section.addWidget(
      CardService.newTextParagraph().setText("Erro: implementationId não encontrado.")
    );

    card.addSection(section);
    return [card.build()];
  }

  const implementationId = e.parameters.implementationId;

  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection();

  const backButtonSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextButton()
        .setText("🏠 Home")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("showHomePage")
            .setParameters({ implementationId: String(implementationId) })
        )
    );

  card.addSection(backButtonSection);

  // Nome
  section.addWidget(
    CardService.newTextInput()
      .setFieldName("categoryName")
      .setTitle("Nome da Nova Categoria")
      .setHint("Ex: Autenticação")
  );

  // Questão
  section.addWidget(
    CardService.newTextInput()
      .setFieldName("questao")
      .setTitle("Questão da Categoria")
      .setHint("Que problema esta categoria resolve?")
      .setMultiline(true)
  );

  // Para que serve
  section.addWidget(
    CardService.newTextInput()
      .setFieldName("paraQueServe")
      .setTitle("Para que serve?")
      .setHint("Explique o objetivo da categoria")
      .setMultiline(true)
  );

  section.addWidget(
    CardService.newTextButton()
      .setText("Criar Categoria")
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName("createCategory")
          .setParameters({ implementationId: String(implementationId) })
      )
  );

  card.addSection(section);

  return [card.build()];
}


function showCategoryKeywordManager(e) {
  const labelName = e.parameters.labelName;  
  const implementationId = e.parameters.implementationId; 

  const card = CardService.newCardBuilder();
  
  const backButtonSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextButton()
        .setText("🏠 Home")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("showHomePage")
            .setParameters({ implementationId: String(implementationId) })
        )
    );

  // Adicionar a seção do botão no topo
  card.addSection(backButtonSection);

  const categorias = getCategories(implementationId);

  const categoria = categorias.find(cat => cat.nome.trim() === labelName.trim());

  if (!categoria) {
    console.log(`Categoria com label '${labelName}' não encontrada.`);
    return;
  }

  const categoryId = String(categoria.id_categoria);

  card.setHeader(CardService.newCardHeader().setTitle("🗂️ Gestão de Palavras-chave"))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(`Categoria: <b>${labelName}</b>`))
    );

  const keywordSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Palavras-chave atuais:"));

  const keywords = getKeywords(implementationId, categoryId);

  if (keywords.length > 0) {
    keywords.forEach(keyword => {
      if (keyword && keyword.keyword) {
        keywordSection.addWidget(
          CardService.newDecoratedText()
            .setText(`<b><i>${keyword.keyword}</i></b>`)
            .setWrapText(true)
            .setButton(
              CardService.newTextButton()
                .setText("❌ Remover")
                .setOnClickAction(
                  CardService.newAction()
                    .setFunctionName("removerKeyword")
                    .setParameters({ 
                      categoryId: String(categoryId),
                      implementationId: String(implementationId), 
                      keywordId: String(keyword.id_keyword) 
                    })
                )
            )
        );
      }
    });
  } else {
    keywordSection.addWidget(CardService.newTextParagraph().setText("Nenhuma palavra-chave definida."));
  }

  const inputSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextInput()
        .setFieldName("novaKeyword")  
        .setTitle("Adicionar nova palavra-chave")
    )
    .addWidget(
      CardService.newTextButton()
        .setText("➕ Adicionar")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("adicionarKeyword")  
            .setParameters({
              categoryId: categoryId,  
              implementationId: implementationId  
            })
        )
    );

  card.addSection(keywordSection).addSection(inputSection);

  return [card.build()];
}

function showEmailContextCard(e, id_implementacao) {
  const opaqueId = e.gmail.messageId;
  const message = GmailApp.getMessageById(opaqueId);
  const messageId = message.getId();

  const thread = message.getThread();
  const subject = message.getSubject();

  // 🔒 Detectar se o email é do próprio utilizador
  const myEmail = Session.getActiveUser().getEmail();
  const from = message.getFrom();
  const isMyEmail = from && myEmail && from.includes(myEmail);

  const cardBuilder = CardService.newCardBuilder();

  /* ============================
   * HEADER
   * ============================ */
  cardBuilder.setHeader(
    CardService.newCardHeader().setTitle("✉️ Email: " + subject)
  );

  /* ============================
   * RESPOSTA
   * ============================ */
  const resposta = getGeneratedResponse(
    id_implementacao,
    thread.getId(),
    messageId
  );

  // Só criar a secção de resposta se NÃO for email do próprio
  if (!isMyEmail) {

    const respostaSection = CardService.newCardSection()
      .setHeader("💬 Resposta ao email");

    /* ---------- SEM RESPOSTA ---------- */
    if (!resposta) {
      respostaSection.addWidget(
        CardService.newTextParagraph()
          .setText("⚠️ Ainda não existe uma resposta gerada.")
      );

      respostaSection.addWidget(
        CardService.newTextButton()
          .setText("✨ Gerar resposta automática")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("generateResponseFromRag")
              .setParameters({
                id_implementacao: String(id_implementacao),
                threadId: thread.getId(),
                messageId: messageId
              })
          )
      );
    }

    /* ---------- PROCESSING ---------- */
    else if (resposta.status === "PROCESSING") {
      respostaSection.addWidget(
        CardService.newTextParagraph()
          .setText("⏳ A resposta está a ser gerada pelo sistema RAG.")
      );

      respostaSection.addWidget(
        CardService.newTextButton()
          .setText("🔄 Atualizar estado")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("showEmailContextCard")
              .setParameters({
                id_implementacao: String(id_implementacao)
              })
          )
      );
    }

    /* ---------- DONE ---------- */
    else if (resposta.status === "DONE") {

      // Label de resposta gerada
      addLabelToThread(thread.getId(), "2. Resposta Gerada");

      respostaSection.addWidget(
        CardService.newTextParagraph()
          .setText(resposta.conteudo || "⚠️ Resposta vazia.")
      );

      if (!resposta.data_validacao) {
        respostaSection.addWidget(
          CardService.newTextButton()
            .setText("✅ Validar e enviar resposta")
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName("approveAndSendResponse")
                .setParameters({
                  id_implementacao: String(id_implementacao),
                  threadId: thread.getId(),
                  messageId: messageId,
                  id_resposta: String(resposta.id_resposta)
                })
            )
        );
      }

      if (resposta.conteudo?.startsWith("⚠️")) {
        respostaSection.addWidget(
          CardService.newTextButton()
            .setText("♻️ Gerar nova resposta")
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName("generateResponseFromRag")
                .setParameters({
                  id_implementacao: String(id_implementacao),
                  threadId: thread.getId(),
                  messageId: messageId
                })
            )
        );
      }
    }

    cardBuilder.addSection(respostaSection);
  }

  /* ============================
   * CATEGORIAS
   * ============================ */
  const categorias = getCategories(String(id_implementacao));

  if (categorias && categorias.length > 0) {
    const categoriaSection = CardService.newCardSection()
      .setHeader("📂 Categorizar email");

    const categoriaDropdown = CardService.newSelectionInput()
      .setFieldName("id_categoria")
      .setTitle("Selecionar categoria")
      .setType(CardService.SelectionInputType.DROPDOWN);

    categorias.forEach(cat => {
      categoriaDropdown.addItem(cat.nome, String(cat.id_categoria), false);
    });

    categoriaSection.addWidget(categoriaDropdown);

    categoriaSection.addWidget(
      CardService.newTextButton()
        .setText("💾 Guardar categoria")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("categorizarEmailManualmente")
            .setParameters({
              messageId: messageId,
              threadId: thread.getId(),
              id_implementacao: String(id_implementacao)
            })
        )
    );

    cardBuilder.addSection(categoriaSection);
  }

  return [cardBuilder.build()];
}



function showCategories(e) {
  const implementationId = e.parameters.implementationId;
  const categories = getCategories(implementationId);

  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection();

  if (!categories || categories.length === 0) {
    section.addWidget(
      CardService.newTextParagraph()
        .setText("Nenhuma categoria foi encontrada para esta implementação.")
    );

    section.addWidget(
      CardService.newTextButton()
        .setText("Criar nova categoria")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("showCreateCategoryPrompt")
            .setParameters({ implementationId: String(implementationId) })
        )
    );
  } else {
    categories.forEach(category => {
      section.addWidget(
        CardService.newTextParagraph().setText(`• ${category.name}`)
      );
    });
  }

  card.addSection(section);
  return [card.build()];
}

function addLabelToThread(threadId, labelName) {
  // Obter ou criar o label
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }

  // Obter a thread e aplicar o label
  const thread = GmailApp.getThreadById(threadId);
  thread.addLabel(label);
}