import { createReadlineInterface } from './utils.js';
import { QdrantService } from './services/qdrant.js';
import { DocumentProcessor } from './services/document-processor.js';
import { LLMService } from './services/llm.js';
import dotenv from 'dotenv';

// Charger les variables d'environnement de .env et .env.local
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

// Parser la configuration des dépôts
let parsedRepos;
try {
  parsedRepos = process.env.GITHUB_REPOS ? JSON.parse(process.env.GITHUB_REPOS) : null;
} catch (error) {
  console.error('⚠️ Erreur de parsing du JSON dans GITHUB_REPOS:', error);
  process.exit(1);
}

if (!parsedRepos) {
  console.error('⚠️ Aucun dépôt configuré dans GITHUB_REPOS');
  process.exit(1);
}

// Configuration depuis les variables d'environnement
const config = {
  qdrantUrl: process.env.QDRANT_URL,
  repos: parsedRepos,
  embeddingModel: process.env.EMBEDDING_MODEL,
  llmModel: process.env.LLM_MODEL,
  hfToken: process.env.HF_TOKEN,
};

/**
 * Démarre une session de questions-réponses avec l'assistant
 */
async function startQASession() {
  console.log("Initialisation de l'assistant...");

  try {
    // Initialisation des services nécessaires
    const qdrant = new QdrantService(config.qdrantUrl);
    const documentProcessor = new DocumentProcessor(config.embeddingModel);
    const llm = new LLMService(config.llmModel, config.hfToken);

    // Initialisation du modèle d'embedding
    await documentProcessor.initialize();

    console.log("\nAssistant prêt! Posez vos questions (tapez 'exit' pour quitter):");
    const readlineInterface = createReadlineInterface();

    const handleQuestion = async (question) => {
      if (question.toLowerCase() === 'exit') {
        console.log('\nAu revoir! 👋');
        readlineInterface.close();
        return;
      }

      try {
        console.log('\nRecherche en cours...');
        // Générer l'embedding de la question
        const questionEmbedding = await documentProcessor.generateEmbedding(question);

        // Rechercher les documents pertinents
        const searchResults = await qdrant.searchSimilar('github_code', questionEmbedding.data);

        // Construire le contexte à partir des résultats
        const context = searchResults
          .map(
            (result) =>
              `Fichier: ${result.payload.repo}/${result.payload.path}\n\nContenu:\n${result.payload.content}\n---`
          )
          .join('\n\n');

        // Préparer la liste des dépôts pour le contexte
        const repoList = config.repos.map((repo) => `- ${repo.name}`).join('\n');

        // Générer la réponse
        const answer = await llm.generateAnswer(question, context, repoList);

        console.log('\nRéponse:');
        console.log(answer);
      } catch (error) {
        console.error('\nErreur lors du traitement de la question:', error.message);
      }

      // Prêt pour la prochaine question
      readlineInterface.question('\nQuestion: ', handleQuestion);
    };

    // Démarrer la première interaction
    readlineInterface.question('\nQuestion: ', handleQuestion);
  } catch (error) {
    console.error("Une erreur est survenue lors de l'initialisation:", error);
    process.exit(1);
  }
}

// Démarrer la session
startQASession();
