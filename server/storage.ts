import { users, documents, conversations, messages, type User, type InsertUser, type Document, type InsertDocument, type Conversation, type InsertConversation, type Message, type InsertMessage } from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, like, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Document operations
  getDocument(id: number): Promise<Document | undefined>;
  getDocuments(userId?: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Conversation operations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversations(userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: number): Promise<boolean>;
  
  // Message operations
  getMessage(id: number): Promise<Message | undefined>;
  getMessages(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Vector search
  searchDocuments(query: string, limit?: number): Promise<{document: Document, relevance: number}[]>;
}

// Initialize database connection
const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql);

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      // Create default admin user if it doesn't exist
      const existingAdmin = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
      if (existingAdmin.length === 0) {
        await db.insert(users).values({
          username: "admin",
          password: "admin123",
          role: "admin"
        });
      }
    } catch (error) {
      console.error("Failed to initialize database:", error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const result = await db.insert(users).values({
        ...insertUser,
        role: insertUser.role || "user"
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async getDocument(id: number): Promise<Document | undefined> {
    try {
      const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting document:", error);
      return undefined;
    }
  }

  async getDocuments(userId?: number): Promise<Document[]> {
    try {
      if (userId) {
        return await db.select().from(documents).where(eq(documents.uploadedBy, userId)).orderBy(desc(documents.uploadedAt));
      }
      return await db.select().from(documents).orderBy(desc(documents.uploadedAt));
    } catch (error) {
      console.error("Error getting documents:", error);
      return [];
    }
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    try {
      const result = await db.insert(documents).values({
        ...insertDocument,
        uploadedBy: insertDocument.uploadedBy || null,
        status: "processing",
        content: null,
        chunks: null,
        embeddings: null,
        metadata: null,
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating document:", error);
      throw error;
    }
  }

  async updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined> {
    try {
      const result = await db.update(documents).set(updates).where(eq(documents.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating document:", error);
      return undefined;
    }
  }

  async deleteDocument(id: number): Promise<boolean> {
    try {
      await db.delete(documents).where(eq(documents.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting document:", error);
      return false;
    }
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    try {
      const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting conversation:", error);
      return undefined;
    }
  }

  async getConversations(userId: number): Promise<Conversation[]> {
    try {
      return await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
    } catch (error) {
      console.error("Error getting conversations:", error);
      return [];
    }
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    try {
      const result = await db.insert(conversations).values(insertConversation).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  }

  async updateConversation(id: number, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    try {
      const result = await db.update(conversations).set({
        ...updates,
        updatedAt: new Date(),
      }).where(eq(conversations.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating conversation:", error);
      return undefined;
    }
  }

  async deleteConversation(id: number): Promise<boolean> {
    try {
      // Delete associated messages first
      await db.delete(messages).where(eq(messages.conversationId, id));
      // Delete conversation
      await db.delete(conversations).where(eq(conversations.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting conversation:", error);
      return false;
    }
  }

  async getMessage(id: number): Promise<Message | undefined> {
    try {
      const result = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting message:", error);
      return undefined;
    }
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    try {
      return await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
    } catch (error) {
      console.error("Error getting messages:", error);
      return [];
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    try {
      const messageData = {
        role: insertMessage.role,
        content: insertMessage.content,
        conversationId: insertMessage.conversationId,
        sources: insertMessage.sources || null,
      };
      const result = await db.insert(messages).values(messageData).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  }

  async searchDocuments(query: string, limit: number = 5): Promise<{document: Document, relevance: number}[]> {
    try {
      // Simple text-based search using PostgreSQL ILIKE
      const searchTerm = `%${query.toLowerCase()}%`;
      const docs = await db.select().from(documents)
        .where(and(
          eq(documents.status, "indexed"),
          like(documents.content, searchTerm)
        ))
        .limit(limit);

      // Calculate simple relevance based on keyword frequency
      const results: {document: Document, relevance: number}[] = docs.map(doc => {
        const content = doc.content?.toLowerCase() || "";
        const searchQuery = query.toLowerCase();
        const words = searchQuery.split(' ').filter(w => w.length > 2);
        let relevance = 0;
        
        for (const word of words) {
          const matches = (content.match(new RegExp(word, 'g')) || []).length;
          relevance += matches;
        }
        
        return { document: doc, relevance };
      });

      return results.sort((a, b) => b.relevance - a.relevance);
    } catch (error) {
      console.error("Error searching documents:", error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();
