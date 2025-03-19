// github-rag.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { HfInference } from '@huggingface/inference';
import { pipeline } from '@xenova/transformers';
import { Document } from 'langchain/document';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { TokenTextSplitter } from 'langchain/text_splitter';
import readline from 'readline';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const exec = promisify(execCallback);

// Configuration
const REPOS = [
  'https://github.com/activitypods/activitypods',
  'https://github.com/assemblee-virtuelle/semapps',
  // Ajoutez ici vos dépôts GitHub
];
const REPOS_DIR = './github_repos';
const EMBEDDING_MODEL = 'Xenova/multilingual-e5-large'; // Modèle multilingue européen
const LLM_MODEL = 'mistralai/Mixtral-8x7B-Instruct-v0.1'; // Modèle français Mistral AI
const HF_TOKEN = process.env.HF_TOKEN || ''; // Optionnel, pour les limites d'accès plus élevées

// 1. Cloner les dépôts
async function cloneRepos() {
  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }

  for (const repoUrl of REPOS) {
    const repoName = repoUrl.split('/').pop();
    const repoPath = path.join(REPOS_DIR, repoName);

    if (!fs.existsSync(repoPath)) {
      console.log(`Clonage de ${repoUrl}...`);
      try {
        await exec(`git clone ${repoUrl} ${repoPath}`);
      } catch (error) {
        console.error(`Erreur lors du clonage de ${repoUrl}:`, error.message);
      }
    } else {
      console.log(`Mise à jour de ${repoName}...`);
      try {
        await exec(`cd ${repoPath} && git pull`);
      } catch (error) {
        console.error(`Erreur lors de la mise à jour de ${repoName}:`, error.message);
      }
    }
  }
}

// 2. Indexer le code
async function indexCode() {
  // Extensions de fichiers à indexer
  const codeExtensions = [
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.html',
    '.css',
    '.py',
    '.java',
    '.go',
    '.rs',
    '.c',
    '.cpp',
    '.h',
  ];
  const docExtensions = ['.md', '.txt', '.rst'];
  const allExtensions = [...codeExtensions, ...docExtensions];

  // Dossiers à exclure
  const excludeDirs = ['.git', 'node_modules', '__pycache__', 'venv', 'dist', 'build'];

  // Préparation de l'embedder
  console.log("Chargement du modèle d'embedding...");
  const embedder = await pipeline('feature-extraction', EMBEDDING_MODEL);

  let documents = [];

  // Parcourir tous les repos
  const repos = fs.readdirSync(REPOS_DIR);
  for (const repoName of repos) {
    const repoPath = path.join(REPOS_DIR, repoName);

    if (fs.statSync(repoPath).isDirectory()) {
      console.log(`Indexation du dépôt ${repoName}...`);

      // Fonction récursive pour parcourir les dossiers
      function traverseDirectory(dirPath) {
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);

          if (stat.isDirectory()) {
            // Ignorer les dossiers exclus
            if (!excludeDirs.includes(file)) {
              traverseDirectory(filePath);
            }
          } else if (stat.isFile()) {
            const fileExt = path.extname(file).toLowerCase();
            if (allExtensions.includes(fileExt)) {
              try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const relativePath = path.relative(repoPath, filePath);

                // Créer un document avec métadonnées
                documents.push({
                  pageContent: content,
                  metadata: {
                    source: filePath,
                    repo: repoName,
                    path: relativePath,
                    extension: fileExt,
                  },
                });
              } catch (error) {
                console.error(`Erreur lors de la lecture de ${filePath}:`, error.message);
              }
            }
          }
        }
      }

      traverseDirectory(repoPath);
    }
  }

  console.log(`Nombre total de fichiers chargés: ${documents.length}`);

  // Découper les documents en morceaux plus petits
  const textSplitter = new TokenTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = [];
  for (const doc of documents) {
    const splits = await textSplitter.splitDocuments([
      new Document({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
      }),
    ]);
    docs.push(...splits);
  }

  console.log(`Nombre total de chunks: ${docs.length}`);

  // Créer les embeddings pour chaque document
  const vectorStore = new MemoryVectorStore();

  // Traiter les documents par lots pour éviter les problèmes de mémoire
  const batchSize = 50;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    console.log(
      `Traitement du lot ${Math.floor(i / batchSize) + 1}/${Math.ceil(docs.length / batchSize)}...`
    );

    // Créer des embeddings pour ce lot
    const embeddings = await Promise.all(
      batch.map(async (doc) => {
        const result = await embedder(doc.pageContent, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
      })
    );

    // Ajouter à la base vectorielle
    for (let j = 0; j < batch.length; j++) {
      await vectorStore.addVectors([embeddings[j]], [batch[j]]);
    }
  }

  console.log('Indexation terminée!');
  return vectorStore;
}

