// github-rag.js
import { createReadlineInterface } from './utils.js';
import { QdrantService } from './services/qdrant.js';
import { DocumentProcessor } from './services/document-processor.js';
import { LLMService } from './services/llm.js';
import { CodeIndexer } from './services/code-indexer.js';

// Configuration from environment variables
const config = {
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  repos: process.env.GITHUB_REPOS
    ? JSON.parse(process.env.GITHUB_REPOS)
    : ['https://github.com/activitypods/activitypods'],
  reposDir: process.env.REPOS_DIR || './github_repos',
  embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/multilingual-e5-large',
  llmModel: process.env.LLM_MODEL || 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  hfToken: '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',
};

async function main() {
  console.log("Initialisation de l'assistant de code RAG éthique pour GitHub...");

  try {
    // Initialisation des services
    const qdrant = new QdrantService(config.qdrantUrl);
    const documentProcessor = new DocumentProcessor(config.embeddingModel);
    const llm = new LLMService(config.llmModel, config.hfToken);
    const codeIndexer = new CodeIndexer(config.reposDir);

    // Indexation du code
    await documentProcessor.initialize();
    const documents = await codeIndexer.indexRepositories();
    const chunks = await documentProcessor.processDocuments(documents);

    // Préparation de la collection Qdrant
    const collectionName = 'github_code';
    await qdrant.initializeCollection(collectionName);

    // Traitement des documents
    for (let i = 0; i < chunks.length; i++) {
      const doc = chunks[i];
      const embedding = await documentProcessor.generateEmbedding(doc.pageContent);
      await qdrant.upsertDocument(collectionName, i, embedding.data, {
        content: doc.pageContent,
        ...doc.metadata,
      });
      console.log(`✅ Document ${i + 1}/${chunks.length} traité`);
    }

    // Interface utilisateur
    console.log("\nAssistant prêt! Posez vos questions (tapez 'exit' pour quitter):");
    const readlineInterface = createReadlineInterface();

    const handleQuestion = async (question) => {
      if (question.toLowerCase() === 'exit') {
        readlineInterface.close();
        return;
      }

      console.log('Recherche en cours...');
      const questionEmbedding = await documentProcessor.generateEmbedding(question);
      const searchResults = await qdrant.searchSimilar(collectionName, questionEmbedding.data);

      const context = searchResults
        .map(
          (result) =>
            `Fichier: ${result.payload.repo}/${result.payload.path}\n\nContenu:\n${result.payload.content}\n---`
        )
        .join('\n\n');

      const repoList = config.repos.map((repo) => `- ${repo.split('/').pop()}`).join('\n');
      const answer = await llm.generateAnswer(question, context, repoList);

      console.log('\nRéponse:');
      console.log(answer);

      readlineInterface.question('\nQuestion: ', handleQuestion);
    };

    readlineInterface.question('\nQuestion: ', handleQuestion);
  } catch (error) {
    console.error('Une erreur est survenue:', error);
  }
}

main();
