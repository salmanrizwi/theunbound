import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, ArrowRight, Loader2, Sparkles, Send } from 'lucide-react';
import { HomepageNewsletterConfig } from '../../types';

interface NewsletterSignupProps {
  config?: HomepageNewsletterConfig;
  onExploreClick?: () => void;
  className?: string;
}

export const NewsletterSignup: React.FC<NewsletterSignupProps> = ({
  config,
  onExploreClick,
  className = ''
}) => {
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Anti-bot honeypot
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'ALREADY_SUBSCRIBED' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Content fallbacks
  const eyebrow = config?.eyebrow || 'STAY INSPIRED';
  const heading = config?.heading || 'Get Japan Travel Inspiration in Your Inbox';
  const description = config?.description || 'Receive destination inspiration, travel ideas, curated experiences, and updates from TheUnbound.';
  const placeholder = config?.emailPlaceholder || 'Enter your email address';
  const buttonText = config?.buttonText || 'Subscribe';
  const privacyText = config?.privacyText || 'By subscribing, you agree to receive newsletter emails. You can unsubscribe at any time.';
  const successHeading = config?.successHeading || "You're subscribed!";
  const successDescription = config?.successDescription || "You'll receive our latest travel inspiration and updates in your inbox.";
  const alreadySubscribedMessage = config?.alreadySubscribedMessage || "You're already subscribed to our newsletter.";
  const defaultErrorMessage = config?.errorMessage || "We couldn't complete your subscription right now. Please try again.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim().toLowerCase();

    // Client validation
    if (!trimmedEmail) {
      setStatus('ERROR');
      setErrorMessage('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setStatus('ERROR');
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setStatus('IDLE');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: trimmedEmail,
          listId: config?.sendyListId,
          honeypot: honeypot.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.status === 'ALREADY_SUBSCRIBED') {
          setStatus('ALREADY_SUBSCRIBED');
        } else {
          setStatus('SUCCESS');
        }
      } else {
        setStatus('ERROR');
        setErrorMessage(data.message || defaultErrorMessage);
      }
    } catch (err) {
      console.warn('[NEWSLETTER] Subscription request issue:', err);
      // Friendly error without leaking tech stack
      setStatus('ERROR');
      setErrorMessage(defaultErrorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section 
      id="homepage-newsletter" 
      aria-label="Newsletter Subscription"
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 via-teal-50/40 to-slate-50 border border-slate-200/80 p-8 sm:p-12 lg:p-14 shadow-sm ${className}`}
    >
      {/* Decorative ambient background accents */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[#00C6A6]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 rounded-full bg-teal-600/5 blur-3xl pointer-events-none" />

      <div className="relative max-w-3xl mx-auto text-center space-y-6">
        {/* Eyebrow badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white border border-teal-200/80 shadow-2xs text-[#008972] text-[11px] font-bold tracking-widest uppercase">
          <Sparkles className="w-3.5 h-3.5 text-[#00C6A6]" />
          <span>{eyebrow}</span>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-3">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            {heading}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Subscription Form / Result States */}
        {status === 'SUCCESS' ? (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-emerald-200 shadow-sm max-w-lg mx-auto space-y-3 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">{successHeading}</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {successDescription}
            </p>
            {onExploreClick && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onExploreClick}
                  className="inline-flex items-center space-x-2 text-xs font-bold text-[#008972] hover:text-slate-900 transition-colors"
                >
                  <span>Explore Destination Gateways</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : status === 'ALREADY_SUBSCRIBED' ? (
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-teal-200 shadow-sm max-w-lg mx-auto space-y-3 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 mx-auto flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Already Subscribed</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {alreadySubscribedMessage}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => { setStatus('IDLE'); setEmail(''); }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline transition-colors"
              >
                Subscribe with a different email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-3" noValidate>
            {/* Honeypot field (hidden from genuine users) */}
            <div className="hidden" aria-hidden="true">
              <input
                type="text"
                name="website_verify"
                tabIndex={-1}
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 bg-white p-2 sm:p-2.5 rounded-2xl sm:rounded-full border border-slate-200/90 shadow-sm focus-within:ring-2 focus-within:ring-[#00C6A6]/40 focus-within:border-[#00C6A6] transition-all">
              <div className="relative flex-1 flex items-center pl-3 sm:pl-4">
                <Mail className="w-4 h-4 text-slate-400 shrink-0 pointer-events-none" />
                <label htmlFor="newsletter-email-input" className="sr-only">
                  Email address
                </label>
                <input
                  id="newsletter-email-input"
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (status === 'ERROR') setStatus('IDLE');
                  }}
                  placeholder={placeholder}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="w-full text-xs sm:text-sm px-3 py-2 sm:py-2 text-slate-900 placeholder-slate-400 bg-transparent border-none focus:outline-none disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 rounded-xl sm:rounded-full bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center space-x-2 shrink-0 shadow-sm hover:shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Subscribing...</span>
                  </>
                ) : (
                  <>
                    <span>{buttonText}</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {status === 'ERROR' && errorMessage && (
              <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-2.5 max-w-md mx-auto">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Privacy and consent disclaimer */}
            <p className="text-[11px] text-slate-400 leading-normal max-w-md mx-auto pt-1">
              {privacyText}
            </p>
          </form>
        )}
      </div>
    </section>
  );
};
