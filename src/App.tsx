/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Sparkles, 
  Video, 
  FileText, 
  Camera, 
  Hash, 
  Image as ImageIcon, 
  TrendingUp, 
  User, 
  Bot, 
  Plus,
  ChevronRight,
  Menu,
  X,
  Loader2,
  Moon,
  Sun
} from 'lucide-react';
import { cn } from './lib/utils';
import { SYSTEM_PROMPT } from './constants';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-premium-black flex items-center justify-center p-6 text-center">
          <div className="glass-card p-8 max-w-md w-full border-red-500/20">
            <h1 className="text-2xl font-serif font-bold text-white mb-4">Something went wrong</h1>
            <p className="text-gray-400 text-sm mb-6">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-gold text-black rounded-xl font-bold hover:bg-gold/90 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image-prompt' | 'image-result';
  imageUrl?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

const QUICK_ACTIONS = [
  { id: 'content', label: 'Content Ideas', icon: Sparkles, prompt: 'Give me 5 viral content ideas for my personal brand.' },
  { id: 'script', label: 'Write Script', icon: FileText, prompt: 'Write a high-converting script for a 60-second Reel.' },
  { id: 'shooting', label: 'Shooting Guide', icon: Camera, prompt: 'Give me a shooting guide for a professional talking-head video.' },
  { id: 'hooks', label: 'Hooks Generator', icon: TrendingUp, prompt: 'Generate 5 attention-grabbing hooks for my next video.' },
  { id: 'hashtags', label: 'Hashtags', icon: Hash, prompt: 'Suggest 15 viral hashtags for a content creator niche.' },
  { id: 'image', label: 'AI Image Prompt', icon: ImageIcon, prompt: 'Generate a minimal AI image prompt for my brand aesthetic.' },
];

export default function App() {
  return (
    <ErrorBoundary>
      <ProfitCoachApp />
    </ErrorBoundary>
  );
}

function ProfitCoachApp() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('profit_coach_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
        } else {
          createNewSession();
        }
      } catch (e) {
        console.error("Failed to parse sessions", e);
        createNewSession();
      }
    } else {
      createNewSession();
    }
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('profit_coach_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;
  const messages = currentSession?.messages || [];

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Coaching Session',
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: "Welcome to **Profit Coach**. I'm here to help you turn your ideas into income. Whether you're starting from scratch or scaling your personal brand, let's get to work.\n\nWhat are we building today?",
        }
      ],
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  // Lazy initialize Gemini to prevent crash if key is missing
  const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please add it to your Secrets in AI Studio.");
    }
    return new GoogleGenAI({ apiKey });
  };

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    // Update session title if it's the first user message
    let updatedTitle = currentSession?.title || 'New Coaching Session';
    if (messages.filter(m => m.role === 'user').length === 0) {
      updatedTitle = text.length > 30 ? text.substring(0, 30) + '...' : text;
    }

    const updatedMessages = [...messages, userMessage];
    
    setSessions(prev => prev.map(s => 
      s.id === currentSessionId 
        ? { ...s, messages: updatedMessages, title: updatedTitle, updatedAt: Date.now() } 
        : s
    ));

    setInput('');
    setIsLoading(true);

    try {
      const ai = getAI();
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
        history: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))
      });

      const response = await chat.sendMessage({ message: text });
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || "I'm sorry, I couldn't process that request.",
      };

      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages: [...updatedMessages, assistantMessage], updatedAt: Date.now() } 
          : s
      ));

      // Check if user asked for an image generation
      if (text.toLowerCase().includes('generate image') || text.toLowerCase().includes('image of')) {
        await handleImageGeneration(text, ai);
      }

    } catch (error) {
      console.error("Error calling Gemini:", error);
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { 
              ...s, 
              messages: [...updatedMessages, {
                id: 'error',
                role: 'assistant',
                content: error instanceof Error ? `Error: ${error.message}` : "I encountered an error. Please try again or check your connection."
              }], 
              updatedAt: Date.now() 
            } 
          : s
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageGeneration = async (prompt: string, ai: any) => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `Generate a high-quality, minimal, premium aesthetic image based on: ${prompt}` }],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setSessions(prev => prev.map(s => 
            s.id === currentSessionId 
              ? { 
                  ...s, 
                  messages: [...s.messages, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: "Here is your generated visual:",
                    type: 'image-result',
                    imageUrl
                  }], 
                  updatedAt: Date.now() 
                } 
              : s
          ));
        }
      }
    } catch (error) {
      console.error("Image generation error:", error);
    }
  };

  return (
    <div className="flex h-screen bg-premium-black overflow-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          x: isSidebarOpen ? 0 : -300,
          width: isSidebarOpen ? 280 : 0
        }}
        className={cn(
          "fixed lg:relative z-50 h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col transition-all duration-300 ease-in-out",
          !isSidebarOpen && "lg:w-0 lg:border-none"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-black" />
            </div>
            <span className="font-serif text-xl font-bold tracking-tight">Profit Coach</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
          <div>
            <button 
              onClick={createNewSession}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-black font-bold transition-all hover:bg-gold/90 mb-6"
            >
              <Plus className="w-4 h-4" />
              New Coaching
            </button>

            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4 px-2">History</h3>
            <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    setCurrentSessionId(session.id);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "group w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-sm",
                    currentSessionId === session.id 
                      ? "bg-gold/10 text-gold border border-gold/20" 
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]"
                  )}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Bot className={cn("w-4 h-4 flex-shrink-0", currentSessionId === session.id ? "text-gold" : "text-gray-500")} />
                    <span className="truncate">{session.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-[var(--border-color)]">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4 px-2">Quick Actions</h3>
            <div className="space-y-1">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    handleSendMessage(action.prompt);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors group text-sm"
                >
                  <action.icon className="w-4 h-4 group-hover:text-gold transition-colors" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
              <User className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Premium Member</p>
              <p className="text-xs text-[var(--text-secondary)]">Active Coach</p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-[var(--bg-app)]">
        {/* Header */}
        <header className="h-16 border-b border-[var(--border-color)] flex items-center justify-between px-6 bg-[var(--bg-app)]/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-serif text-lg font-medium text-[var(--text-primary)]">Session</h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] rounded-lg transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20">
              <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-gold">AI Active</span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
        >
          <div className="max-w-3xl mx-auto w-full space-y-8">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center",
                  msg.role === 'user' ? "bg-white/10" : "bg-gold/20 border border-gold/30"
                )}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-gold" />}
                </div>
                <div className={cn(
                  "max-w-[85%] space-y-2",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-gold/10 text-[var(--text-primary)] rounded-tr-none border border-gold/20" 
                      : "bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-tl-none"
                  )}>
                    <div className="markdown-body">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  </div>
                  
                  {msg.imageUrl && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="mt-4 rounded-2xl overflow-hidden border border-white/10"
                    >
                      <img 
                        src={msg.imageUrl} 
                        alt="Generated content" 
                        className="w-full h-auto object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-gold" />
                </div>
                <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] p-4 rounded-2xl rounded-tl-none">
                  <Loader2 className="w-5 h-5 text-gold animate-spin" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-app)]">
          <div className="max-w-3xl mx-auto relative">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask Profit Coach anything..."
              className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl px-5 py-4 pr-14 text-sm focus:outline-none focus:border-gold/50 transition-all resize-none placeholder:text-gray-500 text-[var(--text-primary)]"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-gold text-black hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="max-w-3xl mx-auto text-center text-[10px] text-[var(--text-secondary)] mt-3 uppercase tracking-widest">
            Premium AI Coaching • Powered by Gemini
          </p>
        </div>
      </main>
    </div>
  );
}
