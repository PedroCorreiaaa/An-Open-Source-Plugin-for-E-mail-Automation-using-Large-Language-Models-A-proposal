function enviarEmailsDeTeste() {
  const destinatario = "projeto4.29241.29344@gmail.com"; // muda para o teu email
  const repeticoes = 20; // repete cada template 100 vezes

  const templates = [
    {
      assunto: "Apoio social para aluno com necessidades especiais",
      corpo: "Bom dia, O meu filho frequenta uma escola pública em Viana do Castelo e tem necessidades educativas especiais. Estamos com dificuldades em garantir acompanhamento adequado. Existe algum serviço de apoio ou acompanhamento familiar que possamos solicitar? Com os melhores cumprimentos"
    }
  ];

  let contador = 0;

  templates.forEach(template => {
    for (let i = 1; i <= repeticoes; i++) {

      const assuntoFinal = `${template.assunto} - Teste ${i}`;
      const corpoFinal = `${template.corpo}\n\n---\nEmail de teste automático nº ${i}\nTemplate: ${template.assunto}`;

      GmailApp.sendEmail(destinatario, assuntoFinal, corpoFinal);

      contador++;

      Utilities.sleep(250); // evita limite de envio por segundo
    }
  });

  Logger.log(`Foram enviados ${contador} emails de teste.`);
}
