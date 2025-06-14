function buildAddOn(e) {
  Logger.log(JSON.stringify(e, null, 2)); // debug

  if (e.gmail && e.gmail.messageId) {
    return showEmailContextCard(e);
  } else {
    return showHomePage();
  }
}

function showHomePage() {
  const card = CardService.newCardBuilder();

  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Clique no botão abaixo para iniciar a auto-resposta agora e a cada hora."))
    .addWidget(
      CardService.newTextButton()
        .setText("Ativar Auto-Resposta")
        .setOnClickAction(CardService.newAction().setFunctionName("startAutoReply"))
    );

  const statsSection = buildStatsSection();
  card.addSection(section).addSection(statsSection);

  return [card.build()];
}


function showEmailContextCard(e) {
  const messageId = e.gmail.messageId;
  const message = GmailApp.getMessageById(messageId);
  const thread = message.getThread();
  const subject = message.getSubject();

  const section = CardService.newCardSection();

  // Verificar se o thread tem a label "Respondido"
  const labels = thread.getLabels().map(label => label.getName());
  const jaRespondido = labels.includes("4. Respondido");

  const respostaGuardada = getResponseForThread(thread.getId());
  const validada = isResponseValidated(thread.getId());

  if (jaRespondido) {
    section.addWidget(CardService.newTextParagraph().setText("✅ Este email já foi respondido."));
  } else if (respostaGuardada) {
    section.addWidget(CardService.newTextParagraph().setText("💬 <b>Resposta gerada para este email:</b>"));
    section.addWidget(CardService.newTextParagraph().setText(respostaGuardada));

    if (!validada) {
      // Botão para gerar resposta melhor
      section.addWidget(
        CardService.newTextButton()
          .setText("♻️ Gerar uma resposta melhor")
          .setOnClickAction(CardService.newAction()
            .setFunctionName("generateBetterResponse")
            .setParameters({threadId: thread.getId()})
          )
      );

      // Botão para aprovar e enviar
      section.addWidget(
        CardService.newTextButton()
          .setText("✅ Aprovar e enviar resposta")
          .setOnClickAction(CardService.newAction()
            .setFunctionName("approveAndSendResponse")
            .setParameters({threadId: thread.getId()})
          )
      );
    } else {
      section.addWidget(CardService.newTextParagraph().setText("✅ Resposta aprovada e enviada."));
    }
  } else {
    section.addWidget(CardService.newTextParagraph().setText("❌ Não existe resposta gerada para este email."));
  }
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("✉️ Email: " + subject))
    .addSection(section)
    .build();

  return [card];
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
    .setNotification(CardService.newNotification().setText("Auto-resposta ativada e primeira execução concluída!"))
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
  content = content.toLowerCase();

  if (content.includes("escolar") || content.includes("ação social") || content.includes("aluno")) return ".Ação Social Escolar";
  if (content.includes("ambiente") || content.includes("verde") || content.includes("árvore")) return ".Ambiente e Espaços Verdes";
  if (content.includes("desporto") || content.includes("ginásio")) return ".Equipamentos Desportivos";
  if (content.includes("feira") || content.includes("mercado")) return ".Feiras e Mercados";

  return ".Outro";
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

    const response = UrlFetchApp.fetch("https://c67f-2001-818-da6c-9b00-89f8-62ff-d9c4-1c7b.ngrok-free.app/query_rag", options);
    const json = JSON.parse(response.getContentText());

    if (json.error) {
      Logger.log("Erro do RAG: " + JSON.stringify(json));
      return "⚠️ Não foi possível obter uma resposta baseada nos PDFs.";
    }

    let resposta = json.response;
    const sources = json.sources || [];

    if (sources.length > 0) {
      const fontesTexto = sources.map(s => `- ${s.filename}, página ${s.page}`).join("\n");
      resposta += `\n\nFontes consultadas:\n${fontesTexto}`;
    }

    return resposta;

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
