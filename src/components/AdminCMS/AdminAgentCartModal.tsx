import React, { useEffect, useMemo, useState } from 'react';
import {
  CurrencyCode,
  Product,
  QuoteItem,
  User,
  UserCartItemDocument
} from '../../types';
import { AppDatabase } from '../../services/db';
import { auth } from '../../services/firebase';
import {
  isAuthorisedCartAdmin,
  resolveTargetAgentUid,
  userCartService
} from '../../services/userCartService';
import { calculateProductPriceForAgent, formatCurrency } from '../../services/pricingEngine';
import { sanitizeProductForAgent } from '../../utils/customerQuoteSanitizer';
import { createQuoteItemContentSnapshot } from '../../utils/b2bQuotationHelpers';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserCheck,
  Users,
  X
} from 'lucide-react';

interface AdminAgentCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  allUsers: User[];
  initialTargetAgent?: User | null;
}

export const AdminAgentCartModal: React.FC<AdminAgentCartModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  initialTargetAgent = null
}) => {
  const db = AppDatabase.getInstance();
  const isAuthorizedAdmin = isAuthorisedCartAdmin(currentUser);

  // Eligible approved B2B Agents with resolvable Firebase Auth UID
  const eligibleAgents = useMemo(() => {
    return allUsers
      .filter((u) => {
        const role = String(u.role || '').toUpperCase();
        const isB2B = role === 'B2B_AGENT' || role === 'AGENT' || role === 'AGENCY_OWNER';
        const isApproved = (u.approvalStatus || 'APPROVED') === 'APPROVED';
        return isB2B && isApproved && Boolean(resolveTargetAgentUid(u));
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allUsers]);

  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    initialTargetAgent ? initialTargetAgent.id : ''
  );
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [travelDate, setTravelDate] = useState(() => {
    const d = new Date(Date.now() + 14 * 86400_000);
    return d.toISOString().split('T')[0];
  });
  const [adults, setAdults] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [adminNote, setAdminNote] = useState('');
  const [currency] = useState<CurrencyCode>('USD');

  const [targetCartItems, setTargetCartItems] = useState<UserCartItemDocument[]>([]);
  const [isLoadingCart, setIsLoadingCart] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedAgentId(initialTargetAgent ? initialTargetAgent.id : '');
      setFeedback(null);
      setAdminNote('');
    }
  }, [isOpen, initialTargetAgent]);

  const selectedAgent = useMemo(
    () => eligibleAgents.find((u) => u.id === selectedAgentId) || null,
    [eligibleAgents, selectedAgentId]
  );

  const selectedAgentUid = useMemo(
    () => resolveTargetAgentUid(selectedAgent),
    [selectedAgent]
  );

  // Active catalog products (filtered by search)
  const activeProducts = useMemo(() => {
    const all = db.getProducts().filter((p) => {
      const status = String(p.status || 'ACTIVE').toUpperCase();
      return status === 'ACTIVE' || status === 'PUBLISHED';
    });
    const q = productSearch.trim().toLowerCase();
    if (!q) return all.slice(0, 80);
    return all
      .filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.city || '').toLowerCase().includes(q) ||
          (p.destinationName || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
      )
      .slice(0, 80);
  }, [db, productSearch]);

  const selectedProduct = useMemo(
    () => activeProducts.find((p) => p.id === selectedProductId) || null,
    [activeProducts, selectedProductId]
  );

  // Load ONLY the selected target agent's isolated cart (`users/{targetUid}/cart`)
  useEffect(() => {
    if (!isOpen || !isAuthorizedAdmin || !currentUser || !selectedAgentUid) {
      setTargetCartItems([]);
      return;
    }

    let cancelled = false;
    setIsLoadingCart(true);
    void userCartService
      .listCartForUser({
        actor: currentUser,
        actorFirebaseUid: auth?.currentUser?.uid || currentUser.id,
        targetUid: selectedAgentUid
      })
      .then((docs) => {
        if (!cancelled) {
          setTargetCartItems(docs);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setTargetCartItems([]);
          setFeedback({ type: 'error', message: err?.message || 'Unable to load agent cart.' });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCart(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, isAuthorizedAdmin, currentUser, selectedAgentUid]);

  if (!isOpen) return null;

  const handleAddItemToTargetAgentCart = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isAuthorizedAdmin || !currentUser) {
      setFeedback({ type: 'error', message: 'Only authorised CMS Administrators may add items to an agent cart.' });
      return;
    }
    if (!selectedAgent || !selectedAgentUid) {
      setFeedback({ type: 'error', message: 'Please explicitly select a target B2B Agent first.' });
      return;
    }
    if (!selectedProduct) {
      setFeedback({ type: 'error', message: 'Please select an active product to add to the agent cart.' });
      return;
    }

    setIsSaving(true);
    try {
      const sanitizedProduct = sanitizeProductForAgent(selectedProduct);
      const itemId = `admin-cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const calculation = calculateProductPriceForAgent(selectedProduct, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        itemId,
        pricingTier: 'B2B',
        adults: Math.max(1, adults),
        children: Math.max(0, childrenCount),
        infants: 0,
        travelDate,
        targetCurrency: currency,
        selectedAddonIds: []
      });

      const quoteItem: QuoteItem = {
        id: itemId,
        product: sanitizedProduct,
        productId: selectedProduct.id,
        pax: { adults: Math.max(1, adults), children: Math.max(0, childrenCount), infants: 0 },
        travelDate,
        notes: adminNote.trim() || undefined,
        selectedAddonIds: [],
        calculation,
        source: 'USER',
        aiSuggested: false,
        category: selectedProduct.category,
        categoryLabel: selectedProduct.category,
        currency_snapshot: currency
      };
      quoteItem.contentSnapshot = createQuoteItemContentSnapshot(sanitizedProduct, quoteItem);

      const created = await userCartService.adminAddItemToAgentCart({
        actor: currentUser,
        actorFirebaseUid: auth?.currentUser?.uid || currentUser.id,
        targetAgent: selectedAgent,
        quoteItem,
        adminNote: adminNote.trim() || undefined
      });

      setTargetCartItems((prev) => [...prev, created]);
      setAdminNote('');
      setSelectedProductId('');
      setFeedback({
        type: 'success',
        message: `Added "${created.productName}" exclusively to ${selectedAgent.name}'s cart (UID: ${selectedAgentUid}). Audit log recorded.`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to add item to target agent cart.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFromTargetAgentCart = async (cartItemId: string) => {
    if (!isAuthorizedAdmin || !currentUser || !selectedAgentUid) return;
    try {
      await userCartService.removeCartItem({
        actor: currentUser,
        actorFirebaseUid: auth?.currentUser?.uid || currentUser.id,
        targetUid: selectedAgentUid,
        cartItemId
      });
      setTargetCartItems((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
      setFeedback({
        type: 'success',
        message: `Removed item from ${selectedAgent?.name}'s isolated cart.`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to remove item.' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0]">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Add Item to Specific Agent&apos;s Cart</h3>
              <p className="text-[11px] text-slate-400">
                Strict UID-isolated write to <span className="font-mono text-[#00E5C0]">users/&#123;targetUid&#125;/cart</span> with Admin audit trail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {!isAuthorizedAdmin ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Access denied. Only authorised CMS Administrators can add items on behalf of a B2B Agent.</span>
            </div>
          ) : (
            <>
              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 border ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Step 1: Explicit Target Agent Selector */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#008972]" />
                  <span>1. Select Target B2B Agent (Required — Never Broadcasts to Agency) *</span>
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => {
                    setSelectedAgentId(e.target.value);
                    setFeedback(null);
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#00C6A6]"
                >
                  <option value="">-- Explicitly choose target B2B Agent --</option>
                  {eligibleAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.email}) — {agent.agencyName || 'Independent Agency'} [UID: {resolveTargetAgentUid(agent)}]
                    </option>
                  ))}
                </select>

                {selectedAgent && selectedAgentUid && (
                  <div className="flex flex-wrap items-center gap-3 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Target UID: <code className="font-mono text-emerald-700">{selectedAgentUid}</code>
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      Agency (Reference Only): {selectedAgent.agencyName || 'N/A'}
                    </span>
                  </div>
                )}
              </div>

              {/* Step 2: Select Product & Add to Target Agent's Cart */}
              <form onSubmit={handleAddItemToTargetAgentCart} className="p-4 rounded-xl bg-white border border-slate-200 space-y-4">
                <div className="text-xs font-bold text-slate-900">
                  2. Select Service &amp; Configure Parameters
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search active catalog products by name, city, or destination..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>

                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#00C6A6]"
                >
                  <option value="">-- Select an Active Product ({activeProducts.length} available) --</option>
                  {activeProducts.map((p: Product) => (
                    <option key={p.id} value={p.id}>
                      [{p.category || p.productType}] {p.name} — {p.city || p.destinationName}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Service Date
                    </label>
                    <input
                      type="date"
                      value={travelDate}
                      onChange={(e) => setTravelDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Adults
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={adults}
                      onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Children</label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={childrenCount}
                      onChange={(e) => setChildrenCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Admin Note (Visible in Audit Trail &amp; Cart Provenance)
                  </label>
                  <input
                    type="text"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="e.g., Requested via WhatsApp for May Tokyo VIP group"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving || !selectedAgentUid || !selectedProductId}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] disabled:opacity-50 text-slate-950 font-black text-xs shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSaving ? 'Adding to Agent Cart...' : 'Add Exclusively to Selected Agent Cart'}</span>
                  </button>
                </div>
              </form>

              {/* Step 3: Target Agent's Current Isolated Cart */}
              {selectedAgent && selectedAgentUid && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900">
                      Current Isolated Cart for {selectedAgent.name} ({targetCartItems.length})
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500">
                      users/{selectedAgentUid}/cart
                    </span>
                  </div>

                  {isLoadingCart ? (
                    <div className="text-xs text-slate-500 py-4 text-center">Loading agent&apos;s cart...</div>
                  ) : targetCartItems.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center bg-white rounded-xl border border-slate-200">
                      This agent&apos;s cart is currently empty.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {targetCartItems.map((docItem) => (
                        <div
                          key={docItem.cartItemId}
                          className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 truncate">{docItem.productName}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  docItem.addedByRole === 'ADMIN'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {docItem.addedByRole === 'ADMIN'
                                  ? `Added by Admin (${docItem.addedByName || docItem.addedByUid})`
                                  : 'Added by Agent'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Date: {docItem.selectedServiceDate || 'TBD'} • Pax: {docItem.passengerConfig.adults}A
                              {docItem.passengerConfig.children > 0 ? ` / ${docItem.passengerConfig.children}C` : ''} •{' '}
                              {formatCurrency(
                                docItem.itemPayload?.calculation?.finalTotalSellingPrice || 0,
                                (docItem.itemPayload?.currency_snapshot as CurrencyCode) || 'USD'
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromTargetAgentCart(docItem.cartItemId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
                            title="Remove from this agent's cart"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
