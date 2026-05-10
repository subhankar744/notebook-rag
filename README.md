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

## RAG Pipeline Details

### 1. Ingestion & Chunking Strategy
The application uses the **RecursiveCharacterTextSplitter** strategy. 
- **Chunk Size:** 1000 characters
- **Chunk Overlap:** 200 characters
- **Why this strategy?** It intelligently splits text based on paragraphs, then sentences, and finally words. This ensures that the context remains meaningful within each chunk, preventing important information from being cut off in the middle of a sentence.

### 2. Embedding & Vector Storage
- **Model:** `sentence-transformers/all-MiniLM-L6-v2` via Hugging Face Inference API (Serverless).
- **Database:** **Qdrant Vector Database**.
- Chunks are converted into 384-dimensional vectors and stored semantically.

### 3. Retrieval & Generation
- **Retriever:** k=5 (retrieves the 5 most relevant document segments).
- **LLM:** `gemini-2.0-flash-lite` via OpenRouter.
- **Prompting:** Uses a strict "System Prompt" that mandates the AI only answer based on the provided context, fulfilling the "groundedness" requirement of the assignment.
