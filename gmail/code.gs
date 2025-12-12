const API_URL = 'https://2293ffcd8565.ngrok-free.app/implementacao';
const API_SECRET = 'yg4yqJhRU6UVjNFaKXbzVrwiNIc38RLf';

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
    
    // Labels base que devem existir independentemente da API
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
            // Verifica se o label já existe
            if (!GmailApp.getUserLabelByName(labelName)) {
                // Se não existir, cria o novo label
                GmailApp.createLabel(labelName);
                Logger.log(`✅ Label criado: ${labelName}`);
            }
        } catch (e) {
            Logger.log(`❌ Erro ao criar o label "${labelName}": ${e}`);
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
            .setFunctionName("enviarEmailsDeTeste")  // <-- substitui pela tua função
            .setParameters({ implementationId: String(implementationId) }) // opcional
        )
    );

  // Secção de Auto-Resposta
  const autoReplySection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Clique no botão abaixo para iniciar a auto-resposta agora e a cada hora."))
    .addWidget(
      CardService.newTextButton()
        .setText("Ativar Auto-Resposta")
        .setOnClickAction(CardService.newAction().setFunctionName("startAutoReply"))
    );

  // Nova Secção de Categorização Manual
  const categorizarSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Clique para iniciar um ciclo de categorização automática de 20 emails por palavras-chave."))
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
    .addWidget(CardService.newTextParagraph().setText("📁 <b>Gerir Palavras-chave por Categoria</b>"));

  categorySection.addWidget(
    CardService.newTextButton()
      .setText("Gerir Categorias")
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
    .addSection(autoReplySection)
    .addSection(categorizarSection)
    .addSection(categorySection)
    .addSection(supportSection)
    .addSection(sendEmailsSection);

  return [card.build()];
}

function showCategoryManagementPage(e) {
  const implementationId = e.parameters.implementationId;
  const card = CardService.newCardBuilder();
  const categorias = getCategories(implementationId);

  //
  // 🔹 SECÇÃO TÍTULO
  //
  const headerSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph().setText("📁 <b>Gestão de Categorias</b>")
    );

  card.addSection(headerSection);


  //
  // 🔹 UMA SECTION POR CATEGORIA
  //
  if (categorias.length > 0) {

    categorias.forEach((cat) => {
      if (cat.nome === ".Outro") return;

      const sec = CardService.newCardSection();

      // Nome da categoria
      sec.addWidget(
        CardService.newTextParagraph().setText(`<b>${cat.nome}</b>`)
      );

      // ButtonSet: editar + eliminar
      const btns = CardService.newButtonSet();

      btns.addButton(
        CardService.newTextButton()
          .setText("🔧 Editar")
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
          .setText("🗑️ Apagar")
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

      // Adiciona a section desta categoria ao card
      card.addSection(sec);
    });

  } else {
    const emptySection = CardService.newCardSection()
      .addWidget(
        CardService.newTextParagraph().setText("Nenhuma categoria encontrada.")
      );
    card.addSection(emptySection);
  }


  //
  // 🔹 SECÇÃO PARA CRIAR NOVA CATEGORIA
  //
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
  // Verificar se o parâmetro implementationId está presente
  if (!e || !e.parameters || !e.parameters.implementationId) {
    const card = CardService.newCardBuilder();
    const section = CardService.newCardSection();
    
    // Adicionar mensagem de erro
    section.addWidget(
      CardService.newTextParagraph().setText("Erro: implementationId não encontrado.")
    );
    
    card.addSection(section);
    return [card.build()];
  }

  const implementationId = e.parameters.implementationId; // Agora podemos garantir que está presente

  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection();

  // Adiciona um campo de texto para o nome da nova categoria
  section.addWidget(
    CardService.newTextInput()
      .setFieldName("categoryName")
      .setTitle("Nome da Nova Categoria")
      .setHint("Digite o nome da nova categoria")
  );

  // Botão para submeter a criação da categoria
  section.addWidget(
    CardService.newTextButton()
      .setText("Criar Categoria")
      .setOnClickAction(CardService.newAction().setFunctionName("createCategory").setParameters({
        implementationId: String(implementationId)  // Passar implementationId corretamente
      }))
  );

  card.addSection(section);
  return [card.build()];
}


