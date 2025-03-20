import fs from 'fs';
import path from 'path';
import { shouldProcessFile, shouldExcludeDirectory } from '../utils.js';
import { exec } from 'child_process';

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
    const allDocuments = [];

    // Créer le répertoire des dépôts s'il n'existe pas
    if (!fs.existsSync(this.reposDir)) {
      fs.mkdirSync(this.reposDir, { recursive: true });
    }

    // Charger la configuration des dépôts
    const repos = JSON.parse(process.env.GITHUB_REPOS);
    if (!repos || !Array.isArray(repos)) {
      throw new Error('Configuration des dépôts invalide');
    }

    // Indexer chaque dépôt
    for (const repo of repos) {
      if (!repo.url || !repo.name) {
        console.warn('⚠️ Dépôt mal configuré, ignoré:', repo);
        continue;
      }

      console.log(`\nIndexation de ${repo.name}...`);
      const repoPath = path.join(this.reposDir, repo.name);

      try {
        // Cloner ou mettre à jour le dépôt
        if (!fs.existsSync(repoPath)) {
          console.log(`Clonage de ${repo.url}...`);
          await exec(`git clone ${repo.url} ${repoPath}`);
        } else {
          console.log(`Mise à jour de ${repo.name}...`);
          await exec('git pull', { cwd: repoPath });
        }

        // Indexer les fichiers du dépôt
        const documents = this.traverseDirectory(repoPath, repo.name);
        allDocuments.push(...documents);
      } catch (error) {
        console.error(`❌ Erreur lors de l'indexation de ${repo.name}:`, error);
      }
    }

    return allDocuments;
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
  traverseDirectory(dirPath, repoName, documents = []) {
    const entries = fs.readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!shouldExcludeDirectory(entry)) {
          this.traverseDirectory(fullPath, repoName, documents);
        }
      } else if (stat.isFile() && shouldProcessFile(entry)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const relativePath = path.relative(path.join(this.reposDir, repoName), fullPath);

          documents.push({
            pageContent: content,
            metadata: {
              repo: repoName,
              path: relativePath,
              size: stat.size,
              modified: stat.mtime,
            },
          });
        } catch (error) {
          console.warn(`⚠️ Impossible de lire le fichier ${fullPath}:`, error.message);
        }
      }
    }

    return documents;
  }

  async indexRepository(repoUrl, repoName) {
    const repoPath = path.join(this.reposDir, repoName);

    try {
      // S'assurer que le répertoire parent existe
      await fs.promises.mkdir(this.reposDir, { recursive: true });

      // Cloner ou mettre à jour le dépôt
      if (!fs.existsSync(repoPath)) {
        console.log(`Clonage de ${repoUrl}...`);
        await new Promise((resolve, reject) => {
          exec(`git clone ${repoUrl} ${repoPath}`, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      } else {
        console.log(`Mise à jour de ${repoName}...`);
        await new Promise((resolve, reject) => {
          exec('git pull', { cwd: repoPath }, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      // Attendre un peu pour s'assurer que les fichiers sont bien écrits
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Indexer les fichiers du dépôt
      return this.traverseDirectory(repoPath, repoName);
    } catch (error) {
      console.error(`❌ Erreur lors de l'indexation de ${repoName}:`, error);
      return [];
    }
  }
}
