import React, { useState, useRef } from 'react';
import { Upload, Link2, X, Image as ImageIcon, Check, Sparkles, Search, RefreshCw, Eye } from 'lucide-react';
import { sanitizeImageUrl, fileToDataUrl, convertUnsplashUrl, fetchUnsplashImagesByQuery } from '../utils/imageUtils';

interface ImageUploadOrUrlInputProps {
  label?: string;
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  helperText?: string;
  className?: string;
  required?: boolean;
  category?: 'customers' | 'hotels' | 'products' | 'all';
  defaultSearchTopic?: string;
}

export const ImageUploadOrUrlInput: React.FC<ImageUploadOrUrlInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'https://images.unsplash.com/... or paste any Unsplash URL',
  helperText,
  className = '',
  required = false,
  category = 'all',
  defaultSearchTopic = ''
}) => {
  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'FETCH' | 'URL'>('UPLOAD');
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(defaultSearchTopic || '');
  const [isFetchingUnsplash, setIsFetchingUnsplash] = useState(false);
  const [unsplashResults, setUnsplashResults] = useState(() => 
    fetchUnsplashImagesByQuery(defaultSearchTopic || '', category)
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image file is too large. Please select a photo under 10MB.');
      return;
    }

    try {
      setIsUploading(true);
      const dataUrl = await fileToDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      console.error('Error reading file:', err);
      alert('Failed to process image file. Please try a different photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlInput = (rawVal: string) => {
    // Automatically sanitize and convert any Unsplash page URL to CDN format
    const converted = convertUnsplashUrl(rawVal);
    onChange(converted);
  };

  const handleSearchUnsplash = () => {
    setIsFetchingUnsplash(true);
    setTimeout(() => {
      const results = fetchUnsplashImagesByQuery(searchQuery, category);
      setUnsplashResults(results);
      setIsFetchingUnsplash(false);
    }, 200);
  };

  const previewSrc = value ? sanitizeImageUrl(value) : '';

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Label and Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        {label && (
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1 uppercase tracking-wider">
            <span>{label}</span>
            {required && <span className="text-rose-500">*</span>}
          </label>
        )}
        <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-semibold text-slate-600 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('UPLOAD')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'UPLOAD' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Upload className="w-3 h-3 text-[#00C6A6]" />
            <span>Upload Photo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FETCH')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'FETCH' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3 h-3 text-[#008972]" />
            <span>Fetch Unsplash</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('URL')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'URL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Link2 className="w-3 h-3 text-slate-500" />
            <span>Direct URL</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Upload Photo */}
      {activeTab === 'UPLOAD' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-[#00C6A6] bg-slate-50 hover:bg-[#00C6A6]/5 rounded-2xl p-4 text-center cursor-pointer transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5 text-[#00C6A6]" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              {isUploading ? 'Compressing & Uploading Photo...' : 'Click to Upload Photo or Drag & Drop'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Supports JPEG, PNG, WEBP, HEIC up to 10MB. Stored directly in your DMC system.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Fetch Unsplash Photo */}
      {activeTab === 'FETCH' && (
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchUnsplash(); } }}
                placeholder="Search Unsplash (e.g. Kyoto Ryokan, Tokyo Tower, Happy Travelers)..."
                className="w-full pl-8.5 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#00C6A6]"
              />
            </div>
            <button
              type="button"
              onClick={handleSearchUnsplash}
              disabled={isFetchingUnsplash}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center space-x-1"
            >
              {isFetchingUnsplash ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-[#00C6A6]" />}
              <span>Search</span>
            </button>
          </div>

          {/* Quick topic tags */}
          <div className="flex flex-wrap gap-1.5">
            {['Japan Travel', 'Luxury Hotel Suite', 'Happy Vacation', 'Mount Fuji Onsen', 'Tokyo Night'].map((tag, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSearchQuery(tag);
                  const results = fetchUnsplashImagesByQuery(tag, category);
                  setUnsplashResults(results);
                }}
                className="text-[10px] bg-white border border-slate-200 hover:border-[#00C6A6] text-slate-600 px-2 py-0.5 rounded-lg cursor-pointer transition-colors"
              >
                + {tag}
              </button>
            ))}
          </div>

          {/* Unsplash Results Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pt-1">
            {unsplashResults.map((item, idx) => {
              const isSelected = value === item.url;
              return (
                <div
                  key={idx}
                  onClick={() => onChange(item.url)}
                  className={`group relative rounded-xl overflow-hidden aspect-4/3 cursor-pointer border transition-all ${
                    isSelected ? 'ring-2 ring-[#00C6A6] border-transparent scale-[1.02]' : 'border-slate-200 hover:border-[#00C6A6]'
                  }`}
                >
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-1.5">
                    <p className="text-[9px] text-white font-medium line-clamp-1">{item.title}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 bg-[#00C6A6] text-slate-950 p-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Direct URL */}
      {activeTab === 'URL' && (
        <div className="space-y-1.5">
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={e => handleUrlInput(e.target.value)}
              placeholder={placeholder}
              required={required}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#00C6A6] focus:ring-1 focus:ring-[#00C6A6]"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            Paste any Unsplash page URL (e.g. <code className="text-slate-600">unsplash.com/photos/...</code>) — it will automatically convert to a high-res image.
          </p>
        </div>
      )}

      {/* Live Image Preview Card */}
      {previewSrc && (
        <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-200 relative shadow-2xs">
            <img
              src={previewSrc}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = sanitizeImageUrl('');
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1 truncate">
              <Check className="w-3.5 h-3.5 text-[#008972] shrink-0" />
              <span>Photo Attached & Ready</span>
            </p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
              {value.startsWith('data:image/') ? 'Direct Uploaded Local Photo Asset' : value}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white text-xs font-medium cursor-pointer transition-colors"
            title="Remove Photo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {helperText && <p className="text-[11px] text-slate-400">{helperText}</p>}
    </div>
  );
};