// 3. Configurer le LLM et la chaîne de requête
async function setupQAChain(vectorStore) {
  // Initialiser HuggingFace Inference pour le LLM
  const hf = new HfInference(HF_TOKEN);

  // Fonction pour générer une réponse
  async function generateAnswer(question, context, repoList) {
    const prompt = `
    <instructions>
    Tu es un assistant de programmation expert qui a une connaissance approfondie des dépôts GitHub suivants:
    ${repoList}
    
    En te basant uniquement sur le contexte fourni et ta compréhension générale du code, réponds à la question.
    Si tu ne trouves pas l'information dans le contexte, dis-le clairement.
    Cite toujours les fichiers sources pertinents dans ta réponse.
    </instructions>
    
    <context>
    ${context}
    </context>
    
    <question>
    ${question}
    </question>
    
    <answer>
    `;

    try {
      const response = await hf.textGeneration({
        model: LLM_MODEL,
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.1,
          top_p: 0.95,
          do_sample: true,
        },
      });

      return response.generated_text.trim();
    } catch (error) {
      console.error('Erreur lors de la génération de la réponse:', error);
      return "Désolé, j'ai rencontré une erreur lors de la génération de la réponse.";
    }
  }

  return async function queryCodeAssistant(question) {
    // Rechercher les documents pertinents
    const embedder = await pipeline('feature-extraction', EMBEDDING_MODEL);
    const questionEmbedding = await embedder(question, { pooling: 'mean', normalize: true });
    const results = await vectorStore.similaritySearch(Array.from(questionEmbedding.data), 5);

    // Construire le contexte à partir des résultats de recherche
    const context = results
      .map((doc) => {
        return `Fichier: ${doc.metadata.repo}/${doc.metadata.path}\n\nContenu:\n${doc.pageContent}\n---`;
      })
      .join('\n\n');

    // Générer la liste des dépôts
    const repoList = REPOS.map((repo) => `- ${repo.split('/').pop()}`).join('\n');

    // Générer la réponse
    return await generateAnswer(question, context, repoList);
  };
}

// Interface utilisateur simple en ligne de commande
async function main() {
  console.log("Initialisation de l'assistant de code RAG éthique pour GitHub...");

  try {
    await cloneRepos();
    const vectorStore = await indexCode();
    const queryCodeAssistant = await setupQAChain(vectorStore);

    console.log("\nAssistant prêt! Posez vos questions (tapez 'exit' pour quitter):");

    const readlineInterface = createReadlineInterface();

    const askQuestion = () => {
      readlineInterface.question('\nQuestion: ', async (question) => {
        if (question.toLowerCase() === 'exit') {
          readlineInterface.close();
          return;
        }

        console.log('Recherche en cours...');
        const answer = await queryCodeAssistant(question);
        console.log('\nRéponse:');
        console.log(answer);

        askQuestion();
      });
    };

    askQuestion();
  } catch (error) {
    console.error('Une erreur est survenue:', error);
  }
}

// Démarrer l'application
main();

// Modifier la création du readline interface
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}
