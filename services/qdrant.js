/**
 * Qdrant Vector Database Service
 *
 * This module provides an interface to the Qdrant vector database for:
 * - Managing collections of vector embeddings
 * - Upserting documents with their embeddings
 * - Performing similarity searches
 *
 * Key features:
 * - Automatic retry mechanism
 * - Connection pooling
 * - Error handling
 * - Rate limiting
 *
 * @module QdrantService
 */

import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Default client configuration for optimal performance
 */
const DEFAULT_CLIENT_CONFIG = {
  timeout: 120000, // 2 minutes
  dispatcher: {
    maxHeaderSize: 16384, // 16KB headers
    bodyTimeout: 30000, // 30s body timeout
    headersTimeout: 30000, // 30s headers timeout
    keepAliveTimeout: 30000, // 30s keep-alive
    keepAliveMaxTimeout: 30000,
    maxRequestsPerClient: 1, // Single request per client for stability
  },
  retry: {
    attempts: 3, // Retry failed requests
    delay: 2000, // Initial delay between retries
    factor: 1.5, // Exponential backoff factor
  },
};

export class QdrantService {
  /**
   * Creates a new Qdrant service instance
   *
   * @param {string} url - Qdrant server URL
   * @example
   * const qdrant = new QdrantService('http://localhost:6333');
   */
  constructor(url = 'http://localhost:6333') {
    this.client = new QdrantClient({ url, ...DEFAULT_CLIENT_CONFIG });
  }

  /**
   * Initializes or reinitializes a collection
   *
   * @param {string} collectionName - Name of the collection
   * @param {number} vectorSize - Size of the embedding vectors
   * @returns {Promise<void>}
   * @throws {Error} If collection creation fails
   *
   * @example
   * await qdrant.initializeCollection('code_embeddings', 1024);
   */
  async initializeCollection(collectionName, vectorSize = 1024) {
    try {
      // Remove existing collection if any
      await this.client.deleteCollection(collectionName).catch(() => {
        // Ignore errors if collection doesn't exist
      });

      // Create new collection
      await this.client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine', // Cosine similarity for embeddings
        },
      });

      console.log(`✅ Collection ${collectionName} initialized`);
    } catch (error) {
      console.error(`❌ Failed to initialize collection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inserts or updates a document with rate limiting and retry
   *
   * @param {string} collectionName - Target collection
   * @param {string|number} id - Unique document identifier
   * @param {Float32Array|number[]} vector - Embedding vector
   * @param {Object} payload - Document metadata
   * @returns {Promise<Object>} Upsert operation result
   * @throws {Error} If upsert fails after retries
   *
   * @example
   * await qdrant.upsertDocument('code_embeddings', 'file1',
   *   embeddings,
   *   { path: 'src/file1.js', content: '...' }
   * );
   */
  async upsertDocument(collectionName, id, vector, payload) {
    const dataSize = this.calculateDataSize({ id, vector, payload });

    // Warn about large documents
    if (dataSize > 10000) {
      // 10KB threshold
      console.warn(`⚠️ Large document detected (${dataSize} bytes)`);
    }

    try {
      // Rate limiting delay
      await this.rateLimit();

      const response = await this.client.upsert(collectionName, {
        wait: true,
        points: [
          {
            id,
            vector: Array.from(vector),
            payload: {
              ...payload,
              _size: dataSize, // For monitoring
              _timestamp: Date.now(),
            },
          },
        ],
      });

      console.log(`✅ Document ${id} upserted (${dataSize} bytes)`);
      return response;
    } catch (error) {
      if (this.isRetryableError(error)) {
        console.warn(`⚠️ Retrying upsert for document ${id}`);
        await this.delay(2000);
        return this.upsertDocument(collectionName, id, vector, payload);
      }
      throw new Error(`Upsert failed: ${error.message}`);
    }
  }

  /**
   * Searches for similar documents using vector similarity
   *
   * @param {string} collectionName - Collection to search in
   * @param {Float32Array|number[]} vector - Query vector
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Similar documents with scores
   * @throws {Error} If search fails
   *
   * @example
   * const results = await qdrant.searchSimilar('code_embeddings',
   *   queryEmbeddings,
   *   5
   * );
   */
  async searchSimilar(collectionName, vector, limit = 5) {
    try {
      return await this.client.search(collectionName, {
        vector: Array.from(vector),
        limit,
        with_payload: true,
      });
    } catch (error) {
      console.error('Search failed:', error.message);
      throw error;
    }
  }

  /**
   * Calculates size of document data
   * @private
   */
  calculateDataSize(data) {
    return JSON.stringify(data).length;
  }

  /**
   * Implements rate limiting delay
   * @private
   */
  async rateLimit() {
    await this.delay(100);
  }

  /**
   * Utility method for delays
   * @private
   */
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Checks if an error is retryable
   * @private
   */
  isRetryableError(error) {
    return error.cause?.code === 'UND_ERR_SOCKET';
  }
}
