import { createReadlineInterface } from './utils.js';
import { QdrantService } from './services/qdrant.js';
import { DocumentProcessor } from './services/document-processor.js';
import { LLMService } from './services/llm.js';
import dotenv from 'dotenv';

// Load environment variables from .env and .env.local
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

// Parse repositories configuration
let parsedRepos;
try {
  parsedRepos = process.env.GITHUB_REPOS ? JSON.parse(process.env.GITHUB_REPOS) : null;
} catch (error) {
  console.error('⚠️ Error parsing JSON in GITHUB_REPOS:', error);
  process.exit(1);
}

if (!parsedRepos) {
  console.error('⚠️ No repositories configured in GITHUB_REPOS');
  process.exit(1);
}

// Configuration from environment variables
const config = {
  qdrantUrl: process.env.QDRANT_URL,
  repos: parsedRepos,
  embeddingModel: process.env.EMBEDDING_MODEL,
  llmModel: process.env.LLM_MODEL,
  hfToken: process.env.HF_TOKEN,
};

/**
 * Starts a Q&A session with the assistant
 */
async function startQASession() {
  console.log('Initializing assistant...');

  try {
    // Initialize required services
    const qdrant = new QdrantService(config.qdrantUrl);
    const documentProcessor = new DocumentProcessor(config.embeddingModel);
    const llm = new LLMService(config.llmModel, config.hfToken);

    // Initialize embedding model
    await documentProcessor.initialize();

    console.log("\nAssistant ready! Ask your questions (type 'exit' to quit):");
    const readlineInterface = createReadlineInterface();

    const handleQuestion = async (question) => {
      if (question.toLowerCase() === 'exit') {
        console.log('\nGoodbye! 👋');
        readlineInterface.close();
        return;
      }

      try {
        console.log('\nSearching...');
        // Generate question embedding
        const questionEmbedding = await documentProcessor.generateEmbedding(question);

        // Search for relevant documents
        const searchResults = await qdrant.searchSimilar('github_code', questionEmbedding.data);

        // Build context from results
        const context = searchResults
          .map(
            (result) =>
              `File: ${result.payload.repo}/${result.payload.path}\n\nContent:\n${result.payload.content}\n---`
          )
          .join('\n\n');

        // Prepare repository list for context
        const repoList = config.repos.map((repo) => `- ${repo.name}`).join('\n');

        // Generate response
        const answer = await llm.generateAnswer(question, context, repoList);

        console.log('\nAnswer:');
        console.log(answer);
      } catch (error) {
        console.error('\nError processing question:', error.message);
      }

      // Ready for next question
      readlineInterface.question('\nQuestion: ', handleQuestion);
    };

    // Start first interaction
    readlineInterface.question('\nQuestion: ', handleQuestion);
  } catch (error) {
    console.error('An error occurred during initialization:', error);
    process.exit(1);
  }
}

// Start the session
startQASession();
