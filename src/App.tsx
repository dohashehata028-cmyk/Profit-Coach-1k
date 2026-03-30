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
import { 
  auth, 
  db, 
  signIn, 
  logOut, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
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
      let errorMessage = "An unexpected error occurred.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error) {
          errorMessage = `Firestore Error: ${parsed.error} (${parsed.operationType} at ${parsed.path})`;
        } else {
          errorMessage = this.state.error?.message || errorMessage;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-premium-black flex items-center justify-center p-6 text-center">
          <div className="glass-card p-8 max-w-md w-full border-red-500/20">
            <h1 className="text-2xl font-serif font-bold text-white mb-4">Something went wrong</h1>
            <p className="text-gray-400 text-sm mb-6">
              {errorMessage}
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
  createdAt?: any;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: any;
  uid: string;
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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        // Sync user profile to Firestore
        const userRef = doc(db, 'users', u.uid);
        setDoc(userRef, {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          lastLogin: serverTimestamp(),
        }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`));
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Sessions
  useEffect(() => {
    if (!user) {
      setSessions([]);
      setCurrentSessionId(null);
      return;
    }

    const q = query(
      collection(db, 'sessions'),
      where('uid', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatSession[];
      setSessions(newSessions);
      if (newSessions.length > 0 && !currentSessionId) {
        setCurrentSessionId(newSessions[0].id);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));

    return () => unsubscribe();
  }, [user]);

  // Sync Messages
  useEffect(() => {
    if (!user || !currentSessionId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'sessions', currentSessionId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(newMessages);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `sessions/${currentSessionId}/messages`));

    return () => unsubscribe();
  }, [user, currentSessionId]);

  const createNewSession = async () => {
    if (!user) return;
    try {
      const sessionRef = await addDoc(collection(db, 'sessions'), {
        title: 'New Coaching Session',
        uid: user.uid,
        updatedAt: serverTimestamp(),
      });
      
      // Add welcome message
      await addDoc(collection(db, 'sessions', sessionRef.id, 'messages'), {
        role: 'assistant',
        content: "Welcome to **Profit Coach**. I'm here to help you turn your ideas into income. Whether you're starting from scratch or scaling your personal brand, let's get to work.\n\nWhat are we building today?",
        createdAt: serverTimestamp(),
      });

      setCurrentSessionId(sessionRef.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sessions');
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'sessions', id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sessions/${id}`);
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
    if (!text.trim() || isLoading || !user || !currentSessionId) return;

    const userMessageContent = text;
    setInput('');
    setIsLoading(true);

    try {
      // 1. Save user message to Firestore
      await addDoc(collection(db, 'sessions', currentSessionId, 'messages'), {
        role: 'user',
        content: userMessageContent,
        createdAt: serverTimestamp(),
      });

      // 2. Update session title if it's the first user message
      if (messages.filter(m => m.role === 'user').length === 0) {
        const title = userMessageContent.length > 30 ? userMessageContent.substring(0, 30) + '...' : userMessageContent;
        await setDoc(doc(db, 'sessions', currentSessionId), { title, updatedAt: serverTimestamp() }, { merge: true });
      } else {
        await setDoc(doc(db, 'sessions', currentSessionId), { updatedAt: serverTimestamp() }, { merge: true });
      }

      // 3. Get AI response
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

      const response = await chat.sendMessage({ message: userMessageContent });
      const assistantContent = response.text || "I'm sorry, I couldn't process that request.";

      // 4. Save assistant message to Firestore
      await addDoc(collection(db, 'sessions', currentSessionId, 'messages'), {
        role: 'assistant',
        content: assistantContent,
        createdAt: serverTimestamp(),
      });

      // 5. Check if user asked for an image generation
      if (userMessageContent.toLowerCase().includes('generate image') || userMessageContent.toLowerCase().includes('image of')) {
        await handleImageGeneration(userMessageContent, ai);
      }

    } catch (error) {
      console.error("Error calling Gemini:", error);
      await addDoc(collection(db, 'sessions', currentSessionId, 'messages'), {
        role: 'assistant',
        content: error instanceof Error ? `Error: ${error.message}` : "I encountered an error. Please try again or check your connection.",
        createdAt: serverTimestamp(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageGeneration = async (prompt: string, ai: any) => {
    if (!currentSessionId) return;
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
          await addDoc(collection(db, 'sessions', currentSessionId, 'messages'), {
            role: 'assistant',
            content: "Here is your generated visual:",
            type: 'image-result',
            imageUrl,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error("Image generation error:", error);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-premium-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-premium-black flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-10 max-w-md w-full text-center border-gold/20"
        >
          <div className="w-16 h-16 rounded-2xl bg-gold mx-auto flex items-center justify-center mb-6 shadow-lg shadow-gold/20">
            <TrendingUp className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-white mb-2">Profit Coach</h1>
          <p className="text-gray-400 mb-8">Sign in to access your premium AI coaching sessions and history.</p>
          <button 
            onClick={signIn}
            className="w-full py-4 bg-gold text-black rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gold/90 transition-all shadow-lg shadow-gold/10"
          >
            <User className="w-5 h-5" />
            Sign in with Google
          </button>
          <p className="text-[10px] text-gray-500 mt-6 uppercase tracking-widest">Premium AI Experience</p>
        </motion.div>
      </div>
    );
  }

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
              {sessions.length === 0 && (
                <p className="text-xs text-gray-500 px-2 py-4 italic">No sessions yet.</p>
              )}
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
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 overflow-hidden flex items-center justify-center">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-gold" />
                )}
              </div>
              <div className="max-w-[120px]">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user.displayName || 'Premium Member'}</p>
                <p className="text-xs text-[var(--text-secondary)] truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={logOut}
              className="p-2 text-gray-500 hover:text-red-500 transition-colors"
              title="Sign Out"
            >
              <X className="w-4 h-4" />
            </button>
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
            <h2 className="font-serif text-lg font-medium text-[var(--text-primary)] truncate max-w-[200px] sm:max-w-md">
              {sessions.find(s => s.id === currentSessionId)?.title || 'Profit Coach'}
            </h2>
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
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mb-6">
                  <Bot className="w-8 h-8 text-gold" />
                </div>
                <h3 className="text-xl font-serif font-bold text-white mb-2">How can I help you today?</h3>
                <p className="text-gray-400 max-w-sm">Select a quick action or start typing to begin your coaching session.</p>
              </div>
            )}
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
                    "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
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
                      className="mt-4 rounded-2xl overflow-hidden border border-white/10 shadow-xl"
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
              className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl px-5 py-4 pr-14 text-sm focus:outline-none focus:border-gold/50 transition-all resize-none placeholder:text-gray-500 text-[var(--text-primary)] shadow-inner"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading || !currentSessionId}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-gold text-black hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-gold/20"
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
