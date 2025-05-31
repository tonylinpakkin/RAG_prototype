import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, FolderOpen, Settings, Plus, Upload, Users, Shield, BarChart3, History, CheckCircle, Database, FileText, FileImage, Mail, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SidebarProps {
  onUploadClick: () => void;
  onConversationSelect: (id: number) => void;
  currentConversationId: number | null;
  onNewConversation: (conversationId: number) => void;
}

type TabType = "chat" | "docs" | "admin";

interface Conversation {
  id: number;
  title: string;
  updatedAt: string;
}

interface Document {
  id: number;
  originalName: string;
  fileType: string;
  status: string;
  uploadedAt: string;
}

export function Sidebar({ onUploadClick, onConversationSelect, currentConversationId, onNewConversation }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ["/api/conversations"],
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ["/api/documents"],
  });

  // Fetch system status
  const { data: status } = useQuery({
    queryKey: ["/api/status"],
  });

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/conversations", {
        title: "New Conversation",
      });
      return response.json();
    },
    onSuccess: (conversation) => {
      onNewConversation(conversation.id);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const handleNewConversation = () => {
    createConversationMutation.mutate();
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    if (fileType.includes('word')) return <FileText className="h-4 w-4 text-blue-500" />;
    if (fileType.includes('image')) return <FileImage className="h-4 w-4 text-green-500" />;
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'indexed': return 'text-green-600 dark:text-green-400';
      case 'processing': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <aside className="w-80 bg-card border-r border-border overflow-y-auto">
      <div className="p-6">
        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "chat"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-4 w-4 mr-2 inline" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab("docs")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "docs"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderOpen className="h-4 w-4 mr-2 inline" />
              Documents
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "admin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings className="h-4 w-4 mr-2 inline" />
              Admin
            </button>
          </nav>
        </div>

        {/* Chat Panel */}
        {activeTab === "chat" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Recent Conversations</h3>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleNewConversation}
                disabled={createConversationMutation.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {conversations.map((conversation: Conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => onConversationSelect(conversation.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    currentConversationId === conversation.id
                      ? "bg-primary/10 border-l-4 border-primary"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <h4 className="font-medium text-sm text-foreground mb-1 truncate">
                    {conversation.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No conversations yet. Start chatting to create one!
                </p>
              )}
            </div>

            {/* System Status */}
            {status && (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
                    <CheckCircle className="h-4 w-4 mr-2 inline" />
                    System Status
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-green-700 dark:text-green-300">Vector DB</span>
                      <span className="text-green-600 dark:text-green-400">{status.vectorDB}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700 dark:text-green-300">LLM Service</span>
                      <span className="text-green-600 dark:text-green-400">{status.llmService}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700 dark:text-green-300">Last Sync</span>
                      <span className="text-green-600 dark:text-green-400">
                        {formatDistanceToNow(new Date(status.lastSync), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Data Sources Status */}
            {status && (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    <Database className="h-4 w-4 mr-2 inline" />
                    Data Sources
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-300">Documents</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {status.documents?.total || 0} files
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-300">Embeddings</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {status.storage?.totalEmbeddings || 0} vectors
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-300">Storage</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {status.storage?.storageUsed || "0 MB"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Documents Panel */}
        {activeTab === "docs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Document Library</h3>
              <Button size="sm" onClick={onUploadClick}>
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
            </div>

            {/* File Type Filters */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="pdfs" defaultChecked />
                <Label htmlFor="pdfs" className="text-sm">
                  PDFs ({documents.filter((d: Document) => d.fileType.includes('pdf')).length})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="docx" defaultChecked />
                <Label htmlFor="docx" className="text-sm">
                  DOCX ({documents.filter((d: Document) => d.fileType.includes('word')).length})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="emails" />
                <Label htmlFor="emails" className="text-sm">Emails (0)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="chats" />
                <Label htmlFor="chats" className="text-sm">Chat Logs (0)</Label>
              </div>
            </div>

            <Separator />

            {/* Recent Uploads */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Recent Uploads
              </h4>
              <div className="space-y-2">
                {documents.slice(0, 10).map((document: Document) => (
                  <div
                    key={document.id}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                  >
                    {getFileIcon(document.fileType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {document.originalName}
                      </p>
                      <p className={`text-xs capitalize ${getStatusColor(document.status)}`}>
                        {document.status}
                      </p>
                    </div>
                  </div>
                ))}
                {documents.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No documents uploaded yet. Click Upload to get started!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Admin Panel */}
        {activeTab === "admin" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">System Administration</h3>
            
            <div className="space-y-3">
              <Button
                variant="ghost"
                className="w-full justify-start p-3 h-auto"
              >
                <Users className="h-4 w-4 mr-3 text-primary" />
                <span className="text-sm font-medium">User Management</span>
              </Button>
              
              <Button
                variant="ghost"
                className="w-full justify-start p-3 h-auto"
              >
                <Shield className="h-4 w-4 mr-3 text-primary" />
                <span className="text-sm font-medium">Access Control</span>
              </Button>
              
              <Button
                variant="ghost"
                className="w-full justify-start p-3 h-auto"
              >
                <BarChart3 className="h-4 w-4 mr-3 text-primary" />
                <span className="text-sm font-medium">Analytics</span>
              </Button>
              
              <Button
                variant="ghost"
                className="w-full justify-start p-3 h-auto"
              >
                <History className="h-4 w-4 mr-3 text-primary" />
                <span className="text-sm font-medium">Audit Logs</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
