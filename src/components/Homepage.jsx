import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Terminal, ArrowRight, AlertCircle, Users } from 'lucide-react';

// Mock recent articles - in production this would come from an API
const mockRecentArticles = [
  {
    id: 1,
    category: 'STARTUPS',
    headline: 'Is Left-Pad the new Bitcoin? Inside the npm package that VCs are calling "transformative"',
    author: 'Sarah Chen',
    timeAgo: '4 hours ago',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop',
  },
  {
    id: 2,
    category: 'FUNDING',
    headline: 'Why VCs are pouring $20M into this To-Do app that "just works differently"',
    author: 'Marcus Williams',
    timeAgo: '6 hours ago',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
  },
  {
    id: 3,
    category: 'AI',
    headline: 'This simple Python script just gained sentience, claims Stanford researcher',
    author: 'Emily Rodriguez',
    timeAgo: '8 hours ago',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&fit=crop',
  },
  {
    id: 4,
    category: 'APPS',
    headline: 'The calculator app that Silicon Valley says will "redefine mathematics"',
    author: 'James Park',
    timeAgo: '12 hours ago',
    image: 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=400&h=300&fit=crop',
  },
  {
    id: 5,
    category: 'VENTURE',
    headline: 'Exclusive: Andreessen Horowitz leads $50M round in controversial regex library',
    author: 'Lisa Thompson',
    timeAgo: '1 day ago',
    image: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=300&fit=crop',
  },
];

const Homepage = () => {
  const navigate = useNavigate();
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
    setLoadingText('Checking cache...');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit job');
      }

      const data = await res.json();

      // If cached, redirect immediately
      if (data.cached) {
        navigate(`/article/${data.slug}`);
        return;
      }

      // New job - wait for completion
      const { jobId, position, slug } = data;
      setQueuePosition(position);

      if (position > 1) {
        setLoadingText(`You are #${position} in queue...`);
      } else {
        setLoadingText('Starting analysis...');
      }

      const eventSource = new EventSource(`/api/progress/${jobId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data);

          switch (eventData.type) {
            case 'queued':
              setQueuePosition(eventData.position);
              setLoadingText(eventData.message || `You are #${eventData.position} in queue...`);
              break;

            case 'started':
              setQueuePosition(null);
              setLoadingText(eventData.message || 'Starting analysis...');
              break;

            case 'progress':
              setLoadingText(eventData.message || 'Processing...');
              break;

            case 'complete':
              eventSource.close();
              eventSourceRef.current = null;
              // Navigate to the article page
              navigate(`/article/${slug}`);
              break;

            case 'error':
              eventSource.close();
              eventSourceRef.current = null;
              setError(eventData.error || 'An error occurred');
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

  useEffect(() => {
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
    <div className="min-h-screen bg-[#0a8935] flex items-center">
      {/* Green Hero Section with Input */}
      <section className="w-full">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Main Input Area - Takes 2 columns */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/20 backdrop-blur rounded-xl p-8"
              >
                <div className="mb-6">
                  <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
                    Hey there, unicorn in the making.
                  </h1>
                  <p className="text-white/80 text-lg">
                    Paste a GitHub repo or a web link and see what your "big break" will look like.
                  </p>
                </div>

                {/* Input Form */}
                <AnimatePresence mode="wait">
                  {error ? (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-xl p-6"
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
                      className="relative"
                    >
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                        <Github size={20} />
                      </div>
                      <input
                        type="text"
                        placeholder="https://github.com/username/project-name"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        className="w-full py-4 pl-12 pr-36 bg-white rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-white/50 placeholder:text-slate-400"
                      />
                      <button
                        type="submit"
                        className="absolute right-2 top-2 bottom-2 bg-[#00d100] text-white px-6 rounded-lg font-bold hover:bg-[#00b800] transition-colors flex items-center gap-2"
                      >
                        Generate <ArrowRight size={16} />
                      </button>
                    </motion.form>
                  ) : (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-white rounded-xl p-6"
                    >
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

                      {queuePosition && queuePosition > 1 && (
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
                          <Users size={14} />
                          <span>{queuePosition - 1} {queuePosition === 2 ? 'person' : 'people'} ahead of you</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-slate-700 font-mono text-sm">
                        <Terminal size={16} className="animate-pulse text-[#00d100]" />
                        {loadingText}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Top Headlines Sidebar */}
            <div className="lg:col-span-1">
              <div className="text-white">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  Recent Headlines
                </h2>
                <div className="space-y-4">
                  {mockRecentArticles.slice(0, 5).map((article, i) => (
                    <a
                      key={article.id}
                      href="#"
                      className="block group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-white/40 font-bold">■</span>
                        <p className="text-white/90 text-sm leading-snug group-hover:text-white transition-colors line-clamp-2">
                          {article.headline.split(':')[0]}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Homepage;
