import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Setup Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

let vectorStore;

// Chunking Strategy: RecursiveCharacterTextSplitter
// It splits by characters but tries to keep paragraphs and sentences together.
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large",
});

// Upload and Index Endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const loader = new PDFLoader(filePath);
    const rawDocs = await loader.load();

    // Chunking
    const docs = await textSplitter.splitDocuments(rawDocs);

    // Indexing into Qdrant
    vectorStore = await QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: process.env.COLLECTION_NAME,
    });

    // Cleanup: remove uploaded file after processing
    fs.unlinkSync(filePath);

    res.json({ message: "File uploaded and indexed successfully" });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Chat Endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!vectorStore) {
      // Try to load existing collection if vectorStore is not in memory
      vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collectionName: process.env.COLLECTION_NAME,
      });
    }

    // Retrieval
    const retriever = vectorStore.asRetriever({ k: 5 });
    const relevantDocs = await retriever.invoke(message);

    // Generation using OpenRouter
    const client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
    });

    const context = relevantDocs
      .map((doc) => `Content: ${doc.pageContent}\nMetadata: ${JSON.stringify(doc.metadata)}`)
      .join("\n\n");

    const systemPrompt = `
      You are an AI Assistant that helps users by answering questions based on the provided document context.
      
      RULES:
      1. ONLY answer based on the provided context.
      2. If the answer is not in the context, politely state that you cannot answer based on the document.
      3. Mention page numbers or sources if available in metadata.
      4. Do NOT use your general knowledge to answer questions that are not covered in the context.

      CONTEXT:
      ${context}
    `;

    const response = await client.chat.completions.create({
      model: "google/gemini-2.0-flash-lite-preview-02-05:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    res.json({ answer: response.choices[0].message.content });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
