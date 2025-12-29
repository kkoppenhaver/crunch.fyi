import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import logoSvg from '../assets/logo.svg';

// Satirical filler messages shown when progress is stale
const FILLER_MESSAGES = [
  'Consulting with anonymous VCs...',
  'Drumming up investor quotes...',
  'Coining a new disruptive buzzword...',
  'Polling Sand Hill Road...',
  'Reaching out to industry analysts...',
  'Synergizing market dynamics...',
  'Projecting hockey stick growth...',
  'Benchmarking against unicorns...',
  'Quantifying the disruption potential...',
  'Stress-testing the moat for alligators...',
  'Validating product-market fit vibrations...',
  'Calculating total addressable hype...',
  'Aligning stakeholder chakras...',
  'Optimizing the pivot trajectory...',
  'Negotiating embargo terms...',
  'Pressure-testing the founding myth...',
];

const Homepage = () => {
  const [recentArticles, setRecentArticles] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const [repoUrl, setRepoUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState('Initializing...');
  const [displayText, setDisplayText] = useState('Initializing...');
  const [error, setError] = useState(null);
  const [trendingSuggestion, setTrendingSuggestion] = useState(null);
  const eventSourceRef = useRef(null);
  const hasAutoSubmittedRef = useRef(false);
  const fillerIntervalRef = useRef(null);
  const fillerIndexRef = useRef(0);

  const handleSubmit = async (e, urlOverride) => {
    if (e) e.preventDefault();
    const urlToSubmit = urlOverride || repoUrl;
    if (!urlToSubmit) return;

    setIsGenerating(true);
    setError(null);
    setTrendingSuggestion(null);
    setLoadingText('Checking cache...');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: urlToSubmit }),
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

      if (position > 1) {
        setLoadingText(`Waiting in queue (#${position})...`);
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
              setLoadingText(eventData.message || `Waiting in queue (#${eventData.position})...`);
              break;

            case 'started':
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

  // Filler message rotation when progress is stale
  useEffect(() => {
    // Clear any existing interval
    if (fillerIntervalRef.current) {
      clearInterval(fillerIntervalRef.current);
      fillerIntervalRef.current = null;
    }

    if (!isGenerating) {
      setDisplayText(loadingText);
      return;
    }

    // Show real message immediately
    setDisplayText(loadingText);

    // After 4 seconds of no updates, start cycling filler messages
    const timeout = setTimeout(() => {
      // Shuffle the starting index for variety
      fillerIndexRef.current = Math.floor(Math.random() * FILLER_MESSAGES.length);

      fillerIntervalRef.current = setInterval(() => {
        setDisplayText(FILLER_MESSAGES[fillerIndexRef.current]);
        fillerIndexRef.current = (fillerIndexRef.current + 1) % FILLER_MESSAGES.length;
      }, 4000);
    }, 4000);

    return () => {
      clearTimeout(timeout);
      if (fillerIntervalRef.current) {
        clearInterval(fillerIntervalRef.current);
      }
    };
  }, [loadingText, isGenerating]);

  // Handle regeneration: auto-submit when navigated with a repoUrl in state
  useEffect(() => {
    if (location.state?.repoUrl && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      const urlFromState = location.state.repoUrl;
      setRepoUrl(urlFromState);
      // Clear the navigation state to prevent re-submission on refresh
      window.history.replaceState({}, document.title);
      // Auto-submit after a brief delay to allow state to settle
      setTimeout(() => {
        handleSubmit(null, urlFromState);
      }, 100);
    }
  }, [location.state]);

  useEffect(() => {
    fetch('/api/article')
      .then((res) => res.json())
      .then((data) => {
        if (data.articles) {
          setRecentArticles(data.articles);
        }
      })
      .catch(() => {
        // Silently fail - we'll just show no articles
      });
  }, []);

  useEffect(() => {
    fetch('/api/trending')
      .then((res) => res.json())
      .then((data) => {
        if (data.suggestion) {
          setTrendingSuggestion(data.suggestion);
        }
      })
      .catch(() => {
        // Silently fail - we'll just not show a suggestion
      });
  }, []);

  const handleRetry = () => {
    setError(null);
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-[#0a8935] flex flex-col">
      {/* Header */}
      <header className="w-full">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <img
            src={logoSvg}
            alt="Crunch"
            className="h-6 brightness-0 invert"
          />
        </div>
      </header>

      {/* Green Hero Section with Input */}
      <section className="w-full flex-1 flex items-center">
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
                    Hey there, future unicorn.
                  </h1>
                  <p className="text-white/80 text-lg">
                    Show us your GitHub repo here and we'll show you what your big break will look like.
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
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <form onSubmit={handleSubmit} className="relative">
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
                      </form>
                      {trendingSuggestion && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="mt-4 text-center"
                        >
                          <span className="text-white/60 text-base">or try </span>
                          <button
                            type="button"
                            onClick={() => setRepoUrl(trendingSuggestion.url)}
                            className="text-white/90 text-base hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
                          >
                            {trendingSuggestion.owner}/{trendingSuggestion.name}
                          </button>
                          <span className="text-white/60 text-base"> (← click it)</span>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-white rounded-xl p-6"
                    >
                      {/* Repo being analyzed */}
                      <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                        <Github size={16} />
                        <span>{repoUrl.replace('https://github.com/', '')}</span>
                      </div>

                      <div className="flex items-center gap-3 text-slate-700 font-mono text-sm">
                        <Loader2 size={16} className="animate-spin text-[#00d100]" />
                        {displayText}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Top Headlines Sidebar - only shown if there are articles */}
            {recentArticles.length > 0 && (
              <div className="lg:col-span-1">
                <div className="text-white">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    Recent Headlines
                  </h2>
                  <div className="space-y-4">
                    {recentArticles.slice(0, 5).map((article) => (
                      <Link
                        key={article.slug}
                        to={`/article/${article.slug}`}
                        className="block group"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-white/40 font-bold">■</span>
                          <p className="text-white/90 text-sm leading-snug group-hover:text-white transition-colors line-clamp-2">
                            {article.headline}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link
                    to="/articles"
                    className="inline-block mt-4 text-white/70 text-sm hover:text-white transition-colors"
                  >
                    View all articles &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-white/60 text-sm">
          Built by{' '}
          <a
            href="https://floorboardai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/80 hover:text-white underline underline-offset-2 transition-colors"
          >
            FloorboardAI
          </a>
          {' '}— We help agencies amplify their impact with AI
        </div>
      </footer>
    </div>
  );
};

export default Homepage;
