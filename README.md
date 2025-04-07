# GitHub RAG Assistant

This is a dirty fast-made demo of a RAG assistant that uses a QDrant vector database to store the data and a LLM to answer questions on specific repositories.

## Prerequisites

- Docker
- Node v20.17.0
- A HuggingFace token

## Installation

1. Clone the project

```bash
git clone https://github.com/Alice-Po/github-rag-demo.git
cd github-rag-demo
```

2. Create a `.env.local` file and add your HuggingFace token

```bash
HF_TOKEN=your_huggingface_token
```

3. Start the QDrant vector database container

```bash
docker compose -f docker-compose.dev.yml up -d
```

To follow container logs, run:

```bash
docker logs rag-av-qdrant-1
```

## Usage

### Update data in the QDrant vector database

In this example, we will update the data in the QDrant vector database based on the repositories configured in the .env file

```bash
npm run update-datas
```

### Ask questions to the RAG assistant in command line to test the RAG

```bash
npm run ask
```

### Start the application

```bash
npm run api
```

### Start the frontend

```bash
cd frontend && npm run dev
```
