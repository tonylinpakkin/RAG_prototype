import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertDocumentSchema, insertConversationSchema, insertMessageSchema } from "@shared/schema";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/html'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  }
});

// Simple session management
const sessions = new Map<string, { userId: number; expires: number }>();

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function requireAuth(req: any, res: any, next: any) {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  if (!sessionId) {
    return res.status(401).json({ message: 'No session token provided' });
  }

  const session = sessions.get(sessionId);
  if (!session || session.expires < Date.now()) {
    sessions.delete(sessionId);
    return res.status(401).json({ message: 'Session expired' });
  }

  req.userId = session.userId;
  next();
}

async function processDocument(documentId: number, filePath: string, fileType: string): Promise<void> {
  try {
    const document = await storage.getDocument(documentId);
    if (!document) return;

    let content = '';
    
    // Extract text based on file type
    if (fileType === 'text/plain' || fileType === 'text/html') {
      content = await fs.readFile(filePath, 'utf-8');
    } else if (fileType === 'application/pdf') {
      // For PDF parsing, we'd use a library like pdf-parse in production
      content = `[PDF content extraction would be implemented here for ${document.originalName}]`;
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // For DOCX parsing, we'd use a library like mammoth in production
      content = `[DOCX content extraction would be implemented here for ${document.originalName}]`;
    }

    // Simple chunking strategy - split into paragraphs
    const chunks = content.split('\n\n').filter(chunk => chunk.trim().length > 50);
    
    // Generate embeddings using Python script
    try {
      const embeddings = await generateEmbeddings(chunks);
      
      await storage.updateDocument(documentId, {
        status: "indexed",
        content,
        chunks,
        embeddings,
        metadata: {
          chunkCount: chunks.length,
          contentLength: content.length,
          processedAt: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error('Embedding generation failed:', error);
      await storage.updateDocument(documentId, {
        status: "error",
        content,
        chunks,
        metadata: {
          error: 'Failed to generate embeddings',
          processedAt: new Date().toISOString(),
        }
      });
    }

    // Clean up temporary file
    await fs.unlink(filePath).catch(() => {});
  } catch (error) {
    console.error('Document processing failed:', error);
    await storage.updateDocument(documentId, {
      status: "error",
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processedAt: new Date().toISOString(),
      }
    });
  }
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [path.join(process.cwd(), 'server/embedding.py')]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${error}`));
        return;
      }
      
      try {
        const embeddings = JSON.parse(output);
        resolve(embeddings);
      } catch (e) {
        reject(new Error(`Failed to parse embeddings: ${e}`));
      }
    });
    
    // Send texts to Python script
    python.stdin.write(JSON.stringify(texts));
    python.stdin.end();
  });
}

async function generateResponse(query: string, context: string): Promise<string> {
  // In production, this would call an actual LLM API (OpenAI, Hugging Face, etc.)
  // For now, return a structured response based on the context
  
  const contextLength = context.length;
  const hasContext = contextLength > 0;
  
  if (!hasContext) {
    return "I don't have any relevant documents to answer your question. Please upload some documents first or try a different query.";
  }

  // Simple template-based response
  return `Based on the documents I've analyzed, here's what I found regarding your question: "${query}"

${context.substring(0, 500)}${contextLength > 500 ? '...' : ''}

This information was extracted from your uploaded documents. Would you like me to search for more specific details or analyze different aspects of this topic?`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const sessionId = generateSessionId();
      sessions.set(sessionId, {
        userId: user.id,
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({
        token: sessionId,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser(userData);
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
      });
    } catch (error) {
      res.status(400).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    if (sessionId) {
      sessions.delete(sessionId);
    }
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user info" });
    }
  });

  // Document routes
  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getDocuments(req.userId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const documentData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: req.userId,
      };

      const document = await storage.createDocument(documentData);
      
      // Process document asynchronously
      processDocument(document.id, req.file.path, req.file.mimetype);

      res.json(document);
    } catch (error) {
      res.status(500).json({ message: "Upload failed" });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.uploadedBy !== req.userId) {
        return res.status(403).json({ message: "Not authorized to delete this document" });
      }

      const deleted = await storage.deleteDocument(documentId);
      if (deleted) {
        res.json({ message: "Document deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete document" });
      }
    } catch (error) {
      res.status(500).json({ message: "Delete failed" });
    }
  });

  // Conversation routes
  app.get("/api/conversations", requireAuth, async (req, res) => {
    try {
      const conversations = await storage.getConversations(req.userId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", requireAuth, async (req, res) => {
    try {
      const conversationData = insertConversationSchema.parse({
        ...req.body,
        userId: req.userId,
      });

      const conversation = await storage.createConversation(conversationData);
      res.json(conversation);
    } catch (error) {
      res.status(400).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation || conversation.userId !== req.userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const messages = await storage.getMessages(conversationId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Chat routes
  app.post("/api/chat", requireAuth, async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Verify conversation belongs to user
      const conversation = await storage.getConversation(conversationId);
      if (!conversation || conversation.userId !== req.userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Store user message
      await storage.createMessage({
        conversationId,
        role: "user",
        content: message,
        sources: null,
      });

      // Search for relevant documents
      const searchResults = await storage.searchDocuments(message, 3);
      
      // Build context from search results
      const context = searchResults
        .map(result => result.document.content)
        .filter(content => content)
        .join('\n\n');

      // Generate AI response
      const aiResponse = await generateResponse(message, context);

      // Store AI response with sources
      const sources = searchResults.map(result => ({
        documentId: result.document.id,
        filename: result.document.originalName,
        relevance: result.relevance,
      }));

      const aiMessage = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: aiResponse,
        sources: sources.length > 0 ? sources : null,
      });

      res.json({
        message: aiMessage,
        sources: searchResults.map(result => ({
          id: result.document.id,
          filename: result.document.originalName,
          relevance: result.relevance,
        })),
      });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // Search route
  app.get("/api/search", requireAuth, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }

      const results = await storage.searchDocuments(q, 10);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Search failed" });
    }
  });

  // System status route
  app.get("/api/status", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      const totalDocs = documents.length;
      const indexedDocs = documents.filter(doc => doc.status === "indexed").length;
      const processingDocs = documents.filter(doc => doc.status === "processing").length;
      const errorDocs = documents.filter(doc => doc.status === "error").length;
      
      const totalSize = documents.reduce((sum, doc) => sum + doc.fileSize, 0);
      const totalEmbeddings = documents
        .filter(doc => doc.embeddings)
        .reduce((sum, doc) => sum + (doc.embeddings?.length || 0), 0);

      res.json({
        vectorDB: "online",
        llmService: "online",
        lastSync: new Date().toISOString(),
        documents: {
          total: totalDocs,
          indexed: indexedDocs,
          processing: processingDocs,
          errors: errorDocs,
        },
        storage: {
          totalSize,
          totalEmbeddings,
          storageUsed: `${Math.round(totalSize / 1024 / 1024)} MB`,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
