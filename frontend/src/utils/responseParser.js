/**
 * Response Parser Module
 *
 * This module handles parsing of AI responses that contain XML tags and code blocks.
 *
 * @module responseParser
 */

/**
 * Parses a response containing XML tags and extracts different sections
 *
 * @param {string} text - The raw response text to parse
 * @returns {ResponseSections} An object containing the parsed sections
 *
 * @typedef {Object} ResponseSections
 * @property {string} instructions - Parsed instructions section
 * @property {string} context - Parsed context section
 * @property {string} question - Parsed question section
 * @property {string} answer - Parsed answer section
 *
 * @example
 * const response = parseResponse(`
 *   <instructions>Follow these steps...</instructions>
 *   <answer>Here's the solution...</answer>
 * `);
 * console.log(response.instructions); // "Follow these steps..."
 */
export const parseResponse = (text) => {
  if (!text) {
    console.warn('Response text is undefined');
    return {
      instructions: '',
      context: '',
      question: '',
      answer: 'Sorry, an error occurred while generating the response.',
    };
  }

  // Helper function to extract content between XML tags
  const extractContent = (tag) => {
    try {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`);
      const match = text.match(regex);
      return match ? parseCodeBlocks(match[1].trim()) : '';
    } catch (error) {
      console.error(`Error extracting content for tag ${tag}:`, error);
      return '';
    }
  };

  return {
    instructions: extractContent('instructions'),
    context: extractContent('context'),
    question: extractContent('question'),
    answer: extractContent('answer'),
  };
};

/**
 * Parses text to identify and structure code blocks
 *
 * @param {string} text - The text containing code blocks
 * @returns {Array<TextBlock>} An array of text and code block objects
 *
 * @typedef {Object} TextBlock
 * @property {'text' | 'code'} type - The type of block
 * @property {string} content - The content of the block
 * @property {string} [language] - The programming language (for code blocks)
 *
 * @example
 * const blocks = parseCodeBlocks(`
 *   Some text
 *   \`\`\`javascript
 *   console.log('Hello');
 *   \`\`\`
 * `);
 */
export const parseCodeBlocks = (text) => {
  const parts = [];
  const codeBlockRegex = /```(?:(\w+)\n)?([\s\S]*?)```/g;
  let lastIndex = 0;

  for (const match of text.matchAll(codeBlockRegex)) {
    // Add text before code block if exists
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index).trim();
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }

    // Add code block
    const [, language = 'javascript', content] = match;
    parts.push({
      type: 'code',
      language,
      content: content.trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text if exists
  const remainingText = text.slice(lastIndex).trim();
  if (remainingText) {
    parts.push({ type: 'text', content: remainingText });
  }

  return parts;
};

/**
 * Removes XML tags from text
 *
 * @param {string} text - The text to clean
 * @returns {string} The cleaned text
 *
 * @example
 * const clean = cleanText('<tag>content</tag>'); // returns "content"
 */
export const cleanText = (text) => text.replace(/<\/?[^>]+(>|$)/g, '').trim();

/**
 * Validates that a response contains all required sections
 *
 * @param {ResponseSections} response - The parsed response sections
 * @returns {boolean} True if the response is valid
 */
export const validateResponse = (response) => {
  const requiredSections = ['answer'];
  return requiredSections.every((section) => response[section] && response[section].length > 0);
};
