import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Tag,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Trash2,
  ArrowRight,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { AppliedPromotionSnapshot, Booking, Quotation, User } from '../../types';
import { calculateQuoteTotal, formatCurrency } from '../../services/pricingEngine';
import { buildAuthoritativeQuotationSnapshot } from '../../services/quotationSnapshotService';
import { normalizePromotionCode } from '../../services/promotionEngine';
import {
  confirmPromotionRedemptionAsync,
  releasePromotionReservationAsync,
  reservePromotionForBookingAsync,
  validatePromotionCodeAsync
} from '../../services/promotionApiService';

interface QuoteBookingConfirmationModalProps {
  isOpen: boolean;
  quote: Quotation;
  user: User | null;
  onClose: () => void;
  /** Performs the actual booking creation and returns the created Booking */
  onConfirmBooking: (finalizedQuote: Quotation, specialNotes?: string) => Promise<Booking | null>;
}

export const QuoteBookingConfirmationModal: React.FC<QuoteBookingConfirmationModalProps> = ({
  isOpen,
  quote,
  user,
  onClose,
  onConfirmBooking
}) => {
  const initialQuotePromo = useMemo<AppliedPromotionSnapshot | null>(() => {
    return quote.appliedPromotion || quote.authoritativeSnapshot?.pricing?.appliedPromotion || null;
  }, [quote]);

  // Baseline pricing WITHOUT any promotion (used as the authoritative pre-discount TheUnbound Base Selling Price)
  const baselineNoPromoTotals = useMemo(() => {
    const cleanQuote: Quotation = {
      ...quote,
      appliedPromotion: null,
      promotionDiscountAmount: 0,
      authoritativeSnapshot: undefined,
      currencyConversionSnapshot: undefined
    };
    return calculateQuoteTotal(cleanQuote, quote.activeOptionId, undefined, quote.currency);
  }, [quote]);

  const preDiscountBaseSellingPrice = useMemo(() => {
    if (
      initialQuotePromo &&
      typeof initialQuotePromo.preDiscountBaseSellingPrice === 'number' &&
      initialQuotePromo.preDiscountBaseSellingPrice > 0
    ) {
      return initialQuotePromo.preDiscountBaseSellingPrice;
    }
    return baselineNoPromoTotals.theUnboundBaseSellingPrice || baselineNoPromoTotals.baseSellingPrice || 0;
  }, [initialQuotePromo, baselineNoPromoTotals]);

  const [activePromotion, setActivePromotion] = useState<AppliedPromotionSnapshot | null>(initialQuotePromo);
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);
  const [revalidationFailedReason, setRevalidationFailedReason] = useState<string | null>(null);
  const [priceChangedRequiresAcceptance, setPriceChangedRequiresAcceptance] = useState<boolean>(false);
  const [acceptedRevisedPrice, setAcceptedRevisedPrice] = useState<boolean>(false);
  const [specialNotes, setSpecialNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const evalItems = useMemo(() => {
    const activeOpt = quote.options?.find((o) => o.id === quote.activeOptionId) || quote.options?.[0];
    const list = activeOpt?.items && activeOpt.items.length > 0 ? activeOpt.items : quote.items || [];
    return list.map((it) => ({
      id: it.id,
      productId: it.product?.id,
      productName: it.product?.name,
      category: it.product?.category,
      productType: (it.product as any)?.productType,
      destinationId: it.product?.destinationId,
      baseSellingPrice:
        it.calculation?.finalTotalSellingPrice ||
        (it.calculation as any)?.sellingPriceFinal ||
        0
    }));
  }, [quote]);

  // Recalculate authoritative booking totals whenever activePromotion changes (NEVER double-deducting)
  const effectiveQuoteForPreview = useMemo<Quotation>(() => {
    const promoChanged =
      (activePromotion?.promotionId || '') !== (initialQuotePromo?.promotionId || '') ||
      (activePromotion?.discountAmount || 0) !== (initialQuotePromo?.discountAmount || 0);

    if (!promoChanged && quote.authoritativeSnapshot?.pricing) {
      return {
        ...quote,
        appliedPromotion: activePromotion
      };
    }

    return {
      ...quote,
      appliedPromotion: activePromotion,
      preDiscountBaseSellingPrice,
      promotionDiscountAmount: activePromotion?.discountAmount || 0,
      discountedBaseSellingPrice: activePromotion
        ? activePromotion.discountedBaseSellingPrice
        : preDiscountBaseSellingPrice,
      // Clear stale snapshot references only on this working copy when booking-stage promotion differs
      authoritativeSnapshot: promoChanged ? undefined : quote.authoritativeSnapshot,
      currencyConversionSnapshot: promoChanged ? undefined : quote.currencyConversionSnapshot
    };
  }, [quote, activePromotion, initialQuotePromo, preDiscountBaseSellingPrice]);

  const effectiveTotals = useMemo(() => {
    return calculateQuoteTotal(
      effectiveQuoteForPreview,
      effectiveQuoteForPreview.activeOptionId,
      undefined,
      effectiveQuoteForPreview.currency
    );
  }, [effectiveQuoteForPreview]);

  const originalCommittedFinalPrice = useMemo(() => {
    const orig = calculateQuoteTotal(quote, quote.activeOptionId, undefined, quote.currency);
    return orig.finalCustomerSellingPrice || quote.finalCustomerSellingPrice || quote.totalSellingPrice || 0;
  }, [quote]);

  // Scenario A: Automatically revalidate an existing promotion code on modal open
  useEffect(() => {
    if (!isOpen) return;
    setActivePromotion(initialQuotePromo);
    setPromoCodeInput('');
    setValidationError(null);
    setValidationNotice(null);
    setRevalidationFailedReason(null);
    setPriceChangedRequiresAcceptance(false);
    setAcceptedRevisedPrice(false);
    setSubmitError(null);

    if (!initialQuotePromo) return;

    let cancelled = false;
    const revalidateExisting = async () => {
      setIsValidating(true);
      try {
        const res = await validatePromotionCodeAsync({
          code: initialQuotePromo.code || initialQuotePromo.normalizedCode,
          stage: 'BOOKING_CONFIRMATION',
          quotationId: quote.id,
          quotationVersion: quote.version || 1,
          quotationStatus: quote.status,
          preDiscountBaseSellingPrice,
          currency: quote.currency,
          destinationId: quote.destinationId,
          destinationName: quote.destination,
          items: evalItems,
          totalPax: quote.totalPax || (quote.adultsCount || 2) + (quote.childrenCount || 0),
          existingQuotationPromotionId: initialQuotePromo.promotionId,
          user
        });

        if (cancelled) return;

        if (res.valid && res.appliedPromotion) {
          setActivePromotion({
            ...res.appliedPromotion,
            appliedStage: initialQuotePromo.appliedStage || 'QUOTATION',
            validationStatus: 'REVALIDATED_VALID'
          });
          setValidationNotice(`Promotion code ${res.appliedPromotion.code} revalidated and active for booking confirmation.`);
          if (Math.abs(res.appliedPromotion.discountAmount - initialQuotePromo.discountAmount) > 0.01) {
            setPriceChangedRequiresAcceptance(true);
          }
        } else {
          const policy = initialQuotePromo.eligibilitySnapshot?.bookingValidityPolicy || 'REQUIRE_REACCEPTANCE';
          if (policy === 'HONOR_QUOTE_SNAPSHOT') {
            setActivePromotion(initialQuotePromo);
            setValidationNotice('Honoring committed quotation promotion snapshot per configured policy.');
          } else {
            // Code expired, paused, disabled, or usage limit exhausted -> remove & require explicit agent acceptance of revised total
            setActivePromotion(null);
            setRevalidationFailedReason(
              res.message || 'The previously applied promotion code is no longer valid at booking confirmation.'
            );
            setPriceChangedRequiresAcceptance(true);
          }
        }
      } catch {
        if (!cancelled) {
          setValidationError('Unable to revalidate promotion right now. Please retry.');
        }
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    };

    revalidateExisting();
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialQuotePromo, quote.id, quote.version, quote.status, quote.currency, quote.destinationId, quote.destination, quote.totalPax, quote.adultsCount, quote.childrenCount, preDiscountBaseSellingPrice, evalItems, user]);

  if (!isOpen) return null;

  const handleApplyBookingStageCode = async () => {
    const clean = normalizePromotionCode(promoCodeInput);
    if (!clean) {
      setValidationError('Please enter a promotion code.');
      return;
    }
    setIsValidating(true);
    setValidationError(null);
    setValidationNotice(null);
    setRevalidationFailedReason(null);

    try {
      const res = await validatePromotionCodeAsync({
        code: clean,
        stage: 'BOOKING_CONFIRMATION',
        quotationId: quote.id,
        quotationVersion: quote.version || 1,
        quotationStatus: quote.status,
        preDiscountBaseSellingPrice,
        currency: quote.currency,
        destinationId: quote.destinationId,
        destinationName: quote.destination,
        items: evalItems,
        totalPax: quote.totalPax || (quote.adultsCount || 2) + (quote.childrenCount || 0),
        existingQuotationPromotionId: initialQuotePromo?.promotionId,
        user
      });

      if (!res.valid || !res.appliedPromotion) {
        // Scenario C: Invalid / unavailable — preserve current committed quotation pricing
        setValidationError(res.message || 'This promotion code is not eligible for this booking.');
        return;
      }

      setActivePromotion({
        ...res.appliedPromotion,
        appliedStage: 'BOOKING_CONFIRMATION',
        validationStatus: 'VALID'
      });
      setPromoCodeInput('');
      setValidationNotice(`Promotion ${res.appliedPromotion.code} applied to TheUnbound Base Selling Price. Please review and accept the revised booking total below.`);
      setPriceChangedRequiresAcceptance(true);
      setAcceptedRevisedPrice(false);
    } catch {
      setValidationError('Unable to validate promotion code at this time.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemovePromotion = () => {
    setActivePromotion(null);
    setValidationError(null);
    setValidationNotice('Promotion removed. Booking will proceed at standard quotation pricing.');
    if (initialQuotePromo) {
      setPriceChangedRequiresAcceptance(true);
      setAcceptedRevisedPrice(false);
    } else {
      setPriceChangedRequiresAcceptance(false);
    }
  };

  const handleConfirm = async () => {
    if (priceChangedRequiresAcceptance && !acceptedRevisedPrice) {
      setSubmitError('Please acknowledge and accept the revised booking total before confirming.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    let createdReservationId: string | undefined;

    try {
      const idempotencyKey = `bk-confirm:${quote.id}:v${quote.version || 1}:${activePromotion?.promotionId || 'none'}`;
      let finalAppliedPromo: AppliedPromotionSnapshot | null = activePromotion;

      // 1. Concurrency-safe server-side reservation before creating Booking
      if (activePromotion) {
        const resOut = await reservePromotionForBookingAsync({
          code: activePromotion.code || activePromotion.normalizedCode,
          quotationId: quote.id,
          quotationNumber: quote.quoteNumber,
          quotationVersion: quote.version || 1,
          idempotencyKey,
          preDiscountBaseSellingPrice,
          currency: quote.currency,
          destinationId: quote.destinationId,
          destinationName: quote.destination,
          items: evalItems,
          totalPax: quote.totalPax || (quote.adultsCount || 2) + (quote.childrenCount || 0),
          existingQuotationPromotionId: initialQuotePromo?.promotionId,
          user
        });

        if (!resOut.ok || !resOut.appliedPromotion) {
          // Concurrent usage limit hit or promotion deactivated right before click
          setActivePromotion(null);
          setRevalidationFailedReason(
            resOut.validation?.message || 'This promotion code is no longer available (usage limit reached or deactivated).'
          );
          setPriceChangedRequiresAcceptance(true);
          setAcceptedRevisedPrice(false);
          setSubmitError(
            resOut.validation?.message || 'Promotion could not be reserved. Review the updated price to continue without promotion.'
          );
          setIsSubmitting(false);
          return;
        }

        createdReservationId = resOut.reservation?.id;
        finalAppliedPromo = {
          ...resOut.appliedPromotion,
          appliedStage: activePromotion.appliedStage,
          reservationId: createdReservationId
        };
      }

      // 2. Build authoritative booking-ready quotation copy (NEVER mutating historical saved quotation versions!)
      const promoChangedFromQuote =
        (finalAppliedPromo?.promotionId || '') !== (initialQuotePromo?.promotionId || '') ||
        (finalAppliedPromo?.discountAmount || 0) !== (initialQuotePromo?.discountAmount || 0);

      let quoteForBooking: Quotation = {
        ...quote,
        appliedPromotion: finalAppliedPromo,
        preDiscountBaseSellingPrice,
        promotionDiscountAmount: finalAppliedPromo?.discountAmount || 0,
        discountedBaseSellingPrice: finalAppliedPromo
          ? finalAppliedPromo.discountedBaseSellingPrice
          : preDiscountBaseSellingPrice
      };

      if (promoChangedFromQuote) {
        // Recalculate cleanly via central pricing & snapshot builder so Booking receives authoritative totals
        const recalcSnap = buildAuthoritativeQuotationSnapshot(
          {
            ...quoteForBooking,
            authoritativeSnapshot: undefined,
            currencyConversionSnapshot: undefined,
            isLocked: false
          },
          {
            versionNumber: quote.version || 1,
            selectedOptionIndexOrId: quote.activeOptionId,
            brandingMode: quote.brandingMode,
            user,
            preserveExistingPricingIfLocked: false
          }
        );
        quoteForBooking = {
          ...quoteForBooking,
          baseFinalSellingPrice: recalcSnap.pricing.baseFinalSellingPrice,
          theUnboundBaseSellingPrice: recalcSnap.pricing.theUnboundBaseSellingPrice,
          agentMarginAmount: recalcSnap.pricing.agentMarginAmount,
          finalCustomerSellingPrice: recalcSnap.pricing.finalCustomerSellingPrice,
          totalSellingPrice: recalcSnap.pricing.finalCustomerSellingPrice,
          hotelAccommodationTotal: recalcSnap.pricing.hotelAccommodationTotal,
          landPartTotal: recalcSnap.pricing.landPartTotal,
          authoritativeSnapshot: recalcSnap,
          currencyConversionSnapshot: recalcSnap.pricing.currencyConversionSnapshot
        };
      }

      // 3. Create the Booking
      const createdBooking = await onConfirmBooking(quoteForBooking, specialNotes.trim() || undefined);
      if (!createdBooking) {
        if (createdReservationId) {
          await releasePromotionReservationAsync(createdReservationId, 'Booking creation returned no record');
        }
        setSubmitError('Booking could not be finalized. Any promotion reservation has been released.');
        setIsSubmitting(false);
        return;
      }

      // 4. Commit Idempotent Promotion Redemption linked to Booking ID
      if (finalAppliedPromo) {
        const commitRes = await confirmPromotionRedemptionAsync({
          promotionId: finalAppliedPromo.promotionId,
          code: finalAppliedPromo.code,
          reservationId: createdReservationId,
          idempotencyKey,
          bookingId: createdBooking.id,
          bookingReference: createdBooking.bookingReference,
          quotationId: quote.id,
          quotationNumber: quote.quoteNumber,
          quotationVersion: quote.version || 1,
          preDiscountBaseSellingPrice,
          currency: quote.currency,
          destinationId: quote.destinationId,
          destinationName: quote.destination,
          items: evalItems,
          totalPax: quote.totalPax || (quote.adultsCount || 2) + (quote.childrenCount || 0),
          appliedStage: finalAppliedPromo.appliedStage,
          appliedPromotion: finalAppliedPromo,
          user
        });

        if (!commitRes.ok) {
          console.warn('[BOOKING-CONFIRM] Promotion redemption commit warning:', commitRes.error);
        }
      }

      onClose();
    } catch (err: any) {
      if (createdReservationId) {
        await releasePromotionReservationAsync(
          createdReservationId,
          err?.message || 'Booking creation threw an error'
        );
      }
      setSubmitError(err?.message || 'Failed to confirm booking. Promotion reservation was released.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const finalPriceDelta = effectiveTotals.finalCustomerSellingPrice - originalCommittedFinalPrice;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-[#00E5C0]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Confirm Quotation to Booking</h3>
              <p className="text-xs text-slate-300 font-mono">
                {quote.quoteNumber} • v{quote.version || 1} • {quote.clientName || 'Valued Client'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Promotion & Discount Code Section */}
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-teal-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Promotion &amp; Discount Code
                </h4>
              </div>
              {isValidating && (
                <span className="inline-flex items-center space-x-1.5 text-[11px] font-bold text-teal-700">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating on server...</span>
                </span>
              )}
            </div>

            {revalidationFailedReason && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">Previous Promotion No Longer Valid</div>
                  <p>{revalidationFailedReason}</p>
                  <p className="text-[11px] text-amber-800">
                    The booking pricing below has been updated to the standard rate. You may enter another eligible code or accept the revised total to proceed.
                  </p>
                </div>
              </div>
            )}

            {activePromotion ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-mono text-xs font-black tracking-wider">
                        {activePromotion.code}
                      </span>
                      <span className="text-xs font-bold text-emerald-900">
                        {activePromotion.promotionName}
                      </span>
                    </div>
                    {activePromotion.promotionDescription && (
                      <p className="text-[11px] text-emerald-800">{activePromotion.promotionDescription}</p>
                    )}
                    <p className="text-[11px] font-semibold text-emerald-700">
                      Discount ({activePromotion.discountType === 'PERCENTAGE' ? `${activePromotion.discountValue}%` : formatCurrency(activePromotion.discountValue, activePromotion.promotionCurrency || quote.currency)}) applied strictly to TheUnbound Base Selling Price (applied once — never duplicated).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePromotion}
                    disabled={isSubmitting || isValidating}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/80 text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold block">Pre-Discount Base</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatCurrency(preDiscountBaseSellingPrice, quote.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold block">Promo Discount</span>
                    <span className="font-mono font-black text-emerald-700">
                      - {formatCurrency(activePromotion.discountAmount, quote.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold block">Discounted Base</span>
                    <span className="font-mono font-black text-slate-900">
                      {formatCurrency(activePromotion.discountedBaseSellingPrice, quote.currency)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-600">
                  Have a promotional discount code for this booking? Enter it below to validate eligibility against TheUnbound Base Selling Price.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => {
                      setPromoCodeInput(e.target.value.toUpperCase());
                      if (validationError) setValidationError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyBookingStageCode();
                      }
                    }}
                    placeholder="Enter promotion code (e.g. JAPAN10)"
                    disabled={isValidating || isSubmitting}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold uppercase tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBookingStageCode}
                    disabled={isValidating || isSubmitting || !promoCodeInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center space-x-1.5 cursor-pointer"
                  >
                    {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Apply Code</span>
                  </button>
                </div>
              </div>
            )}

            {validationNotice && !validationError && (
              <div className="flex items-center space-x-2 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{validationNotice}</span>
              </div>
            )}

            {validationError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Authoritative Booking Commercial Summary */}
          <div className="rounded-2xl bg-slate-900 text-white p-5 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Authoritative Booking Commercial Summary</span>
              <span className="font-mono text-[#00E5C0]">{quote.currency}</span>
            </div>

            <div className="space-y-1.5 text-xs border-t border-slate-800 pt-3">
              <div className="flex justify-between text-slate-300">
                <span>TheUnbound Base Selling Price {activePromotion ? '(Pre-Discount)' : ''}</span>
                <span className="font-mono font-bold">
                  {formatCurrency(preDiscountBaseSellingPrice, quote.currency)}
                </span>
              </div>

              {activePromotion && activePromotion.discountAmount > 0 && (
                <>
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Promotion Discount ({activePromotion.code})</span>
                    <span className="font-mono">
                      - {formatCurrency(activePromotion.discountAmount, quote.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-cyan-300 font-bold">
                    <span>Discounted Base Selling Price</span>
                    <span className="font-mono">
                      {formatCurrency(effectiveTotals.theUnboundBaseSellingPrice, quote.currency)}
                    </span>
                  </div>
                </>
              )}

              {effectiveTotals.markupAmount > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Your Additional Markup</span>
                  <span className="font-mono font-bold">
                    + {formatCurrency(effectiveTotals.markupAmount, quote.currency)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-2.5 border-t border-slate-800">
                <span className="text-sm font-black text-white">Final Booking Total</span>
                <span className="text-2xl font-black font-mono text-[#00E5C0]">
                  {formatCurrency(effectiveTotals.finalCustomerSellingPrice, quote.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Explicit Re-Acceptance Checkbox if price changed at booking stage */}
          {priceChangedRequiresAcceptance && (
            <label className="flex items-start space-x-3 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedRevisedPrice}
                onChange={(e) => {
                  setAcceptedRevisedPrice(e.target.checked);
                  if (submitError) setSubmitError(null);
                }}
                className="mt-0.5 w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-indigo-950 font-medium leading-relaxed">
                I have reviewed and explicitly accept the revised booking total of{' '}
                <strong className="font-mono font-black">
                  {formatCurrency(effectiveTotals.finalCustomerSellingPrice, quote.currency)}
                </strong>{' '}
                ({finalPriceDelta < 0
                  ? `saving ${formatCurrency(Math.abs(finalPriceDelta), quote.currency)}`
                  : finalPriceDelta > 0
                    ? `increased by ${formatCurrency(finalPriceDelta, quote.currency)} from quotation total`
                    : 'unchanged from quotation total'}
                ).
              </span>
            </label>
          )}

          {/* Optional Booking Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Booking Operations Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="Flight numbers, special dietary or rooming requests for operations..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              isValidating ||
              (priceChangedRequiresAcceptance && !acceptedRevisedPrice)
            }
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-black inline-flex items-center space-x-2 shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Confirming Booking...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm &amp; Convert to Booking</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
