import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

// Basic utilities
export const exec = promisify(execCallback);
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

// Utility to create readline interface
export function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// File management utilities
export function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

// File extensions configuration
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

// Utility to check if a file should be processed
export function shouldProcessFile(filePath) {
  const ext = getFileExtension(filePath);
  return [...FILE_EXTENSIONS.code, ...FILE_EXTENSIONS.docs].includes(ext);
}

// Utility to check if a directory should be excluded
export function shouldExcludeDirectory(dirName) {
  return FILE_EXTENSIONS.exclude.includes(dirName);
}

// Git repository management utility
export async function gitCloneOrPull(repoUrl, repoPath) {
  const repoName = repoUrl.split('/').pop();

  if (!fs.existsSync(repoPath)) {
    console.log(`Cloning ${repoUrl}...`);
    try {
      await exec(`git clone ${repoUrl} ${repoPath}`);
      return true;
    } catch (error) {
      console.error(`Error cloning ${repoUrl}:`, error.message);
      return false;
    }
  } else {
    console.log(`Updating ${repoName}...`);
    try {
      await exec(`cd ${repoPath} && git pull`);
      return true;
    } catch (error) {
      console.error(`Error updating ${repoName}:`, error.message);
      return false;
    }
  }
}

// Text chunk management utility
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
