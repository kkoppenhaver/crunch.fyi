import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, Menu, Link2, ChevronRight } from 'lucide-react';

// Social icons as SVGs to match TechCrunch
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

const ArticlePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentArticles, setRecentArticles] = useState([]);

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
      } catch (err) {
        setError('Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [slug]);

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

  const navCategories = ["Latest", "Startups", "Venture", "Apple", "Security", "AI", "Apps"];
  const secondaryNav = ["Events", "Podcasts", "Newsletters"];

  const SocialShareButton = ({ children, label, variant = "dark", onClick }) => (
    <button
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
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
            <a href="#" className="flex items-center gap-2" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
              <div className="w-7 h-7 bg-[#0a8935] flex items-center justify-center">
                <span className="text-white font-bold text-[11px]">TC</span>
              </div>
              <span className="text-[#1a1a1a] font-bold text-[18px] tracking-tight">
                TechCrunch
              </span>
            </a>

            {/* Center Navigation */}
            <nav className="hidden lg:flex items-center">
              {navCategories.map((cat) => (
                <a
                  key={cat}
                  href="#"
                  className={`px-3 py-2 text-[14px] font-medium hover:text-[#0a8935] transition-colors ${cat === article.category ? 'text-[#0a8935]' : 'text-[#1a1a1a]'}`}
                >
                  {cat}
                </a>
              ))}
              <span className="mx-2 text-[#e6e6e6]">|</span>
              {secondaryNav.map((item) => (
                <a
                  key={item}
                  href="#"
                  className="px-3 py-2 text-[14px] font-medium text-[#1a1a1a] hover:text-[#0a8935] transition-colors"
                >
                  {item}
                </a>
              ))}
            </nav>

            {/* Right side controls */}
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-100 rounded" aria-label="Search">
                <Search size={20} className="text-[#1a1a1a]" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded" aria-label="Menu">
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
            <div className="flex items-center gap-2 mt-6 pt-6 border-t border-[#e6e6e6]">
              <SocialShareButton label="Share on Facebook" onClick={handleShare.facebook}><FacebookIcon size={14} /></SocialShareButton>
              <SocialShareButton label="Share on X" onClick={handleShare.twitter}><XIcon size={14} /></SocialShareButton>
              <SocialShareButton label="Share on LinkedIn" onClick={handleShare.linkedin}><LinkedInIcon size={14} /></SocialShareButton>
              <SocialShareButton label="Share on Reddit" onClick={handleShare.reddit}><RedditIcon size={14} /></SocialShareButton>
              <SocialShareButton label="Share via Email" onClick={handleShare.email}><EmailIcon size={14} /></SocialShareButton>
              <SocialShareButton label="Copy link" onClick={handleShare.copyLink}><Link2 size={14} /></SocialShareButton>
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
                  <div className="flex items-center gap-2 mt-1 text-[14px] text-[#666]">
                    <span>{article.author.title}</span>
                    <span className="text-[#ccc]">|</span>
                    <a href="#" className="text-[#0a8935] hover:underline">@{article.author.twitter}</a>
                  </div>
                  <p className="text-[14px] text-[#666] leading-relaxed mt-3">
                    {article.author.bio}
                  </p>
                  <a href="#" className="inline-flex items-center gap-1 text-[14px] font-medium text-[#0a8935] hover:underline mt-3">
                    View Bio <ChevronRight size={14} />
                  </a>
                </div>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-[80px]">
              {/* Most Popular Section */}
              {recentArticles.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 pb-3 border-b-2 border-[#1a1a1a] mb-5">
                    <h3 className="font-bold text-[16px] text-[#1a1a1a]">Most Popular</h3>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#1a1a1a]">
                      <path d="M13 7l5 5-5 5M6 7l5 5-5 5"/>
                    </svg>
                  </div>

                  <ol className="space-y-5">
                    {recentArticles.slice(0, 7).map((recentArticle) => (
                      <li key={recentArticle.slug} className="group">
                        <Link to={`/article/${recentArticle.slug}`} className="block">
                          <h4 className="font-bold text-[15px] text-[#1a1a1a] leading-snug group-hover:text-[#0a8935] transition-colors">
                            {recentArticle.headline.split(':')[0]}
                          </h4>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Event Promo Card */}
              <div className="p-6 bg-[#1a1a1a] text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#0a8935] rounded flex items-center justify-center">
                    <span className="text-white font-bold text-[10px]">SVC</span>
                  </div>
                  <span className="text-[#0a8935] font-bold text-[14px]">StrictlyVC</span>
                </div>
                <div className="text-[12px] text-gray-400 mb-1">
                  <div className="flex gap-8">
                    <div>
                      <span className="text-gray-500">Dates</span>
                      <div className="text-white">TBD</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Locations</span>
                      <div className="text-white">TBA</div>
                    </div>
                  </div>
                </div>
                <p className="text-[13px] text-gray-400 leading-relaxed my-4">
                  Plan ahead for the 2026 StrictlyVC events. Hear straight-from-the-source candid insights in on-stage fireside sessions.
                </p>
                <a href="#" className="inline-flex items-center gap-2 text-[13px] font-bold text-white hover:text-[#0a8935] transition-colors">
                  Waitlist Now
                  <ChevronRight size={14} />
                </a>
              </div>
            </div>
          </aside>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#e6e6e6] mt-12">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Logo and Social */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#0a8935] flex items-center justify-center">
                  <span className="text-white font-bold text-[9px]">TC</span>
                </div>
                <span className="text-[#1a1a1a] font-bold text-[16px]">TechCrunch</span>
              </div>
              <div className="flex items-center gap-3">
                <a href="#" className="text-[#666] hover:text-[#0a8935]"><XIcon size={16} /></a>
                <a href="#" className="text-[#666] hover:text-[#0a8935]"><LinkedInIcon size={16} /></a>
                <a href="#" className="text-[#666] hover:text-[#0a8935]"><FacebookIcon size={16} /></a>
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-4 text-[13px]">
              <a href="#" className="text-[#666] hover:text-[#0a8935]">TechCrunch</a>
              <a href="#" className="text-[#666] hover:text-[#0a8935]">Staff</a>
              <a href="#" className="text-[#666] hover:text-[#0a8935]">Contact Us</a>
              <a href="#" className="text-[#666] hover:text-[#0a8935]">Advertise</a>
              <a href="#" className="text-[#666] hover:text-[#0a8935]">Terms of Service</a>
              <a href="#" className="text-[#666] hover:text-[#0a8935]">Privacy Policy</a>
            </div>
          </div>
          <div className="text-[12px] text-[#999] mt-6">
            © 2025 TechCrunch Media LLC. <span className="text-[#0a8935]">(This is a parody site)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ArticlePage;
