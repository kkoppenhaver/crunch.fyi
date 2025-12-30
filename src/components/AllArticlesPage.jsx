import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Menu, X, Loader2 } from 'lucide-react';
import logoSvg from '../assets/logo.svg';

const XIcon = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedInIcon = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const PAGE_SIZE = 20;

const AllArticlesPage = () => {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const loadMoreRef = useRef(null);

  // Initial load
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await fetch(`/api/article?limit=${PAGE_SIZE}&offset=0`);
        const data = await res.json();
        setArticles(data.articles || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error('Failed to fetch articles:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  // Load more function
  const loadMore = useCallback(async () => {
    if (loadingMore || articles.length >= total) return;

    setLoadingMore(true);
    try {
      const res = await fetch(`/api/article?limit=${PAGE_SIZE}&offset=${articles.length}`);
      const data = await res.json();
      setArticles(prev => [...prev, ...(data.articles || [])]);
    } catch (err) {
      console.error('Failed to load more articles:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [articles.length, total, loadingMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && articles.length < total) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore, loadingMore, articles.length, total]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/article/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        setSearchResults(data.articles || []);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Escape key to close search
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Header */}
      <header className="border-b border-[#e6e6e6] sticky top-0 bg-white z-50">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
          <div className="h-[56px] flex items-center justify-between">
            <a href="#" className="flex items-center" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
              <img src={logoSvg} alt="Crunch" className="h-8" />
            </a>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-100 rounded cursor-pointer" aria-label="Search" onClick={() => setIsSearchOpen(true)}>
                <Search size={20} className="text-[#1a1a1a]" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded cursor-pointer" aria-label="Menu" onClick={() => setIsDrawerOpen(true)}>
                <Menu size={20} className="text-[#1a1a1a]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[900px] mx-auto px-4 lg:px-6 py-8 lg:py-12">
        <h1 className="text-3xl lg:text-4xl font-bold text-[#1a1a1a] mb-8">All Articles</h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-[#0a8935]" />
          </div>
        ) : articles.length === 0 ? (
          <p className="text-[#666] text-center py-12">No articles yet. Be the first to generate one!</p>
        ) : (
          <>
            <div className="space-y-6">
              {articles.map((article) => (
                <Link
                  key={article.slug}
                  to={`/article/${article.slug}`}
                  className="flex gap-4 lg:gap-6 group border-b border-[#e6e6e6] pb-6"
                >
                  {article.image && (
                    <img
                      src={article.image}
                      alt=""
                      className="w-24 h-24 lg:w-32 lg:h-32 object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[12px] text-[#666] mb-2">
                      <span className="text-[#0a8935] font-medium uppercase">{article.category}</span>
                      <span>•</span>
                      <span>{formatDate(article.createdAt)}</span>
                    </div>
                    <h2 className="text-lg lg:text-xl font-bold text-[#1a1a1a] group-hover:text-[#0a8935] transition-colors leading-tight mb-2">
                      {article.headline}
                    </h2>
                    <p className="text-[14px] text-[#666]">By {article.author}</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="py-8 flex items-center justify-center">
              {loadingMore ? (
                <Loader2 size={24} className="animate-spin text-[#0a8935]" />
              ) : articles.length >= total ? (
                <p className="text-[#999] text-sm">Wow, did you read <em>all</em> of those articles? Looks like you'll need to <Link to="/" className="text-[#0a8935] hover:underline">generate another one</Link> if you want more.</p>
              ) : null}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e6e6e6] mt-12">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-6">
              <img src={logoSvg} alt="Crunch" className="h-5" />
              <div className="flex items-center gap-3">
                <a href="https://twitter.com/kkoppenhaver" target="_blank" rel="noopener noreferrer" className="text-[#666] hover:text-[#0a8935]" aria-label="Follow on X"><XIcon size={16} /></a>
                <a href="https://linkedin.com/in/keanankoppenhaver" target="_blank" rel="noopener noreferrer" className="text-[#666] hover:text-[#0a8935]" aria-label="Follow on LinkedIn"><LinkedInIcon size={16} /></a>
              </div>
            </div>
            <div className="text-[12px] text-[#999]">
              Built by{' '}
              <a href="https://floorboardai.com" target="_blank" rel="noopener noreferrer" className="text-[#0a8935] hover:underline">FloorboardAI</a>
              {' '}— We help agencies amplify their impact with AI
            </div>
          </div>
        </div>
      </footer>

      {/* About Drawer */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setIsDrawerOpen(false)} />
        <div className={`absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-xl transform transition-transform duration-300 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between p-4 border-b border-[#e6e6e6]">
            <img src={logoSvg} alt="Crunch" className="h-5" />
            <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-gray-100 rounded cursor-pointer" aria-label="Close menu">
              <X size={20} className="text-[#1a1a1a]" />
            </button>
          </div>
          <div className="p-6">
            <h2 className="text-xl font-bold text-[#1a1a1a] mb-4">About Crunch.fyi</h2>
            <div className="space-y-4 text-[15px] text-[#666] leading-relaxed">
              <p>Crunch.fyi is a parody news generator that transforms GitHub repositories into TechCrunch-style articles.</p>
              <p>What started as just an random idea, turned into a winter break project where I (<a href="https://x.com/kkoppenhaver" target="_blank" rel="noopener noreferrer" className="text-[#0a8935] hover:underline">hi there</a>) use the Claude Agent SDK to scan a GitHub repo, figure out what's interesting about it, and satirize the tech news media in a generated article.</p>
              <p>If you want to learn more about the behind the scenes and how I built crunch.fyi, I'll have a blog post up soon that goes into all the technical details.</p>
              <p>In the mean time, if you need help bringing AI into your company or building AI tools just like this one, feel free to reach out to me at <a href="mailto:keanan@floorboardai.com" className="text-[#0a8935] hover:underline">keanan@floorboardai.com</a>.</p>
            </div>
            <div className="mt-8 pt-6 border-t border-[#e6e6e6]">
              <p className="text-[13px] text-[#999]">
                Built by{' '}
                <a href="https://floorboardai.com" target="_blank" rel="noopener noreferrer" className="text-[#0a8935] hover:underline">FloorboardAI</a>
                {' '}&mdash; We help agencies amplify their impact with AI
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Overlay */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center pt-20 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSearchOpen(false);
              setSearchQuery('');
            }
          }}
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="relative border-b border-gray-200">
              <Search size={24} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full py-4 pl-14 pr-4 bg-transparent text-xl text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {searchQuery.trim() === '' ? (
                <p className="text-gray-400 text-center py-8">Start typing to search...</p>
              ) : isSearching ? (
                <p className="text-gray-400 text-center py-8">Searching...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No articles found</p>
              ) : (
                <div>
                  {searchResults.map((a) => (
                    <Link
                      key={a.slug}
                      to={`/article/${a.slug}`}
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="block p-4 hover:bg-gray-50 transition-colors group border-b border-gray-100 last:border-b-0"
                    >
                      <h3 className="text-gray-900 font-medium group-hover:text-[#0a8935] transition-colors">
                        {a.headline}
                      </h3>
                      {a.category && (
                        <span className="text-gray-400 text-sm mt-1 inline-block">{a.category}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllArticlesPage;
