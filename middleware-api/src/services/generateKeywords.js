import rake from "node-rake";

function normalizeText(text) {
  return text
    .normalize("NFD")                 
    .replace(/[\u0300-\u036f]/g, "")  
    .replace(/[^\w\s]/g, " ")         
    .replace(/\s+/g, " ")             
    .toLowerCase()
    .trim();
}


export function generateKeywords(text, limit = 12) {
  if (!text || typeof text !== "string") return [];

  const cleanText = normalizeText(text);

  const keywords = rake.generate(cleanText);

  return keywords
    .map(k => k.trim())
    .filter(k => k.length > 2)             
    .filter(k => k.split(" ").length <= 5) 
    .slice(0, limit);
}
