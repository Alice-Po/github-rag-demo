import { createReadlineInterface } from './utils.js';
import { QdrantService } from './services/qdrant.js';
import { DocumentProcessor } from './services/document-processor.js';
import { LLMService } from './services/llm.js';

// Configuration en dur pour les tests
const config = {
  qdrantUrl: 'http://localhost:6333',
  repos: ['https://github.com/activitypods/activitypods'],
  embeddingModel: 'Xenova/multilingual-e5-large',
  llmModel: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  hfToken: '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', // Remplacez par votre vrai token
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
        const repoList = config.repos.map((repo) => `- ${repo.split('/').pop()}`).join('\n');

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
