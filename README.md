# Notebook RAG

Your own version of Google NotebookLM. Upload documents and have grounded conversations with them.

## Features
- **PDF Upload:** Seamlessly upload and process PDF documents.
- **Intelligent Chunking:** Uses `RecursiveCharacterTextSplitter` to preserve context while splitting text.
- **Vector Search:** Powered by Qdrant and OpenAI Embeddings for fast, semantic retrieval.
- **Grounded AI:** Answers are strictly based on the uploaded document, preventing hallucinations.

## Tech Stack
- **Frontend:** React, Vite, Lucide React, Axios
- **Backend:** Node.js, Express, Multer
- **AI/RAG:** LangChain, OpenAI (GPT-4o-mini & Text Embeddings)
- **Database:** Qdrant (Vector Store)

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- An OpenAI API Key
- A Qdrant instance (Local via Docker or Qdrant Cloud)

### 2. Backend Setup
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Open `.env` and add your credentials:
   ```env
   OPENAI_API_KEY=your_key_here
   QDRANT_URL=http://localhost:6333
   COLLECTION_NAME=notebook-rag
   ```
3. Start the server:
   ```bash
   npm start
   ```

### 3. Frontend Setup
1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

### 4. Running Qdrant Locally (Recommended)
If you have Docker installed, you can run Qdrant with:
```bash
docker run -p 6333:6333 qdrant/qdrant
```

## How it Works
1. **Ingestion:** When you upload a PDF, the server loads it and splits it into smaller chunks (1000 characters with 200 overlap).
2. **Embedding:** Each chunk is converted into a high-dimensional vector using OpenAI's `text-embedding-3-large` model.
3. **Indexing:** These vectors are stored in a Qdrant collection.
4. **Retrieval:** When you ask a question, your query is embedded, and the most relevant chunks are retrieved from Qdrant.
5. **Generation:** The retrieved chunks are sent to GPT-4o-mini with a strict prompt to ensure the answer is grounded in the document.
