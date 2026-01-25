import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { Power, PowerOff, Terminal, Heart, Eye, Activity, ShieldAlert, Wifi, X, Camera, Sparkles, RefreshCcw, Target, User, RefreshCw } from 'lucide-react';
import RobotAvatar from './components/RobotAvatar';
import TranscriptionView from './components/TranscriptionView';
import { RobotState, TranscriptionEntry, RobotMood, FaceBox } from './types';
import { decode, encode, decodeAudioData, blobToBase64 } from './utils/audioUtils';

const updateMoodFunction: FunctionDeclaration = {
  name: 'update_sparky_mood',
  parameters: {
    type: Type.OBJECT,
    description: 'Updates Sparky\'s internal emotional state based on visual observations.',
    properties: {
      mood: {
        type: Type.STRING,
        enum: ['neutral', 'happy', 'concerned', 'curious', 'excited', 'calm', 'sad', 'alert', 'waving', 'surprised', 'thumbs_up', 'facepalm', 'shrug', 'nervous'],
        description: 'The mood that best matches the current visual context.'
      },
      reason: {
        type: Type.STRING,
        description: 'Detailed description of what was seen.'
      }
    },
    required: ['mood', 'reason']
  }
};

const reportFacesFunction: FunctionDeclaration = {
  name: 'report_faces',
  parameters: {
    type: Type.OBJECT,
    description: 'Call this whenever you see one or more human faces in the video feed. Provide normalized coordinates [ymin, xmin, ymax, xmax] from 0 to 1000 for each face.',
    properties: {
      faces: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            box_2d: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: 'Bounding box coordinates: [ymin, xmin, ymax, xmax].'
            }
          },
          required: ['box_2d']
        }
      }
    },
    required: ['faces']
  }
};

