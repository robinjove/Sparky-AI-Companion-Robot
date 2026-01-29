import React, { useEffect, useRef } from 'react';
import { Terminal, RefreshCcw, Activity } from 'lucide-react';
import { TranscriptionEntry } from '../types';

interface TranscriptionViewProps {
  history: TranscriptionEntry[];
  currentInput: string;
  currentOutput: string;
  isActive: boolean;
}

const TranscriptionView: React.FC<TranscriptionViewProps> = ({ 
  history, 
  currentInput, 
  currentOutput,
  isActive
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever history or current transcripts change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, currentInput, currentOutput]);

  return (
    <div className="flex flex-col h-full max-h-full bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden group">
      {/* Optimized Header */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between bg-slate-950/30 shrink-0">
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`} />
          Neural Logs
          {isActive && (
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-white/5 opacity-50">
              <RefreshCcw className="w-2 h-2 animate-spin-slow" />
              <Activity className="w-2 h-2 animate-pulse" />
            </div>
          )}
        </div>
        <div className="text-[8px] text-slate-600 font-mono italic">
          v2.9.8
        </div>
      </div>

      {/* Messages Area: Refined for 100% Zoom */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent"
      >
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center space-y-3 opacity-30">
            <Terminal className="w-6 h-6 mb-1" />
            <div className="space-y-1">
              <p className="italic text-[9px] uppercase tracking-widest font-bold">Awaiting Link...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry, i) => (
              <div 
                key={i} 
                className={`flex flex-col ${
                  entry.type === 'user' ? 'items-end' : 
                  entry.type === 'robot' ? 'items-start' : 
                  'items-center'
                }`}
              >
                {entry.type === 'system' ? (
                  <div className="my-0.5 px-2 py-1 bg-slate-900/60 border border-white/5 rounded text-[8px] font-mono text-cyan-400/70 uppercase tracking-tight animate-in fade-in">
                    {entry.text}
                  </div>
                ) : (
                  <div className={`group/msg relative max-w-[95%] rounded-lg px-2.5 py-2 text-[12px] leading-snug font-medium transition-all animate-in fade-in slide-in-from-bottom-1 ${
                    entry.type === 'user' 
                      ? 'bg-slate-800 text-slate-300 rounded-tr-none border border-white/5' 
                      : 'bg-blue-600/10 border border-blue-500/20 text-blue-100/90 rounded-tl-none shadow-sm'
                  }`}>
                    <div className="flex flex-col gap-1">
                      <span className="text-[7px] font-black uppercase tracking-tighter opacity-30">
                        {entry.type === 'user' ? 'Biological' : 'Machine'}
                      </span>
                      {entry.text}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Real-time Partial Transcripts */}
            {(currentInput || currentOutput) && (
              <div className={`flex flex-col ${currentInput ? 'items-end' : 'items-start'} opacity-50 animate-pulse`}>
                 <div className="max-w-[90%] rounded-lg px-2.5 py-1.5 text-[11px] italic font-mono bg-slate-800/20 border border-white/5">
                   {currentInput || currentOutput}
                 </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.1);
          border-radius: 10px;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 4s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default TranscriptionView;