function showCategoryKeywordManager(e) {
  const labelName = e.parameters.labelName;  // Obtém o nome da categoria
  const implementationId = e.parameters.implementationId;  // Obtém o ID da implementação

  console.log(implementationId);  // Verifica se o parâmetro foi passado corretamente
  console.log(labelName);  // Verifica o conteúdo de labelName

  if (!implementationId || !labelName) {
    console.log("Erro: Parâmetros necessários não encontrados.");
    return;  // Retorna um erro ou exibe uma mensagem ao usuário
  }

  const categorias = getCategories(implementationId);  // Obtém as categorias usando o implementationId

  console.log(categorias);  // Verifica as categorias recuperadas

  // Encontrar a categoria que corresponde ao labelName
  const categoria = categorias.find(cat => cat.nome.trim() === labelName.trim());

  if (!categoria) {
    console.log(`Categoria com label '${labelName}' não encontrada.`);
    return;  // Retorna um erro ou exibe uma mensagem ao usuário
  }

  const categoryId = String(categoria.id_categoria);  // Passar categoryId como string

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("🗂️ Gestão de Palavras-chave"))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(`Categoria: <b>${labelName}</b>`))
    );

  const keywordSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Palavras-chave atuais:"));

  // Buscar as palavras-chave da categoria
  const keywords = getKeywords(implementationId, categoryId);  // Função que chama o backend para obter as keywords

  if (keywords.length > 0) {
    keywords.forEach(keyword => {
      // Verificar se 'keyword.keyword' está presente
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
                      categoryId: String(categoryId),  // Passa o ID da categoria
                      implementationId: String(implementationId) , // Passa o ID da implementação
                      keywordId: String(keyword.id_keyword)  // Garantir que o ID seja passado como string
                    })
                )
            )
        );
      } else {
        console.log(`Keyword inválida: ${keyword}`);
      }
    });
  } else {
    keywordSection.addWidget(CardService.newTextParagraph().setText("Nenhuma palavra-chave definida."));
  }
  const inputSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextInput()
        .setFieldName("novaKeyword")  // Define o campo de texto
        .setTitle("Adicionar nova palavra-chave")
    )
    .addWidget(
      CardService.newTextButton()
        .setText("➕ Adicionar")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("adicionarKeyword")  // Define a função que será chamada
            .setParameters({
              categoryId: categoryId,  // Passa o ID da categoria
              implementationId: implementationId  // Passa o ID da implementação
            })
        )
    );


  return [card.addSection(keywordSection).addSection(inputSection).build()];
}


















































function showEmailContextCard(e, id_implementacao) {
  // ------------------------------------------------------------
  // 1️⃣ Obter Message ID REAL (converter ID opaco do Add-on)
  // ------------------------------------------------------------
  const opaqueId = e.gmail.messageId;  // ex: msg-a:r-44995...
  const message = GmailApp.getMessageById(opaqueId);
  const messageId = message.getId();   // ex: 19a9e40959f650f5 (o ID certo)

  const thread = message.getThread();
  const subject = message.getSubject();

  // Criar card builder
  const cardBuilder = CardService.newCardBuilder();

  // Secção principal
  const section = CardService.newCardSection();

  // ------------------------------------------------------------
  // 2️⃣ Verificar labels e respostas geradas
  // ------------------------------------------------------------
  const labels = thread.getLabels().map(label => label.getName());
  const jaRespondido = labels.includes("4. Respondido");

  const respostaGuardada = getResponseForThread(thread.getId());
  const validada = isResponseValidated(thread.getId());

  // ------------------------------------------------------------
  // 3️⃣ Secção de CATEGORIZAÇÃO MANUAL
  // ------------------------------------------------------------
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
              messageId: messageId,  // agora o ID real
              id_implementacao: String(id_implementacao)
            })
        )
    );

    cardBuilder.addSection(categoriaSection);
  }

  // ------------------------------------------------------------
  // 4️⃣ Secção de respostas automáticas
  // ------------------------------------------------------------
  if (jaRespondido) {
    section.addWidget(
      CardService.newTextParagraph().setText("✅ Este email já foi respondido.")
    );

  } else if (respostaGuardada) {
    section.addWidget(
      CardService.newTextParagraph()
        .setText("💬 <b>Resposta gerada para este email:</b>")
    );
    section.addWidget(
      CardService.newTextParagraph().setText(respostaGuardada)
    );

    if (!validada) {
      section.addWidget(
        CardService.newTextButton()
          .setText("♻️ Gerar uma melhor resposta")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("generateBetterResponse")
              .setParameters({ threadId: thread.getId() })
          )
      );

      section.addWidget(
        CardService.newTextButton()
          .setText("✅ Aprovar e enviar resposta")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("approveAndSendResponse")
              .setParameters({ threadId: thread.getId() })
          )
      );

    } else {
      section.addWidget(
        CardService.newTextParagraph().setText("✅ Resposta aprovada e enviada.")
      );
    }

  } else {
    section.addWidget(
      CardService.newTextParagraph()
        .setText("❌ Não existe resposta gerada para este email.")
    );
  }

  // Adicionar secção principal
  cardBuilder.addSection(section);

  // Cabeçalho do card
  cardBuilder.setHeader(
    CardService.newCardHeader().setTitle("✉️ Email: " + subject)
  );

  // Construir e retornar
  return [cardBuilder.build()];
}





