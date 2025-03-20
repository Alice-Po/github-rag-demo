/**
 * Parse une réponse contenant des balises XML et extrait les différentes sections
 * @param {string} text - Le texte à parser
 * @returns {Object} Un objet contenant les différentes sections
 */
export const parseResponse = (text) => {
  // Vérifier si le texte est défini
  if (!text) {
    console.warn('Texte de réponse non défini');
    return {
      instructions: '',
      context: '',
      question: '',
      answer: 'Désolé, une erreur est survenue lors de la génération de la réponse.',
    };
  }

  const sections = {};

  // Fonction helper pour extraire le contenu entre les balises
  const extractContent = (tag) => {
    try {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`);
      const match = text.match(regex);
      return match ? parseCodeBlocks(match[1].trim()) : '';
    } catch (error) {
      console.error(`Erreur lors de l'extraction du contenu pour le tag ${tag}:`, error);
      return '';
    }
  };

  // Extraire les différentes sections
  sections.instructions = extractContent('instructions');
  sections.context = extractContent('context');
  sections.question = extractContent('question');
  sections.answer = extractContent('answer');

  return sections;
};

/**
 * Parse le texte pour identifier les blocs de code
 * @param {string} text - Le texte à parser
 * @returns {Array} Un tableau d'objets représentant le texte et les blocs de code
 */
export const parseCodeBlocks = (text) => {
  const parts = [];
  const codeBlockRegex = /```(?:(\w+)\n)?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Ajouter le texte avant le bloc de code
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index).trim(),
      });
    }

    // Ajouter le bloc de code
    parts.push({
      type: 'code',
      language: match[1] || 'javascript',
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Ajouter le reste du texte
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex).trim(),
    });
  }

  return parts;
};

/**
 * Nettoie le texte des balises XML
 * @param {string} text - Le texte à nettoyer
 * @returns {string} Le texte nettoyé
 */
export const cleanText = (text) => {
  return text.replace(/<\/?[^>]+(>|$)/g, '').trim();
};
