/**
 * RAG (Retrieval Augmented Generation) Demo Server
 *
 * This server demonstrates how to build a RAG system that:
 * 1. Indexes GitHub repositories
 * 2. Processes queries using semantic search
 * 3. Generates context-aware responses using LLMs
 *
 * Architecture Overview:
 * - Express server handles HTTP requests
 * - Qdrant vector database stores embeddings
 * - HuggingFace provides embedding and LLM capabilities
 * - Document processor handles text processing and embedding generation
 *
 * Required Environment Variables:
 * - HF_TOKEN: HuggingFace API token
 * - GITHUB_REPOS: JSON array of repository configurations
 * - QDRANT_URL: Qdrant database URL (default: http://localhost:6333)
 * - EMBEDDING_MODEL: HuggingFace embedding model (default: Xenova/multilingual-e5-large)
 * - LLM_MODEL: HuggingFace LLM model (default: mistralai/Mixtral-8x7B-Instruct-v0.1)
 * - REPOS_DIR: Local directory for cloned repositories (default: ./github_repos)
 *
 * @example GITHUB_REPOS format:
 * [
 *   {
 *     "name": "Project Name",
 *     "url": "https://github.com/owner/repo"
 *   }
 * ]
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { QdrantService } from './services/qdrant.js';
import { DocumentProcessor } from './services/document-processor.js';
import { LLMService } from './services/llm.js';

// Load environment variables
dotenv.config();

// Validate essential environment variables
const validateEnvironment = () => {
if (!process.env.HF_TOKEN) {
    console.error('❌ Missing HF_TOKEN in environment variables');
    process.exit(1);
  }

  let parsedRepos;
  try {
    parsedRepos = process.env.GITHUB_REPOS ? JSON.parse(process.env.GITHUB_REPOS) : null;
    if (!parsedRepos || !Array.isArray(parsedRepos) || parsedRepos.length === 0) {
      throw new Error('Invalid or empty GITHUB_REPOS configuration');
    }
  } catch (error) {
    console.error('❌ Error parsing GITHUB_REPOS:', error);
    console.error('Current value:', process.env.GITHUB_REPOS);
  process.exit(1);
}

  return parsedRepos;
};

// Initialize Express application with middleware
const app = express();
app.use(cors());
app.use(express.json());

/**
 * Server Configuration
 * Centralizes all configurable parameters and dependencies
 */
const config = {
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/multilingual-e5-large',
  llmModel: process.env.LLM_MODEL || 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  hfToken: process.env.HF_TOKEN,
  repos: validateEnvironment(),
  reposDir: process.env.REPOS_DIR || './github_repos',
};

// Log configuration (excluding sensitive data)
console.log('Server Configuration:', {
  ...config,
  hfToken: '***',
});

/**
 * Initialize Services
 * Creates instances of core services required for RAG functionality
 */
const services = {
  qdrant: new QdrantService(config.qdrantUrl),
  documentProcessor: new DocumentProcessor(config.embeddingModel),
  llm: new LLMService(config.llmModel, config.hfToken),
};

// Initialize document processor
await services.documentProcessor.initialize();

/**
 * Health Check Endpoint
 * Verifies API is running and services are initialized
 */
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'RAG API is operational',
    version: '1.0.0',
  });
});

/**
 * Question Answering Endpoint
 * Processes natural language queries and returns AI-generated responses
 *
 * Request body: { question: string }
 * Response: { answer: string, context?: string }
 */
app.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;

    // Input validation
    if (!question?.trim()) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'Question is required',
      });
    }

    // 1. Generate embedding for the question
    console.log('Generating embedding for:', question);
    const embedding = await services.documentProcessor.generateEmbedding(question);

    // 2. Search for relevant documents
    console.log('Searching similar documents...');
    const searchResults = await services.qdrant.searchSimilar('github_code', embedding.data, 5);

    if (!searchResults?.length) {
      return res.status(404).json({
        error: 'No relevant information found',
        details: 'Try rephrasing your question',
      });
    }

    // 3. Prepare context from search results
    const context = searchResults
      .map(
        (result) =>
          `File: ${result.payload.repo}/${result.payload.path}\n\n` +
          `Content:\n${result.payload.content}\n---`
      )
      .join('\n\n');

    // 4. Generate repository list for context
    const repoList = config.repos.map((repo) => `- ${repo.name}`).join('\n');

    // 5. Generate AI response
    console.log('Generating answer...');
    const answer = await services.llm.generateAnswer(question, context, repoList);

    // 6. Send response
    res.json({ answer, context });
  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Configuration Endpoint
 * Returns public configuration data for client initialization
 */
app.get('/config', (req, res) => {
  res.json({
    repos: config.repos,
    version: '1.0.0',
    features: {
      contextViewer: true,
      codeHighlighting: true,
    },
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
🚀 RAG Demo Server is running!
📡 URL: http://localhost:${PORT}
📚 Serving ${config.repos.length} repositories
🔍 Using ${config.embeddingModel} for embeddings
🤖 Using ${config.llmModel} for responses
  `);
});
