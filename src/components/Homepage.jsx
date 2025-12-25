import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Terminal, Zap, ArrowRight, AlertCircle, Users } from 'lucide-react';

const Homepage = ({ onGenerate }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState('Initializing...');
  const [queuePosition, setQueuePosition] = useState(null);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!repoUrl) return;

    setIsGenerating(true);
    setError(null);
    setQueuePosition(null);
    setLoadingText('Submitting job...');

    try {
      // 1. Submit job to queue
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit job');
      }

      const { jobId, position } = await res.json();
      setQueuePosition(position);

      if (position > 1) {
        setLoadingText(`You are #${position} in queue...`);
      } else {
        setLoadingText('Starting analysis...');
      }

      // 2. Connect to SSE for progress updates
      const eventSource = new EventSource(`/api/progress/${jobId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'queued':
              setQueuePosition(data.position);
              setLoadingText(data.message || `You are #${data.position} in queue...`);
              break;

            case 'started':
              setQueuePosition(null);
              setLoadingText(data.message || 'Starting analysis...');
              break;

            case 'progress':
              setLoadingText(data.message || 'Processing...');
              break;

            case 'complete':
              eventSource.close();
              eventSourceRef.current = null;
              onGenerate(repoUrl, data.article);
              break;

            case 'error':
              eventSource.close();
              eventSourceRef.current = null;
              setError(data.error || 'An error occurred');
              setIsGenerating(false);
              break;

            default:
              break;
          }
        } catch (parseError) {
          console.error('Failed to parse SSE event:', parseError);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        setError('Connection lost. Please try again.');
        setIsGenerating(false);
      };
    } catch (err) {
      setError(err.message || 'Failed to generate article');
      setIsGenerating(false);
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleRetry = () => {
    setError(null);
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#00d100] selection:text-white">
      {/* Navbar */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
          <div className="w-8 h-8 bg-[#00d100] text-white flex items-center justify-center rounded">
            TC
          </div>
          <span>Disruptor<span className="text-slate-400">.ai</span></span>
        </div>
        <a href="#" className="text-sm font-medium hover:text-[#00d100] transition-colors">Login</a>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center mt-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 bg-green-100 text-[#008a00] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
            <Zap size={14} />
            AI-Powered Journalism
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            Turn your spaghetti code into <span className="text-[#00d100]">unicorn hype.</span>
          </h1>
          <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto">
            Paste a GitHub repo. Our AI agent will analyze the code, dox the maintainer,
            and write a fake TechCrunch article about how it's changing the world.
          </p>
        </motion.div>

        {/* Input Area */}
        <div className="w-full max-w-2xl relative">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border-2 border-red-300 rounded-xl p-8 shadow-xl"
              >
                <div className="flex items-start gap-4">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={24} />
                  <div className="flex-1">
                    <h3 className="font-bold text-red-700 mb-2">Something went wrong</h3>
                    <p className="text-slate-600 mb-4">{error}</p>
                    <button
                      onClick={handleRetry}
                      className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-[#00d100] transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : !isGenerating ? (
              <motion.form
                key="form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleSubmit}
                className="relative group"
              >
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                  <Github size={20} />
                </div>
                <input
                  type="text"
                  placeholder="https://github.com/username/project-name"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full py-5 pl-12 pr-40 bg-white border-2 border-slate-200 rounded-xl shadow-lg text-lg focus:outline-none focus:border-[#00d100] transition-all placeholder:text-slate-300"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 bottom-2 bg-slate-900 text-white px-6 rounded-lg font-bold hover:bg-[#00d100] transition-colors flex items-center gap-2"
                >
                  Generate <ArrowRight size={16} />
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white border-2 border-[#00d100] rounded-xl p-8 shadow-xl flex flex-col items-center justify-center min-h-[100px]"
              >
                {/* Progress indicator */}
                <div className="w-full bg-slate-100 h-2 rounded-full mb-4 overflow-hidden">
                  <motion.div
                    className="h-full bg-[#00d100]"
                    initial={{ width: "5%" }}
                    animate={{
                      width: queuePosition ? "10%" : "90%",
                    }}
                    transition={{
                      duration: queuePosition ? 0.5 : 60,
                      ease: "linear",
                    }}
                  />
                </div>

                {/* Queue position indicator */}
                {queuePosition && queuePosition > 1 && (
                  <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
                    <Users size={14} />
                    <span>{queuePosition - 1} {queuePosition === 2 ? 'person' : 'people'} ahead of you</span>
                  </div>
                )}

                {/* Loading text */}
                <div className="flex items-center gap-3 text-slate-700 font-mono text-sm">
                  <Terminal size={16} className="animate-pulse text-[#00d100]" />
                  {loadingText}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Social Proof / Examples */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="bg-white p-4 rounded border border-slate-200">
            <div className="text-[#00d100] text-xs font-bold uppercase mb-2">Disrupting</div>
            <h3 className="font-bold mb-1">"Is Left-Pad the new Bitcoin?"</h3>
            <p className="text-xs text-slate-400">Generated 4m ago</p>
          </div>
          <div className="bg-white p-4 rounded border border-slate-200">
            <div className="text-[#00d100] text-xs font-bold uppercase mb-2">Funding</div>
            <h3 className="font-bold mb-1">"Why VCs are pouring $20M into this To-Do app."</h3>
            <p className="text-xs text-slate-400">Generated 12m ago</p>
          </div>
          <div className="bg-white p-4 rounded border border-slate-200">
            <div className="text-[#00d100] text-xs font-bold uppercase mb-2">AI</div>
            <h3 className="font-bold mb-1">"This simple script just gained sentience."</h3>
            <p className="text-xs text-slate-400">Generated 1h ago</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Homepage;
