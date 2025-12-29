import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, Menu, Link2, ChevronRight, RefreshCw, X } from 'lucide-react';
import logoSvg from '../assets/logo.svg';

// Social icons as SVGs
const FacebookIcon = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

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

const RedditIcon = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
  </svg>
);

const EmailIcon = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const GitHubIcon = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const ArticlePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [sourceUrl, setSourceUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentArticles, setRecentArticles] = useState([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = React.useRef(null);

  // Debounced search effect
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

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const res = await fetch(`/api/article/${slug}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Article not found');
          } else {
            setError('Failed to load article');
          }
          return;
        }
        const data = await res.json();
        setArticle(data.article);
        setSourceUrl(data.sourceUrl);
      } catch (err) {
        setError('Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [slug]);

  const handleRegenerate = async () => {
    if (!sourceUrl || isRegenerating) return;

    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/article/${slug}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Navigate to homepage with the repo URL pre-filled
        navigate('/', { state: { repoUrl: sourceUrl } });
      } else {
        console.error('Failed to delete article');
        setIsRegenerating(false);
      }
    } catch (err) {
      console.error('Failed to delete article:', err);
      setIsRegenerating(false);
    }
  };

  useEffect(() => {
    fetch('/api/article')
      .then((res) => res.json())
      .then((data) => {
        if (data.articles) {
          // Filter out the current article from the list
          const filtered = data.articles.filter((a) => a.slug !== slug);
          setRecentArticles(filtered);
        }
      })
      .catch(() => {
        // Silently fail - we'll just show no articles
      });
  }, [slug]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#0a8935] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading article...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !article) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {error || 'Article not found'}
          </h1>
          <p className="text-slate-600 mb-4">The article you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-[#0a8935] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#087a2f] transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }


  const SocialShareButton = ({ children, label, variant = "dark", onClick }) => (
    <button
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
        variant === "light"
          ? "text-white/70 hover:text-white"
          : "border border-[#dadada] text-[#1a1a1a] hover:border-[#0a8935] hover:text-[#0a8935] bg-white"
      }`}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );

  // Get the current page URL and article info for sharing
  const shareUrl = window.location.href;
  const shareTitle = article.headline;

  const handleShare = {
    facebook: () => {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
        '_blank',
        'width=600,height=400'
      );
    },
    twitter: () => {
      window.open(
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
        '_blank',
        'width=600,height=400'
      );
    },
    linkedin: () => {
      window.open(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
        '_blank',
        'width=600,height=400'
      );
    },
    reddit: () => {
      window.open(
        `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`,
        '_blank',
        'width=600,height=400'
      );
    },
    email: () => {
      window.location.href = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`Check out this article: ${shareUrl}`)}`;
    },
    copyLink: async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      } catch (err) {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Link copied to clipboard!');
      }
    },
  };

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Header */}
      <header className="border-b border-[#e6e6e6] sticky top-0 bg-white z-50">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
          <div className="h-[56px] flex items-center justify-between">
            {/* Logo */}
            <a href="#" className="flex items-center" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
              <img src={logoSvg} alt="Crunch" className="h-6" />
            </a>

            {/* Right side controls */}
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

      {/* Hero Section - Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Left: Image */}
        <div className="relative">
          <img
            src={article.image}
            alt="Article hero"
            className="w-full h-[300px] sm:h-[400px] lg:h-[600px] object-cover"
          />
        </div>

        {/* Right: Green Panel with Content */}
        <div className="bg-[#0a8935] p-6 lg:p-12 flex flex-col justify-center min-h-[300px] lg:min-h-[600px]">
          {/* Category + Share Row */}
          <div className="flex items-center justify-between mb-6">
            <a href="#" className="text-white font-bold text-[13px] tracking-wider uppercase border-t-2 border-white pt-2">
              {article.category}
            </a>
            <div className="flex items-center gap-1">
              <SocialShareButton label="Share on Facebook" variant="light" onClick={handleShare.facebook}><FacebookIcon size={16} /></SocialShareButton>
              <SocialShareButton label="Share on X" variant="light" onClick={handleShare.twitter}><XIcon size={16} /></SocialShareButton>
              <SocialShareButton label="Share on LinkedIn" variant="light" onClick={handleShare.linkedin}><LinkedInIcon size={16} /></SocialShareButton>
              <SocialShareButton label="Share on Reddit" variant="light" onClick={handleShare.reddit}><RedditIcon size={16} /></SocialShareButton>
              <SocialShareButton label="Share via Email" variant="light" onClick={handleShare.email}><EmailIcon size={16} /></SocialShareButton>
              <SocialShareButton label="Copy link" variant="light" onClick={handleShare.copyLink}><Link2 size={16} /></SocialShareButton>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-[28px] sm:text-[36px] lg:text-[44px] font-bold leading-[1.1] text-white mb-auto" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {article.headline}
          </h1>

          {/* Byline */}
          <div className="flex items-center gap-2 mt-8 text-[14px] text-white">
            <a href="#" className="font-medium hover:underline">
              {article.author.name}
            </a>
            <span className="text-white/60">—</span>
            <time className="text-white/80">{article.timestamp}</time>
          </div>
        </div>
      </div>

      {/* Image Credit - Below the hero */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
        <div className="lg:w-1/2 py-2">
          <span className="text-[11px] text-[#666] uppercase tracking-wide font-mono">
            IMAGE CREDITS: {article.imageCredit.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Article Content Area */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 py-8 lg:py-12">

          {/* Article Column */}
          <article className="lg:col-span-7">
            {/* Article Body */}
            <div className="text-[18px] lg:text-[20px] leading-[1.7] text-[#1a1a1a]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {article.content.map((paragraph, index) => (
                <p key={index} className="mb-6">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Topics/Tags */}
            <div className="mt-10 pt-6 border-t border-[#e6e6e6]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] text-[#1a1a1a] font-medium mr-1">Topics:</span>
                {article.tags.map((tag) => (
                  <a
                    key={tag}
                    href="#"
                    className="text-[13px] text-[#0a8935] hover:underline"
                  >
                    {tag}
                  </a>
                ))}
              </div>
            </div>

            {/* Share buttons row */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-[#e6e6e6]">
              <div className="flex items-center gap-2">
                <SocialShareButton label="Share on Facebook" onClick={handleShare.facebook}><FacebookIcon size={14} /></SocialShareButton>
                <SocialShareButton label="Share on X" onClick={handleShare.twitter}><XIcon size={14} /></SocialShareButton>
                <SocialShareButton label="Share on LinkedIn" onClick={handleShare.linkedin}><LinkedInIcon size={14} /></SocialShareButton>
                <SocialShareButton label="Share on Reddit" onClick={handleShare.reddit}><RedditIcon size={14} /></SocialShareButton>
                <SocialShareButton label="Share via Email" onClick={handleShare.email}><EmailIcon size={14} /></SocialShareButton>
                <SocialShareButton label="Copy link" onClick={handleShare.copyLink}><Link2 size={14} /></SocialShareButton>
              </div>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-[#0a8935] border border-[#0a8935] rounded-lg hover:bg-[#0a8935] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                {isRegenerating ? 'Regenerating...' : 'Regenerate Article'}
              </button>
            </div>

            {/* Author Bio Card */}
            <div className="mt-10 p-6 bg-[#f5f5f5]">
              <div className="flex items-start gap-4">
                <img
                  src={article.author.avatar}
                  alt={article.author.name}
                  className="w-[72px] h-[72px] rounded-full bg-gray-200 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[18px] text-[#1a1a1a]">
                    {article.author.name}
                  </div>
                  <div className="text-[14px] text-[#666] mt-1">
                    {article.author.title}
                  </div>
                  <p className="text-[14px] text-[#666] leading-relaxed mt-3">
                    {article.author.bio}
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-[80px]">
              {/* GitHub Source */}
              {sourceUrl && (
                <div className="mb-8 pb-3 border-[#1a1a1a] flex items-center flex-wrap gap-1.5">
                  <span className="font-bold text-[20px] text-[#1a1a1a] leading-none">Learn more at</span>
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 group cursor-pointer"
                  >
                    <GitHubIcon size={20} className="text-[#1a1a1a]" />
                    <span className="font-bold text-[20px] text-[#1a1a1a] leading-none group-hover:text-[#0a8935] transition-colors">
                      {sourceUrl.replace('https://github.com/', '')}
                    </span>
                  </a>
                </div>
              )}

              {/* Most Popular Section */}
              {recentArticles.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 pb-3 border-b-2 border-[#1a1a1a] mb-5">
                    <h3 className="font-bold text-[16px] text-[#1a1a1a]">Other Recent Articles</h3>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#1a1a1a]">
                      <path d="M13 7l5 5-5 5M6 7l5 5-5 5"/>
                    </svg>
                  </div>

                  <ol className="space-y-5">
                    {recentArticles.slice(0, 7).map((recentArticle) => (
                      <li key={recentArticle.slug} className="group">
                        <Link to={`/article/${recentArticle.slug}`} className="block">
                          <h4 className="font-bold text-[15px] text-[#1a1a1a] leading-snug group-hover:text-[#0a8935] transition-colors">
                            {recentArticle.headline}
                          </h4>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

            </div>
          </aside>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#e6e6e6] mt-12">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Logo and Social */}
            <div className="flex items-center gap-6">
              <img src={logoSvg} alt="Crunch" className="h-5" />
              <div className="flex items-center gap-3">
                <button onClick={handleShare.twitter} className="text-[#666] hover:text-[#0a8935] cursor-pointer" aria-label="Share on X"><XIcon size={16} /></button>
                <button onClick={handleShare.linkedin} className="text-[#666] hover:text-[#0a8935] cursor-pointer" aria-label="Share on LinkedIn"><LinkedInIcon size={16} /></button>
                <button onClick={handleShare.facebook} className="text-[#666] hover:text-[#0a8935] cursor-pointer" aria-label="Share on Facebook"><FacebookIcon size={16} /></button>
              </div>
            </div>

            {/* Copyright and Attribution */}
            <div className="text-[12px] text-[#999] flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span>© 2025 Crunch. <span className="text-[#0a8935]">(This is a parody site)</span></span>
              <span className="hidden sm:inline text-[#ccc]">•</span>
              <span>
                Built by{' '}
                <a
                  href="https://floorboardai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0a8935] hover:underline"
                >
                  FloorboardAI
                </a>
                {' '}— We help agencies amplify their impact with AI
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* About Drawer */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setIsDrawerOpen(false)}
        />

        {/* Drawer Panel */}
        <div
          className={`absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-xl transform transition-transform duration-300 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#e6e6e6]">
            <img src={logoSvg} alt="Crunch" className="h-5" />
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-2 hover:bg-gray-100 rounded cursor-pointer"
              aria-label="Close menu"
            >
              <X size={20} className="text-[#1a1a1a]" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="p-6">
            <h2 className="text-xl font-bold text-[#1a1a1a] mb-4">About Crunch.fyi</h2>
            <div className="space-y-4 text-[15px] text-[#666] leading-relaxed">
              <p>
                Crunch.fyi is a parody news generator that transforms GitHub repositories into TechCrunch-style articles.
              </p>
              <p>
                What started as just an random idea, turned into a winter break project where I (<a href="https://x.com/kkoppenhaver" target="_blank" rel="noopener noreferrer" className="text-[#0a8935] hover:underline">hi there</a>) use the Claude Agent SDK to scan a GitHub repo, figure out what's interesting about it, and satirize the tech news media in a generated article.
              </p>
              <p>
                If you want to learn more about the behind the scenes and how I built crunch.fyi, I'll have a blog post up soon that goes into all the technical details.
              </p>
              <p>
                In the mean time, if you need help bringing AI into your company or building AI tools just like this one, feel free to reach out to me at <a href="mailto:keanan@floorboardai.com" className="text-[#0a8935] hover:underline">keanan@floorboardai.com</a>.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-[#e6e6e6]">
              <p className="text-[13px] text-[#999]">
                Built by{' '}
                <a
                  href="https://floorboardai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0a8935] hover:underline"
                >
                  FloorboardAI
                </a>
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
          {/* Close button */}
          <button
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
            }}
            className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors cursor-pointer"
            aria-label="Close search"
          >
            <X size={24} />
          </button>

          {/* Search container */}
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Search input */}
            <div className="relative border-b border-gray-200">
              <Search size={24} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full py-4 pl-14 pr-4 bg-transparent text-xl text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>

            {/* Search results */}
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
                        <span className="text-gray-400 text-sm mt-1 inline-block">
                          {a.category}
                        </span>
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

export default ArticlePage;
