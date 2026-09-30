import React, { useState } from 'react';
import { BlogArticle } from '../types';
import { AppDatabase } from '../services/db';
import { 
  BookOpen, 
  Search, 
  Calendar, 
  User as UserIcon, 
  Clock, 
  ArrowRight, 
  Share2, 
  Bookmark, 
  Sparkles, 
  ChevronRight,
  X,
  Check
} from 'lucide-react';

interface PublicBlogHubProps {
  onBackToExplore?: () => void;
  onNavigateDestination?: (destSlug: string) => void;
}

export const PublicBlogHub: React.FC<PublicBlogHubProps> = ({ onBackToExplore, onNavigateDestination }) => {
  const db = AppDatabase.getInstance();
  const [blogs] = useState<BlogArticle[]>(() => db.getBlogs().filter(b => b.status === 'PUBLISHED'));
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [readingArticle, setReadingArticle] = useState<BlogArticle | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const categories = ['ALL', 'Destination Insight', 'Bespoke Itineraries', 'Rail & Transit', 'Luxury Hospitality'];

  const filtered = blogs.filter(b => {
    const matchesCat = selectedCategory === 'ALL' || b.category === selectedCategory;
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch = !q ||
      (b.title || '').toLowerCase().includes(q) ||
      (b.summary || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.tags || []).some(t => (t || '').toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const featuredBlog = blogs.find(b => b.isFeatured) || blogs[0];

  const handleOpenArticle = (blog: BlogArticle) => {
    db.incrementBlogViews(blog.id);
    setReadingArticle(blog);
  };

  const handleShare = (blog: BlogArticle) => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div className="space-y-12">
      {/* Editorial Header */}
      <div className="bg-slate-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-[#00C6A6]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 bg-[#00C6A6]/20 border border-[#00C6A6]/40 text-[#00E5C0] font-bold text-xs uppercase tracking-wider px-3 py-1 rounded-full">
            <BookOpen className="w-3.5 h-3.5" />
            <span>TheUnbound Ground Gazette & Intelligence</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight font-serif">
            Insider Intelligence & Destination Guides
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light">
            Deep-dive operational masterclasses, luxury ryokan and castle buyouts, scenic alpine rail guides, and logistics wisdom curated by ground directors in Tokyo, London, and Zurich.
          </p>

          {/* Search bar */}
          <div className="pt-4 max-w-lg">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search articles, topics, private tours, destinations..."
                className="w-full pl-12 pr-4 py-3 bg-slate-900/90 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#00C6A6] transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Featured Hero Article */}
      {featuredBlog && !searchQuery && selectedCategory === 'ALL' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 group">
          <div className="lg:col-span-7 relative h-72 lg:h-auto overflow-hidden bg-slate-950">
            <img
              src={featuredBlog.featuredImage}
              alt={featuredBlog.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent lg:hidden" />
          </div>

          <div className="lg:col-span-5 p-8 lg:p-10 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <span className="bg-[#00C6A6] text-slate-950 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  Featured Masterclass
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {featuredBlog.readTimeMinutes} min read
                </span>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 leading-snug group-hover:text-[#008972] transition-colors font-serif">
                {featuredBlog.title}
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                {featuredBlog.summary}
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center space-x-3">
                <img
                  src={featuredBlog.authorAvatar}
                  alt={featuredBlog.author}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">{featuredBlog.author}</div>
                  <div className="text-[11px] text-slate-400">{featuredBlog.authorRole}</div>
                </div>
              </div>

              <button
                onClick={() => handleOpenArticle(featuredBlog)}
                className="w-full py-3 bg-slate-950 hover:bg-[#00C6A6] hover:text-slate-950 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
              >
                <span>Read Masterclass</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none pb-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat === 'ALL' ? 'All Editorial Articles' : cat}
          </button>
        ))}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map(blog => (
          <div
            key={blog.id}
            onClick={() => handleOpenArticle(blog)}
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between cursor-pointer group"
          >
            <div>
              <div className="relative h-52 overflow-hidden bg-slate-900">
                <img
                  src={blog.featuredImage}
                  alt={blog.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-slate-950/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/10">
                    {blog.category}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-3">
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{blog.publishDate}</span>
                  <span>•</span>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{blog.readTimeMinutes} min read</span>
                </div>

                <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-[#008972] transition-colors font-serif">
                  {blog.title}
                </h3>

                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                  {blog.summary}
                </p>
              </div>
            </div>

            <div className="p-6 pt-0 border-t border-slate-100 mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 pt-4">
                <img
                  src={blog.authorAvatar}
                  alt={blog.author}
                  className="w-7 h-7 rounded-full object-cover border border-slate-200"
                />
                <div className="text-[11px] font-semibold text-slate-800 truncate">
                  {blog.author}
                </div>
              </div>

              <span className="text-[#00C6A6] group-hover:translate-x-1 transition-transform pt-4 font-bold text-xs inline-flex items-center">
                Read <ChevronRight className="w-4 h-4 ml-0.5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">No articles matched your filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search terms or category selection to view all available ground insights.
          </p>
        </div>
      )}

      {/* Reading Article Modal */}
      {readingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setReadingArticle(null)}
              className="sticky top-4 float-right mr-4 z-20 w-9 h-9 rounded-full bg-slate-900/70 text-white hover:bg-slate-900 flex items-center justify-center cursor-pointer transition-colors backdrop-blur-sm shadow-md"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Hero */}
            <div className="relative h-64 sm:h-80 bg-slate-950">
              <img
                src={readingArticle.featuredImage}
                alt={readingArticle.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
                <span className="bg-[#00C6A6] text-slate-950 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-block">
                  {readingArticle.category}
                </span>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-serif leading-tight">
                  {readingArticle.title}
                </h1>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 sm:p-10 space-y-8">
              {/* Author and metadata */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100 text-xs">
                <div className="flex items-center space-x-3">
                  <img
                    src={readingArticle.authorAvatar}
                    alt={readingArticle.author}
                    className="w-11 h-11 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{readingArticle.author}</div>
                    <div className="text-slate-400">{readingArticle.authorRole}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-slate-500">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{readingArticle.publishDate}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{readingArticle.readTimeMinutes} min read</span>
                  </div>
                  <button
                    onClick={() => handleShare(readingArticle)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    title="Share Article Link"
                  >
                    {copiedShare ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4 text-slate-700" />}
                  </button>
                </div>
              </div>

              {/* Summary Callout */}
              <div className="p-4 bg-slate-50 border-l-4 border-[#00C6A6] rounded-r-2xl italic text-slate-700 text-sm leading-relaxed font-serif">
                "{readingArticle.summary}"
              </div>

              {/* Rendered Content */}
              <div className="prose prose-slate max-w-none text-slate-700 text-sm leading-relaxed space-y-4">
                {readingArticle.content.split('\n\n').map((block, idx) => {
                  if (block.startsWith('## ')) {
                    return <h2 key={idx} className="text-xl font-bold text-slate-900 font-serif pt-4">{block.replace('## ', '')}</h2>;
                  }
                  if (block.startsWith('### ')) {
                    return <h3 key={idx} className="text-base font-bold text-slate-900 pt-2">{block.replace('### ', '')}</h3>;
                  }
                  if (block.startsWith('> ')) {
                    return (
                      <blockquote key={idx} className="p-4 bg-slate-50 border-l-4 border-slate-900 rounded-r-2xl italic font-serif text-slate-800">
                        {block.replace('> ', '')}
                      </blockquote>
                    );
                  }
                  if (block.includes('|')) {
                    // Render simple table
                    const rows = block.trim().split('\n').filter(r => !r.includes(':---'));
                    return (
                      <div key={idx} className="overflow-x-auto my-4">
                        <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
                          <tbody>
                            {rows.map((r, ri) => (
                              <tr key={ri} className={ri === 0 ? 'bg-slate-100 font-bold' : 'border-t border-slate-100'}>
                                {r.split('|').filter(c => c.trim() !== '').map((cell, ci) => (
                                  <td key={ci} className="py-2.5 px-3">{cell.trim()}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }
                  return <p key={idx}>{block}</p>;
                })}
              </div>

              {/* Tags */}
              <div className="pt-6 border-t border-slate-100 flex flex-wrap gap-2">
                {readingArticle.tags.map((t, idx) => (
                  <span key={idx} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold">
                    #{t}
                  </span>
                ))}
              </div>

              {/* Footer CTA */}
              <div className="p-6 bg-slate-950 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-white">Planning a journey to this destination?</h4>
                  <p className="text-xs text-slate-400">Request a contracted wholesale quotation or explore curated itineraries.</p>
                </div>
                {onNavigateDestination && readingArticle.destinationSlug && (
                  <button
                    onClick={() => {
                      onNavigateDestination(readingArticle.destinationSlug!);
                      setReadingArticle(null);
                    }}
                    className="px-5 py-2.5 bg-[#00C6A6] text-slate-950 font-bold rounded-xl text-xs hover:bg-[#008972] transition-colors cursor-pointer shrink-0"
                  >
                    Explore Destination Tariffs
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