function generateBetterResponse(e) {
  const threadId = e.parameters.threadId;
  const threads = GmailApp.getThreads(0, 50);
  const thread = threads.find(t => t.getId() === threadId);
  if (!thread) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("❌ Thread não encontrada."))
      .build();
  }

  const messages = thread.getMessages();
  let combinedContent = "";
  for (const msg of messages) {
    combinedContent += msg.getPlainBody() + "\n\n";
  }

  const novaResposta = generateResponseFromRAG(combinedContent.trim());
  saveResponseForThread(threadId, novaResposta);
  setResponseValidated(threadId, false);

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(showEmailContextCard({gmail:{messageId: messages[messages.length-1].getId()}})[0]))
    .setNotification(CardService.newNotification().setText("♻️ Resposta melhor gerada com sucesso. Reveja e aprove."))
    .build();
}

function approveAndSendResponse(e) {
  const threadId = e.parameters.threadId;
  const resposta = getResponseForThread(threadId);

  if (!resposta) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("❌ Não há resposta para enviar."))
      .build();
  }

  let thread;
  try {
    thread = GmailApp.getThreadById(threadId);
  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("❌ Erro ao obter o thread: " + error.message))
      .build();
  }

  if (!thread) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("❌ Thread não encontrado."))
      .build();
  }

  thread.reply(resposta);
  setResponseValidated(threadId, true);

  const labelValidada = getOrCreateLabel("3. Resposta Validada");
  thread.addLabel(labelValidada);

  const labelRespondido = getOrCreateLabel("4. Respondido");
  thread.addLabel(labelRespondido);

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(showEmailContextCard({gmail:{messageId: thread.getMessages().slice(-1)[0].getId()}})[0]))
    .setNotification(CardService.newNotification().setText("✅ Resposta aprovada e enviada com sucesso!"))
    .build();
}

// Armazenar e recuperar resposta por thread (usando UserProperties)
function saveResponseForThread(threadId, resposta) {
  PropertiesService.getUserProperties().setProperty(threadId + "_resposta", resposta);
}
function getResponseForThread(threadId) {
  return PropertiesService.getUserProperties().getProperty(threadId + "_resposta");
}

function setResponseValidated(threadId, valor) {
  PropertiesService.getUserProperties().setProperty(threadId + "_validada", valor ? "true" : "false");
}
function isResponseValidated(threadId) {
  return PropertiesService.getUserProperties().getProperty(threadId + "_validada") === "true";
}

function buildStatsSection() {
  const stats = getCategoryStats();
  const categorias = [];
  const valores = [];

  for (const categoria in stats) {
    const valor = stats[categoria].categorizado || 0;
    if (valor > 0) {
      categorias.push(categoria);
      valores.push(valor);
    }
  }

  const chartUrl = generatePieChartUrl(categorias, valores);

  return CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("📊 Distribuição de Emails por Categoria"))
    .addWidget(CardService.newImage().setImageUrl(chartUrl))
    .addWidget(
      CardService.newTextButton()
        .setText("📥 Exportar estatísticas completas em formato CSV")
        .setOnClickAction(CardService.newAction().setFunctionName("exportStatsAsCSV"))
    );
}

