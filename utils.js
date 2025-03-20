import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

// Utilitaires de base
export const exec = promisify(execCallback);
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

// Utilitaire pour créer l'interface readline
export function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Utilitaires pour la gestion des fichiers
export function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

// Configuration des extensions de fichiers
export const FILE_EXTENSIONS = {
  code: [
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
  ],
  docs: ['.md', '.txt', '.rst'],
  exclude: ['.git', 'node_modules', '__pycache__', 'venv', 'dist', 'build'],
};

// Utilitaire pour vérifier si un fichier doit être traité
export function shouldProcessFile(filePath) {
  const ext = getFileExtension(filePath);
  return [...FILE_EXTENSIONS.code, ...FILE_EXTENSIONS.docs].includes(ext);
}

// Utilitaire pour vérifier si un dossier doit être exclu
export function shouldExcludeDirectory(dirName) {
  return FILE_EXTENSIONS.exclude.includes(dirName);
}

// Utilitaire pour la gestion des dépôts Git
export async function gitCloneOrPull(repoUrl, repoPath) {
  const repoName = repoUrl.split('/').pop();

  if (!fs.existsSync(repoPath)) {
    console.log(`Clonage de ${repoUrl}...`);
    try {
      await exec(`git clone ${repoUrl} ${repoPath}`);
      return true;
    } catch (error) {
      console.error(`Erreur lors du clonage de ${repoUrl}:`, error.message);
      return false;
    }
  } else {
    console.log(`Mise à jour de ${repoName}...`);
    try {
      await exec(`cd ${repoPath} && git pull`);
      return true;
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de ${repoName}:`, error.message);
      return false;
    }
  }
}

// Utilitaire pour la gestion des chunks de texte
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
