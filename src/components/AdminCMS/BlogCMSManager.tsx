import React, { useState, useEffect } from 'react';
import { BlogArticle, BlogStatus } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { 
  BookOpen, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Search, 
  Eye, 
  Sparkles, 
  Calendar, 
  User as UserIcon, 
  Tag, 
  FileText,
  Globe,
  Share2,
  Bookmark
} from 'lucide-react';

interface BlogCMSManagerProps {
  onViewArticle?: (article: BlogArticle) => void;
}

export const BlogCMSManager: React.FC<BlogCMSManagerProps> = ({ onViewArticle }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [blogs, setBlogs] = useState<BlogArticle[]>(() => db.getBlogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogArticle | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<BlogArticle>>({
    title: '',
    slug: '',
    author: user?.name || 'Marcus Vance',
    authorRole: 'Senior Ground Operations Director',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
    category: 'Destination Insight',
    tags: ['Japan', 'Luxury', 'Logistics'],
    summary: '',
    content: '',
    featuredImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
    status: 'PUBLISHED',
    isFeatured: false,
    publishDate: new Date().toISOString().split('T')[0],
    readTimeMinutes: 5,
    destinationSlug: 'japan',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: ''
  });

  const [tagInput, setTagInput] = useState('');

  const refresh = () => {
    setBlogs(db.getBlogs());
  };

  useEffect(() => {
    const unsub = db.subscribe(() => {
      refresh();
    });
    return () => unsub();
  }, [db]);

  const handleOpenCreate = () => {
    setEditingBlog(null);
    setFormData({
      title: '',
      slug: '',
      author: user?.name || 'Marcus Vance',
      authorRole: 'Senior Ground Operations Director',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
      category: 'Destination Insight',
      tags: ['B2B Guide', 'Luxury Travel'],
      summary: '',
      content: `## Executive Overview\n\nIntroduce the luxury destination, ground operational challenges, and private VIP access opportunities.\n\n### Key Highlights\n\n- **Luggage Forwarding**: Fast and seamless door-to-door transit.\n- **Private Access**: VIP temple and castle hours.\n\n| Item | Standard | TheUnbound VIP Standard |\n| :--- | :--- | :--- |\n| Vehicle | Standard Coach | Alphard Executive MPV |\n| Guide | Group Guide | Certified Blue Badge Historian |`,
      featuredImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
      status: 'PUBLISHED',
      isFeatured: false,
      publishDate: new Date().toISOString().split('T')[0],
      readTimeMinutes: 5,
      destinationSlug: 'japan',
      seoTitle: '',
      seoDescription: '',
      seoKeywords: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (blog: BlogArticle) => {
    setEditingBlog(blog);
    setFormData({ ...blog });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.slug) return;

    const blogToSave: BlogArticle = {
      id: editingBlog ? editingBlog.id : `blog-${Date.now()}`,
      title: formData.title || '',
      slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
      author: formData.author || 'TheUnbound Editorial Desk',
      authorRole: formData.authorRole || 'Ground Specialist',
      authorAvatar: formData.authorAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
      category: formData.category || 'Destination Insight',
      tags: formData.tags || [],
      summary: formData.summary || '',
      content: formData.content || '',
      featuredImage: formData.featuredImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1600&auto=format&fit=crop',
      status: (formData.status as BlogStatus) || 'PUBLISHED',
      isFeatured: formData.isFeatured ?? false,
      publishDate: formData.publishDate || new Date().toISOString().split('T')[0],
      readTimeMinutes: Number(formData.readTimeMinutes) || 5,
      destinationSlug: formData.destinationSlug || 'japan',
      seoTitle: formData.seoTitle || formData.title || '',
      seoDescription: formData.seoDescription || formData.summary || '',
      seoKeywords: formData.seoKeywords || '',
      views: editingBlog?.views || 0,
      createdAt: editingBlog?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveBlog(blogToSave, user);
    refresh();
    setIsModalOpen(false);
  };

  const handleDelete = (blogId: string) => {
    if (confirm('Are you sure you want to delete this editorial article?')) {
      db.deleteBlog(blogId, user);
      refresh();
    }
  };

  const handleToggleStatus = (blog: BlogArticle) => {
    const nextStatus = blog.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    db.saveBlog({ ...blog, status: nextStatus }, user);
    refresh();
  };

  const addTag = () => {
    if (tagInput.trim()) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      tags: (prev.tags || []).filter((_, i) => i !== idx)
    }));
  };

  const filtered = blogs.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = filterCategory === 'ALL' || b.category === filterCategory;
    const matchesStat = filterStatus === 'ALL' || b.status === filterStatus;
    return matchesSearch && matchesCat && matchesStat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Editorial Publications & Travel Insights</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Blog CMS & Article Hub ({blogs.length} Articles)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Publish destination guides, logistics masterclasses, SEO articles, and insider luxury recommendations.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Write New Article</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search articles by title, author, summary..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Categories</option>
            <option value="Destination Insight">Destination Insight</option>
            <option value="Bespoke Itineraries">Bespoke Itineraries</option>
            <option value="Rail & Transit">Rail & Transit</option>
            <option value="Luxury Hospitality">Luxury Hospitality</option>
            <option value="B2B Operations">B2B Operations</option>
          </select>
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Blog Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(blog => (
          <div 
            key={blog.id}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="relative h-44 overflow-hidden bg-slate-900 group">
                <img
                  src={blog.featuredImage}
                  alt={blog.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute top-3 right-3 flex items-center space-x-2">
                  {blog.isFeatured && (
                    <span className="bg-[#00C6A6] text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full shadow">
                      FEATURED
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleStatus(blog)}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors backdrop-blur-md ${
                      blog.status === 'PUBLISHED'
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-amber-500/90 text-white'
                    }`}
                  >
                    {blog.status === 'PUBLISHED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    <span>{blog.status}</span>
                  </button>
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0]">
                    {blog.category} • {blog.readTimeMinutes} min read
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                  {blog.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {blog.summary}
                </p>

                <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 text-xs">
                  <img
                    src={blog.authorAvatar}
                    alt={blog.author}
                    className="w-6 h-6 rounded-full object-cover border border-slate-200"
                  />
                  <div className="text-[11px] truncate">
                    <span className="font-semibold text-slate-800">{blog.author}</span>
                    <span className="text-slate-400"> • {blog.publishDate}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                {blog.views || 0} views
              </span>

              <div className="flex items-center space-x-2">
                {onViewArticle && (
                  <button
                    onClick={() => onViewArticle(blog)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="Preview Public Page"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleOpenEdit(blog)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="Edit Article"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(blog.id)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="Delete Article"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Editor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingBlog ? 'Edit Editorial Article' : 'Compose New Article'}
                </h3>
                <p className="text-xs text-slate-500">Full markdown formatting, SEO title, metadata, author bio, and read times.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700">Article Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title || ''}
                    onChange={e => {
                      const title = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        title,
                        slug: prev.slug ? prev.slug : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                      }));
                    }}
                    placeholder="e.g. The Connoisseur’s Guide to Luxury Ryokans"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">URL Slug *</label>
                  <input
                    type="text"
                    required
                    value={formData.slug || ''}
                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                    placeholder="e.g. japan-luxury-ryokan-guide"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Author Name</label>
                  <input
                    type="text"
                    value={formData.author || ''}
                    onChange={e => setFormData({ ...formData, author: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Author Role</label>
                  <input
                    type="text"
                    value={formData.authorRole || ''}
                    onChange={e => setFormData({ ...formData, authorRole: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Destination Insight">Destination Insight</option>
                    <option value="Bespoke Itineraries">Bespoke Itineraries</option>
                    <option value="Rail & Transit">Rail & Transit</option>
                    <option value="Luxury Hospitality">Luxury Hospitality</option>
                    <option value="B2B Operations">B2B Operations</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Read Time (Mins)</label>
                  <input
                    type="number"
                    value={formData.readTimeMinutes || 5}
                    onChange={e => setFormData({ ...formData, readTimeMinutes: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Featured Hero Image URL</label>
                <input
                  type="url"
                  value={formData.featuredImage || ''}
                  onChange={e => setFormData({ ...formData, featuredImage: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Executive Summary / Excerpt</label>
                <textarea
                  rows={2}
                  value={formData.summary || ''}
                  onChange={e => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Engaging 2-sentence summary for search engines and card preview..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Markdown Content Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Full Content (Markdown Supported)</label>
                  <span className="text-[11px] text-slate-400">Supports # Headings, tables, blockquotes, bullet points</span>
                </div>
                <textarea
                  rows={10}
                  value={formData.content || ''}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write your article in Markdown..."
                  className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl leading-relaxed focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              {/* SEO Meta Box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-xs">
                  <Globe className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>Search Engine Optimization (SEO) & OpenGraph</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600 font-medium">SEO Meta Title</label>
                    <input
                      type="text"
                      value={formData.seoTitle || ''}
                      onChange={e => setFormData({ ...formData, seoTitle: e.target.value })}
                      placeholder="Title tag for Google results..."
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600 font-medium">SEO Keywords (Comma Separated)</label>
                    <input
                      type="text"
                      value={formData.seoKeywords || ''}
                      onChange={e => setFormData({ ...formData, seoKeywords: e.target.value })}
                      placeholder="Japan DMC, luxury tours, Kyoto guide..."
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Publication Status & Toggles */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured ?? false}
                      onChange={e => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="w-4 h-4 text-[#00C6A6] rounded border-slate-300"
                    />
                    <span className="font-semibold text-slate-800">Pin as Featured Article</span>
                  </label>

                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as BlogStatus })}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  >
                    <option value="PUBLISHED">Published (Live)</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                  >
                    {editingBlog ? 'Update Article' : 'Publish Article'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
