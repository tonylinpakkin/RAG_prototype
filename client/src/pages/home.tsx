import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { FileUploadModal } from "@/components/file-upload-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { Search, Bell, Moon, Sun, ChevronDown, Brain } from "lucide-react";

export default function Home() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);

  const handleNewConversation = (conversationId: number) => {
    setCurrentConversationId(conversationId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card dark:bg-gray-800 border-b border-border shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Brain className="text-primary-foreground text-sm" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">RAG Assistant</h1>
                  <p className="text-xs text-muted-foreground">Knowledge Intelligence Platform</p>
                </div>
              </div>
            </div>

            {/* Global Search */}
            <div className="flex-1 max-w-lg mx-8">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  className="pl-10"
                  placeholder="Search documents and conversations..."
                />
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
              </Button>

              {/* Theme Toggle */}
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>

              {/* User Profile */}
              <div className="flex items-center space-x-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user?.username?.slice(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-foreground">{user?.username}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={logout}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar 
          onUploadClick={() => setIsUploadModalOpen(true)}
          onConversationSelect={setCurrentConversationId}
          currentConversationId={currentConversationId}
          onNewConversation={handleNewConversation}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-card">
          <ChatInterface 
            conversationId={currentConversationId}
            onNewConversation={handleNewConversation}
          />
        </main>
      </div>

      {/* File Upload Modal */}
      <FileUploadModal 
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
}
