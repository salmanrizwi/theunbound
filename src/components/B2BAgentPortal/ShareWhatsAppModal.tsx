import React, { useState, useMemo } from 'react';
import {
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Phone,
  User as UserIcon,
  MapPin,
  Calendar,
  Layers,
  X
} from 'lucide-react';
import { Quotation, User, TravelLead } from '../../types';
import { AppDatabase } from '../../services/db';
import {
  generateWhatsAppQuoteMessage,
  generateWhatsAppShareUrl,
  validateInternationalPhone,
  recordWhatsAppQuoteShare,
  WhatsAppSenderBranding
} from '../../services/quoteWhatsAppService';
import { formatCurrency } from '../../services/pricingEngine';

interface ShareWhatsAppModalProps {
  quote: Quotation;
  user: User | null;
  selectedOptionIndex?: number;
  onClose: () => void;
  onSuccess?: (updatedQuote: Quotation, linkedLead?: TravelLead) => void;
}

export const ShareWhatsAppModal: React.FC<ShareWhatsAppModalProps> = ({
  quote,
  user,
  selectedOptionIndex = 0,
  onClose,
  onSuccess
}) => {
  const db = AppDatabase.getInstance();

  // Initial phone detection from quote or linked lead
  const initialPhone = useMemo(() => {
    if (quote.clientPhone) return quote.clientPhone;
    if (quote.leadId) {
      const lead = db.getLeadById(quote.leadId);
      if (lead?.phone) return lead.phone;
    }
    return '';
  }, [quote, db]);

  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhone);
  const [saveToProfile, setSaveToProfile] = useState<boolean>(true);
  const [customNote, setCustomNote] = useState<string>('');
  const [includeEmojis, setIncludeEmojis] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [shareSuccessNotice, setShareSuccessNotice] = useState<string | null>(null);

  // Sender branding determination
  const senderBranding: WhatsAppSenderBranding = useMemo(() => ({
    name: user?.name || quote.agentName,
    agency: user?.agencyName || user?.companyName || quote.agentAgency || 'TheUnbound Luxury DMC',
    phone: user?.phone || quote.agentPhone,
    email: user?.email || quote.agentEmail
  }), [user, quote]);

  // Selected Option Information
  const currentOption = useMemo(() => {
    if (quote.options && quote.options.length > 0) {
      return quote.options[selectedOptionIndex] || quote.options[0];
    }
    return undefined;
  }, [quote, selectedOptionIndex]);

  // Dynamically generated message
  const generatedMessage = useMemo(() => {
    return generateWhatsAppQuoteMessage({
      quote,
      selectedOptionIndexOrId: selectedOptionIndex,
      senderBranding,
      customNote,
      useEmojis: includeEmojis
    });
  }, [quote, selectedOptionIndex, senderBranding, customNote, includeEmojis]);

  // Real-time phone validation
  const phoneValidation = useMemo(() => {
    return validateInternationalPhone(phoneNumber);
  }, [phoneNumber]);

  // Handle Copying message to clipboard
  const handleCopyMessage = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(generatedMessage);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = generatedMessage;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);

      // Audit log the copy action
      db.logAudit(
        user,
        'QUOTE_SENT',
        'Quotation',
        quote.id,
        `WHATSAPP_QUOTE_SHARE_INITIATED: Copied WhatsApp proposal message to clipboard for quote ${quote.quoteNumber}`
      );
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Handle WhatsApp Link Dispatch
  const handleLaunchWhatsApp = () => {
    if (!phoneValidation.isValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Audit and record activity in Quotation + Lead Management
      const shareResult = recordWhatsAppQuoteShare(db, quote, {
        quote,
        recipientPhone: phoneValidation.normalized,
        user,
        selectedOptionTitle: currentOption?.optionTitle,
        savePhoneToCustomerProfile: saveToProfile
      });

      // 2. Generate WhatsApp Web / App deep link
      const waUrl = generateWhatsAppShareUrl(phoneValidation.normalized, generatedMessage);

      // 3. Open WhatsApp in new tab / application
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      setShareSuccessNotice(`WhatsApp chat launched with +${phoneValidation.normalized}. Activity recorded in Quotation history and Lead timeline.`);

      if (onSuccess) {
        onSuccess(shareResult.updatedQuote, shareResult.lead);
      }

      // Close modal after brief feedback
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (error) {
      console.error('Failed to record WhatsApp quote share:', error);
      setIsSubmitting(false);
    }
  };

  const finalSellingPrice = currentOption?.totalSellingPrice !== undefined
    ? currentOption.totalSellingPrice
    : (quote.totalSellingPrice || 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <MessageCircle className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold tracking-tight">Share Quote on WhatsApp</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Customer Presentation
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">
                Direct WhatsApp transmission with strictly customer-safe pricing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 space-y-5 overflow-y-auto grow">

          {/* SUCCESS NOTIFICATION */}
          {shareSuccessNotice && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start space-x-2.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Quotation Share Initiated!</span>
                <span>{shareSuccessNotice}</span>
              </div>
            </div>
          )}

          {/* QUOTE SUMMARY CARD */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                <span className="font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700">
                  {quote.quoteNumber || quote.id}
                </span>
                <span className="text-slate-400">•</span>
                <span className="flex items-center space-x-1 text-slate-600">
                  <UserIcon className="w-3 h-3 text-slate-400" />
                  <span>{quote.clientName || 'Client Name Pending'}</span>
                </span>
              </div>

              {currentOption && (
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200 flex items-center space-x-1">
                  <Layers className="w-3 h-3 text-purple-600" />
                  <span>{currentOption.optionTitle}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center space-x-1.5 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{quote.destination}</span>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">{quote.travelStartDate || 'Flexible'}</span>
              </div>
              <div className="sm:text-right">
                <span className="text-[10px] text-slate-400 block font-medium">Selling Price:</span>
                <span className="text-sm font-extrabold font-mono text-emerald-700">
                  {formatCurrency(finalSellingPrice, quote.currency || 'USD')}
                </span>
              </div>
            </div>
          </div>

          {/* CUSTOMER PHONE INPUT SECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="customer-whatsapp-input" className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Customer WhatsApp Number</span>
                <span className="text-red-500">*</span>
              </label>
              {phoneValidation.isValid && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>+{phoneValidation.normalized}</span>
                </span>
              )}
            </div>

            <div className="relative">
              <input
                id="customer-whatsapp-input"
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="e.g. +91 98116 54959 or 14155552671"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all focus:outline-none focus:ring-2 ${
                  phoneNumber && !phoneValidation.isValid
                    ? 'border-amber-400 bg-amber-50/40 text-amber-900 focus:ring-amber-200'
                    : 'border-slate-300 bg-white text-slate-900 focus:ring-emerald-200 focus:border-emerald-500'
                }`}
              />
            </div>

            {/* Validation Notice */}
            {phoneNumber && !phoneValidation.isValid ? (
              <p className="text-[11px] text-amber-600 flex items-center space-x-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{phoneValidation.error}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                Include country code without special characters. Example: <code>919811654959</code> for India or <code>14155552671</code> for US.
              </p>
            )}

            {/* Save to customer profile checkbox */}
            <label className="flex items-center space-x-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveToProfile}
                onChange={e => setSaveToProfile(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span className="text-xs text-slate-600">
                Save / update this WhatsApp number in customer profile & Lead record
              </span>
            </label>
          </div>

          {/* OPTIONAL CONSULTANT NOTE */}
          <div className="space-y-1.5">
            <label htmlFor="whatsapp-custom-note" className="text-xs font-semibold text-slate-700">
              Personalized Note / Add-on Note <span className="text-slate-400 text-[11px] font-normal">(Optional)</span>
            </label>
            <input
              id="whatsapp-custom-note"
              type="text"
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              placeholder="e.g. Rate guaranteed until Friday. Complimentary room upgrade confirmed."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* LIVE MESSAGE PREVIEW */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  WhatsApp Message Preview
                </span>
                <button
                  type="button"
                  onClick={() => setIncludeEmojis(!includeEmojis)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                    includeEmojis
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                  title="Toggle emojis in WhatsApp proposal"
                >
                  {includeEmojis ? '✨ Emojis: ON' : 'Emojis: OFF (Plain)'}
                </button>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {generatedMessage.length} characters
              </span>
            </div>

            <div
              className="relative rounded-2xl bg-slate-900 text-slate-100 p-4 text-xs max-h-56 overflow-y-auto border border-slate-800 shadow-inner leading-relaxed whitespace-pre-wrap select-text"
              style={{
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
              }}
            >
              {generatedMessage}
            </div>

            {/* COMMERCIAL SAFETY BADGE */}
            <div className="flex items-center space-x-2 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3 py-2 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Zero Commercial Disclosures:</strong> Internal nett wholesale rates, markups, margins, and supplier codes are strictly omitted.
              </span>
            </div>
          </div>

        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyMessage}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              title="Copy message to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-extrabold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Message</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-bold hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!phoneValidation.isValid || isSubmitting}
              onClick={handleLaunchWhatsApp}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black transition-all flex items-center space-x-2 shadow-md shadow-emerald-700/20 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-white" />
              <span>Continue to WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
