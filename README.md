# GitHub RAG Assistant

## Prerequisites

- Docker
- Docker Compose
- Un token HuggingFace (optionnel)

## Installation

1. Cloner le projet

```bash
git clone https://github.com/activitypods/github-rag-ethical.git
cd github-rag-ethical
```

2. Créer un fichier `.env` et ajouter votre token HuggingFace

```bash
HF_TOKEN=votre_token_huggingface
```

3. Lancer le conteneur

```bash
docker compose -f docker-compose.dev.yml up -d
```

Pour suivre les logs du conteneur, exécuter :

```bash
docker logs rag-av-qdrant-1
```

## Utilisation

L'application va :

1. Cloner les dépôts spécifiés
2. Indexer le code dans Qdrant
3. Démarrer une interface en ligne de commande pour poser des questions

## Structure du projet

- `github-rag.js`: Script principal pour l'assistant RAG
- `docker-compose.yml`: Fichier de configuration Docker
- `.env`: Fichier pour stocker le token HuggingFace
- `github_repos`: Dossier pour stocker les dépôts GitHub clonés
