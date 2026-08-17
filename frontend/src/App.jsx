import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiMoon, FiSun, FiSend, FiCopy, FiCheckCircle, FiPlus } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import axios from 'axios';

const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-120b'];
const welcomeContent = `Hello! I am your AI assistant of Mostafizur Rahman. Ask me anything! 🙂

I'm here to help you with:
• Answering questions
• Writing content
• And much more.

Feel free to ask me anything!`;

function AiLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <defs>
        <linearGradient id="ai-gradient" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="48" height="48" rx="16" fill="url(#ai-gradient)" />
      <path d="M22 40L30 24L38 40" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 34H36" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="30" cy="20" r="3" fill="white" />
      <circle cx="30" cy="20" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
    </svg>
  );
}

function App() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [model, setModel] = useState(models[0]);
  const [history, setHistory] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [toast, setToast] = useState('');
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('nova-chat-history');
    if (saved) {
      const parsed = JSON.parse(saved);
      setHistory(parsed);
      if (parsed.length) {
        setActiveChatId(parsed[0].id);
        setMessages(parsed[0].messages);
        setShowWelcome(false);
      } else {
        setShowWelcome(true);
      }
    } else {
      setShowWelcome(true);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [draft]);

  const saveHistory = (nextHistory) => {
    setHistory(nextHistory);
    localStorage.setItem('nova-chat-history', JSON.stringify(nextHistory));
  };

  const createNewChat = () => {
    setMessages([]);
    setActiveChatId(null);
    setDraft('');
    setShowWelcome(true);
    setToast('Started a new conversation');
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const saveCurrentChat = (nextMessages, chatId = activeChatId) => {
    if (!nextMessages.length) return;
    const title = nextMessages[0]?.content?.slice(0, 28) || 'New Chat';
    if (!chatId) {
      const newChat = { id: Date.now().toString(), title, messages: nextMessages };
      const nextHistory = [newChat, ...history];
      saveHistory(nextHistory);
      setActiveChatId(newChat.id);
      return;
    }
    const nextHistory = history.map((chat) => (chat.id === chatId ? { ...chat, title, messages: nextMessages } : chat));
    saveHistory(nextHistory);
  };

  const handleSend = async () => {
    if (!draft.trim() || loading) return;
    setShowWelcome(false);
    const userMessage = { id: Date.now().toString(), role: 'user', content: draft.trim(), timestamp: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    const chatId = activeChatId || Date.now().toString();
    setMessages(nextMessages);
    setActiveChatId(chatId);
    setDraft('');
    setLoading(true);

    try {
      const response = await axios.post('/api/chat', {
        messages: nextMessages,
        model
      });
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.reply,
        timestamp: new Date().toISOString()
      };
      const finalMessages = [...nextMessages, assistantMessage];
      setMessages(finalMessages);
      saveCurrentChat(finalMessages, chatId);
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Unexpected issue. Please try again.';
      const assistantMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `Error: ${errorMsg}`,
        timestamp: new Date().toISOString()
      };
      setMessages([...nextMessages, assistantMessage]);
      saveCurrentChat([...nextMessages, assistantMessage], chatId);
      setToast('The assistant hit an error. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    setLoading(false);
    setToast('Generation stopped');
  };

  const copyText = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setToast('Message copied');
    } catch {
      setToast('Unable to copy');
    }
  };

  const shell = darkMode ? 'bg-[#111827] text-white' : 'bg-[#f8fafc] text-slate-900';
  const muted = darkMode ? 'text-[#9ca3af]' : 'text-slate-500';
  const bubbleUser = 'bg-[#2563eb] text-white';
  const bubbleAi = darkMode ? 'bg-[#f3f4f6] text-slate-800' : 'bg-[#f1f5f9] text-slate-800';

  return (
    <div className={`min-h-screen ${shell}`}>
      {toast && (
        <div className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-lg ${darkMode ? 'border-white/10 bg-[#1f2937]' : 'border-slate-200 bg-white'}`}>
          <FiCheckCircle className="text-[#2563eb]" /> {toast}
        </div>
      )}

      <div className="mx-auto flex min-h-screen max-w-[900px] flex-col px-3 py-4 sm:px-6 sm:py-6">
        <header className={`rounded-full border px-4 py-3 ${darkMode ? 'border-white/10 bg-[#1f2937]/80' : 'border-slate-200 bg-white/90'} shadow-sm backdrop-blur`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#60A5FA] to-[#8B5CF6] p-[2px]">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 backdrop-blur">
                  <AiLogo className="h-6 w-6" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">AI ASSISTANT</p>
                <p className={`text-xs ${muted}`}>Make Life Easier with AI 😊</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={createNewChat}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#60A5FA] to-[#8B5CF6] px-3.5 py-2 text-sm font-medium text-white shadow-sm"
              >
                <FiPlus className="text-sm" />
                <span>New Chat</span>
              </motion.button>
              <button onClick={() => setDarkMode((prev) => !prev)} className={`rounded-full p-2 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
                {darkMode ? <FiSun /> : <FiMoon />}
              </button>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col px-1 pb-32 pt-6 sm:px-2">
          <div className="mx-auto flex w-full max-w-[850px] flex-1 flex-col gap-3">
            {showWelcome && messages.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="flex max-w-[90%] items-start gap-3 sm:max-w-[82%]">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#60A5FA] to-[#8B5CF6] p-[2px]">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 backdrop-blur">
                      <AiLogo className="h-5 w-5" />
                    </div>
                  </div>
                  <div className={`rounded-[22px] px-4 py-3 ${bubbleAi}`}>
                    <div className="text-sm leading-7">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>
                        }}
                      >
                        {welcomeContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : messages.length > 0 ? (
              messages.map((message) => (
                <motion.div key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' ? (
                    <div className="flex max-w-[90%] items-start gap-3 sm:max-w-[82%]">
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#60A5FA] to-[#8B5CF6] p-[2px]">
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 backdrop-blur">
                          <AiLogo className="h-5 w-5" />
                        </div>
                      </div>
                      <div className={`rounded-[22px] px-4 py-3 ${bubbleAi}`}>
                        <div className="text-sm leading-7">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
                              code({ inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <div className={`my-3 overflow-hidden rounded-xl border ${darkMode ? 'border-slate-200/20 bg-[#111827]' : 'border-slate-200 bg-[#f8fafc]'}`}>
                                    <div className={`flex items-center justify-between px-3 py-2 text-xs ${muted}`}>
                                      <span>{match[1]}</span>
                                      <button onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))} className="rounded-lg px-2 py-1 hover:bg-black/5">Copy</button>
                                    </div>
                                    <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                                  </div>
                                ) : (
                                  <code className={`rounded px-1.5 py-0.5 ${darkMode ? 'bg-slate-200/20 text-cyan-600' : 'bg-slate-200 text-slate-700'}`} {...props}>{children}</code>
                                );
                              }
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        <div className={`mt-2 flex items-center justify-between gap-3 text-[11px] ${muted}`}>
                          <span>{message.timestamp ? new Date(message.timestamp).toLocaleString() : ''}</span>
                          <button onClick={() => copyText(message.content, message.id)} className="rounded-full p-1 hover:bg-black/5">
                            <FiCopy />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`max-w-[80%] rounded-[22px] px-4 py-3 sm:max-w-[70%] ${bubbleUser}`}>
                      <div className="text-sm leading-7">{message.content}</div>
                    </div>
                  )}
                </motion.div>
              ))
            ) : null}
            {loading && (
              <div className="flex justify-start">
                <div className="flex max-w-[90%] items-start gap-3 sm:max-w-[82%]">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#60A5FA] to-[#8B5CF6] p-[2px]">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 backdrop-blur">
                      <AiLogo className="h-5 w-5" />
                    </div>
                  </div>
                  <div className={`rounded-[22px] px-4 py-3 ${bubbleAi}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
                      <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:120ms]" />
                      <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:240ms]" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className={`fixed inset-x-0 bottom-0 border-t px-3 py-3 sm:px-6 ${darkMode ? 'border-white/10 bg-[#111827]/95' : 'border-slate-200 bg-[#f8fafc]/95'} backdrop-blur`}>
          <div className={`mx-auto max-w-[850px] rounded-[24px] border p-2 ${darkMode ? 'border-white/10 bg-[#1f2937]' : 'border-slate-200 bg-white'} shadow-sm`}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask me anything..."
              className={`max-h-[180px] min-h-[50px] w-full resize-none overflow-hidden bg-transparent px-3 py-3 text-sm outline-none ${darkMode ? 'text-white' : 'text-slate-900'}`}
            />
            <div className="mt-2 flex items-center justify-end px-2 pb-2">
              {loading ? (
                <button onClick={handleStop} className={`rounded-full px-3 py-2 text-sm ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-100 hover:bg-slate-200'}`}>Stop</button>
              ) : (
                <button onClick={handleSend} disabled={loading || !draft.trim()} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#60A5FA] to-[#8B5CF6] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <FiSend /> Send
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
