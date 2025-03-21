/**
 * GitHub Repository Code Indexer
 *
 * This module handles the indexing of source code files from GitHub repositories.
 * It provides functionality to:
 * - Clone/update repositories
 * - Traverse directory structures
 * - Extract file contents and metadata
 * - Filter relevant files for indexing
 *
 * @module CodeIndexer
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { shouldProcessFile, shouldExcludeDirectory } from '../utils.js';

const exec = promisify(execCallback);

/**
 * Represents a document extracted from a code file
 * @typedef {Object} CodeDocument
 * @property {string} pageContent - The content of the file
 * @property {Object} metadata - File metadata
 * @property {string} metadata.repo - Repository name
 * @property {string} metadata.path - File path relative to repo root
 * @property {number} metadata.size - File size in bytes
 * @property {Date} metadata.modified - Last modification date
 */

export class CodeIndexer {
  /**
   * Creates a new CodeIndexer instance
   * @param {string} reposDir - Path to the directory where repositories will be cloned
   */
  constructor(reposDir) {
    this.reposDir = reposDir;
  }

  /**
   * Indexes all configured repositories
   * @returns {Promise<CodeDocument[]>} Array of indexed documents
   * @throws {Error} If repository configuration is invalid
   */
  async indexRepositories() {
    const allDocuments = [];

    // Ensure repositories directory exists
    await fs.promises.mkdir(this.reposDir, { recursive: true });

    // Load repository configuration
    const repos = JSON.parse(process.env.GITHUB_REPOS);
    if (!Array.isArray(repos)) {
      throw new Error('Invalid repository configuration');
    }

    // Process each repository
    for (const repo of repos) {
      if (!this.validateRepoConfig(repo)) {
        console.warn('⚠️ Skipping invalid repository config:', repo);
        continue;
      }

      console.log(`\nIndexing ${repo.name}...`);
      try {
        const documents = await this.indexRepository(repo.url, repo.name);
        allDocuments.push(...documents);
        console.log(`✅ Successfully indexed ${documents.length} files from ${repo.name}`);
      } catch (error) {
        console.error(`❌ Failed to index ${repo.name}:`, error);
      }
    }

    return allDocuments;
  }

  /**
   * Indexes a single repository
   * @param {string} repoUrl - Repository URL
   * @param {string} repoName - Repository name
   * @returns {Promise<CodeDocument[]>} Array of indexed documents
   */
  async indexRepository(repoUrl, repoName) {
    const repoPath = path.join(this.reposDir, repoName);

    try {
      await this.ensureRepoCloned(repoUrl, repoPath);
      // Small delay to ensure file system operations are complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.traverseDirectory(repoPath, repoName);
    } catch (error) {
      console.error(`Failed to process repository ${repoName}:`, error);
      return [];
    }
  }

  /**
   * Recursively traverses a directory and processes files
   * @private
   * @param {string} dirPath - Directory path to traverse
   * @param {string} repoName - Repository name for metadata
   * @param {CodeDocument[]} [documents=[]] - Accumulator for documents
   * @returns {CodeDocument[]} Array of processed documents
   */
  traverseDirectory(dirPath, repoName, documents = []) {
    const entries = fs.readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !shouldExcludeDirectory(entry)) {
        this.traverseDirectory(fullPath, repoName, documents);
        continue;
      }

      if (stat.isFile() && shouldProcessFile(entry)) {
        try {
          const document = this.processFile(fullPath, repoName, stat);
          if (document) documents.push(document);
        } catch (error) {
          console.warn(`⚠️ Failed to process ${fullPath}:`, error.message);
        }
      }
    }

    return documents;
  }

  /**
   * Processes a single file and creates a document
   * @private
   * @param {string} filePath - Path to the file
   * @param {string} repoName - Repository name
   * @param {fs.Stats} stats - File stats
   * @returns {CodeDocument|null} Processed document or null if processing failed
   */
  processFile(filePath, repoName, stats) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(path.join(this.reposDir, repoName), filePath);

    return {
      pageContent: content,
      metadata: {
        repo: repoName,
        path: relativePath,
        size: stats.size,
        modified: stats.mtime,
      },
    };
  }

  /**
   * Ensures a repository is cloned and up to date
   * @private
   * @param {string} repoUrl - Repository URL
   * @param {string} repoPath - Local path for the repository
   */
  async ensureRepoCloned(repoUrl, repoPath) {
    if (!fs.existsSync(repoPath)) {
      console.log(`Cloning ${repoUrl}...`);
      await exec(`git clone ${repoUrl} ${repoPath}`);
    } else {
      console.log(`Updating repository...`);
      await exec('git pull', { cwd: repoPath });
    }
  }

  /**
   * Validates repository configuration
   * @private
   * @param {Object} repo - Repository configuration object
   * @returns {boolean} True if configuration is valid
   */
  validateRepoConfig(repo) {
    return repo?.url && repo?.name;
  }
}