function generatePieChartUrl(labels, data) {
  const chartConfig = {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          "#3366CC", "#DC3912", "#FF9900", "#109618", "#990099"
        ]
      }]
    },
    options: {
      plugins: {
        legend: {
          position: "right",
          labels: { font: { size: 14 } }
        },
        datalabels: {
          color: "#000",
          formatter: (value, context) => {
            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const percent = ((value / total) * 100).toFixed(1);
            return `${value} (${percent}%)`;
          },
          align: "end",
          anchor: "end",
          font: { size: 12, weight: "bold" }
        },
        title: {
          display: true,
          text: "Emails Categorizados",
          font: { size: 16 }
        }
      }
    },
    plugins: ["chartjs-plugin-datalabels"]
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}`;
}

function exportStatsAsCSV() {
  const stats = getCategoryStats();

  let csv = "Categoria;Total Emails Categorizados\n";
  for (const categoria in stats) {
    csv += `${categoria};${stats[categoria].categorizado}\n`;
  }

  const blob = Utilities.newBlob(csv, "text/csv", "estatisticas.csv");
  DriveApp.createFile(blob);

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText("CSV exportado para o seu Google Drive com o nome estatisticas.csv"))
    .build();
}

function startAutoReply() {
  deleteExistingTriggers();
  autoReplyToUnreadEmails();

  setHourlyTrigger();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(showHomePage()[0]))
    .build();
}


function setHourlyTrigger() {
  ScriptApp.newTrigger("autoReplyToUnreadEmails").timeBased().everyHours(1).create();
}

function deleteExistingTriggers() {
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === "autoReplyToUnreadEmails") ScriptApp.deleteTrigger(t);
  }
}

function autoReplyToUnreadEmails() {
  const threads = GmailApp.search("is:unread");

  const labelCategorizado = getOrCreateLabel("1. Categorizado");
  const labelRespostaGerada = getOrCreateLabel("2. Resposta Gerada");

  for (const thread of threads) {
    // Ignorar threads que já têm alguma label para evitar processar repetidamente
    if (thread.getLabels().length > 0) continue;

    for (const msg of thread.getMessages()) {
      const content = msg.getPlainBody().trim();

      const category = getEmailCategoryKeyWordMatching(content);
      if (category) {
        const label = getOrCreateLabel(category);
        thread.addLabel(label);
        thread.addLabel(labelCategorizado);
      }

      // Gerar a resposta
      const response = generateResponseFromRAG(content);
      
      // Guardar a resposta para o thread
      saveResponseForThread(thread.getId(), response);
      setResponseValidated(thread.getId(), false);

      // Marcar como lido, mas não criar draft nem enviar
      msg.markRead();
    }

    // Adicionar a label "Resposta Gerada" ao thread para indicar que já foi processado
    thread.addLabel(labelRespostaGerada);
  }
}


function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

function getEmailCategoryKeyWordMatching(content) {
  content = content
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  const categorias = getCategorias();
  let bestMatch = ".Outro";
  let highestScore = 0;

  for (const cat of categorias) {
    let score = 0;

    for (const keyword of cat.keywords) {
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, "gi");
      const matches = content.match(regex);
      if (matches) score += matches.length;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = cat.label;
    }
  }

  return bestMatch;
}


function generateResponseFromRAG(emailContent) {
  try {
    const payload = {
      question: emailContent,
      embedding_model: "ollama"
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch("https://24a006a83746.ngrok-free.app/query_rag", options);
    const json = JSON.parse(response.getContentText());

    if (json.error) {
      Logger.log("Erro do RAG: " + JSON.stringify(json));
      return "⚠️ Não foi possível obter uma resposta baseada nos PDFs.";
    }

    let respostaGerada = json.response;
    const sources = json.sources || [];

    if (sources.length > 0) {
      const fontesTexto = sources.map(s => `- ${s.filename}, página ${s.page}`).join("\n");
      respostaGerada += `\n\nFontes consultadas:\n${fontesTexto}`;
    }

    return respostaGerada;

  } catch (e) {
    Logger.log("Erro ao contactar RAG: " + e.toString());
    return "⚠️ Erro ao contactar o sistema RAG.";
  }
}

// Estatísticas
function getCategoryStats() {
  const categorias = [
    "Ação Social Escolar",
    "Ambiente e Espaços Verdes",
    "Equipamentos Desportivos",
    "Feiras e Mercados",
    "Outro"
  ];

  const stats = {};
  for (const cat of categorias) {
    stats[cat] = { categorizado: 0 };
  }

  const allThreads = GmailApp.getInboxThreads();
  for (const thread of allThreads) {
    for (const label of thread.getLabels()) {
      let labelName = label.getName();
      if (labelName.startsWith(".")) labelName = labelName.substring(1);

      if (stats[labelName]) stats[labelName].categorizado++;
    }
  }
  return stats;
}