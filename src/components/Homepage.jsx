import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Terminal, Zap, ArrowRight } from 'lucide-react';

const Homepage = ({ onGenerate }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState('Initializing agent...');

  // Simulated loading sequence
  useEffect(() => {
    if (isGenerating) {
      const texts = [
        "Cloning repository...",
        "Judging variable naming conventions...",
        "Stalking contributor commit history...",
        "Identifying buzzwords...",
        "Fabricating Series A funding rumors...",
        "Drafting clickbait headline..."
      ];
      let i = 0;
      const interval = setInterval(() => {
        setLoadingText(texts[i % texts.length]);
        i++;
      }, 800);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!repoUrl) return;
    setIsGenerating(true);
    // Simulate API call delay
    setTimeout(() => {
      onGenerate(repoUrl); // Callback to switch views
    }, 4500);
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
            {!isGenerating ? (
              <motion.form
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white border-2 border-[#00d100] rounded-xl p-8 shadow-xl flex flex-col items-center justify-center min-h-[100px]"
              >
                <div className="w-full bg-slate-100 h-2 rounded-full mb-4 overflow-hidden">
                  <motion.div
                    className="h-full bg-[#00d100]"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 4.5, ease: "easeInOut" }}
                  />
                </div>
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
