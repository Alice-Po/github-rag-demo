import { TokenTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { pipeline } from '@xenova/transformers';
import { delay } from '../utils.js';

/**
 * @class DocumentProcessor
 * @description Classe responsable du traitement des documents et de la génération des embeddings.
 * Elle gère le découpage des documents en chunks et la transformation du texte en vecteurs
 * via un modèle d'embedding multilingue.
 */
export class DocumentProcessor {
  /**
   * @constructor
   * @param {string} embeddingModel - Identifiant du modèle d'embedding à utiliser (ex: 'Xenova/multilingual-e5-large')
   * @description Initialise le processeur de documents avec un modèle d'embedding spécifique
   */
  constructor(embeddingModel) {
    this.embeddingModel = embeddingModel;
  }

  /**
   * Initialise le pipeline de traitement des embeddings
   * @async
   * @returns {Promise<void>}
   * @description Charge le modèle d'embedding en mémoire et prépare le pipeline de transformation.
   * Cette étape doit être effectuée avant toute génération d'embedding.
   * @throws {Error} Si le chargement du modèle échoue
   */
  async initialize() {
    console.log("Chargement du modèle d'embedding...");
    this.embedder = await pipeline('feature-extraction', this.embeddingModel);
  }

  /**
   * Découpe les documents en chunks plus petits pour un traitement optimal
   * @async
   * @param {Array<{pageContent: string, metadata: Object}>} documents - Liste des documents à traiter
   * @returns {Promise<Array<{pageContent: string, metadata: Object}>>} Documents découpés en chunks
   * @description Utilise TokenTextSplitter pour découper les documents en morceaux plus petits
   * tout en préservant leurs métadonnées. Cette étape est cruciale pour :
   * 1. Respecter les limites de taille du modèle d'embedding
   * 2. Créer des chunks sémantiquement cohérents
   * 3. Optimiser la recherche de similarité
   */
  async processDocuments(documents) {
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

    return docs;
  }

  /**
   * Génère un embedding vectoriel pour un texte donné
   * @async
   * @param {string} text - Texte à transformer en vecteur
   * @returns {Promise<{data: Float32Array}>} Vecteur d'embedding normalisé
   * @description Transforme un texte en vecteur numérique via le modèle d'embedding.
   * Les options de pooling et de normalisation sont configurées pour optimiser
   * la recherche de similarité sémantique.
   * @throws {Error} Si le modèle n'est pas initialisé ou si la transformation échoue
   */
  async generateEmbedding(text) {
    return this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    });
  }
}
