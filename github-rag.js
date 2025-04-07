import { createReadlineInterface } from './utils.js';
import { QdrantService } from './services/qdrant.js';
import { DocumentProcessor } from './services/document-processor.js';
import { LLMService } from './services/llm.js';
import { CodeIndexer } from './services/code-indexer.js';
import dotenv from 'dotenv';

dotenv.config();

const chunks = [];

let parsedRepos;
try {
  parsedRepos = process.env.GITHUB_REPOS ? JSON.parse(process.env.GITHUB_REPOS) : null;
  console.log('Configured repositories:', process.env.GITHUB_REPOS);
} catch (error) {
  console.error('⚠️ Error parsing JSON in GITHUB_REPOS:', error);
  console.error('Current value:', process.env.GITHUB_REPOS);
  process.exit(1);
}

if (!parsedRepos) {
  console.error('⚠️ No repositories configured in GITHUB_REPOS');
  process.exit(1);
}

const config = {
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  repos: parsedRepos,
  reposDir: process.env.REPOS_DIR || './github_repos',
  embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/multilingual-e5-large',
  llmModel: process.env.LLM_MODEL || 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  hfToken: process.env.HF_TOKEN,
};

async function main() {
  console.log('Initializing ethical code RAG assistant for GitHub...');

  try {
    // Initialize services
    const qdrant = new QdrantService(config.qdrantUrl);
    const documentProcessor = new DocumentProcessor(config.embeddingModel);
    const llm = new LLMService(config.llmModel, config.hfToken);
    const codeIndexer = new CodeIndexer(config.reposDir);

    // Code indexing
    await documentProcessor.initialize();
    console.log('Indexing repositories...');

    // Index each repository
    for (const repo of config.repos) {
      try {
        console.log(`Indexing repository ${repo.name}...`);
        const documents = await codeIndexer.indexRepository(repo.url, repo.name);

        if (!documents || documents.length === 0) {
          console.warn(`⚠️ No documents found for ${repo.name}`);
          continue;
        }

        console.log(`📚 ${documents.length} documents found in ${repo.name}`);
        const processedDocs = await documentProcessor.processDocuments(documents);
        chunks.push(...processedDocs);
      } catch (error) {
        console.error(`❌ Error processing ${repo.name}:`, error);
      }
    }

    // Prepare Qdrant collection
    const collectionName = 'github_code';
    await qdrant.initializeCollection(collectionName);

    // Process documents in batches
    const batchSize = parseInt(process.env.BATCH_SIZE) || 1;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      for (const doc of batch) {
        const embedding = await documentProcessor.generateEmbedding(doc.pageContent);
        await qdrant.upsertDocument(collectionName, i, embedding.data, {
          content: doc.pageContent,
          ...doc.metadata,
        });
      }
      console.log(
        `✅ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          chunks.length / batchSize
        )} processed`
      );

      // Wait between batches to avoid overload
      if (i + batchSize < chunks.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, parseInt(process.env.DELAY_BETWEEN_BATCHES) || 500)
        );
      }
    }

    // User interface
    console.log("\nAssistant ready! Ask your questions (type 'exit' to quit):");
    const readlineInterface = createReadlineInterface();

    const handleQuestion = async (question) => {
      if (question.toLowerCase() === 'exit') {
        readlineInterface.close();
        return;
      }

      console.log('Searching...');
      const questionEmbedding = await documentProcessor.generateEmbedding(question);
      const searchResults = await qdrant.searchSimilar(collectionName, questionEmbedding.data);

      const context = searchResults
        .map(
          (result) =>
            `File: ${result.payload.repo}/${result.payload.path}\n\nContent:\n${result.payload.content}\n---`
        )
        .join('\n\n');

      const repoList = config.repos.map((repo) => `- ${repo.name}`).join('\n');
      const answer = await llm.generateAnswer(question, context, repoList);

      console.log('\nAnswer:');
      console.log(answer);

      readlineInterface.question('\nQuestion: ', handleQuestion);
    };

    readlineInterface.question('\nQuestion: ', handleQuestion);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main();
