import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAI } from "openai";
import { fetch, setGlobalDispatcher, Agent } from "undici";

// Force Node.js to use undici's fetch instead of the buggy built-in one
globalThis.fetch = fetch;
setGlobalDispatcher(new Agent({ connect: { timeout: 60000 } }));

dotenv.config();

// Sanitize and log environment variables for debugging (obscured)
let QDRANT_URL = process.env.QDRANT_URL?.trim();
// Force strip :6333 for cloud URLs to ensure port 443 is used
if (QDRANT_URL && QDRANT_URL.includes("cloud.qdrant.io") && QDRANT_URL.includes(":6333")) {
  QDRANT_URL = QDRANT_URL.replace(":6333", "");
}
const QDRANT_API_KEY = process.env.QDRANT_API_KEY?.replace(/\s/g, '');
const COLLECTION_NAME = process.env.COLLECTION_NAME?.trim();
const HUGGINGFACEHUB_API_TOKEN = process.env.HUGGINGFACEHUB_API_TOKEN?.replace(/\s/g, '');
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.replace(/\s/g, '');

console.log("--- Server Configuration ---");
console.log("QDRANT_URL (Sanitized):", QDRANT_URL || "MISSING");
console.log("COLLECTION_NAME:", COLLECTION_NAME || "MISSING");
console.log("HUGGINGFACE_TOKEN:", HUGGINGFACEHUB_API_TOKEN ? "Defined (Length: " + HUGGINGFACEHUB_API_TOKEN.length + ")" : "MISSING");
console.log("OPENROUTER_KEY:", OPENROUTER_API_KEY ? "Defined" : "MISSING");
console.log("----------------------------");

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Setup Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

let vectorStore;

// Chunking Strategy: RecursiveCharacterTextSplitter
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: HUGGINGFACEHUB_API_TOKEN,
  model: "sentence-transformers/all-MiniLM-L6-v2",
});

// Upload and Index Endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    filePath = req.file.path;
    const loader = new PDFLoader(filePath);
    const rawDocs = await loader.load();

    // Chunking
    const docs = await textSplitter.splitDocuments(rawDocs);

    // Indexing into Qdrant
    vectorStore = await QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
      collectionName: COLLECTION_NAME,
      checkCompatibility: false, // Resolve "Failed to obtain server version" error
    });

    res.json({ message: "File uploaded and indexed successfully" });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    // Cleanup: remove uploaded file after processing (even on error)
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
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
      try {
        // Try to load existing collection if vectorStore is not in memory
        vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
          url: QDRANT_URL,
          apiKey: QDRANT_API_KEY,
          collectionName: COLLECTION_NAME,
          checkCompatibility: false, // Resolve "Failed to obtain server version" error
        });
      } catch (err) {
        return res.status(400).json({ 
          error: "No document indexed yet. Please upload a PDF first." 
        });
      }
    }

    // Retrieval
    const retriever = vectorStore.asRetriever({ k: 5 });
    const relevantDocs = await retriever.invoke(message);

    if (relevantDocs.length === 0) {
      return res.json({ answer: "I couldn't find any relevant information in the document to answer your question." });
    }

    // Generation using OpenRouter
    const client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: OPENROUTER_API_KEY,
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
      model: "google/gemini-2.0-flash-exp:free",
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
