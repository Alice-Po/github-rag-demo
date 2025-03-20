// github-rag.js
import { createReadlineInterface } from './utils.js';
import { QdrantService } from './services/qdrant.js';
import { DocumentProcessor } from './services/document-processor.js';
import { LLMService } from './services/llm.js';
import { CodeIndexer } from './services/code-indexer.js';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

// Initialiser le tableau pour les chunks
const chunks = [];

// Configuration from environment variables
let parsedRepos;
try {
  parsedRepos = process.env.GITHUB_REPOS ? JSON.parse(process.env.GITHUB_REPOS) : null;
  console.log('Dépôts configurés:', process.env.GITHUB_REPOS); // Debug
} catch (error) {
  console.error('⚠️ Erreur de parsing du JSON dans GITHUB_REPOS:', error);
  console.error('Valeur actuelle:', process.env.GITHUB_REPOS);
  process.exit(1);
}

if (!parsedRepos) {
  console.error('⚠️ Aucun dépôt configuré dans GITHUB_REPOS');
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
  console.log("Initialisation de l'assistant de code RAG éthique pour GitHub...");

  try {
    // Initialisation des services
    const qdrant = new QdrantService(config.qdrantUrl);
    const documentProcessor = new DocumentProcessor(config.embeddingModel);
    const llm = new LLMService(config.llmModel, config.hfToken);
    const codeIndexer = new CodeIndexer(config.reposDir);

    // Indexation du code
    await documentProcessor.initialize();
    console.log('Indexation des dépôts...');

    // Indexer chaque dépôt
    for (const repo of config.repos) {
      try {
        console.log(`Indexation du dépôt ${repo.name}...`);
        const documents = await codeIndexer.indexRepository(repo.url, repo.name);
        
        if (!documents || documents.length === 0) {
          console.warn(`⚠️ Aucun document trouvé pour ${repo.name}`);
          continue;
        }
        
        console.log(`📚 ${documents.length} documents trouvés dans ${repo.name}`);
        const processedDocs = await documentProcessor.processDocuments(documents);
        chunks.push(...processedDocs);
      } catch (error) {
        console.error(`❌ Erreur lors du traitement de ${repo.name}:`, error);
      }
    }

    // Préparation de la collection Qdrant
    const collectionName = 'github_code';
    await qdrant.initializeCollection(collectionName);

    // Traitement des documents par lots
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
        `✅ Lot ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} traité`
      );

      // Attendre un peu entre les lots pour éviter la surcharge
      if (i + batchSize < chunks.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, parseInt(process.env.DELAY_BETWEEN_BATCHES) || 500)
        );
      }
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

      const repoList = config.repos.map((repo) => `- ${repo.name}`).join('\n');
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
