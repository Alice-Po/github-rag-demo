import { QdrantClient } from '@qdrant/js-client-rest';

export class QdrantService {
  constructor(url = 'http://localhost:6333') {
    this.client = new QdrantClient({
      url,
      timeout: 120000,
      dispatcher: {
        maxHeaderSize: 16384, // 16KB pour les headers
        bodyTimeout: 30000, // 30s timeout pour le body
        headersTimeout: 30000, // 30s timeout pour les headers
        keepAliveTimeout: 30000, // Keep-alive de 30s
        keepAliveMaxTimeout: 30000, // Max keep-alive de 30s
        maxRequestsPerClient: 1, // Une seule requête à la fois
      },
      retry: {
        attempts: 3,
        delay: 2000,
        factor: 1.5,
      },
    });
  }

  /**
   * Initialise ou réinitialise une collection
   * @param {string} collectionName - Nom de la collection
   * @param {number} vectorSize - Taille des vecteurs (défaut: 1024)
   * @returns {Promise<void>}
   */
  async initializeCollection(collectionName, vectorSize = 1024) {
    // Supprimer la collection existante
    try {
      await this.client.deleteCollection(collectionName);
      console.log('Collection existante supprimée');
    } catch (error) {
      console.log('Aucune collection existante à supprimer');
    }

    // Créer la nouvelle collection
    try {
      await this.client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });
    } catch (error) {
      console.log('Collection existe déjà ou erreur:', error.message);
    }
  }

  /**
   * Insère ou met à jour un document avec gestion de flux
   */
  async upsertDocument(collectionName, id, vector, payload) {
    // Vérification de la taille des données
    const dataSize = JSON.stringify({ id, vector, payload }).length;
    if (dataSize > 10000) {
      // 10KB limit
      console.warn(`⚠️ Large document detected (${dataSize} bytes), splitting recommended`);
    }

    try {
      // Ajout d'un délai entre les requêtes pour éviter la surcharge
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await this.client.upsert(collectionName, {
        wait: true,
        points: [
          {
            id,
            vector: Array.from(vector),
            payload: {
              ...payload,
              _size: dataSize, // Pour le monitoring
            },
          },
        ],
      });

      console.log(`✅ Document inséré (${dataSize} bytes)`);
      return response;
    } catch (error) {
      if (error.cause?.code === 'UND_ERR_SOCKET') {
        console.error(`🚨 Erreur socket - taille: ${dataSize} bytes`);
        // Attendre plus longtemps avant de réessayer
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Réessayer une fois
        return this.upsertDocument(collectionName, id, vector, payload);
      }
      throw new Error(`Erreur upsert: ${error.message}`);
    }
  }

  /**
   * Recherche les documents similaires dans une collection
   * @param {string} collectionName - Nom de la collection
   * @param {Float32Array} vector - Vecteur de recherche
   * @param {number} limit - Nombre maximum de résultats (défaut: 5)
   * @returns {Promise<Array>} Résultats de la recherche
   */
  async searchSimilar(collectionName, vector, limit = 5) {
    try {
      const results = await this.client.search(collectionName, {
        vector: Array.from(vector),
        limit,
        with_payload: true, // Pour récupérer les métadonnées
      });
      return results;
    } catch (error) {
      console.error('Erreur lors de la recherche:', error.message);
      throw error;
    }
  }
}