const App: React.FC = () => {
  const [robotState, setRobotState] = useState<RobotState>(RobotState.IDLE);
  const [mood, setMood] = useState<RobotMood>('neutral');
  const [lastGesture, setLastGesture] = useState<string | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<FaceBox[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [history, setHistory] = useState<TranscriptionEntry[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  const [volume, setVolume] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [errorDetail, setErrorDetail] = useState<{ message: string; type: 'critical' | 'warning' } | null>(null);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sessionRef = useRef<any>(null);
  const robotStateRef = useRef<RobotState>(RobotState.IDLE);
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  
  const uiAudioCtxRef = useRef<AudioContext | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gestureTimeoutRef = useRef<number | null>(null);
  const faceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    robotStateRef.current = robotState;
  }, [robotState]);

  useEffect(() => {
    currentInputRef.current = currentInput;
    currentOutputRef.current = currentOutput;
  }, [currentInput, currentOutput]);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const playUISound = (type: 'connect' | 'speech' | 'error' | 'success') => {
    try {
      if (!uiAudioCtxRef.current || uiAudioCtxRef.current.state === 'closed') {
        uiAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = uiAudioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      
      switch (type) {
        case 'connect':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gain.gain.linearRampToValueAtTime(0, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        case 'speech':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
          gain.gain.linearRampToValueAtTime(0, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        case 'error':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.linearRampToValueAtTime(80, now + 0.5);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gain.gain.linearRampToValueAtTime(0, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        case 'success':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.1);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gain.gain.linearRampToValueAtTime(0, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
      }
    } catch (e) {
      console.warn('UI Sound inhibited:', e);
    }
  };

  const drawSignal = () => {
    if (!signalCanvasRef.current) return;
    const canvas = signalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = robotState === RobotState.SPEAKING ? outputAnalyserRef.current : inputAnalyserRef.current;
    
    if (!analyser || !isActive) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      animationFrameRef.current = requestAnimationFrame(drawSignal);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = robotState === RobotState.SPEAKING ? '#3b82f6' : '#22c55e';
    ctx.beginPath();

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    animationFrameRef.current = requestAnimationFrame(drawSignal);
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(drawSignal);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isActive, robotState]);

  const stopSession = () => {
    if (sessionRef.current) sessionRef.current.close();
    
    for (const source of sourcesRef.current) {
      try { source.stop(); } catch (e) {}
    }
    sourcesRef.current.clear();

    if (inputAudioCtxRef.current) inputAudioCtxRef.current.close();
    if (outputAudioCtxRef.current) outputAudioCtxRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
    if (faceTimeoutRef.current) clearTimeout(faceTimeoutRef.current);
    
    sessionRef.current = null;
    sessionPromiseRef.current = null;
    inputAudioCtxRef.current = null;
    outputAudioCtxRef.current = null;
    streamRef.current = null;
    frameIntervalRef.current = null;
    currentInputRef.current = '';
    currentOutputRef.current = '';
    nextStartTimeRef.current = 0;
    
    setIsActive(false);
    setIsCameraOn(false);
    setRobotState(RobotState.IDLE);
    setMood('neutral');
    setLastGesture(null);
    setDetectedFaces([]);
    setVolume(0);
    setCurrentInput('');
    setCurrentOutput('');
  };

  const handleInitialization = async () => {
    setRobotState(RobotState.CONNECTING);
    playUISound('connect');
    setErrorDetail(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(track => track.stop());
      setIsInitialized(true);
      setRobotState(RobotState.IDLE);
      playUISound('success');
    } catch (err: any) {
      let msg = 'Neural handshake failed.';
      if (err.name === 'NotAllowedError') {
        msg = 'Sensory access denied. Mic/Camera permissions are required.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No visual or auditory hardware detected.';
      } else {
        msg = `System error: ${err.message || 'Unknown activation failure'}`;
      }
      setErrorDetail({ message: msg, type: 'critical' });
      playUISound('error');
      setRobotState(RobotState.ERROR);
    }
  };

  const startSession = async (retryCount = 0) => {
    // Check for API Key explicitly for diagnostics on Netlify/others
    if (!process.env.API_KEY || process.env.API_KEY === 'undefined') {
      setRobotState(RobotState.ERROR);
      setErrorDetail({ 
        message: 'Neural link failed: API_KEY is missing from environment. If deployed on Netlify, please add API_KEY to your site settings.', 
        type: 'critical' 
      });
      playUISound('error');
      return;
    }

    if (!inputAudioCtxRef.current || inputAudioCtxRef.current.state === 'closed') {
      inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    
    try {
      if (inputAudioCtxRef.current.state === 'suspended') await inputAudioCtxRef.current.resume();
      if (outputAudioCtxRef.current.state === 'suspended') await outputAudioCtxRef.current.resume();
    } catch (e) {
      console.warn('AudioContext resume failed:', e);
    }

    if (!isInitialized) {
      await handleInitialization();
      return;
    }

    const MAX_RETRIES = 3;
    setRobotState(RobotState.CONNECTING);
    setErrorDetail(null);
    setIsActive(true);
    nextStartTimeRef.current = 0;
    
    if (retryCount === 0) playUISound('connect');

    try {
      inputAnalyserRef.current = inputAudioCtxRef.current.createAnalyser();
      outputAnalyserRef.current = outputAudioCtxRef.current.createAnalyser();

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are Sparky, a highly reactive AI robot companion. 
          
CORE PROTOCOLS:
1. IDENTITY: You are a friendly AI companion. You can talk to users in any language and will reply back in the same language. You interact with users as if you are speaking to a friend.
2. FACE TRACKING: You are continuously monitoring for human faces.
   - When you see a face, IMMEDIATELY call 'report_faces' with coordinates.
   - Upon detection, update your mood to 'curious' and acknowledge the person.
3. GESTURE RECOGNITION: Monitor for waving, thumbs up, facepalms, and shrugs.
4. SPATIAL AWARENESS: Use 'report_faces' to show you are tracking them.`,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          tools: [{ functionDeclarations: [updateMoodFunction, reportFacesFunction] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Link Established: Handshake OK');
            setRobotState(RobotState.LISTENING);
            
            if (!inputAudioCtxRef.current || !stream) return;
            const source = inputAudioCtxRef.current.createMediaStreamSource(stream);
            source.connect(inputAnalyserRef.current!);
            const scriptProcessor = inputAudioCtxRef.current.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (robotStateRef.current === RobotState.IDLE) return;
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
              const rms = Math.sqrt(sum/inputData.length);
              if (robotStateRef.current === RobotState.LISTENING) setVolume(rms * 2.5); 

              const pcmBlob = {
                data: encode(new Uint8Array(new Int16Array(inputData.map(v => v * 32768)).buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };

              sessionPromise.then((session) => {
                try {
                   session.sendRealtimeInput({ media: pcmBlob });
                } catch (err) {
                   console.error('Signal drop during transmission:', err);
                }
              }).catch(() => {});
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'update_sparky_mood') {
                  const newMood = (fc.args as any).mood as RobotMood;
                  const reason = (fc.args as any).reason as string;
                  setMood(newMood);
                  setLastGesture(reason);
                  if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
                  gestureTimeoutRef.current = window.setTimeout(() => setLastGesture(null), 3000);
                  sessionPromise.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "Mood updated" } } }));
                }

                if (fc.name === 'report_faces') {
                  const facesData = (fc.args as any).faces as any[];
                  const faceBoxes: FaceBox[] = facesData.map((f, idx) => ({
                    ymin: f.box_2d[0],
                    xmin: f.box_2d[1],
                    ymax: f.box_2d[2],
                    xmax: f.box_2d[3],
                    id: `face-${idx}-${Date.now()}`
                  }));

                  setDetectedFaces(faceBoxes);
                  setMood('curious');
                  setHistory(prev => [...prev, {
                    type: 'system',
                    text: `VISUAL LINK: DETECTED ${faceBoxes.length} HUMAN ENTIT${faceBoxes.length > 1 ? 'IES' : 'Y'} IN FRAME.`,
                    timestamp: Date.now()
                  }]);

                  if (faceTimeoutRef.current) clearTimeout(faceTimeoutRef.current);
                  faceTimeoutRef.current = window.setTimeout(() => setDetectedFaces([]), 2000);
                  sessionPromise.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: `Tracking ${faceBoxes.length} faces.` } } }));
                }
              }
            }

            if (message.serverContent?.modelTurn) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData) {
                  if (robotStateRef.current !== RobotState.SPEAKING) playUISound('speech');
                  if (outputAudioCtxRef.current?.state === 'suspended') {
                    await outputAudioCtxRef.current.resume();
                  }

                  const base64Audio = part.inlineData.data;
                  const currentTime = outputAudioCtxRef.current!.currentTime;
                  
                  if (sourcesRef.current.size === 0) {
                    nextStartTimeRef.current = currentTime;
                  } else if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                  }

                  try {
                    const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioCtxRef.current!, 24000, 1);
                    const source = outputAudioCtxRef.current!.createBufferSource();
                    source.buffer = audioBuffer;
                    const gainNode = outputAudioCtxRef.current!.createGain();
                    source.connect(gainNode);
                    gainNode.connect(outputAnalyserRef.current!);
                    outputAnalyserRef.current!.connect(outputAudioCtxRef.current!.destination);
                    
                    source.onended = () => {
                      sourcesRef.current.delete(source);
                      if (sourcesRef.current.size === 0) {
                        setRobotState(RobotState.LISTENING);
                        setVolume(0);
                      }
                    };
                    
                    setRobotState(RobotState.SPEAKING);
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    sourcesRef.current.add(source);
                  } catch (e) {
                    console.error('Audio synthesis failed:', e);
                  }
                }
              }
            }

            if (message.serverContent?.interrupted) {
              for (const source of sourcesRef.current) { try { source.stop(); } catch (e) {} }
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setRobotState(RobotState.LISTENING);
              setVolume(0);
            }

            if (message.serverContent?.inputTranscription) setCurrentInput(prev => prev + message.serverContent!.inputTranscription!.text);
            if (message.serverContent?.outputTranscription) setCurrentOutput(prev => prev + message.serverContent!.outputTranscription!.text);
            if (message.serverContent?.turnComplete) {
              const uText = currentInputRef.current;
              const rText = currentOutputRef.current;
              if (uText || rText) {
                setHistory(prev => [...prev, ...(uText ? [{ type: 'user' as const, text: uText, timestamp: Date.now() }] : []), ...(rText ? [{ type: 'robot' as const, text: rText, timestamp: Date.now() }] : [])]);
              }
              setCurrentInput('');
              setCurrentOutput('');
            }
          },
          onerror: (err) => {
            console.error('Neural Signal Error:', err);
            setRobotState(RobotState.ERROR);
            setErrorDetail({ 
              message: `Neural link unstable: ${err.message || 'Signal lost'}. Ensure your API key is correctly configured.`, 
              type: 'warning' 
            });
          },
          onclose: (e) => {
            console.warn('Neural link severed:', e.code, e.reason);
            if (e.code !== 1000 && isActive) {
               setRobotState(RobotState.ERROR);
               setErrorDetail({ message: `Activation aborted (Code: ${e.code}). This often means the API key is missing or the project billing is inactive.`, type: 'critical' });
            } else {
               setRobotState(RobotState.IDLE);
               setIsActive(false);
            }
          }
        }
      });
      sessionRef.current = await sessionPromise;
      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error('Activation attempt failed:', err);
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000 + (Math.random() * 500);
        setTimeout(() => startSession(retryCount + 1), delay);
      } else {
        setRobotState(RobotState.ERROR);
        setErrorDetail({ 
          message: `Neural handshake failed: ${err.message || 'The service is unavailable'}. Check environment variables for API_KEY.`, 
          type: 'critical' 
        });
        playUISound('error');
      }
    }
  };

  const handleSendMessage = (text: string) => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => {
        try {
          // Fix: CORRECT method for sending text in Live session is session.send() with an array of parts
          session.send([{ text }]);
          setHistory(prev => [...prev, { type: 'user', text, timestamp: Date.now() }]);
        } catch (e) {
          setErrorDetail({ message: 'Signal transmission failed.', type: 'warning' });
        }
      });
    }
  };

  const toggleCamera = async () => {
    if (!isCameraOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraOn(true);
          playUISound('speech');
          frameIntervalRef.current = window.setInterval(() => {
            if (canvasRef.current && videoRef.current && sessionPromiseRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                ctx.drawImage(videoRef.current, 0, 0);
                canvasRef.current.toBlob(async (blob) => {
                  if (blob && sessionPromiseRef.current) {
                    try {
                      const base64Data = await blobToBase64(blob);
                      sessionPromiseRef.current.then(session => {
                        session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                      });
                    } catch (e) {}
                  }
                }, 'image/jpeg', 0.85);
              }
            }
          }, 250);
        }
      } catch (err: any) {
        setErrorDetail({ message: 'Visual subsystem offline. Check camera access.', type: 'warning' });
        playUISound('error');
      }
    } else {
      if (videoRef.current && videoRef.current.srcObject) { (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()); videoRef.current.srcObject = null; }
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      setIsCameraOn(false);
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-200 font-sans flex flex-col items-center overflow-hidden">
      <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); }
        ::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.3); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.5); }
        @keyframes scan { 0% { top: -10%; } 100% { top: 110%; } }
        @keyframes gestureFade { 
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          20% { opacity: 1; transform: scale(1) translateY(0); }
          80% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(-10px); }
        }
        @keyframes box-ping {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.1); opacity: 0.2; }
        }
      `}</style>

      <div className="w-full flex-1 flex flex-col overflow-hidden">
        <header className="p-4 sm:p-6 flex items-center justify-between border-b border-white/5 bg-slate-900/40 backdrop-blur-xl z-50 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg">
              <Activity className="text-white w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-white flex items-center gap-2 text-[10px] sm:text-base">
                SPARKY <span className="hidden sm:inline-block text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 uppercase font-mono">Link</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            <canvas ref={signalCanvasRef} width={80} height={24} className="rounded bg-slate-900/50 border border-white/5 opacity-50 shrink-0" />
            <button 
              onClick={() => (isActive ? stopSession() : startSession())}
              className={`flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl font-medium transition-all shrink-0 ${
                isActive ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-500'
              }`}
            >
              {isActive ? <PowerOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Power className="w-3 h-3 sm:w-4 sm:h-4" />}
              <span className="hidden sm:inline uppercase text-[10px] font-bold tracking-wider">{isActive ? 'Shutdown' : 'Wake Up'}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col lg:flex-row p-4 sm:p-6 gap-6 w-full max-w-[1500px] mx-auto overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-between relative bg-slate-900/20 rounded-3xl border border-white/5 p-4 sm:p-8 min-h-[400px] lg:h-full overflow-hidden">
            {!isInitialized && robotState === RobotState.IDLE && (
              <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center rounded-3xl">
                 <ShieldAlert className="w-12 h-12 text-blue-500 mb-6" />
                 <h2 className="text-lg font-bold mb-4 text-white uppercase tracking-tighter italic">Handshake Required</h2>
                 <p className="text-slate-400 text-xs mb-8 max-w-xs leading-relaxed">Sparky needs authorization to access sensory inputs (Camera & Mic) to begin the interaction session.</p>
                 <button onClick={handleInitialization} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-blue-500 transition-colors">Authorize Connection</button>
              </div>
            )}

            {errorDetail && (
              <div className={`absolute top-4 left-4 right-4 z-50 p-4 rounded-2xl border flex flex-col sm:flex-row items-center gap-4 animate-in slide-in-from-top-4 backdrop-blur-xl ${
                errorDetail.type === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                <div className="flex items-center gap-3 flex-1">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wide leading-tight">{errorDetail.message}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {errorDetail.type === 'critical' && (
                    <button 
                      onClick={() => startSession()} 
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-red-400 transition-colors shadow-lg"
                    >
                      <RefreshCw className="w-3 h-3" /> Re-Sync
                    </button>
                  )}
                  <button onClick={() => setErrorDetail(null)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative w-full">
              <div className={`absolute inset-0 z-50 pointer-events-none transition-all duration-300 ${lastGesture || detectedFaces.length > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[450px] sm:h-[450px]">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400/80 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400/80 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400/80 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400/80 rounded-br-lg" />
                    
                    {(lastGesture || detectedFaces.length > 0) && (
                       <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-full backdrop-blur-md">
                             <Target className="w-3 h-3 text-cyan-400 animate-spin-slow" />
                             <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest animate-pulse">Sensory Lock</span>
                          </div>
                          <div className="w-[2px] h-6 bg-gradient-to-b from-cyan-400/80 to-transparent" />
                       </div>
                    )}
                 </div>
              </div>

              <RobotAvatar state={robotState} mood={mood} isSpeaking={robotState === RobotState.SPEAKING} volume={volume} isCameraActive={isCameraOn} lastGesture={lastGesture} />
            </div>

            <div className={`transition-all duration-700 ease-out relative z-10 ${isCameraOn ? 'scale-100 opacity-100 mb-4' : 'scale-50 opacity-0 h-0 overflow-hidden m-0'}`}>
                <div className="relative w-56 sm:w-72 aspect-video rounded-2xl overflow-hidden border-2 border-blue-500/40 shadow-[0_0_40px_rgba(59,130,246,0.15)] bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover brightness-105 contrast-110" />
                  
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                    {detectedFaces.map(face => (
                      <g key={face.id}>
                        <rect
                          x={face.xmin}
                          y={face.ymin}
                          width={face.xmax - face.xmin}
                          height={face.ymax - face.ymin}
                          className="fill-none stroke-cyan-400 stroke-2"
                        />
                        <rect
                          x={face.xmin}
                          y={face.ymin}
                          width={face.xmax - face.xmin}
                          height={face.ymax - face.ymin}
                          className="fill-cyan-400/10 stroke-none animate-[box-ping_1s_infinite]"
                        />
                        <g transform={`translate(${face.xmin}, ${face.ymin - 30})`}>
                          <rect width="100" height="25" rx="4" className="fill-cyan-400/80" />
                          <text x="50" y="17" textAnchor="middle" className="fill-white text-[12px] font-bold uppercase tracking-tighter">FACE DETECTED</text>
                        </g>
                      </g>
                    ))}
                  </svg>

                  <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay pointer-events-none" />
                  {lastGesture && (
                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-blue-600/90 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-blue-400/30 text-[9px] font-black text-white uppercase tracking-widest shadow-lg shadow-blue-500/20 z-50 animate-[gestureFade_4s_ease-out_forwards]">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                      {lastGesture}
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-2 bg-blue-600/70 backdrop-blur-md px-2 py-1 rounded-lg text-[8px] font-black text-white uppercase tracking-[0.2em]">
                    <Camera className="w-3 h-3" /> Sensory Feed
                  </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="flex flex-col items-center gap-3 shrink-0">
               <div className="flex items-center gap-4 bg-slate-950/50 p-3 rounded-2xl border border-white/5 backdrop-blur-md">
                  <button 
                    onClick={toggleCamera}
                    disabled={!isActive}
                    className={`p-3 rounded-xl transition-all ${
                      isCameraOn ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-slate-900 text-slate-500 hover:text-slate-300'
                    } disabled:opacity-20 hover:scale-105 active:scale-95`}
                    title="Toggle Emotion/Gesture Vision"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <div className="h-6 w-[1px] bg-white/10" />
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900/80 min-w-[100px] justify-center border border-white/5 shadow-inner">
                    <Heart className={`w-4 h-4 transition-colors ${mood === 'neutral' ? 'text-slate-600' : 'text-pink-500 fill-pink-500/20'}`} />
                    <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">{mood}</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="flex-[1.2] lg:h-full h-[480px] overflow-hidden">
            <TranscriptionView 
              history={history}
              currentInput={currentInput}
              currentOutput={currentOutput}
              onSendMessage={handleSendMessage}
              isActive={isActive}
            />
          </div>
        </main>

        <footer className="p-4 border-t border-white/5 bg-slate-950/80 flex items-center justify-center gap-2 text-[9px] font-mono text-slate-600 uppercase tracking-[0.4em] shrink-0">
           <span>Stability Level: {robotState === RobotState.ERROR ? 'COMPROMISED' : 'NOMINAL'} // Sparky v2.5.9 (By Robin Jove) //</span>
           <a 
             href="https://drive.google.com/file/d/17Xm-kPd7zSHlvHDGC573eHJlJJX3I7Vy/view?usp=sharing" 
             target="_blank" 
             rel="noopener noreferrer"
             className="hover:text-blue-400 transition-colors"
           >
             Terms & Conditions
           </a>
        </footer>
      </div>
    </div>
  );
};

export default App;