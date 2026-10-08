import React, { useState } from 'react';
import { Booking, BookingPaymentProof, User } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { 
  CreditCard, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Upload, 
  Eye, 
  FileText, 
  ShieldCheck, 
  Coins, 
  ArrowRight,
  X,
  RotateCcw
} from 'lucide-react';

interface PaymentProofsManagerProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const PaymentProofsManager: React.FC<PaymentProofsManagerProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const paymentSummary = db.calculateBookingPaymentSummary(booking);
  const proofs = booking.paymentProofs || [];

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeProofPreview, setActiveProofPreview] = useState<{ url: string; title: string } | null>(null);
  const [verifyingProof, setVerifyingProof] = useState<{
    proof: BookingPaymentProof;
    action: 'VERIFIED' | 'REJECTED' | 'REPLACEMENT_REQUIRED';
  } | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');

  // Add Tranche Form State
  const [amount, setAmount] = useState<string>(paymentSummary.pendingAmount > 0 ? paymentSummary.pendingAmount.toString() : '500');
  const [currency, setCurrency] = useState(booking.currency || 'USD');
  const [trancheLabel, setTrancheLabel] = useState(`Tranche ${proofs.length + 1}`);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'WIRE_TRANSFER' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'>('WIRE_TRANSFER');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState<{ name: string; url: string; type: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isAdminOrOps = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MEMBER' || currentUser?.role === 'DMC_STAFF';

  const openAddTrancheModal = () => {
    const nextTrancheNum = proofs.length + 1;
    setTrancheLabel(nextTrancheNum === 1 ? 'Tranche 1 (50% Advance Deposit)' : `Tranche ${nextTrancheNum} (Balance Settlement)`);
    setAmount(paymentSummary.pendingAmount > 0 ? paymentSummary.pendingAmount.toString() : '');
    setCurrency(booking.currency || 'USD');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setTransactionRef('');
    setNotes('');
    setProofFile(null);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const isPdf = file.type.includes('pdf') || file.name.endsWith('.pdf');
      setProofFile({
        name: file.name,
        url: dataUrl,
        type: isPdf ? 'PDF' : 'IMAGE'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTranche = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setFormError('Please enter a valid payment amount greater than 0.');
      return;
    }

    if (!transactionRef.trim()) {
      setFormError('Please provide a Transaction Reference Number / Bank Wire Advice ID.');
      return;
    }

    try {
      db.addBookingPaymentTranche(
        booking.id,
        {
          amount: numAmount,
          currency,
          trancheLabel: trancheLabel.trim() || `Tranche ${proofs.length + 1}`,
          paymentDate,
          paymentMethod,
          transactionRef: transactionRef.trim(),
          proofFileUrl: proofFile?.url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
          proofFileName: proofFile?.name || 'Payment_Transfer_Receipt.pdf',
          proofFileType: (proofFile?.type as any) || 'PDF',
          notes: notes.trim() || undefined
        },
        currentUser
      );

      setIsAddModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit payment tranche');
    }
  };

  const handleConfirmVerification = () => {
    if (!verifyingProof) return;
    db.verifyBookingPayment(
      booking.id,
      verifyingProof.proof.id,
      verifyingProof.action,
      verificationNotes,
      currentUser
    );
    setVerifyingProof(null);
    setVerificationNotes('');
    onRefresh();
  };

  return (
    <div id="booking-payment-proofs-section" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs mb-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
              <CreditCard className="w-5 h-5 text-[#008f77]" />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              Payment Management & Multi-Tranche Verification
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              booking.paymentStatus === 'PAID'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : booking.paymentStatus === 'PARTIALLY_PAID'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}>
              {booking.paymentStatus ? booking.paymentStatus.replace(/_/g, ' ') : 'PENDING PAYMENT'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Supports unlimited payment tranches, currency receipts, wire advices, and financial verification audit trail.
          </p>
        </div>

        <button
          id="btn-add-payment-tranche"
          onClick={openAddTrancheModal}
          className="flex items-center px-4 py-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 rounded-xl text-xs font-bold shadow-md shadow-[#00C6A6]/20 transition-all cursor-pointer"
        >
          <span>Add Payment Tranche / Proof</span>
        </button>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
          <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">Total Booking Value</span>
          <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
            {formatCurrency(paymentSummary.totalAmount, booking.currency)}
          </span>
        </div>
        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50">
          <span className="text-[11px] font-bold text-emerald-800 uppercase block tracking-wider">Verified Paid</span>
          <span className="text-lg font-black font-mono text-emerald-900 mt-1 block">
            {formatCurrency(paymentSummary.verifiedPaidAmount, booking.currency)}
          </span>
        </div>
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50">
          <span className="text-[11px] font-bold text-amber-800 uppercase block tracking-wider">Pending Verification</span>
          <span className="text-lg font-black font-mono text-amber-900 mt-1 block">
            {formatCurrency(Math.max(0, paymentSummary.paidAmount - paymentSummary.verifiedPaidAmount), booking.currency)}
          </span>
        </div>
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50">
          <span className="text-[11px] font-bold text-rose-800 uppercase block tracking-wider">Outstanding Balance</span>
          <span className="text-lg font-black font-mono text-rose-900 mt-1 block">
            {formatCurrency(paymentSummary.pendingAmount, booking.currency)}
          </span>
        </div>
      </div>

      {/* Tranches List */}
      {proofs.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
          <div className="p-2.5 rounded-2xl bg-teal-50 text-[#008f77] w-fit mx-auto mb-2">
            <CreditCard className="w-8 h-8 text-[#008f77]" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            No Payment Proofs Uploaded
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Upload the advance deposit or bank payment advice to initiate processing.
          </p>
          <button
            onClick={openAddTrancheModal}
            className="px-4 py-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 rounded-xl text-xs font-bold shadow-md shadow-[#00C6A6]/20 inline-flex items-center cursor-pointer"
          >
            <span>Upload Advance Deposit Proof</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {proofs.map((proof, idx) => {
            const isVerified = proof.verificationStatus === 'VERIFIED';
            const isRejected = proof.verificationStatus === 'REJECTED';
            const isReplacement = proof.verificationStatus === 'REPLACEMENT_REQUIRED';
            const isPending = proof.verificationStatus === 'PENDING_VERIFICATION' || !proof.verificationStatus;

            return (
              <div 
                key={proof.id} 
                id={`payment-tranche-row-${proof.id}`}
                className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl mt-0.5 ${
                    isVerified ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    isRejected ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                    isReplacement ? 'bg-orange-50 text-orange-800 border border-orange-200' :
                    'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {isVerified ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                     isRejected ? <XCircle className="w-5 h-5 text-rose-600" /> :
                     isReplacement ? <RotateCcw className="w-5 h-5 text-orange-600" /> :
                     <Clock className="w-5 h-5 text-amber-600" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-slate-900">
                        {proof.trancheLabel || `Tranche #${idx + 1}`}
                      </h4>
                      <span className="text-base font-black font-mono text-slate-900">
                        {formatCurrency(proof.amount, proof.currency || booking.currency)}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isVerified ? 'bg-emerald-50 text-emerald-900 border-emerald-300' :
                        isRejected ? 'bg-rose-50 text-rose-900 border-rose-300' :
                        isReplacement ? 'bg-orange-50 text-orange-900 border-orange-300' :
                        'bg-amber-50 text-amber-900 border-amber-300'
                      }`}>
                        {proof.verificationStatus ? proof.verificationStatus.replace(/_/g, ' ') : 'PENDING VERIFICATION'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 font-mono mt-1 space-x-3">
                      <span>Method: <strong className="text-slate-800">{proof.paymentMethod?.replace(/_/g, ' ')}</strong></span>
                      <span>Ref: <strong className="text-slate-800">{proof.transactionRef}</strong></span>
                      <span>Date: <strong className="text-slate-800">{proof.paymentDate}</strong></span>
                    </div>

                    {proof.verificationNotes && (
                      <p className="text-xs text-slate-600 mt-1 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        Verification Notes: {proof.verificationNotes}
                        {proof.verifiedByName && ` — verified by ${proof.verifiedByName}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                  {proof.proofFileUrl && (
                    <button
                      onClick={() => setActiveProofPreview({ url: proof.proofFileUrl!, title: `Payment Proof: ${proof.trancheLabel} (${proof.transactionRef})` })}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Advice / Receipt</span>
                    </button>
                  )}

                  {isAdminOrOps && (
                    <div className="flex items-center gap-1.5">
                      {!isVerified && (
                        <button
                          onClick={() => setVerifyingProof({ proof, action: 'VERIFIED' })}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Approve and Mark Verified"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      )}
                      {!isReplacement && (
                        <button
                          onClick={() => setVerifyingProof({ proof, action: 'REPLACEMENT_REQUIRED' })}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Request Replacement Document"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Req Replacement</span>
                        </button>
                      )}
                      {!isRejected && (
                        <button
                          onClick={() => setVerifyingProof({ proof, action: 'REJECTED' })}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Reject Payment Advice"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Payment Tranche Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
                  <CreditCard className="w-5 h-5 text-[#008f77]" />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  Upload Payment Tranche Proof
                </h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveTranche} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tranche Name / Label *</label>
                <input
                  type="text"
                  required
                  value={trancheLabel}
                  onChange={(e) => setTrancheLabel(e.target.value)}
                  placeholder="e.g. Tranche 1 (50% Advance Deposit)"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1810"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono uppercase bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20 cursor-pointer"
                  >
                    <option value="WIRE_TRANSFER">Wire Transfer (SWIFT)</option>
                    <option value="CREDIT_CARD">Credit / Debit Card</option>
                    <option value="BANK_TRANSFER">Direct Bank Deposit / NEFT</option>
                    <option value="CHEQUE">Cheque / Demand Draft</option>
                    <option value="OTHER">UPI / Corporate Account</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Transaction Reference Number / UTR / Auth Code *
                </label>
                <input
                  type="text"
                  required
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. HDFC-WIRE-JP-849201"
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono uppercase bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                />
              </div>

              {/* Upload Proof Document */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Payment Proof / Transfer Advice File (PDF / JPG / PNG) *
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 font-mono truncate">
                    {proofFile ? proofFile.name : 'No file chosen (A standard wire proof will be linked)'}
                  </span>
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Browse File</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any details regarding the remit currency, bank fees, or exchange rate."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 rounded-xl text-xs font-black shadow-md shadow-[#00C6A6]/20 cursor-pointer transition-colors"
                >
                  Submit Payment Tranche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verification Action Modal */}
      {verifyingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6">
            <h3 className="text-base font-black text-slate-900 mb-2 flex items-center gap-2">
              <div className="p-1 rounded-lg bg-teal-50 text-[#008f77]">
                <ShieldCheck className="w-5 h-5 text-[#008f77]" />
              </div>
              <span>Verify Payment: {verifyingProof.action ? verifyingProof.action.replace(/_/g, ' ') : 'VERIFY'}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating {verifyingProof.proof.trancheLabel} for {formatCurrency(verifyingProof.proof.amount, verifyingProof.proof.currency)} (Ref: {verifyingProof.proof.transactionRef}).
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Verification Notes / Remittance Reference *
              </label>
              <textarea
                rows={3}
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="e.g. Funds verified in DMC corporate bank account. Value date 2026-08-30."
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setVerifyingProof(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVerification}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer transition-colors ${
                  verifyingProof.action === 'VERIFIED' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  verifyingProof.action === 'REJECTED' ? 'bg-rose-600 hover:bg-rose-700' :
                  'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                Confirm {verifyingProof.action ? verifyingProof.action.replace(/_/g, ' ') : 'Verification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Preview Modal */}
      {activeProofPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h4 className="text-sm font-black text-slate-900">
                {activeProofPreview.title}
              </h4>
              <button
                onClick={() => setActiveProofPreview(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-auto flex items-center justify-center bg-slate-100">
              <img 
                src={activeProofPreview.url} 
                alt="Payment Proof Advice" 
                className="max-h-[60vh] max-w-full object-contain rounded-2xl shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
