import fs from 'fs';
import path from 'path';
import { shouldProcessFile, shouldExcludeDirectory } from '../utils.js';

/**
 * @class CodeIndexer
 * @description Classe responsable de l'indexation des fichiers de code source dans les dépôts GitHub.
 * Elle parcourt récursivement les répertoires pour extraire le contenu des fichiers et leurs métadonnées.
 */
export class CodeIndexer {
  /**
   * @constructor
   * @param {string} reposDir - Chemin vers le répertoire contenant les dépôts clonés
   */
  constructor(reposDir) {
    this.reposDir = reposDir;
  }

  /**
   * Indexe tous les dépôts présents dans le répertoire configuré
   * @async
   * @returns {Promise<Array<{pageContent: string, metadata: Object}>>} Liste des documents indexés
   * @description Parcourt tous les dépôts dans le répertoire configuré et indexe leurs fichiers.
   * Chaque document contient le contenu du fichier et ses métadonnées (chemin, dépôt, etc.)
   */
  async indexRepositories() {
    let documents = [];
    const repos = fs.readdirSync(this.reposDir);

    for (const repoName of repos) {
      const repoPath = path.join(this.reposDir, repoName);
      if (fs.statSync(repoPath).isDirectory()) {
        console.log(`Indexation du dépôt ${repoName}...`);
        documents = [...documents, ...this.traverseDirectory(repoPath, repoName)];
      }
    }

    return documents;
  }

  /**
   * Parcourt récursivement un répertoire pour indexer les fichiers
   * @private
   * @param {string} dirPath - Chemin du répertoire à parcourir
   * @param {string} repoName - Nom du dépôt en cours d'indexation
   * @returns {Array<{pageContent: string, metadata: Object}>} Liste des documents indexés dans ce répertoire
   * @description Fonction récursive qui :
   * 1. Parcourt tous les fichiers d'un répertoire
   * 2. Ignore les répertoires exclus (node_modules, .git, etc.)
   * 3. Traite les fichiers avec les extensions configurées
   * 4. Extrait le contenu et les métadonnées de chaque fichier
   */
  traverseDirectory(dirPath, repoName) {
    const documents = [];
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !shouldExcludeDirectory(file)) {
        documents.push(...this.traverseDirectory(filePath, repoName));
      } else if (stat.isFile() && shouldProcessFile(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const relativePath = path.relative(path.join(this.reposDir, repoName), filePath);

          documents.push({
            pageContent: content,
            metadata: {
              source: filePath,
              repo: repoName,
              path: relativePath,
              extension: path.extname(filePath).toLowerCase(),
            },
          });
        } catch (error) {
          console.error(`Erreur lors de la lecture de ${filePath}:`, error.message);
        }
      }
    }

    return documents;
  }
}
