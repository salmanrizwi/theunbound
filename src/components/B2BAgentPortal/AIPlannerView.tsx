import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  RotateCcw, 
  ArrowRight, 
  CheckCircle2, 
  HelpCircle, 
  Calendar, 
  Users, 
  MapPin, 
  Building2, 
  Car, 
  Compass, 
  DollarSign, 
  ShieldCheck, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown, 
  Layers, 
  Clock, 
  SlidersHorizontal,
  BookmarkCheck,
  Check,
  Zap,
  Info,
  ExternalLink,
  Shield,
  FileCheck,
  X
} from 'lucide-react';
import { 
  AiPlannerResult, 
  AiPlannerOptionPlan, 
  AiPlannerStructuredRequirements, 
  CurrencyCode, 
  User, 
  TripRouteHub, 
  QuoteItem,
  AiPlannerRefinementItem
} from '../../types';
import { AiPlannerEngine } from '../../services/aiPlannerEngine';
import { AiPlannerTrackingService, generateAlphanumericLeadId } from '../../services/aiPlannerTracking';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency } from '../../services/pricingEngine';

interface AIPlannerViewProps {
  onOpenInQuoteBuilder: (plan: AiPlannerOptionPlan, requirements: AiPlannerStructuredRequirements) => void;
  onNavigateToTab?: (tab: string) => void;
  initialPrompt?: string;
}

const PRESET_PROMPTS = [
  {
    title: 'Japan Golden Route (8 Nights)',
    desc: 'Tokyo & Kyoto for 4 Adults in 5-Star Luxury with Private Transfers',
    prompt: 'Create an 8-night luxury itinerary in Japan for 4 adults starting in Tokyo and finishing in Kyoto. We need 5-star hotels, private airport transfers, scenic intercity transfer, and curated cultural experiences including temples, dining, and Mt Fuji.'
  },
  {
    title: 'Tokyo & Hakone Ryokan (6 Nights)',
    desc: 'Family of 3 (2 Adults, 1 Child 7yo) with Onsen Experience',
    prompt: 'Family of 3 (2 adults and 1 child aged 7) traveling to Japan for 6 nights. 4 nights in Tokyo and 2 nights in Hakone Ryokan with hot spring onsen and private transfers.'
  },
  {
    title: 'Cultural Explorer (7 Nights)',
    desc: 'Foodie & Heritage focused 4-star boutique stay for 2 Adults',
    prompt: '7 nights cultural and gastronomy itinerary for 2 adults visiting Tokyo and Kyoto. 4-star boutique accommodations, tea ceremony, private Tsukiji/Nishiki food walking tours and bullet train transfers.'
  }
];

