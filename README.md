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
docker-compose up --build
```

## Utilisation

1. Ouvrir un terminal et lancer la commande suivante

```bash
npm install
```

2. Lancer l'assistant

```bash
npm start
```
