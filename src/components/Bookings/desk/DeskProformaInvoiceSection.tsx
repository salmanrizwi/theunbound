import React, { useState, useMemo, useEffect } from 'react';
import {
  Booking,
  BookingInvoice,
  BookingInvoiceAuditEntry,
  BookingUploadedInvoice,
  UploadedInvoiceType,
  InvoiceAssociationType,
  InvoicePaymentStatus,
  InvoiceServiceItem,
  CurrencyCode,
  User
} from '../../../types';
import { AppDatabase } from '../../../services/db';
import { isInternalStaff, isMasterAdmin } from '../../../services/permissionEngine';
import { formatCurrency } from '../../../services/pricingEngine';
import { ProformaInvoiceModal } from '../../AdminCMS/leads/ProformaInvoiceModal';
import { ProformaPreflightError } from '../../../services/proformaInvoicePreflight';
import { ProformaGenerationErrorModal, ProformaGenerationSuccessModal } from '../../AdminCMS/invoices/ProformaGenerationModals';
import {
  downloadProformaInvoiceDocument,
  generateAndPersistProformaInvoice
} from '../../../services/proformaInvoiceService';
import {
  evaluateProformaInvoiceFreshness,
  resolveAuthoritativeProformaAmount
} from '../../../services/bookingOperationsSyncService';
import { 
  Receipt, 
  Plus, 
  Eye, 
  Edit3, 
  Printer, 
  Download, 
  Share2, 
  Mail, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Building2, 
  Calendar, 
  History, 
  X,
  Send,
  MessageCircle,
  Sparkles,
  DollarSign,
  CreditCard,
  Layers,
  UploadCloud,
  FileText,
  Trash2,
  Paperclip,
  AlertCircle,
  ArrowRight,
  FileCheck,
  RefreshCw,
  Users,
  ShieldCheck
} from 'lucide-react';

interface DeskProformaInvoiceSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['USD', 'INR', 'EUR', 'GBP', 'JPY', 'SGD', 'AED', 'AUD', 'CAD', 'THB'];

