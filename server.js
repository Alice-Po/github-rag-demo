import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { QdrantService } from './services/qdrant.js';
import { DocumentProcessor } from './services/document-processor.js';
import { LLMService } from './services/llm.js';

// Charger les variables d'environnement
dotenv.config();

// Vérifier que le token est présent
if (!process.env.HF_TOKEN) {
  console.error("⚠️ HF_TOKEN manquant dans les variables d'environnement");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
let parsedRepos;
try {
  parsedRepos = process.env.GITHUB_REPOS ? JSON.parse(process.env.GITHUB_REPOS) : null;
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
  embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/multilingual-e5-large',
  llmModel: process.env.LLM_MODEL || 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  hfToken: process.env.HF_TOKEN,
  repos: parsedRepos,
  reposDir: process.env.REPOS_DIR || './github_repos',
};

// Vérifier la configuration au démarrage
console.log('Configuration chargée :', {
  ...config,
  hfToken: config.hfToken ? '***' : 'NON DÉFINI ⚠️',
});

// Initialiser les services
const qdrant = new QdrantService(config.qdrantUrl);
const documentProcessor = new DocumentProcessor(config.embeddingModel);
const llm = new LLMService(config.llmModel, config.hfToken);

// Route de test pour vérifier que l'API fonctionne
app.get('/', (req, res) => {
  res.json({ message: 'API RAG is running' });
});

// Initialiser le modèle d'embedding
await documentProcessor.initialize();

app.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    console.log('Question reçue:', question);

    if (!question || typeof question !== 'string') {
      throw new Error('Question invalide');
    }

    const questionEmbedding = await documentProcessor.generateEmbedding(question);
    console.log('Embedding généré');

    const searchResults = await qdrant.searchSimilar('github_code', questionEmbedding.data, 5);
    console.log('Résultats de recherche:', searchResults.length);

    if (!searchResults || searchResults.length === 0) {
      throw new Error('Aucun résultat trouvé');
    }

    const context = searchResults
      .map(
        (result) =>
          `Fichier: ${result.payload.repo}/${result.payload.path}\n\nContenu:\n${result.payload.content}\n---`
      )
      .join('\n\n');

    // Mise à jour de la génération de la liste des repos
    const repoList = config.repos.map((repo) => `- ${repo.name}`).join('\n');
    console.log('Liste des repos:', repoList);

    const answer = await llm.generateAnswer(question, context, repoList);
    console.log('Réponse générée');

    // Extraire l'URL du dépôt des résultats
    const repoUrl = searchResults[0]?.payload?.repo || config.repos[0].url;

    res.json({
      answer,
      context,
      repoUrl, // Ajouter l'URL du dépôt à la réponse
    });
  } catch (error) {
    console.error('Error détaillée:', error);
    res.status(500).json({
      error: 'Une erreur est survenue',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

app.get('/config', (req, res) => {
  res.json({
    repos: config.repos,
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log('Configuration:', {
    ...config,
    hfToken: '***', // Masquer le token dans les logs
  });
});
