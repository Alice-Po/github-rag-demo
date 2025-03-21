/**
 * LLM Service for RAG System
 *
 * This module provides an interface to Hugging Face's inference API for text generation.
 * It handles:
 * - Model initialization and configuration
 * - Prompt engineering and context management
 * - Response generation with error handling
 *
 * @module LLMService
 */

import { HfInference } from '@huggingface/inference';

/**
 * Default generation parameters for the language model
 */
const DEFAULT_PARAMETERS = {
  max_new_tokens: 1024,
  temperature: 0.1, // Lower temperature for more focused responses
  top_p: 0.95, // Nucleus sampling for balanced output
  do_sample: true, // Enable sampling for more natural responses
};

/**
 * Service class for handling LLM interactions
 */
export class LLMService {
  /**
   * Creates a new LLM service instance
   *
   * @param {string} model - HuggingFace model identifier
   * @param {string} token - HuggingFace API token
   * @throws {Error} If token is missing or invalid
   */
  constructor(model, token) {
    if (!token) {
      throw new Error('Missing HuggingFace API token');
    }

    this.model = model;
    this.hf = new HfInference(token);
  }

  /**
   * Generates an AI response based on question and context
   *
   * @param {string} question - User's question
   * @param {string} context - Relevant context from vector search
   * @param {string} repoList - List of available repositories
   * @returns {Promise<string>} Generated response
   * @throws {Error} If generation fails
   *
   * @example
   * const llm = new LLMService('mistralai/Mixtral-8x7B-Instruct-v0.1', 'hf_token');
   * const response = await llm.generateAnswer(
   *   'How does the auth system work?',
   *   'auth.js contains...',
   *   'repo1, repo2'
   * );
   */
  async generateAnswer(question, context, repoList) {
    try {
      // Construct prompt with clear sections
      const prompt = this.constructPrompt(question, context, repoList);

      // Generate response with model
      const response = await this.hf.textGeneration({
        model: this.model,
        inputs: prompt,
        parameters: DEFAULT_PARAMETERS,
      });

      return response.generated_text.trim();
    } catch (error) {
      // Handle specific error cases
      if (this.isAuthError(error)) {
        throw new Error('Invalid HuggingFace token. Please check your configuration.');
      }

      if (this.isModelAccessError(error)) {
        throw new Error(
          'Model access error. Please ensure you have accepted the model terms on HuggingFace Hub.'
        );
      }

      // Log error details for debugging
      console.error('LLM Error:', {
        type: error.name,
        message: error.message,
        model: this.model,
      });

      throw error;
    }
  }

  /**
   * Constructs a formatted prompt for the LLM
   * @private
   */
  constructPrompt(question, context, repoList) {
    return `
    <instructions>
    You are an expert programming assistant with deep knowledge of the following GitHub repositories:
    ${repoList}
    
    Based solely on the provided context and your general programming knowledge:
    1. Answer the question clearly and concisely
    2. Always cite relevant source files
    3. If information is not in the context, say so explicitly
    </instructions>
    
    <context>
    ${context}
    </context>
    
    <question>
    ${question}
    </question>
    
    <answer>
    `;
  }

  /**
   * Checks if an error is related to authentication
   * @private
   */
  isAuthError(error) {
    return (
      error.message.includes('Invalid username or password') ||
      error.message.includes('Unauthorized')
    );
  }

  /**
   * Checks if an error is related to model access
   * @private
   */
  isModelAccessError(error) {
    return error.message.includes('fetching the blob') || error.message.includes('access denied');
  }

  /**
   * Validates the current configuration
   * @returns {boolean} True if the service is properly configured
   */
  isConfigValid() {
    return Boolean(this.model && this.hf);
  }
}