export const AIPlannerView: React.FC<AIPlannerViewProps> = ({
  onOpenInQuoteBuilder,
  onNavigateToTab,
  initialPrompt = ''
}) => {
  const { user } = useAuth();
  const { currency } = useQuotation();

  const engine = AiPlannerEngine.getInstance();
  const tracking = AiPlannerTrackingService.getInstance();

  const [promptText, setPromptText] = useState(initialPrompt || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [currentResult, setCurrentResult] = useState<AiPlannerResult | null>(null);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [refinementText, setRefinementText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [savedLeadSuccess, setSavedLeadSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track page open telemetry
  useEffect(() => {
    tracking.logActivity('AI_PLANNER_OPENED', user);
  }, []);

  const handleGenerate = async (overridePrompt?: string) => {
    const textToUse = overridePrompt || promptText;
    if (!textToUse.trim()) return;

    setIsGenerating(true);
    setErrorMessage(null);
    setSavedLeadSuccess(null);

    try {
      setGenerationStep('Understanding client travel requirements...');
      tracking.logActivity('AI_REQUEST_SUBMITTED', user, { additional: { prompt: textToUse } });
      await new Promise(r => setTimeout(r, 450));

      const structuredReqs = engine.parseRequirements(textToUse);

      setGenerationStep('Querying verified TheUnbound inventory & hotel contracts...');
      await new Promise(r => setTimeout(r, 550));

      setGenerationStep('Building day-by-day itinerary sequence & route hubs...');
      await new Promise(r => setTimeout(r, 450));

      setGenerationStep('Executing authoritative Pricing Engine & feasibility checks...');
      await new Promise(r => setTimeout(r, 500));

      const result = await engine.generatePlan(structuredReqs, user, currency, textToUse);
      setCurrentResult(result);
      setActiveOptionIndex(0);

      tracking.logActivity('AI_PLAN_GENERATED', user, {
        destination: result.requirements.destination.value,
        pax: result.requirements.travelers.adults.value + result.requirements.travelers.children.value,
        nights: result.requirements.duration.nights.value,
        totalSellingPrice: result.options[0]?.totalSellingPrice,
        currency
      });
    } catch (err: any) {
      console.error('AI Planner generation error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while querying inventory. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleRefine = async (overridePrompt?: string, actionRefinement?: AiPlannerRefinementItem) => {
    const promptToRun = overridePrompt || refinementText;
    if ((!promptToRun.trim() && !actionRefinement) || !currentResult) return;

    setIsRefining(true);
    setErrorMessage(null);

    try {
      tracking.logActivity('AI_PLAN_REGENERATED', user, {
        additional: { refinement: promptToRun || actionRefinement?.label }
      });
      const updated = await engine.refinePlan(currentResult, promptToRun, user, activeOptionIndex, actionRefinement);
      setCurrentResult(updated);
      setRefinementText('');
    } catch (err: any) {
      console.error('AI Planner refinement error:', err);
      setErrorMessage('Failed to refine plan. Please try again.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleDismissSuggestion = (refinementId: string) => {
    if (!currentResult) return;
    const updated = engine.dismissRefinement(currentResult, refinementId, activeOptionIndex);
    setCurrentResult(updated);
  };

  const handleSaveLead = () => {
    if (!currentResult) return;
    const currentOption = currentResult.options[activeOptionIndex];
    if (!currentOption) return;

    const savedLead = tracking.createOrUpdateLeadFromAiPlan(
      currentOption,
      currentResult.requirements,
      user
    );

    setSavedLeadSuccess(`CRM Lead #${savedLead.leadNumber} successfully captured with ${currentOption.items.length} services!`);
    setTimeout(() => setSavedLeadSuccess(null), 5000);
  };

  const handleOpenInBuilder = () => {
    if (!currentResult) return;
    const currentOption = currentResult.options[activeOptionIndex];
    if (!currentOption) return;

    tracking.logActivity('AI_PLAN_OPENED_IN_QUOTE_BUILDER', user, {
      destination: currentOption.destinationName,
      pax: currentResult.requirements.travelers.adults.value,
      nights: currentResult.requirements.duration.nights.value,
      totalSellingPrice: currentOption.totalSellingPrice,
      currency
    });

    onOpenInQuoteBuilder(currentOption, currentResult.requirements);
  };

  const activeOption = currentResult?.options[activeOptionIndex];

  return (
    <div id="ai-planner-view-root" className="min-h-screen bg-slate-50/60 pb-24 text-slate-900">
      {/* Header Banner */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    AI Planner
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Intelligent B2B Travel Planning using live TheUnbound inventory, verified contracts & pricing engine.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Zero Hallucination Guaranteed</span>
              <span className="h-3 w-px bg-slate-300" />
              <span>Ver 2.4.0</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Requirement Input Area */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <label htmlFor="ai-planner-prompt-input" className="block text-base font-semibold text-slate-900">
            Tell us what your client needs
          </label>
          <p className="mt-1 text-sm text-slate-500">
            Describe destination, duration, travelers, hotels, pace, interests or special requests. The AI Planner will query TheUnbound database and assemble an authoritative, quotation-ready itinerary.
          </p>

          <div className="mt-4">
            <textarea
              id="ai-planner-prompt-input"
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g. Plan an 8-night luxury tour in Japan for 4 adults. Staying in Tokyo and Kyoto with 5-star hotels, private airport and intercity chauffeur transfers, tea ceremony, Mt Fuji tour, and top cultural landmarks..."
              className="w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Quick Presets */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Quick Presets:</span>
            {PRESET_PROMPTS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                id={`preset-prompt-btn-${idx}`}
                onClick={() => {
                  setPromptText(preset.prompt);
                  handleGenerate(preset.prompt);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <Zap className="h-3 w-3 text-amber-500" />
                <span>{preset.title}</span>
              </button>
            ))}
          </div>

          {/* Action Bar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="h-4 w-4 text-slate-400" />
              <span>Quotes automatically respect your B2B Agent markup and tier settings.</span>
            </div>
            <div className="flex items-center gap-3">
              {promptText && (
                <button
                  type="button"
                  onClick={() => setPromptText('')}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                id="btn-generate-ai-plan"
                disabled={isGenerating || !promptText.trim()}
                onClick={() => handleGenerate()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    <span>Planning Trip...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span>Generate Itinerary Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generation Progress Indicator */}
          {isGenerating && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <RotateCcw className="h-5 w-5 animate-spin text-slate-900" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{generationStep}</p>
                  <p className="text-xs text-slate-500">Retrieving real active contracts, rates and scheduling day slots...</p>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
              <p>{errorMessage}</p>
            </div>
          )}

          {savedLeadSuccess && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <p>{savedLeadSuccess}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {currentResult && activeOption && (
          <div className="mt-8 space-y-8">
            {/* Structured Requirement Status Pill Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Extracted Travel Specifications</h2>
                  <p className="text-xs text-slate-500">Verified parameters extracted from your agent prompt.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> Confirmed
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700 border border-blue-200">
                    <Info className="h-3 w-3" /> Inferred
                  </span>
                  {currentResult.missingSummary.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700 border border-amber-200">
                      <HelpCircle className="h-3 w-3" /> Missing
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Destination</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{currentResult.requirements.destination.value}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Route Hubs</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 truncate">
                    {currentResult.requirements.hubs.value.join(' → ')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Travel Dates</p>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {currentResult.requirements.travelDates?.startDate?.value 
                        ? `${new Date(currentResult.requirements.travelDates.startDate.value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` 
                        : 'Flexible'}
                      {currentResult.requirements.travelDates?.endDate?.value 
                        ? ` – ${new Date(currentResult.requirements.travelDates.endDate.value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` 
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Duration</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {currentResult.requirements.duration.nights.value}N / {currentResult.requirements.duration.days.value}D
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Travelers</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {currentResult.requirements.travelers.adults.value} Adults
                    {currentResult.requirements.travelers.children.value > 0 ? `, ${currentResult.requirements.travelers.children.value} Ch` : ''}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Hotels</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 truncate">
                    {currentResult.requirements.hotelPreference.category.value}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Ground Transport</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {currentResult.requirements.transportPreference.value}
                  </p>
                </div>
              </div>

              {/* Follow-up Questions if missing info */}
              {currentResult.followUpQuestions.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <HelpCircle className="h-4 w-4 text-amber-700" />
                    <span>Optional Refinement Details:</span>
                  </p>
                  <div className="mt-2 space-y-2">
                    {currentResult.followUpQuestions.map(q => (
                      <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <span className="text-amber-800 font-medium">{q.question}</span>
                        {q.options ? (
                          <div className="flex gap-1.5">
                            {q.options.map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleGenerate(`${promptText}. Note: ${q.field} is ${opt}`)}
                                className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-100"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-amber-700 italic">Default applied ({String(q.currentValue)})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3-Option Switcher Tabs */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {currentResult.options.map((opt, idx) => {
                const isSelected = activeOptionIndex === idx;
                return (
                  <button
                    key={opt.optionNumber}
                    type="button"
                    id={`option-card-btn-${idx}`}
                    onClick={() => setActiveOptionIndex(idx)}
                    className={`relative rounded-2xl border p-5 text-left transition ${
                      isSelected
                        ? 'border-slate-900 bg-white shadow-md ring-2 ring-slate-900'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        idx === 0 
                          ? 'bg-slate-900 text-white' 
                          : idx === 1 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {opt.badge}
                      </span>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-slate-900" />}
                    </div>
                    <h3 className="mt-3 text-base font-bold text-slate-900">{opt.title}</h3>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{opt.tagline}</p>
                    
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase">Delivered Selling Price</p>
                          <p className="text-lg font-extrabold text-slate-900">
                            {formatCurrency(opt.totalSellingPrice, opt.currency)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Per Person</p>
                          <p className="text-xs font-bold text-slate-700">
                            {formatCurrency(opt.perPersonSellingPrice, opt.currency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Option Detail Header & Actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                      Option {activeOption.optionNumber}: {activeOption.badge}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                      Feasibility Score: {activeOption.feasibility.score.toFixed(1)} / 10
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
                      {activeOption.hotelTier}
                    </span>
                  </div>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">{activeOption.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{activeOption.reasoning}</p>

                  {/* Route Sequence Pills */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Route Flow:</span>
                    {activeOption.routeHubs.map((hub, hIdx) => (
                      <React.Fragment key={hub.id || hIdx}>
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span>{hub.hubName} ({hub.nights}N)</span>
                        </span>
                        {hIdx < activeOption.routeHubs.length - 1 && (
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Applied Customizations Bar */}
                  {activeOption.appliedRefinements && activeOption.appliedRefinements.length > 0 && (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-900">Customized Refinements Applied:</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {activeOption.appliedRefinements.map((ref) => (
                          <span
                            key={ref.refinementId}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-xs"
                          >
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{ref.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Action Button Bar */}
                <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col lg:items-end">
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-500">Delivered Selling Price ({activeOption.currency})</p>
                    <p className="text-3xl font-black text-slate-900">
                      {formatCurrency(activeOption.totalSellingPrice, activeOption.currency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      approx. {formatCurrency(activeOption.perPersonSellingPrice, activeOption.currency)} / person
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-save-as-lead"
                      onClick={handleSaveLead}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <BookmarkCheck className="h-4 w-4 text-slate-500" />
                      <span>Save CRM Lead</span>
                    </button>
                    <button
                      type="button"
                      id="btn-open-in-quote-builder"
                      onClick={handleOpenInBuilder}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 active:scale-98"
                    >
                      <span>Open in Quote Builder</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Recommended Smart Refinements */}
              {activeOption.suggestedRefinements && activeOption.suggestedRefinements.length > 0 && (
                <div className="mt-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 via-slate-50 to-white p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Recommended Smart Refinements</h3>
                        <p className="text-xs text-slate-500">Contextual optimizations generated specifically for this itinerary.</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded-full self-start sm:self-auto">
                      1-Click Instant Adjustment
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {activeOption.suggestedRefinements.map((sug) => (
                      <div
                        key={sug.refinementId}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-indigo-300 hover:shadow-sm"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold text-slate-900 leading-snug">{sug.label}</h4>
                            <button
                              type="button"
                              title="Dismiss suggestion"
                              onClick={() => handleDismissSuggestion(sug.refinementId)}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed">{sug.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={isRefining}
                          onClick={() => handleRefine('', sug)}
                          className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                        >
                          <Zap className="h-3 w-3 text-amber-400" />
                          <span>Apply Refinement</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Day-by-Day Chronological Itinerary */}
              <div className="mt-8">
                <h3 className="text-lg font-bold text-slate-900">Day-Wise Structured Itinerary</h3>
                <p className="text-xs text-slate-500">Chronological schedule with verified accommodations, transfers, and activities.</p>

                <div className="mt-4 space-y-4">
                  {activeOption.days.map((day) => (
                    <div 
                      key={day.dayNumber}
                      className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                            D{day.dayNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                {day.formattedDate}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-xs font-semibold text-slate-700">{day.hubName}</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">{day.themeTitle}</h4>
                          </div>
                        </div>
                        {day.isTransitionDay && (
                          <span className="mt-1 sm:mt-0 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                            <Car className="h-3.5 w-3.5" /> Intercity Transfer Day
                          </span>
                        )}
                      </div>

                      {/* Day Items */}
                      <div className="mt-4 space-y-2.5">
                        {day.items.map((item, itIdx) => (
                          <div 
                            key={item.id || itIdx}
                            className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs"
                          >
                            <div className="flex items-start gap-3">
                              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                                item.type === 'HOTEL' 
                                   ? 'bg-blue-100 text-blue-800' 
                                   : item.type === 'TRANSFER' 
                                   ? 'bg-amber-100 text-amber-800' 
                                   : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {item.type === 'HOTEL' ? <Building2 className="h-3.5 w-3.5" /> : item.type === 'TRANSFER' ? <Car className="h-3.5 w-3.5" /> : <Compass className="h-3.5 w-3.5" />}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{item.name}</span>
                                  <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200">
                                    {item.category}
                                  </span>
                                  {item.source === 'USER' ? (
                                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                                      Customized
                                    </span>
                                  ) : (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200">
                                      AI Scheduled
                                    </span>
                                  )}
                                  {item.serviceTime && (
                                    <span className="flex items-center gap-0.5 text-slate-400 text-[11px]">
                                      <Clock className="h-3 w-3" /> {item.serviceTime}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-slate-600">{item.notes}</p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="font-bold text-slate-900">{item.sellingPriceFormatted}</span>
                              <p className="text-[10px] text-emerald-600 font-medium">In Inventory</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conversational Plan Refinement Box */}
              <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <label htmlFor="refinement-prompt-input" className="block text-sm font-bold text-slate-900">
                  Refine or Modify this Plan
                </label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Instruct AI Planner to adjust hotels, change ground transport, add specific tours, or modify pace without starting over.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    id="refinement-prompt-input"
                    type="text"
                    value={refinementText}
                    onChange={(e) => setRefinementText(e.target.value)}
                    placeholder="e.g. Upgrade all hotels to 5-star luxury, switch to private MPV transfers, or add 1 more night..."
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    id="btn-submit-refinement"
                    disabled={isRefining || !refinementText.trim()}
                    onClick={() => handleRefine()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isRefining ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Apply</span>
                  </button>
                </div>

                {/* Refinement Quick Presets */}
                <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
                  <span className="text-[11px] font-semibold text-slate-500">Quick Adjustments:</span>
                  {[
                    { label: 'Make it more relaxed', prompt: 'Make it more relaxed and unhurried' },
                    { label: 'Add Hakone & Fuji', prompt: 'Add Hakone and Mt. Fuji traditional onsen ryokan' },
                    { label: '5-Star Luxury Hotels', prompt: 'Upgrade accommodations to 5-star luxury hotels' },
                    { label: 'Reduce Price (4-Star)', prompt: 'Reduce the price using 4-star boutique hotels' },
                    { label: 'Add Tsukiji Food Tour', prompt: 'Add Tsukiji market & Ginza food tasting walk' },
                    { label: 'VIP Limousine Transfer', prompt: 'Upgrade to VIP executive limousine chauffeur' },
                    { label: 'Add 1 Night in Tokyo', prompt: 'Add 1 additional night in Tokyo' }
                  ].map((chip, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      disabled={isRefining}
                      onClick={() => handleRefine(chip.prompt)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <Zap className="h-2.5 w-2.5 text-amber-500" />
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Handoff Call to Action */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl bg-slate-900 p-6 text-white">
                <div>
                  <h4 className="text-base font-bold">Ready to customize and finalize this quote?</h4>
                  <p className="text-xs text-slate-300">
                    Push this complete itinerary directly into the Guided B2B Quote Builder to adjust markups, edit vouchers, or send to client.
                  </p>
                </div>
                <button
                  type="button"
                  id="btn-bottom-open-in-builder"
                  onClick={handleOpenInBuilder}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-md transition hover:bg-slate-100"
                >
                  <span>Open in Guided Quote Builder</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
