import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Copy,
  Check,
  Sparkles,
  Terminal,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { ChatMessage } from '../types';

interface ChatTimelineProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  loading: boolean;
}

export const ChatTimeline: React.FC<ChatTimelineProps> = ({
  messages,
  onSendMessage,
  loading,
}) => {
  const [input, setInput] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    setInput('');
    await onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const promptSuggestions = [
    'How do I perform a zero-downtime rollback?',
    'What kubectl command checks the container restart history?',
    'Explain the root cause in simple terms for team handoff',
    'Draft a 3-bullet update for the #incidents Slack channel',
  ];

  const renderFormattedContent = (content: string, msgId: string) => {
    // Split by code blocks ```...```
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, idx) => {
      if (part.startsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const language = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : '';
        const code = language ? lines.slice(1).join('\n') : lines.join('\n');
        const blockId = `${msgId}-code-${idx}`;

        return (
          <div
            key={idx}
            className="my-2.5 rounded-lg border border-gray-800 bg-[#070A11] overflow-hidden font-mono text-xs shadow-inner"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0D121D] border-b border-gray-800/80 text-[11px] text-gray-400">
              <span className="text-gray-400 uppercase font-semibold">
                {language || 'Terminal / Output'}
              </span>
              <button
                onClick={() => handleCopy(code, blockId)}
                className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors"
                title="Copy code"
              >
                {copiedIndex === blockId ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-gray-200 leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Format markdown paragraphs
      return (
        <div key={idx} className="space-y-2 whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
          {part}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0F19]">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.map(msg => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${
                isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0 mt-0.5 shadow-sm shadow-blue-500/10">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm ${
                  isUser
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 rounded-tr-none'
                    : 'bg-[#121927] border border-gray-800 text-gray-200 rounded-tl-none shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 text-[10px] opacity-75">
                  <span className="font-semibold font-mono">
                    {isUser ? 'On-Call Engineer' : 'Workers AI Triage Assistant'}
                  </span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="prose prose-invert max-w-none text-xs sm:text-sm">
                  {renderFormattedContent(msg.content, msg.id)}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300 flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#121927] border border-gray-800 rounded-xl rounded-tl-none p-3.5 text-xs text-gray-400 flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]" />
              <span className="text-gray-400 ml-2">Workers AI analyzing logs & formulating next steps...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested Follow-up Chips */}
      <div className="px-4 py-2 border-t border-gray-800/60 bg-[#0E131F]/50 flex items-center space-x-2 overflow-x-auto text-[11px]">
        <span className="text-gray-500 flex items-center flex-shrink-0">
          <Sparkles className="w-3 h-3 mr-1 text-blue-400" />
          Suggestions:
        </span>
        {promptSuggestions.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            className="flex-shrink-0 px-2.5 py-1 rounded-full bg-gray-900 border border-gray-800 hover:border-gray-700 hover:bg-gray-800 text-gray-300 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-gray-800 bg-[#0E131F]">
        <div className="relative flex items-center bg-[#111827] border border-gray-800 rounded-lg focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/30">
          <textarea
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question, paste diagnostic command output, or request mitigation steps... (Enter to send, Shift+Enter for newline)"
            className="w-full bg-transparent p-2.5 text-xs sm:text-sm text-gray-200 placeholder-gray-500 focus:outline-none resize-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="mr-2 p-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all shadow-md shadow-blue-600/20"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
