const categoriasJson = `
[
  {
    "label": ".Ação Social Escolar",
    "keywords": ["escolar", "ação social", "aluno", "estudo", "pedagógica", "escolares", "apoio"]
  },
  {
    "label": ".Ambiente e Espaços Verdes",
    "keywords": ["ambiente", "verde", "árvore", "ambiental", "parque ecológico", "terreno"]
  },
  {
    "label": ".Equipamentos Desportivos",
    "keywords": ["desporto", "ginásio", "material desportivo", "piscina","treinos", "competição"]
  },
  {
    "label": ".Feiras e Mercados",
    "keywords": ["feira", "mercado", "venda"]
  }
]
`;

function getCategorias() {
  return JSON.parse(categoriasJson);
}

function saveCategorias(categorias) {
  const json = JSON.stringify(categorias);
  PropertiesService.getUserProperties().setProperty('categorias', json);
}
