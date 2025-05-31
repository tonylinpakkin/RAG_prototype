import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-provider";
import { Bot, User, Send, Paperclip, Mic, Settings, FileText, Database, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: { id: number; filename: string; relevance: number }[];
  createdAt: string;
}

interface ChatInterfaceProps {
  conversationId: number | null;
  onNewConversation: (conversationId: number) => void;
}

export function ChatInterface({ conversationId, onNewConversation }: ChatInterfaceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [model, setModel] = useState("llama2-70b");
  const [includeCitations, setIncludeCitations] = useState(true);
  const [detailedAnalysis, setDetailedAnalysis] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch messages for current conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, conversationId }: { message: string; conversationId: number }) => {
      const response = await apiRequest("POST", "/api/chat", { message, conversationId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/conversations", { title });
      return response.json();
    },
    onSuccess: (conversation) => {
      onNewConversation(conversation.id);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + "px";
    }
  }, [message]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    let targetConversationId = conversationId;

    // Create new conversation if none exists
    if (!targetConversationId) {
      const newConversation = await createConversationMutation.mutateAsync(
        message.length > 50 ? message.substring(0, 50) + "..." : message
      );
      targetConversationId = newConversation.id;
    }

    sendMessageMutation.mutate({
      message: message.trim(),
      conversationId: targetConversationId!,
    });

    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedPrompts = [
    "📊 Analyze Q4 reports",
    "📧 Summarize email threads", 
    "🔍 Search technical docs"
  ];

  const handleSuggestedPrompt = (prompt: string) => {
    setMessage(prompt.substring(2).trim()); // Remove emoji
    textareaRef.current?.focus();
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Knowledge Assistant</h2>
              <p className="text-sm text-muted-foreground">Ask questions about your documents and data</p>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llama2-70b">Llama 2 70B</SelectItem>
                  <SelectItem value="mistral-7b">Mistral 7B</SelectItem>
                  <SelectItem value="codellama-34b">CodeLlama 34B</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start space-x-3 animate-fade-in">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <p className="text-foreground mb-3">
                    👋 Welcome! I'm your RAG-powered knowledge assistant. I can help you find information across your documents, emails, chat histories, and databases.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedPrompts.map((prompt, index) => (
                      <Button
                        key={index}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSuggestedPrompt(prompt)}
                        className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Message Input */}
        <div className="border-t border-border p-6">
          <div className="flex items-end space-x-4">
            <Button variant="ghost" size="icon">
              <Paperclip className="h-4 w-4" />
            </Button>

            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your documents..."
                className="min-h-[44px] max-h-32 resize-none pr-12"
                rows={1}
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!message.trim() || sendMessageMutation.isPending}
                className="absolute bottom-2 right-2 h-8 w-8"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="ghost" size="icon">
              <Mic className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="citations"
                  checked={includeCitations}
                  onCheckedChange={(checked) => setIncludeCitations(checked === true)}
                />
                <Label htmlFor="citations">Include citations</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="detailed"
                  checked={detailedAnalysis}
                  onCheckedChange={(checked) => setDetailedAnalysis(checked === true)}
                />
                <Label htmlFor="detailed">Detailed analysis</Label>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span>Model:</span>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-32 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llama2-70b">Llama 2 70B</SelectItem>
                  <SelectItem value="mistral-7b">Mistral 7B</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Knowledge Assistant</h2>
            <p className="text-sm text-muted-foreground">Ask questions about your documents and data</p>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="llama2-70b">Llama 2 70B</SelectItem>
                <SelectItem value="mistral-7b">Mistral 7B</SelectItem>
                <SelectItem value="codellama-34b">CodeLlama 34B</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messagesLoading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (messages as Message[])?.length === 0 ? (
          <div className="flex items-start space-x-3 animate-fade-in">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <p className="text-foreground mb-3">
                    👋 Welcome! I'm your RAG-powered knowledge assistant. I can help you find information across your documents, emails, chat histories, and databases.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedPrompts.map((prompt, index) => (
                      <Button
                        key={index}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSuggestedPrompt(prompt)}
                        className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          (messages as Message[])?.map((msg: Message) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 animate-fade-in ${
                msg.role === "user" ? "justify-end" : ""
              }`}
            >
              {msg.role === "assistant" && (
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div className={`flex-1 ${msg.role === "user" ? "max-w-3xl" : ""}`}>
                <Card className={msg.role === "user" ? "ml-12 bg-muted" : "bg-card border shadow-sm"}>
                  <CardContent className="p-4">
                    <p className="text-foreground whitespace-pre-wrap">{msg.content}</p>

                    {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                      <>
                        <Separator className="my-3" />
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Sources referenced:</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source) => (
                              <Badge key={source.id} variant="secondary" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                {source.filename}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {msg.role === "user" && (
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user?.username?.slice(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))
        )}

        {/* Typing Indicator */}
        {sendMessageMutation.isPending && (
          <div className="flex items-start space-x-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Card className="bg-card border">
                <CardContent className="p-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-border p-6">
        <div className="flex items-end space-x-4">
          <Button variant="ghost" size="icon">
            <Paperclip className="h-4 w-4" />
          </Button>

          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your documents..."
              className="min-h-[44px] max-h-32 resize-none pr-12"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMessageMutation.isPending}
              className="absolute bottom-2 right-2 h-8 w-8"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="ghost" size="icon">
            <Mic className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="citations"
                checked={includeCitations}
                onCheckedChange={(checked) => setIncludeCitations(checked === true)}
              />
              <Label htmlFor="citations">Include citations</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="detailed"
                checked={detailedAnalysis}
                onCheckedChange={(checked) => setDetailedAnalysis(checked === true)}
              />
              <Label htmlFor="detailed">Detailed analysis</Label>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span>Model:</span>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="llama2-70b">Llama 2 70B</SelectItem>
                <SelectItem value="mistral-7b">Mistral 7B</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}