export const DeskProformaInvoiceSection: React.FC<DeskProformaInvoiceSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const isInternal = isInternalStaff(currentUser);
  const isAdmin = Boolean(
    currentUser &&
      (isMasterAdmin(currentUser) ||
        currentUser.role === 'ADMIN' ||
        (currentUser.role as string) === 'SUPER_ADMIN')
  );

  // Sub-Tab Switcher
  const [activeInvoiceTab, setActiveInvoiceTab] = useState<'proforma' | 'manual'>('proforma');

  // Modals & States for Proforma Invoices
  const [isGenerating, setIsGenerating] = useState(false);
  const [preflightError, setPreflightError] = useState<ProformaPreflightError | null>(null);
  const [successModalInvoice, setSuccessModalInvoice] = useState<BookingInvoice | null>(null);
  const [selectedInvoiceForPreview, setSelectedInvoiceForPreview] = useState<BookingInvoice | null>(null);
  const [invoiceToEdit, setInvoiceToEdit] = useState<BookingInvoice | null>(null);
  const [historyInvoice, setHistoryInvoice] = useState<BookingInvoice | null>(null);
  const [emailModalInvoice, setEmailModalInvoice] = useState<BookingInvoice | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSentNotice, setEmailSentNotice] = useState(false);

  // Full-field Edit states for Proforma Invoice
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editInvoiceDate, setEditInvoiceDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>(booking.currency || 'USD');
  const [editPaymentStatus, setEditPaymentStatus] = useState<InvoicePaymentStatus>('UNPAID');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editLeadTravelerName, setEditLeadTravelerName] = useState('');
  const [editCustomerEmail, setEditCustomerEmail] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editAgencyName, setEditAgencyName] = useState('');
  const [editBilledToGstin, setEditBilledToGstin] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editTravelDates, setEditTravelDates] = useState('');
  const [editBookingDescription, setEditBookingDescription] = useState('');
  const [editTotalPax, setEditTotalPax] = useState<number>(1);
  const [editPerPersonPrice, setEditPerPersonPrice] = useState<string>('0');
  const [editTotalAmount, setEditTotalAmount] = useState<string>('0');
  const [editRecalcMode, setEditRecalcMode] = useState<'PER_PERSON_DRIVES_TOTAL' | 'TOTAL_DRIVES_PER_PERSON'>('PER_PERSON_DRIVES_TOTAL');
  const [editSyncToBooking, setEditSyncToBooking] = useState<boolean>(true);
  const [editServices, setEditServices] = useState<InvoiceServiceItem[]>([]);
  const [editBillingAddress, setEditBillingAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTerms, setEditTerms] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editSwift, setEditSwift] = useState('');
  const [editAmendmentReason, setEditAmendmentReason] = useState('');

  // Admin Delete Proforma Modal State
  const [invoiceToDelete, setInvoiceToDelete] = useState<BookingInvoice | null>(null);
  const [deleteInvoiceReason, setDeleteInvoiceReason] = useState('');
  const [deleteInvoiceError, setDeleteInvoiceError] = useState<string | null>(null);
  const [showAuditHistoryPanel, setShowAuditHistoryPanel] = useState(false);

  // States for Manual Uploaded Invoices
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [manualInvoiceToReplace, setManualInvoiceToReplace] = useState<BookingUploadedInvoice | null>(null);
  const [manualInvoiceType, setManualInvoiceType] = useState<UploadedInvoiceType>('Supplier Invoice');
  const [manualInvoiceAssociation, setManualInvoiceAssociation] = useState<InvoiceAssociationType>('BOOKING');
  const [manualInvoiceItemId, setManualInvoiceItemId] = useState('');
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('');
  const [manualInvoiceDate, setManualInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualInvoiceCurrency, setManualInvoiceCurrency] = useState<CurrencyCode>(booking.currency || 'USD');
  const [manualInvoiceAmount, setManualInvoiceAmount] = useState('');
  const [manualInvoiceNotes, setManualInvoiceNotes] = useState('');
  
  // File Upload State
  const [uploadedFile, setUploadedFile] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');
  const [uploadedMimeType, setUploadedMimeType] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Inline UI Notices & Modals (No window.alert / window.confirm / window.prompt / window.open)
  const [localRevision, setLocalRevision] = useState(0);
  const [inlineNotice, setInlineNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [reissueTargetInvoice, setReissueTargetInvoice] = useState<BookingInvoice | null>(null);
  const [reissueReason, setReissueReason] = useState('Updated payment terms & due date');
  const [archiveTargetManualInvoice, setArchiveTargetManualInvoice] = useState<BookingUploadedInvoice | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editBankAccountName, setEditBankAccountName] = useState('');

  useEffect(() => {
    return db.subscribeToCollections(
      ['booking_invoices', 'invoices', 'bookings', 'booking_pricing_snapshots', 'booking_manual_discounts'],
      () => {
        setLocalRevision(prev => prev + 1);
      }
    );
  }, [db]);

  // Preview uploaded document
  const [previewUploadedInvoiceDoc, setPreviewUploadedInvoiceDoc] = useState<BookingUploadedInvoice | null>(null);

  // All invoices associated with this booking
  const allInvoices = useMemo(() => {
    return db.getBookingInvoices(booking.id);
  }, [
    db,
    booking.id,
    booking.updatedAt,
    booking.activeProformaInvoiceId,
    booking.proformaInvoiceIds?.length,
    booking.currentPricingSnapshotVersion,
    localRevision
  ]);

  // All uploaded manual invoices
  const uploadedInvoices = useMemo(() => {
    return db.getUploadedInvoices(booking.id).filter(i => i.status !== 'ARCHIVED');
  }, [db, booking.id, booking.updatedAt, localRevision]);

  const activeInvoice = allInvoices[0]; // Most recent
  const latestAuthoritative = useMemo(() => resolveAuthoritativeProformaAmount(booking), [
    booking,
    booking.updatedAt,
    booking.currentPricingSnapshotVersion,
    booking.totalAmount,
    localRevision
  ]);
  const activeInvoiceFreshness = useMemo(
    () => (activeInvoice ? evaluateProformaInvoiceFreshness(activeInvoice, booking, allInvoices) : null),
    [activeInvoice, booking, allInvoices]
  );
  const needsRevisedProforma = Boolean(
    booking.hasRevisedPricingAfterInvoice || (activeInvoiceFreshness && activeInvoiceFreshness.isOutdated)
  );

  const serviceItems = useMemo(() => {
    return db.normalizeServiceItems(booking.items || [], booking);
  }, [db, booking]);

  // Combined immutable Proforma Invoice Audit History (includes created, edited, PAX recalculated, reissued & deleted records)
  const combinedAuditHistory = useMemo<BookingInvoiceAuditEntry[]>(() => {
    const map = new Map<string, BookingInvoiceAuditEntry>();
    (booking.proformaInvoiceAuditHistory || []).forEach(entry => {
      if (entry?.id) map.set(entry.id, entry);
    });
    allInvoices.forEach(inv => {
      (inv.auditHistory || []).forEach(entry => {
        if (entry?.id && !map.has(entry.id)) map.set(entry.id, entry);
      });
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
  }, [booking.proformaInvoiceAuditHistory, allInvoices, localRevision]);

  const handleGenerateInvoice = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setInlineNotice(null);
    try {
      const forceRegenerate = allInvoices.length > 0;
      const res = await generateAndPersistProformaInvoice(booking.id, currentUser, {
        forceRegenerate
      });
      if (res.success && res.invoice) {
        setLocalRevision(prev => prev + 1);
        setSuccessModalInvoice(res.invoice);
        setInlineNotice({
          type: 'success',
          message: `Proforma Invoice #${res.invoice.invoiceNumber} (v${res.invoice.invoiceVersion || 1}) generated and persisted${res.storagePersisted ? ' to Firebase Storage & Firestore' : ' to Firestore'}.`
        });
        onRefresh();
      } else {
        setPreflightError(
          res.error || {
            code: 'UNKNOWN_ERROR',
            title: 'Invoice Generation Failed',
            message: 'The system could not generate the Proforma Invoice.',
            missingRequirements: ['Valid booking pricing data'],
            actionableInstruction: 'Please check your connection or contact Admin support.',
            bookingId: booking.id
          }
        );
      }
    } catch (err: any) {
      setPreflightError({
        code: 'UNKNOWN_ERROR',
        title: 'Execution Error During Invoice Generation',
        message: err?.message || 'An unexpected error occurred during Proforma Invoice creation.',
        missingRequirements: ['Valid booking record'],
        actionableInstruction: 'Please refresh the page and try again.',
        bookingId: booking.id
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetManualInvoiceForm = () => {
    setManualInvoiceToReplace(null);
    setManualInvoiceType('Supplier Invoice');
    setManualInvoiceAssociation('BOOKING');
    setManualInvoiceItemId('');
    setManualInvoiceNumber('');
    setManualInvoiceDate(new Date().toISOString().split('T')[0]);
    setManualInvoiceCurrency(booking.currency || 'USD');
    setManualInvoiceAmount('');
    setManualInvoiceNotes('');
    setUploadedFile('');
    setUploadedFileName('');
    setUploadedFileSize('');
    setUploadedMimeType('');
    setUploadError(null);
  };

  const handleOpenUploadModal = () => {
    resetManualInvoiceForm();
    setIsUploadModalOpen(true);
  };

  const handleOpenReplaceModal = (inv: BookingUploadedInvoice) => {
    setManualInvoiceToReplace(inv);
    setManualInvoiceType(inv.invoiceType);
    setManualInvoiceAssociation(inv.associationType);
    setManualInvoiceItemId(inv.bookingItemId || '');
    setManualInvoiceNumber(inv.invoiceNumber);
    setManualInvoiceDate(inv.invoiceDate || new Date().toISOString().split('T')[0]);
    setManualInvoiceCurrency(inv.currency);
    setManualInvoiceAmount(String(inv.amount || ''));
    setManualInvoiceNotes(inv.notes || '');
    setUploadedFile(inv.uploadedFile || '');
    setUploadedFileName(inv.uploadedFileName || '');
    setUploadedFileSize(inv.fileSize || '');
    setUploadedMimeType(inv.mimeType || 'application/pdf');
    setUploadError(null);
    setIsUploadModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds maximum 10MB limit.');
      return;
    }

    setUploadError(null);
    setUploadedFileName(file.name);
    setUploadedFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    setUploadedMimeType(file.type || 'application/pdf');

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedFile(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveManualInvoiceUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) {
      setUploadError('Please attach an invoice document file.');
      return;
    }
    if (!manualInvoiceNumber.trim()) {
      setUploadError('Invoice number is required.');
      return;
    }
    if (!manualInvoiceAmount || Number(manualInvoiceAmount) <= 0) {
      setUploadError('Valid invoice amount is required.');
      return;
    }

    try {
      const now = new Date().toISOString();
      if (manualInvoiceToReplace) {
        db.replaceUploadedInvoice(
          manualInvoiceToReplace.id,
          {
            invoiceType: manualInvoiceType,
            associationType: manualInvoiceAssociation,
            invoiceNumber: manualInvoiceNumber.trim(),
            invoiceDate: manualInvoiceDate,
            currency: manualInvoiceCurrency,
            amount: Number(manualInvoiceAmount),
            uploadedFile,
            uploadedFileName,
            fileSize: uploadedFileSize,
            mimeType: uploadedMimeType,
            notes: manualInvoiceNotes,
            bookingItemId: manualInvoiceAssociation === 'SERVICE_ITEM' ? manualInvoiceItemId : undefined
          },
          currentUser
        );
      } else {
        const newInvoice: BookingUploadedInvoice = {
          id: `up-inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          invoiceId: `inv-man-${Date.now()}`,
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
          bookingItemId: manualInvoiceAssociation === 'SERVICE_ITEM' ? manualInvoiceItemId : undefined,
          associationType: manualInvoiceAssociation,
          invoiceType: manualInvoiceType,
          invoiceNumber: manualInvoiceNumber.trim(),
          invoiceDate: manualInvoiceDate || now.split('T')[0],
          currency: manualInvoiceCurrency,
          amount: Number(manualInvoiceAmount),
          uploadedFile,
          uploadedFileName,
          fileSize: uploadedFileSize,
          mimeType: uploadedMimeType,
          uploadedBy: currentUser?.id || 'admin',
          uploadedByName: currentUser?.name || 'Operations Staff',
          uploadedAt: now,
          status: 'ACTIVE',
          notes: manualInvoiceNotes,
          history: [{
            action: 'UPLOAD',
            timestamp: now,
            actor: currentUser?.name || 'Operations Staff',
            note: 'Manual invoice document uploaded'
          }]
        };
        db.saveUploadedInvoice(newInvoice, currentUser);
      }

      setIsUploadModalOpen(false);
      resetManualInvoiceForm();
      onRefresh();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to save manual invoice document');
    }
  };

  const handleArchiveManualInvoice = (inv: BookingUploadedInvoice) => {
    setArchiveTargetManualInvoice(inv);
  };

  const confirmArchiveManualInvoice = () => {
    if (!archiveTargetManualInvoice) return;
    db.archiveUploadedInvoice(archiveTargetManualInvoice.id, 'Removed by authorized staff', currentUser);
    setArchiveTargetManualInvoice(null);
    setLocalRevision(prev => prev + 1);
    setInlineNotice({
      type: 'success',
      message: `Archived manual invoice #${archiveTargetManualInvoice.invoiceNumber}.`
    });
    onRefresh();
  };

  const openEditModal = (inv: BookingInvoice) => {
    const profile = db.getCentralCompanyProfile();
    const initPax = Math.max(1, Number(inv.totalPax || booking.customer?.totalPax || 1));
    const initTotal = Math.round(Number(inv.proformaFinalBookingAmount ?? inv.totalAmount ?? 0) * 100) / 100;
    const initPerPerson =
      typeof inv.perPersonPrice === 'number' && inv.perPersonPrice > 0
        ? Math.round(inv.perPersonPrice * 100) / 100
        : Math.round((initTotal / initPax) * 100) / 100;

    setInvoiceToEdit(inv);
    setEditInvoiceNumber(inv.invoiceNumber || '');
    setEditInvoiceDate(inv.invoiceDate || new Date().toISOString().split('T')[0]);
    setEditDueDate(inv.dueDate || '');
    setEditCurrency(inv.currency || booking.currency || 'USD');
    setEditPaymentStatus(inv.paymentStatus || 'UNPAID');
    setEditCustomerName(inv.customerName || booking.customer?.leadTravelerName || '');
    setEditLeadTravelerName(inv.leadTravelerName || booking.customer?.leadTravelerName || inv.customerName || '');
    setEditCustomerEmail(inv.customerEmail || booking.customer?.email || '');
    setEditCustomerPhone(inv.customerPhone || booking.customer?.phone || '');
    setEditAgencyName(inv.agencyName || inv.billedToAgency || booking.agencyName || '');
    setEditBilledToGstin(inv.billedToGstin || '');
    setEditDestination(inv.destination || booking.destinationName || '');
    setEditTravelDates(
      inv.travelDates ||
        (booking.travelStartDate ? `${booking.travelStartDate} to ${booking.travelEndDate || ''}`.trim() : '')
    );
    setEditBookingDescription(inv.bookingDescription || '');
    setEditTotalPax(initPax);
    setEditPerPersonPrice(String(initPerPerson));
    setEditTotalAmount(String(initTotal));
    setEditRecalcMode('PER_PERSON_DRIVES_TOTAL');
    setEditSyncToBooking(true);
    setEditServices(
      (inv.services && inv.services.length > 0 ? inv.services : []).map((srv, idx) => ({
        ...srv,
        id: srv.id || `srv-${idx + 1}`,
        pax: srv.pax || initPax,
        quantity: srv.quantity || srv.pax || initPax
      }))
    );
    setEditBillingAddress(inv.billingAddress || (inv as any).customerAddress || `${inv.customerName}\n${inv.agencyName || ''}`);
    setEditNotes(inv.notes || '');
    setEditTerms(inv.terms || '');
    setEditBankName(inv.bankAccountDetails?.bankName || profile.bankDetails?.bankName || '');
    setEditBankAccountName(inv.bankAccountDetails?.accountName || profile.bankDetails?.accountName || profile.legalName || profile.companyName || '');
    setEditBankAccount(inv.bankAccountDetails?.accountNumber || profile.bankDetails?.accountNumber || '');
    setEditSwift(inv.bankAccountDetails?.swiftBic || profile.bankDetails?.swiftBic || '');
    setEditAmendmentReason('');
    setEditError(null);
  };

  const handleEditPaxChange = (rawVal: string) => {
    const parsed = Math.max(1, Math.floor(Number(rawVal) || 1));
    setEditTotalPax(parsed);
    if (editRecalcMode === 'PER_PERSON_DRIVES_TOTAL') {
      const pp = Number(editPerPersonPrice) || 0;
      const newTot = Math.round(pp * parsed * 100) / 100;
      setEditTotalAmount(String(newTot));
    } else {
      const tot = Number(editTotalAmount) || 0;
      const newPp = Math.round((tot / parsed) * 100) / 100;
      setEditPerPersonPrice(String(newPp));
    }
    setEditServices(prev => prev.map(srv => ({ ...srv, pax: parsed, quantity: parsed })));
  };

  const handleEditPerPersonChange = (rawVal: string) => {
    setEditPerPersonPrice(rawVal);
    setEditRecalcMode('PER_PERSON_DRIVES_TOTAL');
    const pp = Number(rawVal);
    if (Number.isFinite(pp) && pp >= 0) {
      const newTot = Math.round(pp * Math.max(1, editTotalPax) * 100) / 100;
      setEditTotalAmount(String(newTot));
    }
  };

  const handleEditTotalAmountChange = (rawVal: string) => {
    setEditTotalAmount(rawVal);
    setEditRecalcMode('TOTAL_DRIVES_PER_PERSON');
    const tot = Number(rawVal);
    if (Number.isFinite(tot) && tot >= 0) {
      const newPp = Math.round((tot / Math.max(1, editTotalPax)) * 100) / 100;
      setEditPerPersonPrice(String(newPp));
    }
  };

  const handleSaveInvoiceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceToEdit) return;
    setEditError(null);

    if (!editAmendmentReason.trim()) {
      setEditError('Please enter a reason for this Proforma Invoice update (required for audit history).');
      return;
    }

    const hasBankInput = Boolean(editBankName.trim() || editBankAccount.trim() || editSwift.trim());
    const bankAccountDetails = hasBankInput
      ? {
          bankName: editBankName.trim(),
          accountName:
            editBankAccountName.trim() ||
            db.getCentralCompanyProfile().legalName ||
            db.getCentralCompanyProfile().companyName ||
            '',
          accountNumber: editBankAccount.trim(),
          swiftBic: editSwift.trim()
        }
      : undefined;

    const res = db.editProformaInvoiceFull(
      booking.id,
      invoiceToEdit.id,
      {
        invoiceNumber: isAdmin ? editInvoiceNumber.trim() : invoiceToEdit.invoiceNumber,
        invoiceDate: editInvoiceDate,
        dueDate: editDueDate,
        currency: isAdmin ? editCurrency : invoiceToEdit.currency,
        paymentStatus: isAdmin ? editPaymentStatus : invoiceToEdit.paymentStatus,
        customerName: editCustomerName.trim(),
        leadTravelerName: editLeadTravelerName.trim(),
        customerEmail: editCustomerEmail.trim(),
        customerPhone: editCustomerPhone.trim(),
        billedToAgency: editAgencyName.trim(),
        agencyName: editAgencyName.trim(),
        billedToGstin: editBilledToGstin.trim() || undefined,
        destination: editDestination.trim(),
        travelDates: editTravelDates.trim(),
        bookingDescription: editBookingDescription.trim() || undefined,
        totalPax: isAdmin ? Math.max(1, Math.floor(editTotalPax)) : invoiceToEdit.totalPax,
        perPersonPrice: isAdmin ? Number(editPerPersonPrice) : invoiceToEdit.perPersonPrice,
        totalAmount: isAdmin ? Number(editTotalAmount) : invoiceToEdit.totalAmount,
        recalcMode: editRecalcMode,
        services: editServices,
        billingAddress: editBillingAddress,
        notes: editNotes,
        terms: editTerms,
        bankAccountDetails,
        syncToBooking: isAdmin ? editSyncToBooking : false
      },
      currentUser,
      editAmendmentReason.trim()
    );

    if (res.success && res.invoice) {
      setInvoiceToEdit(null);
      setLocalRevision(prev => prev + 1);
      setInlineNotice({
        type: 'success',
        message: `Updated Proforma Invoice #${res.invoice.invoiceNumber} (v${res.invoice.invoiceVersion || 1}) — ${res.invoice.totalPax} PAX • ${formatCurrency(res.invoice.proformaFinalBookingAmount ?? res.invoice.totalAmount, res.invoice.currency)} synced across booking records.`
      });
      onRefresh();
    } else {
      setEditError(res.error || 'Failed to update Proforma Invoice.');
    }
  };

  const handleConfirmDeleteProforma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceToDelete) return;
    if (!deleteInvoiceReason.trim()) {
      setDeleteInvoiceError('Please provide an audit reason for deleting this Proforma Invoice.');
      return;
    }
    const res = db.deleteProformaInvoice(
      booking.id,
      invoiceToDelete.id,
      currentUser,
      deleteInvoiceReason.trim()
    );
    if (res.success) {
      setInvoiceToDelete(null);
      setDeleteInvoiceReason('');
      setDeleteInvoiceError(null);
      setLocalRevision(prev => prev + 1);
      setInlineNotice({
        type: 'success',
        message: `Deleted Proforma Invoice #${res.deletedInvoiceNumber}. Permanent deletion record preserved in Invoice Audit History.`
      });
      onRefresh();
    } else {
      setDeleteInvoiceError(res.error || 'Failed to delete Proforma Invoice.');
    }
  };

  const handleReissueInvoice = (inv: BookingInvoice) => {
    setReissueTargetInvoice(inv);
    setReissueReason('Updated payment terms & due date');
  };

  const confirmReissueInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reissueTargetInvoice || !reissueReason.trim()) return;
    const res = await generateAndPersistProformaInvoice(booking.id, currentUser, {
      forceRegenerate: true,
      reason: reissueReason.trim()
    });
    if (res.success && res.invoice) {
      setReissueTargetInvoice(null);
      setLocalRevision(prev => prev + 1);
      setInlineNotice({
        type: 'success',
        message: `Reissued Proforma Invoice #${res.invoice.invoiceNumber} (v${res.invoice.invoiceVersion || 1}). Prior version remains preserved.`
      });
      onRefresh();
    } else {
      setInlineNotice({
        type: 'error',
        message: res.error?.message || 'Failed to reissue Proforma Invoice.'
      });
      setReissueTargetInvoice(null);
    }
  };

  const openEmailModal = (inv: BookingInvoice) => {
    const profile = db.getCentralCompanyProfile();
    const companyName = profile.companyName || profile.legalName || 'Commercial Desk';
    const bankInfo = inv.bankAccountDetails || profile.bankDetails;
    const paymentSection =
      bankInfo && (bankInfo.bankName || bankInfo.accountNumber)
        ? `\nPAYMENT INSTRUCTIONS:\nBank Name: ${bankInfo.bankName || 'N/A'}\nAccount Name: ${bankInfo.accountName || companyName}\nAccount Number: ${bankInfo.accountNumber || 'N/A'}${bankInfo.swiftBic ? `\nSWIFT / BIC: ${bankInfo.swiftBic}` : ''}\n`
        : '\nPAYMENT INSTRUCTIONS:\nPlease remit per agreed commercial wire instructions on file with our accounts desk.\n';

    setEmailModalInvoice(inv);
    setEmailRecipient(inv.customerEmail || booking.customer?.email || booking.agentEmailSnapshot || '');
    setEmailSubject(`Proforma Invoice #${inv.invoiceNumber} - Booking #${booking.bookingReference}`);
    setEmailBody(
`Dear ${inv.customerName || 'Valued Partner'},

Please find your preliminary Proforma Invoice #${inv.invoiceNumber} (v${inv.invoiceVersion || 1}) for Booking #${booking.bookingReference}.

COMMERCIAL SUMMARY:
• Proforma Reference: ${inv.invoiceNumber}
• Date: ${inv.invoiceDate}
• Due Date: ${inv.dueDate}
• Final Booking Amount: ${inv.currency} ${(inv.proformaFinalBookingAmount ?? inv.totalAmount).toLocaleString()}
• Amount Paid: ${inv.currency} ${inv.amountPaid.toLocaleString()}
• Balance Due: ${inv.currency} ${inv.balanceDue.toLocaleString()}
${paymentSection}
Note: This Proforma Invoice is a preliminary commercial billing document and not a statutory tax invoice.

Warm regards,
${companyName}`
    );
    setEmailSentNotice(false);
  };

  const handleSendEmail = () => {
    if (emailModalInvoice) {
      db.recordBookingActivity({
        eventId: `act-email-inv-${Date.now()}`,
        bookingId: booking.id,
        eventType: 'STATUS_UPDATED',
        actorId: currentUser?.id || 'admin',
        actorRole: currentUser?.role || 'FINANCE',
        actorName: currentUser?.name || 'Finance Lead',
        timestamp: new Date().toISOString(),
        metadata: { recipient: emailRecipient, invoiceNumber: emailModalInvoice.invoiceNumber },
        description: `Dispatched Proforma Invoice #${emailModalInvoice.invoiceNumber} to ${emailRecipient}`
      }, currentUser);
    }
    setEmailSentNotice(true);
    setTimeout(() => {
      setEmailModalInvoice(null);
      setEmailSentNotice(false);
      onRefresh();
    }, 1200);
  };

  const handleShareWhatsApp = async (inv: BookingInvoice) => {
    const profile = db.getCentralCompanyProfile();
    const bankInfo = inv.bankAccountDetails || profile.bankDetails;
    const bankLine =
      bankInfo && (bankInfo.bankName || bankInfo.accountNumber)
        ? `\nBank: ${bankInfo.bankName || 'N/A'} | A/C: ${bankInfo.accountNumber || 'N/A'}`
        : '';
    const text = `*Proforma Invoice (Preliminary Commercial Document)*\n` +
      `Proforma Ref: *#${inv.invoiceNumber}* (v${inv.invoiceVersion || 1})\n` +
      `Booking Ref: *#${booking.bookingReference}*\n` +
      `Client: ${inv.customerName}\n` +
      `Final Booking Amount: *${inv.currency} ${(inv.proformaFinalBookingAmount ?? inv.totalAmount).toLocaleString()}*\n` +
      `Amount Paid: *${inv.currency} ${inv.amountPaid.toLocaleString()}*\n` +
      `Balance Due: *${inv.currency} ${inv.balanceDue.toLocaleString()}*\n` +
      `Payment Due Date: ${inv.dueDate}${bankLine}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setInlineNotice({
          type: 'success',
          message: `Copied Proforma #${inv.invoiceNumber} summary to clipboard for WhatsApp sharing.`
        });
      } else {
        setInlineNotice({
          type: 'success',
          message: `Prepared Proforma #${inv.invoiceNumber} commercial summary for sharing.`
        });
      }
    } catch {
      setInlineNotice({
        type: 'error',
        message: 'Could not copy to clipboard automatically. Use Email Dispatch to copy the commercial summary.'
      });
    }
  };

  return (
    <div id="desk-proforma-invoice-section" className="space-y-6">
      {inlineNotice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            inlineNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="font-semibold">{inlineNotice.message}</span>
          <button
            type="button"
            onClick={() => setInlineNotice(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        <button
          onClick={() => setActiveInvoiceTab('proforma')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeInvoiceTab === 'proforma'
              ? 'bg-[#008f77] text-white shadow-2xs'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>System-Generated Proforma Invoices ({allInvoices.length})</span>
        </button>

        <button
          onClick={() => setActiveInvoiceTab('manual')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeInvoiceTab === 'manual'
              ? 'bg-[#008f77] text-white shadow-2xs'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Manual Uploaded Invoices ({uploadedInvoices.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: SYSTEM-GENERATED PROFORMA INVOICES */}
      {activeInvoiceTab === 'proforma' && (
        <div className="space-y-6">
          {needsRevisedProforma && isInternal && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Booking Pricing Revised After Earlier Proforma Invoice (Snapshot v{latestAuthoritative.sourcePricingSnapshotVersion})
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {activeInvoiceFreshness?.reason ||
                      booking.revisedPricingNotice ||
                      `Previously issued proforma invoices remain preserved and immutable. Current authoritative Final Booking Amount is ${formatCurrency(latestAuthoritative.finalBookingAmount, latestAuthoritative.currency)}. Issue a Revised Proforma Invoice reflecting the latest committed snapshot.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateInvoice}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Generate Revised Proforma Invoice</span>
              </button>
            </div>
          )}
          {/* Top Banner */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" />
                  Authoritative Proforma Billing
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-xs text-slate-500 font-bold">
                  {allInvoices.length} Invoices Generated
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-xs text-teal-700 font-bold">
                  Current Booking Total: {formatCurrency(latestAuthoritative.finalBookingAmount, latestAuthoritative.currency)} (Snap v{latestAuthoritative.sourcePricingSnapshotVersion})
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Proforma Invoices & Commercial Accounts
              </h2>
              <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
                Auto-generated from authoritative committed booking pricing snapshots. Historical issued versions remain strictly immutable and are marked outdated if a later discount or pricing revision occurs.
              </p>
            </div>

            {isInternal && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowAuditHistoryPanel(prev => !prev)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                    showAuditHistoryPanel
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Audit History ({combinedAuditHistory.length})</span>
                </button>
                <button
                  onClick={handleGenerateInvoice}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                    isGenerating ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Proforma...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {needsRevisedProforma
                          ? 'Generate Revised Proforma Invoice'
                          : allInvoices.length > 0
                            ? 'Generate New Proforma Version'
                            : 'Generate Proforma Invoice'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Permanent Proforma Invoice Audit History Panel */}
          {showAuditHistoryPanel && (
            <div className="bg-white rounded-3xl p-5 border border-purple-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    Proforma Invoice Audit Trail ({combinedAuditHistory.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuditHistoryPanel(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {combinedAuditHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No proforma invoice audit events recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {combinedAuditHistory.map(entry => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              entry.action === 'DELETED'
                                ? 'bg-rose-100 text-rose-800'
                                : entry.action === 'PAX_RECALCULATED'
                                ? 'bg-indigo-100 text-indigo-800'
                                : entry.action === 'CREATED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {entry.action.replace('_', ' ')}
                          </span>
                          <span className="font-mono font-bold text-slate-900">#{entry.invoiceNumber}</span>
                          <span className="text-slate-500">by {entry.actorName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {entry.reason && <p className="text-slate-700">{entry.reason}</p>}
                      {(entry.previousPax !== undefined || entry.newPax !== undefined || entry.previousAmount !== undefined || entry.newAmount !== undefined) && (
                        <div className="flex flex-wrap gap-3 text-[11px] font-mono text-slate-600 pt-0.5">
                          {entry.previousPax !== undefined && entry.newPax !== undefined && entry.previousPax !== entry.newPax && (
                            <span>PAX: {entry.previousPax} → {entry.newPax}</span>
                          )}
                          {entry.previousAmount !== undefined && entry.newAmount !== undefined && entry.previousAmount !== entry.newAmount && (
                            <span>
                              Amount: {formatCurrency(entry.previousAmount, entry.currency || booking.currency)} →{' '}
                              {formatCurrency(entry.newAmount, entry.currency || booking.currency)}
                            </span>
                          )}
                          {entry.action === 'DELETED' && entry.previousAmount !== undefined && (
                            <span className="text-rose-700">
                              Deleted Amount: {formatCurrency(entry.previousAmount, entry.currency || booking.currency)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Invoice List */}
          {allInvoices.length > 0 ? (
            <div className="space-y-4">
              {allInvoices.map((invoice, idx) => {
                const isLatest = idx === 0;
                const freshness = evaluateProformaInvoiceFreshness(invoice, booking, allInvoices);
                const isPaid = invoice.paymentStatus === 'PAID';
                const isPartiallyPaid = invoice.paymentStatus === 'PARTIALLY_PAID';

                return (
                  <div
                    key={invoice.id}
                    className={`bg-white rounded-3xl border p-6 shadow-xs space-y-5 transition-all ${
                      isLatest && !freshness.isOutdated
                        ? 'border-teal-300 ring-1 ring-teal-200'
                        : freshness.isOutdated && isLatest
                          ? 'border-amber-300 ring-1 ring-amber-200'
                          : 'border-slate-200 opacity-90'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-black">
                          <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-black text-slate-900 font-mono">
                              #{invoice.invoiceNumber}
                            </h3>
                            {invoice.invoiceVersion && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 font-mono">
                                v{invoice.invoiceVersion}
                              </span>
                            )}
                            {isLatest && !freshness.isOutdated && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 uppercase tracking-wider">
                                Active Proforma (Current)
                              </span>
                            )}
                            {freshness.statusLabel === 'OUTDATED_PRICING' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider">
                                Outdated • Snap v{freshness.invoiceSnapshotVersion} vs v{freshness.latestSnapshotVersion}
                              </span>
                            )}
                            {freshness.statusLabel === 'SUPERSEDED' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 uppercase tracking-wider">
                                Superseded • Immutable v{invoice.invoiceVersion || 1}
                              </span>
                            )}
                            {invoice.storagePath && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                Stored PDF
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            Issued {invoice.invoiceDate} • Due {invoice.dueDate} • Preliminary Commercial Document (Non-Tax Invoice)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          isPaid ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                          isPartiallyPaid ? 'bg-blue-50 text-blue-800 border-blue-300' :
                          'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                          {invoice.paymentStatus || 'PENDING_PAYMENT'}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            void downloadProformaInvoiceDocument(invoice, booking, db.getCentralCompanyProfile());
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#008972] hover:bg-[#007360] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Download Official Proforma Invoice PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceForPreview(invoice)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>

                        {isInternal && (
                          <button
                            type="button"
                            onClick={() => openEditModal(invoice)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openEmailModal(invoice)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                          title="Email Invoice"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => { void handleShareWhatsApp(invoice); }}
                          className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all cursor-pointer"
                          title="Copy Commercial Summary for WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>

                        {isInternal && (
                          <button
                            type="button"
                            onClick={() => handleReissueInvoice(invoice)}
                            className="p-2 rounded-xl text-purple-600 hover:bg-purple-50 transition-all cursor-pointer"
                            title="Reissue Proforma Invoice (New Version)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {((invoice.versionHistory && invoice.versionHistory.length > 0) ||
                          (invoice.auditHistory && invoice.auditHistory.length > 0)) && (
                          <button
                            type="button"
                            onClick={() => setHistoryInvoice(invoice)}
                            className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 transition-all cursor-pointer"
                            title="Version & Audit History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setInvoiceToDelete(invoice);
                              setDeleteInvoiceReason('');
                              setDeleteInvoiceError(null);
                            }}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all cursor-pointer"
                            title="Delete Proforma Invoice (Admin Only)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Authoritative Proforma Commercial Summary — Immutable Snapshot Amount Only */}
                    {(() => {
                      // Always display this Proforma Invoice's own immutable snapshot amount so historical versions stay intact
                      const displayFinalAmount = Number(invoice.proformaFinalBookingAmount ?? invoice.totalAmount ?? 0);
                      const displayPaid = Number(invoice.amountPaid ?? invoice.paidAmount ?? 0);
                      const displayBalance = Math.max(0, Math.round((displayFinalAmount - displayPaid) * 100) / 100);
                      const displayCredit = Math.max(0, Math.round((displayPaid - displayFinalAmount) * 100) / 100);
                      const displayCurrency = invoice.currency || booking.currency;
                      const displaySnap =
                        invoice.sourcePricingSnapshotId || `SNAP-v${invoice.sourcePricingSnapshotVersion || 1}`;
                      return (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800">
                              <span className="text-[10px] font-bold text-teal-300 uppercase block">Final Booking Amount</span>
                              <span className="text-base font-black text-white font-mono mt-0.5 block">
                                {formatCurrency(displayFinalAmount, displayCurrency)}
                              </span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Amount Paid</span>
                              <span className="text-sm font-black text-emerald-700 font-mono mt-0.5 block">
                                {formatCurrency(displayPaid, displayCurrency)}
                              </span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                {displayCredit > 0 ? 'Balance / Credit' : 'Balance Due'}
                              </span>
                              <span className={`text-sm font-black font-mono mt-0.5 block ${displayCredit > 0 ? 'text-indigo-700' : displayBalance > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                                {displayCredit > 0
                                  ? `Credit ${formatCurrency(displayCredit, displayCurrency)}`
                                  : formatCurrency(displayBalance, displayCurrency)}
                              </span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">PAX & Per-Person Rate</span>
                              <span className="text-xs font-black text-slate-800 font-mono mt-1 block">
                                {Math.max(1, Number(invoice.totalPax || booking.customer?.totalPax || 1))} PAX •{' '}
                                {formatCurrency(
                                  typeof invoice.perPersonPrice === 'number' && invoice.perPersonPrice > 0
                                    ? invoice.perPersonPrice
                                    : Math.round((displayFinalAmount / Math.max(1, Number(invoice.totalPax || booking.customer?.totalPax || 1))) * 100) / 100,
                                  displayCurrency
                                )}
                                /pax
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono truncate block" title={displaySnap}>
                                {displaySnap} (v{invoice.sourcePricingSnapshotVersion || 1})
                              </span>
                            </div>
                          </div>
                          {freshness.reason && (
                            <p className="text-[11px] text-amber-800 bg-amber-50/70 border border-amber-200 rounded-xl px-3 py-2">
                              {freshness.reason}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Descriptive Booked Services Scope (No Tax/Service Fee/Itemized Margin Breakdown) */}
                    <div className="text-xs space-y-2">
                      <div className="flex items-center justify-between text-slate-500 font-bold uppercase text-[10px]">
                        <span>Booked Services Scope ({invoice.services?.length || 0})</span>
                        <span>Proforma Invoice • Consolidated Final Amount</span>
                      </div>

                      <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                        {((invoice.services && invoice.services.length > 0) ? invoice.services : (invoice.items || [])).map((srv: any, sIdx: number) => (
                          <div key={srv.id || sIdx} className="p-3 bg-white flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800">{srv.description || srv.serviceName || srv.productName || 'Travel Ground Service'}</span>
                              <span className="text-[10px] text-slate-400 block">
                                {srv.category || 'SERVICE'} • Date: {srv.serviceDate || srv.travelDate || 'Scheduled'}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-slate-600 text-[11px]">
                              {srv.pax || srv.quantity || 1} Pax
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-black text-slate-900">No Proforma Invoice Generated</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Generate the authoritative commercial proforma invoice in native currency directly from the booking line items.
                </p>
              </div>
              {isInternal && (
                <button
                  onClick={handleGenerateInvoice}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Proforma Invoice Now</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: MANUAL UPLOADED INVOICES */}
      {activeInvoiceTab === 'manual' && (
        <div className="space-y-6">
          {/* Manual Invoice Header */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4" />
                  Manual Invoice Repository
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-xs text-slate-500 font-bold">
                  {uploadedInvoices.length} Documents Uploaded
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                External & Supplier Manual Invoices
              </h2>
              <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
                Upload and manage actual supplier invoice documents, tax invoices, and external receipts attached to this booking or specific service items.
              </p>
            </div>

            {isInternal && (
              <button
                onClick={handleOpenUploadModal}
                className="px-4 py-2.5 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold transition-all flex items-center shadow-xs cursor-pointer"
              >
                <span>Upload Manual Invoice</span>
              </button>
            )}
          </div>

          {/* Manual Invoice Cards List */}
          {uploadedInvoices.length > 0 ? (
            <div className="space-y-4">
              {uploadedInvoices.map((inv) => (
                <div key={inv.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-slate-900 font-mono">
                            #{inv.invoiceNumber}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                            {inv.invoiceType}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                            {inv.associationType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Uploaded on {new Date(inv.uploadedAt).toLocaleDateString()} by {inv.uploadedByName || 'Operations Staff'}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {inv.uploadedFile && (
                        <button
                          onClick={() => setPreviewUploadedInvoiceDoc(inv)}
                          className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#008f77] border border-teal-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Document</span>
                        </button>
                      )}

                      {inv.uploadedFile && (
                        <a
                          href={inv.uploadedFile}
                          download={inv.uploadedFileName || `Invoice-${inv.invoiceNumber}.pdf`}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Download Invoice File"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      )}

                      {isInternal && (
                        <button
                          onClick={() => handleOpenReplaceModal(inv)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Replace Document File"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Replace</span>
                        </button>
                      )}

                      {isInternal && (
                        <button
                          onClick={() => handleArchiveManualInvoice(inv)}
                          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                          title="Remove Manual Invoice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Document Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Amount</span>
                      <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                        {inv.currency} {Number(inv.amount || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Invoice Date</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                        {inv.invoiceDate || 'N/A'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Attached File Document</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Paperclip className="w-4 h-4 text-[#008f77] shrink-0" />
                        <span className="font-bold text-slate-800 truncate font-mono text-xs">
                          {inv.uploadedFileName || 'Invoice-Document.pdf'}
                        </span>
                        {inv.fileSize && (
                          <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                            {inv.fileSize}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {inv.notes && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                      <strong className="text-slate-800">Operational Remarks:</strong> {inv.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4">
              <UploadCloud className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-black text-slate-900">No Manual Invoices Uploaded</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Upload external supplier invoices, tax receipts, or commercial documents directly into the booking ledger.
                </p>
              </div>
              {isInternal && (
                <button
                  onClick={handleOpenUploadModal}
                  className="px-5 py-2.5 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold transition-all inline-flex items-center cursor-pointer shadow-xs"
                >
                  <span>Upload Manual Invoice Document</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {/* MODAL 1: Preview Proforma Invoice */}
      {selectedInvoiceForPreview && (
        <ProformaInvoiceModal
          invoice={selectedInvoiceForPreview}
          booking={booking}
          onClose={() => setSelectedInvoiceForPreview(null)}
        />
      )}

      {/* MODAL 2: Full-Field Admin Edit Proforma Invoice */}
      {invoiceToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveInvoiceEdit}
            className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 my-8 border border-slate-200 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-teal-600" />
                  <span>Edit Proforma Invoice #{invoiceToEdit.invoiceNumber}</span>
                  {isAdmin && (
                    <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-black uppercase">
                      Admin Full Edit
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Modify commercial fields, PAX count (with live per-person &amp; total recalculation), client/agency details, services, bank instructions, and terms.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceToEdit(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                {editError}
              </div>
            )}

            {/* Block 1: Invoice Identity & Commercial Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Invoice Number</label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={editInvoiceNumber}
                  onChange={e => setEditInvoiceNumber(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border border-slate-200 font-mono ${!isAdmin ? 'bg-slate-100 text-slate-500' : ''}`}
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Issue Date</label>
                <input
                  type="date"
                  required
                  value={editInvoiceDate}
                  onChange={e => setEditInvoiceDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Due Date</label>
                <input
                  type="date"
                  required
                  value={editDueDate}
                  onChange={e => setEditDueDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Currency</label>
                <select
                  disabled={!isAdmin}
                  value={editCurrency}
                  onChange={e => setEditCurrency(e.target.value as CurrencyCode)}
                  className={`w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold ${!isAdmin ? 'bg-slate-100 text-slate-500' : ''}`}
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Block 2: PAX & Live Pricing Recalculation (Admin) */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-teal-300">
                  <Users className="w-4 h-4" />
                  <span>PAX &amp; Live Pricing Recalculation</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEditRecalcMode('PER_PERSON_DRIVES_TOTAL')}
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                        editRecalcMode === 'PER_PERSON_DRIVES_TOTAL'
                          ? 'bg-teal-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      PAX × Per-Person → Total
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditRecalcMode('TOTAL_DRIVES_PER_PERSON')}
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                        editRecalcMode === 'TOTAL_DRIVES_PER_PERSON'
                          ? 'bg-teal-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Total ÷ PAX → Per-Person
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">PAX (Passenger Count) *</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    disabled={!isAdmin}
                    value={editTotalPax}
                    onChange={e => handleEditPaxChange(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-mono font-black text-sm ${
                      isAdmin
                        ? 'bg-white text-slate-900 border-teal-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Per-Person Rate ({editCurrency})</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={!isAdmin}
                    value={editPerPersonPrice}
                    onChange={e => handleEditPerPersonChange(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold text-sm ${
                      isAdmin
                        ? 'bg-white text-slate-900 border-slate-300'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Final Invoice Total ({editCurrency})</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={!isAdmin}
                    value={editTotalAmount}
                    onChange={e => handleEditTotalAmountChange(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-mono font-black text-sm ${
                      isAdmin
                        ? 'bg-white text-slate-900 border-teal-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Payment Status</label>
                  <select
                    disabled={!isAdmin}
                    value={editPaymentStatus}
                    onChange={e => setEditPaymentStatus(e.target.value as InvoicePaymentStatus)}
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs ${
                      isAdmin
                        ? 'bg-white text-slate-900 border-slate-300'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <option value="UNPAID">UNPAID</option>
                    <option value="PENDING_PAYMENT">PENDING PAYMENT</option>
                    <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                    <option value="PAID">PAID</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </div>
              </div>

              {(() => {
                const liveTotal = Math.max(0, Number(editTotalAmount) || 0);
                const livePaid = Number(invoiceToEdit.amountPaid ?? invoiceToEdit.paidAmount ?? booking.paidAmount ?? 0);
                const liveBal = Math.max(0, Math.round((liveTotal - livePaid) * 100) / 100);
                const liveCredit = Math.max(0, Math.round((livePaid - liveTotal) * 100) / 100);
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-[11px]">
                    <div className="flex flex-wrap gap-4 font-mono">
                      <span className="text-slate-300">
                        Paid: <strong className="text-emerald-400">{formatCurrency(livePaid, editCurrency)}</strong>
                      </span>
                      <span className="text-slate-300">
                        {liveCredit > 0 ? 'Credit Balance: ' : 'Recalculated Balance Due: '}
                        <strong className={liveCredit > 0 ? 'text-indigo-300' : 'text-amber-300'}>
                          {formatCurrency(liveCredit > 0 ? liveCredit : liveBal, editCurrency)}
                        </strong>
                      </span>
                    </div>
                    {isAdmin && (
                      <label className="inline-flex items-center gap-2 text-teal-200 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editSyncToBooking}
                          onChange={e => setEditSyncToBooking(e.target.checked)}
                          className="rounded border-slate-500"
                        />
                        <span>Sync updated PAX, total &amp; payment schedule across booking</span>
                      </label>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Block 3: Client, Agency & Trip Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer / Billed To Name</label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={e => setEditCustomerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Lead Traveler Name</label>
                <input
                  type="text"
                  value={editLeadTravelerName}
                  onChange={e => setEditLeadTravelerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Agency / Company Name</label>
                <input
                  type="text"
                  value={editAgencyName}
                  onChange={e => setEditAgencyName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Client Email</label>
                <input
                  type="email"
                  value={editCustomerEmail}
                  onChange={e => setEditCustomerEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Client Phone</label>
                <input
                  type="text"
                  value={editCustomerPhone}
                  onChange={e => setEditCustomerPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">GSTIN / Tax ID (Optional)</label>
                <input
                  type="text"
                  value={editBilledToGstin}
                  onChange={e => setEditBilledToGstin(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Destination</label>
                <input
                  type="text"
                  value={editDestination}
                  onChange={e => setEditDestination(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Travel Dates</label>
                <input
                  type="text"
                  value={editTravelDates}
                  onChange={e => setEditTravelDates(e.target.value)}
                  placeholder="e.g. 2026-10-12 to 2026-10-18"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Booking Summary / Description</label>
                <input
                  type="text"
                  value={editBookingDescription}
                  onChange={e => setEditBookingDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            {/* Block 4: Editable Service Line Items */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-800 uppercase text-[11px]">
                  Booked Services Scope ({editServices.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setEditServices(prev => [
                      ...prev,
                      {
                        id: `srv-${Date.now()}`,
                        description: 'Additional Travel Service',
                        category: 'GROUND_SERVICE',
                        serviceDate: booking.travelStartDate || new Date().toISOString().split('T')[0],
                        pax: editTotalPax,
                        quantity: editTotalPax,
                        unitPrice: 0,
                        lineTotal: 0
                      }
                    ])
                  }
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-teal-50 text-teal-800 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Service Line
                </button>
              </div>
              {editServices.length === 0 ? (
                <p className="text-[11px] text-slate-400">No service lines attached to this proforma.</p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {editServices.map((srv, idx) => (
                    <div key={srv.id || idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-slate-200">
                      <input
                        type="text"
                        value={srv.description || ''}
                        onChange={e =>
                          setEditServices(prev =>
                            prev.map((s, i) => (i === idx ? { ...s, description: e.target.value } : s))
                          )
                        }
                        placeholder="Service description"
                        className="col-span-5 p-1.5 rounded-lg border border-slate-200 text-xs"
                      />
                      <input
                        type="text"
                        value={srv.category || ''}
                        onChange={e =>
                          setEditServices(prev =>
                            prev.map((s, i) => (i === idx ? { ...s, category: e.target.value } : s))
                          )
                        }
                        placeholder="Category"
                        className="col-span-2 p-1.5 rounded-lg border border-slate-200 text-xs"
                      />
                      <input
                        type="text"
                        value={srv.serviceDate || ''}
                        onChange={e =>
                          setEditServices(prev =>
                            prev.map((s, i) => (i === idx ? { ...s, serviceDate: e.target.value } : s))
                          )
                        }
                        placeholder="Date"
                        className="col-span-2 p-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                      />
                      <input
                        type="number"
                        min={1}
                        value={srv.pax || editTotalPax}
                        onChange={e => {
                          const p = Math.max(1, Math.floor(Number(e.target.value) || 1));
                          setEditServices(prev =>
                            prev.map((s, i) => (i === idx ? { ...s, pax: p, quantity: p } : s))
                          );
                        }}
                        className="col-span-2 p-1.5 rounded-lg border border-slate-200 text-xs font-mono text-right"
                        title="PAX"
                      />
                      <button
                        type="button"
                        onClick={() => setEditServices(prev => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg flex justify-center cursor-pointer"
                        title="Remove line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Block 5: Bank Details, Address, Terms, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={editBankName}
                  onChange={e => setEditBankName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  value={editBankAccountName}
                  onChange={e => setEditBankAccountName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Account Number</label>
                <input
                  type="text"
                  value={editBankAccount}
                  onChange={e => setEditBankAccount(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">SWIFT / BIC Code</label>
                <input
                  type="text"
                  value={editSwift}
                  onChange={e => setEditSwift(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-4">
                <label className="font-bold text-slate-700 block mb-1">Billing Address</label>
                <textarea
                  rows={2}
                  value={editBillingAddress}
                  onChange={e => setEditBillingAddress(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Terms &amp; Conditions</label>
                <textarea
                  rows={2}
                  value={editTerms}
                  onChange={e => setEditTerms(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Commercial Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-4 p-3 bg-amber-50 rounded-2xl border border-amber-200">
                <label className="font-bold text-amber-900 block mb-1">Amendment Reason (Audited &amp; Required) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Updated PAX from 4 to 6 and recalculated total per partner confirmation"
                  value={editAmendmentReason}
                  onChange={e => setEditAmendmentReason(e.target.value)}
                  className="w-full p-2 rounded-xl border border-amber-300 bg-white text-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInvoiceToEdit(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Save Changes &amp; Sync Financial Records
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2B: Admin Delete Proforma Invoice Confirmation */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmDeleteProforma}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-rose-700 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>Delete Proforma Invoice #{invoiceToDelete.invoiceNumber}?</span>
              </h3>
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              This will permanently remove Proforma Invoice <strong>#{invoiceToDelete.invoiceNumber}</strong> (
              {formatCurrency(
                invoiceToDelete.proformaFinalBookingAmount ?? invoiceToDelete.totalAmount,
                invoiceToDelete.currency
              )}
              ) from this booking. A permanent deletion record will remain preserved in the Proforma Invoice Audit History.
            </p>
            {deleteInvoiceError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                {deleteInvoiceError}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deletion Reason (Required for Audit) *</label>
              <input
                type="text"
                required
                value={deleteInvoiceReason}
                onChange={e => setDeleteInvoiceReason(e.target.value)}
                placeholder="e.g. Duplicate draft created with wrong agency entity"
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Delete Proforma
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Version & Audit History */}
      {historyInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[82vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" />
                  Proforma Audit &amp; Version History: #{historyInvoice.invoiceNumber}
                </h3>
                <p className="text-[11px] text-slate-400">Current version: v{historyInvoice.invoiceVersion || 1}</p>
              </div>
              <button onClick={() => setHistoryInvoice(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1 text-xs">
              {historyInvoice.auditHistory && historyInvoice.auditHistory.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Field &amp; PAX Audit Log</p>
                  {historyInvoice.auditHistory.map(aud => (
                    <div key={aud.id} className="p-3 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{aud.action.replace('_', ' ')}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(aud.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600">By <strong>{aud.actorName}</strong> ({aud.actorRole || 'STAFF'})</p>
                      {aud.reason && <p className="text-slate-700 italic">"{aud.reason}"</p>}
                      {aud.changedFields && aud.changedFields.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-[11px] font-mono bg-white p-2 rounded-xl border border-purple-100">
                          {aud.changedFields.slice(0, 8).map((cf, cIdx) => (
                            <div key={cIdx} className="text-slate-600">
                              <span className="font-bold text-slate-800">{cf.field}:</span> {cf.before || '—'} → {cf.after || '—'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {historyInvoice.versionHistory && historyInvoice.versionHistory.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Previous Snapshots</p>
                  {historyInvoice.versionHistory.map((ver, i) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">Version {ver.version}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(ver.amendedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600">Amended By: <strong>{ver.amendedByName || 'Operations Lead'}</strong></p>
                      <p className="text-slate-500 italic bg-white p-2 rounded-xl border border-slate-100 mt-1">
                        "{ver.reason || 'Billing adjustment'}"
                      </p>
                    </div>
                  ))}
                </div>
              ) : !historyInvoice.auditHistory?.length ? (
                <div className="text-center py-6 text-slate-400">No previous versions or audit events.</div>
              ) : null}
            </div>

            <div className="pt-3 border-t border-slate-100 text-right shrink-0">
              <button
                onClick={() => setHistoryInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Email Dispatch */}
      {emailModalInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-600" />
                Dispatch Proforma Invoice via Email
              </h3>
              <button onClick={() => setEmailModalInvoice(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailSentNotice ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">Invoice Dispatched!</h4>
                <p className="text-xs text-slate-500">Activity logged in booking timeline.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Recipient Email</label>
                  <input
                    type="email"
                    required
                    value={emailRecipient}
                    onChange={e => setEmailRecipient(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Body</label>
                  <textarea
                    rows={9}
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <a
                    href={`mailto:${emailRecipient}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-teal-700 font-bold hover:underline"
                  >
                    Open in Local Email / Gmail
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEmailModalInvoice(null)}
                      className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendEmail}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send & Log</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: Reissue Proforma Invoice (Inline Replacement for window.prompt) */}
      {reissueTargetInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={confirmReissueInvoice} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">
                Reissue Proforma Invoice #{reissueTargetInvoice.invoiceNumber}
              </h3>
              <button type="button" onClick={() => setReissueTargetInvoice(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Reissuing generates a new Proforma version while preserving all previous issued versions immutably for audit history.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Reissue *</label>
              <input
                type="text"
                required
                value={reissueReason}
                onChange={e => setReissueReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setReissueTargetInvoice(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer">
                Issue New Version
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 6: Confirm Archive Manual Invoice */}
      {archiveTargetManualInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="text-sm font-black text-slate-900">Archive Manual Invoice?</h3>
            <p className="text-xs text-slate-600">
              Remove manual invoice <strong>#{archiveTargetManualInvoice.invoiceNumber}</strong>? This action is recorded in audit history.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setArchiveTargetManualInvoice(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={confirmArchiveManualInvoice} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer">
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREFLIGHT ERROR MODAL */}
      <ProformaGenerationErrorModal
        error={preflightError}
        onClose={() => setPreflightError(null)}
      />

      {/* SUCCESS MODAL */}
      <ProformaGenerationSuccessModal
        invoice={successModalInvoice}
        onClose={() => setSuccessModalInvoice(null)}
        onViewInvoice={(inv) => setSelectedInvoiceForPreview(inv)}
        onDownloadPdf={(inv) => {
          void downloadProformaInvoiceDocument(inv, booking, db.getCentralCompanyProfile());
        }}
      />
    </div>
  );
};
