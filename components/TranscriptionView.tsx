import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { TranscriptionEntry } from '../types';

interface TranscriptionViewProps {
  history: TranscriptionEntry[];
  currentInput: string;
  currentOutput: string;
  onSendMessage: (text: string) => void;
  isActive: boolean;
}

const TranscriptionView: React.FC<TranscriptionViewProps> = ({ 
  history, 
  currentInput, 
  currentOutput, 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever history or current transcripts change
  useEffect(() => {
    if (scrollRef.current) {
      const { scrollHeight, clientHeight } = scrollRef.current;
      scrollRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  }, [history, currentInput, currentOutput]);

  return (
    <div className="flex flex-col h-full max-h-full bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 shadow-inner overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/30 shrink-0">
        <div className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Terminal className="w-3 h-3 text-blue-500" />
          Neural Logs
        </div>
        <div className="text-[8px] text-slate-600 font-mono italic">
          v2.0.5-empathy
        </div>
      </div>

      {/* Messages Area - Added min-h-0 to fix flex-overflow issues */}
      <div 
        ref={scrollRef} 
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 pr-2 space-y-3 sm:space-y-4 custom-scrollbar"
      >
        <div className="min-w-full inline-block pr-1">
          {history.map((entry, i) => (
            <div 
              key={i} 
              className={`flex flex-col mb-3 sm:mb-4 ${
                entry.type === 'user' ? 'items-end' : 
                entry.type === 'robot' ? 'items-start' : 
                'items-center'
              }`}
            >
              {entry.type === 'system' ? (
                <div className="my-2 px-3 py-1 bg-slate-900/50 border border-white/5 rounded-lg text-[9px] font-mono text-cyan-400/80 uppercase tracking-widest text-center animate-in fade-in zoom-in-95 duration-300">
                  {entry.text}
                </div>
              ) : (
                <div className={`max-w-[85%] rounded-xl sm:rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-sm shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 whitespace-pre-wrap break-words ${
                  entry.type === 'user' 
                    ? 'bg-slate-800 text-slate-100 rounded-tr-none border border-slate-700' 
                    : 'bg-blue-600/10 border border-blue-500/30 text-blue-100 rounded-tl-none shadow-blue-500/5'
                }`}>
                  {entry.text}
                </div>
              )}
            </div>
          ))}
          
          {currentInput && (
            <div className="flex flex-col items-end opacity-60 mb-3 sm:mb-4">
              <div className="max-w-[85%] bg-slate-800 rounded-xl sm:rounded-2xl rounded-tr-none px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-sm italic animate-pulse whitespace-pre-wrap break-words">
                {currentInput}...
              </div>
            </div>
          )}
          
          {currentOutput && (
            <div className="flex flex-col items-start mb-3 sm:mb-4">
               <div className="max-w-[85%] bg-blue-600/10 border border-blue-500/30 text-blue-100 rounded-xl sm:rounded-2xl rounded-tl-none px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-sm whitespace-pre-wrap break-words">
                {currentOutput}
              </div>
            </div>
          )}

          {history.length === 0 && !currentInput && !currentOutput && (
            <div className="h-full py-20 flex flex-col items-center justify-center text-slate-600 text-center p-4">
              <div className="w-10 h-10 rounded-full border border-slate-800 flex items-center justify-center mb-3 opacity-30">
                 <Terminal className="w-5 h-5" />
              </div>
              <p className="italic text-[10px] sm:text-xs uppercase tracking-widest font-bold">Neural handshake established.</p>
              <p className="italic text-[10px] sm:text-xs opacity-50 mt-1">Awaiting auditory or visual input...</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* Standard Scrollbar logic for Modern Browsers */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(59, 130, 246, 0.4) rgba(15, 23, 42, 0.3);
          scroll-behavior: smooth;
        }

        /* Webkit specific styles for more control */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.4);
          border-radius: 10px;
          transition: background 0.2s;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.6);
        }
      `}</style>
    </div>
  );
};

export default TranscriptionView;