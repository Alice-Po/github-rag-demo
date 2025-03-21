/**
 * Document Processor and Embedding Generator
 *
 * This module handles document processing and embedding generation for the RAG system.
 * It provides functionality to:
 * - Split large documents into semantic chunks
 * - Generate embeddings using multilingual models
 * - Process and prepare documents for vector storage
 *
 * The processor uses:
 * - TokenTextSplitter for intelligent document chunking
 * - Xenova Transformers for embedding generation
 * - LangChain's Document structure for consistency
 *
 * @module DocumentProcessor
 */

import { TokenTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { pipeline } from '@xenova/transformers';

/**
 * Represents a processed document chunk
 * @typedef {Object} DocumentChunk
 * @property {string} pageContent - The text content of the chunk
 * @property {Object} metadata - Original document metadata
 */

export class DocumentProcessor {
  /**
   * Creates a new DocumentProcessor instance
   *
   * @param {string} embeddingModel - Identifier of the embedding model to use
   * @example
   * const processor = new DocumentProcessor('Xenova/multilingual-e5-large');
   */
  constructor(embeddingModel) {
    this.embeddingModel = embeddingModel;
    this.embedder = null;
    this.isInitialized = false;
  }

  /**
   * Initializes the embedding pipeline
   *
   * @async
   * @throws {Error} If model loading fails
   * @example
   * await processor.initialize();
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('Loading embedding model:', this.embeddingModel);
      this.embedder = await pipeline('feature-extraction', this.embeddingModel);
      this.isInitialized = true;
      console.log('✅ Embedding model loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load embedding model:', error);
      throw new Error('Embedding model initialization failed');
    }
  }

  /**
   * Splits documents into smaller chunks for optimal processing
   *
   * @async
   * @param {Array<DocumentChunk>} documents - Documents to process
   * @returns {Promise<Array<DocumentChunk>>} Processed document chunks
   *
   * @example
   * const chunks = await processor.processDocuments([
   *   { pageContent: 'Long text...', metadata: { source: 'file.txt' } }
   * ]);
   */
  async processDocuments(documents) {
    const splitter = new TokenTextSplitter({
      chunkSize: 1000, // Target size for each chunk
      chunkOverlap: 200, // Overlap between chunks to maintain context
    });

    const processedDocs = [];

    for (const doc of documents) {
      try {
        const splits = await splitter.splitDocuments([
          new Document({
            pageContent: doc.pageContent,
            metadata: doc.metadata,
          }),
        ]);
        processedDocs.push(...splits);
      } catch (error) {
        console.warn('⚠️ Failed to process document:', error);
        // Continue processing other documents
      }
    }

    console.log(`📄 Processed ${processedDocs.length} document chunks`);
    return processedDocs;
  }

  /**
   * Generates an embedding vector for given text
   *
   * @async
   * @param {string} text - Text to convert to embedding
   * @returns {Promise<{data: Float32Array}>} Normalized embedding vector
   * @throws {Error} If embedder is not initialized or generation fails
   *
   * @example
   * const embedding = await processor.generateEmbedding('Sample text');
   * // embedding.data contains the vector representation
   */
  async generateEmbedding(text) {
    if (!this.isInitialized || !this.embedder) {
      throw new Error('Embedding model not initialized. Call initialize() first.');
    }

    try {
      return await this.embedder(text, {
        pooling: 'mean', // Use mean pooling for sentence embeddings
        normalize: true, // Normalize vectors for cosine similarity
      });
    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Checks if the processor is ready to generate embeddings
   *
   * @returns {boolean} True if the processor is initialized
   */
  isReady() {
    return this.isInitialized && this.embedder !== null;
  }
}
