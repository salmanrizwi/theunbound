import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Booking,
  BookingPassenger,
  PassengerComplianceDocument,
  PassengerComplianceDocumentCategory,
  PassengerDocumentVerificationStatus,
  User
} from '../../types';
import { AppDatabase } from '../../services/db';
import { isExternalUser, isInternalStaff } from '../../services/permissionEngine';
import {
  PASSENGER_DOC_CATEGORY_LABELS,
  PassengerDocumentUploadProgress,
  RecoverablePassengerDocumentDraft,
  canUserDeletePassengerDocument,
  deletePassengerComplianceDocument,
  filterScopedPassengerDocuments,
  loadBookingPassengerDocumentsFromFirestore,
  replacePassengerComplianceDocument,
  resolveAuthenticatedPassengerDocumentBlob,
  retrySavePassengerDocumentMetadata,
  triggerAuthenticatedPassengerDocumentDownload,
  updatePassengerDocumentVerification,
  uploadPassengerComplianceDocument,
  validatePassengerDocumentFile
} from '../../services/passengerDocumentService';
import {
  Users,
  Trash2,
  Edit,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  ShieldCheck,
  Crown,
  CreditCard,
  Lock,
  X,
  Download,
  RefreshCw,
  History,
  Plus,
  Loader2,
  AlertTriangle,
  Calendar
} from 'lucide-react';

interface PassengerManifestManagerProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

interface PreviewTarget {
  title: string;
  doc?: PassengerComplianceDocument;
  legacyUrl?: string;
  legacyFileName?: string;
}

interface QueuedUploadItem {
  id: string;
  file: File;
  category: PassengerComplianceDocumentCategory;
  expiryDate: string;
  notes: string;
  status: 'QUEUED' | 'UPLOADING' | 'SAVED' | 'FAILED';
  progressPercent: number;
  stageMessage: string;
  error?: string;
  savedDoc?: PassengerComplianceDocument;
}

const ADDITIONAL_DOC_CATEGORIES: PassengerComplianceDocumentCategory[] = [
  'PASSPORT_FRONT',
  'PASSPORT_BACK',
  'VISA_COPY',
  'PAN_CARD',
  'NATIONAL_ID',
  'TRAVEL_INSURANCE',
  'FLIGHT_TICKET',
  'MEDICAL_DECLARATION',
  'OTHER_COMPLIANCE'
];

function formatFileSize(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const PassengerManifestManager: React.FC<PassengerManifestManagerProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const maxPax =
    (booking.customer?.totalAdults || 0) + (booking.customer?.totalChildren || 0) ||
    booking.items?.reduce((max, it) => Math.max(max, it.totalPax), 0) ||
    1;
  const currentPassengers = booking.passengers || [];
  const isFull = currentPassengers.length >= maxPax;

  // Immutability & Access Checks
  const isExternal = isExternalUser(currentUser);
  const isInternal = isInternalStaff(currentUser);
  const isSubmitted = booking.status !== 'DRAFT';
  const canAddOrDelete = !isExternal || !isSubmitted;
  const canEditIdentity = !isExternal || !isSubmitted;
  const canDeleteDocs = canUserDeletePassengerDocument(currentUser, booking);

  // Persisted Compliance Documents State (strictly hydrated from Firestore + synced cache)
  const [persistedDocs, setPersistedDocs] = useState<PassengerComplianceDocument[]>(() =>
    filterScopedPassengerDocuments(db.getPassengerComplianceDocuments(booking.id), booking.id)
  );
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [recoverableDrafts, setRecoverableDrafts] = useState<RecoverablePassengerDocumentDraft[]>([]);
  const [isRetryingDraftId, setIsRetryingDraftId] = useState<string | null>(null);

  // Hydrate persisted documents from Firestore on mount / booking switch
  useEffect(() => {
    let active = true;
    const syncLocal = () => {
      if (!active) return;
      setPersistedDocs(
        filterScopedPassengerDocuments(db.getPassengerComplianceDocuments(booking.id), booking.id)
      );
    };

    const hydrate = async () => {
      setIsLoadingDocs(true);
      try {
        const remote = await loadBookingPassengerDocumentsFromFirestore(booking.id);
        if (active) {
          setPersistedDocs(filterScopedPassengerDocuments(remote, booking.id));
        }
      } catch {
        syncLocal();
      } finally {
        if (active) setIsLoadingDocs(false);
      }
    };

    syncLocal();
    hydrate();
    const unsub = db.subscribeToCollections(['booking_passenger_documents', 'bookings'], syncLocal);
    return () => {
      active = false;
      unsub();
    };
  }, [booking.id]);

  // Passenger Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState<BookingPassenger | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveProgressText, setSaveProgressText] = useState('');
  const [saveProgressPercent, setSaveProgressPercent] = useState(0);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [nationality, setNationality] = useState('Indian');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportIssueDate, setPassportIssueDate] = useState('');
  const [passportExpiryDate, setPassportExpiryDate] = useState('');
  const [isLeadPax, setIsLeadPax] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [mealPreference, setMealPreference] = useState('');
  const [panNumber, setPanNumber] = useState('');

  // Queued real File objects (NEVER stored as base64 in Firestore!)
  const [pendingFrontFile, setPendingFrontFile] = useState<File | null>(null);
  const [pendingBackFile, setPendingBackFile] = useState<File | null>(null);
  const [pendingVisaFile, setPendingVisaFile] = useState<File | null>(null);
  const [pendingPanFile, setPendingPanFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Multi-File / Single Replacement Compliance Document Upload Modal
  const [uploadModalPax, setUploadModalPax] = useState<BookingPassenger | null>(null);
  const [uploadModalCategory, setUploadModalCategory] = useState<PassengerComplianceDocumentCategory>('PASSPORT_FRONT');
  const [uploadModalReplaceDoc, setUploadModalReplaceDoc] = useState<PassengerComplianceDocument | null>(null);
  const [uploadModalFile, setUploadModalFile] = useState<File | null>(null);
  const [uploadModalQueue, setUploadModalQueue] = useState<QueuedUploadItem[]>([]);
  const [uploadModalExpiry, setUploadModalExpiry] = useState('');
  const [uploadModalNotes, setUploadModalNotes] = useState('');
  const [uploadModalReplaceReason, setUploadModalReplaceReason] = useState('');
  const [uploadModalError, setUploadModalError] = useState<string | null>(null);
  const [isUploadingSingleDoc, setIsUploadingSingleDoc] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState<PassengerDocumentUploadProgress | null>(null);

  // Authenticated Document Preview Modal
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string>('application/pdf');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  // Version History Modal
  const [historyDoc, setHistoryDoc] = useState<PassengerComplianceDocument | null>(null);

  // Verification Modal (Internal Staff)
  const [verifyTargetDoc, setVerifyTargetDoc] = useState<PassengerComplianceDocument | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<PassengerDocumentVerificationStatus>('APPROVED');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyExpiry, setVerifyExpiry] = useState('');
  const [isUpdatingVerification, setIsUpdatingVerification] = useState(false);

  // Inline Confirmation Modals (NO window.confirm)
  const [paxToDelete, setPaxToDelete] = useState<{ id: string; name: string } | null>(null);
  const [docToDelete, setDocToDelete] = useState<PassengerComplianceDocument | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Clean up object URLs on preview change/unmount
  useEffect(() => {
    const revokePrevious = () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };

    if (!previewTarget) {
      revokePrevious();
      setPreviewBlobUrl(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    const loadPreview = async () => {
      revokePrevious();
      setPreviewBlobUrl(null);
      setPreviewError(null);

      if (previewTarget.doc) {
        setIsLoadingPreview(true);
        const res = await resolveAuthenticatedPassengerDocumentBlob(
          previewTarget.doc,
          booking,
          currentUser
        );
        if (cancelled) return;
        setIsLoadingPreview(false);
        if (!res.success || !res.blob) {
          setPreviewError(res.error || 'Could not retrieve document preview securely.');
          return;
        }
        const blobUrl = URL.createObjectURL(res.blob);
        activeBlobUrlRef.current = blobUrl;
        setPreviewMimeType(res.mimeType || previewTarget.doc.mimeType || 'application/pdf');
        setPreviewBlobUrl(blobUrl);
        return;
      }

      if (previewTarget.legacyUrl && !previewTarget.legacyUrl.startsWith('storage://')) {
        setPreviewBlobUrl(previewTarget.legacyUrl);
        setPreviewMimeType(
          previewTarget.legacyUrl.startsWith('data:application/pdf') ||
            previewTarget.legacyFileName?.toLowerCase().endsWith('.pdf')
            ? 'application/pdf'
            : 'image/jpeg'
        );
      } else {
        setPreviewError('Document metadata record is still syncing. Please refresh and try again.');
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
      revokePrevious();
    };
  }, [previewTarget, booking, currentUser]);

  const docsByPassenger = useMemo(() => {
    const map = new Map<string, PassengerComplianceDocument[]>();
    for (const pax of currentPassengers) {
      map.set(pax.id, filterScopedPassengerDocuments(persistedDocs, booking.id, pax.id));
    }
    return map;
  }, [persistedDocs, currentPassengers, booking.id]);

  const findActiveDocByCategory = (
    passengerId: string,
    category: PassengerComplianceDocumentCategory
  ): PassengerComplianceDocument | undefined => {
    const paxDocs = docsByPassenger.get(passengerId) || [];
    return paxDocs.find(d => d.category === category && d.status !== 'DELETED');
  };

  const openAddModal = () => {
    if (isFull || !canAddOrDelete) return;
    setEditingPassenger(null);
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setDateOfBirth('');
    setGender('MALE');
    setNationality(booking.customer?.nationality || 'Indian');
    setPassportNumber('');
    setPassportIssueDate('');
    setPassportExpiryDate('');
    setIsLeadPax(currentPassengers.length === 0);
    setPhone(currentPassengers.length === 0 ? booking.customer?.phone || '' : '');
    setEmail(currentPassengers.length === 0 ? booking.customer?.email || '' : '');
    setMealPreference('');
    setPanNumber('');
    setPendingFrontFile(null);
    setPendingBackFile(null);
    setPendingVisaFile(null);
    setPendingPanFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (pax: BookingPassenger) => {
    setEditingPassenger(pax);
    setFirstName(pax.firstName || '');
    setMiddleName(pax.middleName || '');
    setLastName(pax.lastName || '');
    setDateOfBirth(pax.dateOfBirth || '');
    setGender(pax.gender || 'MALE');
    setNationality(pax.nationality || 'Indian');
    setPassportNumber(pax.passportNumber || '');
    setPassportIssueDate(pax.passportIssueDate || '');
    setPassportExpiryDate(pax.passportExpiryDate || pax.passportExpiry || '');
    setIsLeadPax(pax.isLeadPax || false);
    setPhone(pax.phone || '');
    setEmail(pax.email || '');
    setMealPreference(pax.mealPreference || '');
    setPanNumber(pax.panNumber || '');
    setPendingFrontFile(null);
    setPendingBackFile(null);
    setPendingVisaFile(null);
    setPendingPanFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleQueueFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'FRONT' | 'BACK' | 'PAN' | 'VISA'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validatePassengerDocumentFile({
      originalFileName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size
    });
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid document file.');
      return;
    }
    setFormError(null);
    if (type === 'FRONT') setPendingFrontFile(file);
    if (type === 'BACK') setPendingBackFile(file);
    if (type === 'PAN') setPendingPanFile(file);
    if (type === 'VISA') setPendingVisaFile(file);
  };

  const handleSavePassenger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingProfile) return;
    setFormError(null);

    if (canEditIdentity && (!firstName.trim() || !lastName.trim())) {
      setFormError('Please enter both first name and last name.');
      return;
    }

    setIsSavingProfile(true);
    setSaveProgressText('Saving passenger profile...');

    try {
      const targetIsLead = editingPassenger ? editingPassenger.isLeadPax : isLeadPax;
      const payload: Partial<BookingPassenger> = {
        passportNumber: passportNumber.trim(),
        passportIssueDate,
        passportExpiryDate,
        passportExpiry: passportExpiryDate,
        panNumber: targetIsLead ? panNumber.trim().toUpperCase() : undefined
      };

      if (canEditIdentity) {
        payload.firstName = firstName.trim();
        payload.middleName = middleName.trim();
        payload.lastName = lastName.trim();
        payload.dateOfBirth = dateOfBirth;
        payload.gender = gender;
        payload.nationality = nationality;
        payload.isLeadPax = isLeadPax;
        payload.phone = phone.trim() || undefined;
        payload.email = email.trim() || undefined;
        payload.mealPreference = mealPreference.trim() || undefined;
      }

      let targetPassengerId: string | null = editingPassenger?.id || null;

      if (editingPassenger) {
        db.updateBookingPassenger(booking.id, editingPassenger.id, payload, currentUser);
      } else {
        if (!canAddOrDelete) {
          throw new Error(
            'This booking has been submitted and is now read-only. New passenger profiles cannot be added.'
          );
        }
        const createdPax = db.addBookingPassenger(booking.id, payload as any, currentUser);
        targetPassengerId = createdPax?.id || null;
      }

      const activeBooking = db.getBookingById(booking.id, currentUser) || booking;
      if (!targetPassengerId && activeBooking.passengers?.length) {
        targetPassengerId = activeBooking.passengers[activeBooking.passengers.length - 1].id;
      }
      await db.saveBookingAsync(activeBooking, currentUser, { isDocumentUpdate: !canEditIdentity });

      // Upload queued compliance files to Firebase Storage + Firestore metadata
      const uploadQueue: Array<{ category: PassengerComplianceDocumentCategory; file: File }> = [];
      if (pendingFrontFile) uploadQueue.push({ category: 'PASSPORT_FRONT', file: pendingFrontFile });
      if (pendingBackFile) uploadQueue.push({ category: 'PASSPORT_BACK', file: pendingBackFile });
      if (pendingVisaFile) uploadQueue.push({ category: 'VISA_COPY', file: pendingVisaFile });
      if (targetIsLead && pendingPanFile) uploadQueue.push({ category: 'PAN_CARD', file: pendingPanFile });

      const failedMessages: string[] = [];
      const newRecoverable: RecoverablePassengerDocumentDraft[] = [];

      if (targetPassengerId && uploadQueue.length > 0) {
        for (let i = 0; i < uploadQueue.length; i++) {
          const item = uploadQueue[i];
          const basePct = Math.round((i / uploadQueue.length) * 100);
          setSaveProgressPercent(Math.max(5, basePct));
          setSaveProgressText(
            `Uploading ${PASSENGER_DOC_CATEGORY_LABELS[item.category]} (${i + 1}/${uploadQueue.length})...`
          );

          const latestBooking = db.getBookingById(booking.id, currentUser) || activeBooking;
          const existingDoc = findActiveDocByCategory(targetPassengerId, item.category);
          const handleItemProgress = (progress: PassengerDocumentUploadProgress) => {
            const overall = Math.round(((i + progress.percent / 100) / uploadQueue.length) * 100);
            setSaveProgressPercent(Math.min(99, Math.max(5, overall)));
            setSaveProgressText(
              `${PASSENGER_DOC_CATEGORY_LABELS[item.category]} (${i + 1}/${uploadQueue.length}): ${progress.message}`
            );
          };

          const result = existingDoc
            ? await replacePassengerComplianceDocument(
                {
                  booking: latestBooking,
                  existingDocument: existingDoc,
                  file: item.file,
                  originalFileName: item.file.name,
                  mimeType: item.file.type,
                  expiryDate:
                    item.category === 'PASSPORT_FRONT' || item.category === 'PASSPORT_BACK'
                      ? passportExpiryDate || undefined
                      : undefined,
                  onProgress: handleItemProgress
                },
                currentUser
              )
            : await uploadPassengerComplianceDocument(
                {
                  booking: latestBooking,
                  passengerId: targetPassengerId,
                  category: item.category,
                  file: item.file,
                  originalFileName: item.file.name,
                  mimeType: item.file.type,
                  expiryDate:
                    item.category === 'PASSPORT_FRONT' || item.category === 'PASSPORT_BACK'
                      ? passportExpiryDate || undefined
                      : undefined,
                  onProgress: handleItemProgress
                },
                currentUser
              );

          if (!result.success) {
            failedMessages.push(`${PASSENGER_DOC_CATEGORY_LABELS[item.category]}: ${result.error}`);
            if (result.recoverableDraft) {
              newRecoverable.push(result.recoverableDraft);
            }
          }
        }
      }

      if (newRecoverable.length > 0) {
        setRecoverableDrafts(prev => [...newRecoverable, ...prev]);
      }

      setPersistedDocs(
        filterScopedPassengerDocuments(db.getPassengerComplianceDocuments(booking.id), booking.id)
      );
      onRefresh();

      if (failedMessages.length > 0) {
        setFormError(failedMessages.join(' | '));
        setStatusBanner({
          type: 'error',
          message: `One or more compliance documents failed to save: ${failedMessages[0]}`
        });
        return;
      }

      setSaveProgressPercent(100);
      setIsModalOpen(false);
      setStatusBanner({
        type: 'success',
        message:
          uploadQueue.length > 0
            ? `Saved passenger profile and permanently persisted ${uploadQueue.length} document(s).`
            : 'Passenger profile saved successfully.'
      });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save passenger profile.');
    } finally {
      setIsSavingProfile(false);
      setSaveProgressText('');
      setSaveProgressPercent(0);
    }
  };

  const openSingleDocUploadModal = (
    pax: BookingPassenger,
    category: PassengerComplianceDocumentCategory,
    replaceDoc?: PassengerComplianceDocument
  ) => {
    setUploadModalPax(pax);
    setUploadModalCategory(replaceDoc ? replaceDoc.category : category);
    setUploadModalReplaceDoc(replaceDoc || null);
    setUploadModalFile(null);
    setUploadModalQueue([]);
    setUploadModalExpiry(replaceDoc?.expiryDate || '');
    setUploadModalNotes(replaceDoc?.verificationNotes || '');
    setUploadModalReplaceReason('');
    setUploadModalError(null);
    setReplaceProgress(null);
  };

  const handleAddFilesToUploadQueue = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadModalError(null);
    const nextItems: QueuedUploadItem[] = [];
    const invalidErrors: string[] = [];

    Array.from(fileList).forEach((file, idx) => {
      const validation = validatePassengerDocumentFile({
        originalFileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size
      });
      if (!validation.valid) {
        invalidErrors.push(`${file.name}: ${validation.error || 'Unsupported file'}`);
        return;
      }
      nextItems.push({
        id: `q-${Date.now()}-${idx}-${Math.floor(Math.random() * 10000)}`,
        file,
        category: uploadModalCategory,
        expiryDate: uploadModalExpiry,
        notes: uploadModalNotes,
        status: 'QUEUED',
        progressPercent: 0,
        stageMessage: 'Ready to upload'
      });
    });

    if (invalidErrors.length > 0) {
      setUploadModalError(invalidErrors.join(' | '));
    }
    if (nextItems.length > 0) {
      setUploadModalQueue(prev => [...prev, ...nextItems]);
    }
  };

  const updateQueuedItem = (id: string, patch: Partial<QueuedUploadItem>) => {
    setUploadModalQueue(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeQueuedItem = (id: string) => {
    if (isUploadingSingleDoc) return;
    setUploadModalQueue(prev => prev.filter(item => item.id !== id));
  };

  const processQueuedUploadItems = async (targetIds?: string[]) => {
    if (!uploadModalPax || isUploadingSingleDoc) return;
    const candidates = uploadModalQueue.filter(item => {
      if (targetIds && !targetIds.includes(item.id)) return false;
      return item.status === 'QUEUED' || item.status === 'FAILED';
    });
    if (candidates.length === 0) {
      setUploadModalError('Please add at least one PDF, JPG, PNG, or WEBP file to upload.');
      return;
    }

    setIsUploadingSingleDoc(true);
    setUploadModalError(null);
    let succeededCount = 0;
    let failedCount = 0;
    const savedNames: string[] = [];

    try {
      for (const item of candidates) {
        updateQueuedItem(item.id, {
          status: 'UPLOADING',
          progressPercent: 8,
          stageMessage: 'Validating & preparing upload...',
          error: undefined
        });

        const latestBooking = db.getBookingById(booking.id, currentUser) || booking;
        const result = await uploadPassengerComplianceDocument(
          {
            booking: latestBooking,
            passengerId: uploadModalPax.id,
            category: item.category,
            file: item.file,
            originalFileName: item.file.name,
            mimeType: item.file.type,
            expiryDate: (item.expiryDate || uploadModalExpiry).trim() || undefined,
            verificationNotes: (item.notes || uploadModalNotes).trim() || undefined,
            onProgress: (progress) => {
              updateQueuedItem(item.id, {
                progressPercent: progress.percent,
                stageMessage: progress.message
              });
            }
          },
          currentUser
        );

        if (result.success && result.document) {
          succeededCount += 1;
          savedNames.push(result.document.originalFileName);
          updateQueuedItem(item.id, {
            status: 'SAVED',
            progressPercent: 100,
            stageMessage:
              result.document.storageBackend === 'FIRESTORE_CHUNKS'
                ? 'Saved securely to Firestore document store'
                : 'Saved securely to Storage & Firestore',
            savedDoc: result.document,
            error: undefined
          });
        } else {
          failedCount += 1;
          if (result.recoverableDraft) {
            setRecoverableDrafts(prev => [result.recoverableDraft!, ...prev]);
          }
          updateQueuedItem(item.id, {
            status: 'FAILED',
            progressPercent: 0,
            stageMessage: 'Upload failed — click Retry',
            error: result.error || 'Document upload failed.'
          });
        }
      }

      setPersistedDocs(
        filterScopedPassengerDocuments(db.getPassengerComplianceDocuments(booking.id), booking.id)
      );
      onRefresh();

      if (failedCount === 0 && succeededCount > 0) {
        const paxLabel = uploadModalPax.fullName || `${uploadModalPax.firstName} ${uploadModalPax.lastName}`;
        setUploadModalPax(null);
        setUploadModalReplaceDoc(null);
        setUploadModalQueue([]);
        setStatusBanner({
          type: 'success',
          message:
            succeededCount === 1
              ? `Uploaded and permanently saved ${savedNames[0]} for ${paxLabel}.`
              : `Uploaded and permanently saved ${succeededCount} compliance documents for ${paxLabel}.`
        });
      } else if (failedCount > 0) {
        setUploadModalError(
          `${failedCount} file(s) failed to upload${succeededCount > 0 ? ` (${succeededCount} saved successfully)` : ''}. Click "Retry Failed" to try again.`
        );
      }
    } catch (err: any) {
      setUploadModalError(err?.message || 'Unexpected error during document upload.');
    } finally {
      setIsUploadingSingleDoc(false);
    }
  };

  const handleSingleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadModalPax || isUploadingSingleDoc) return;

    // Multi-file upload flow (standard mode)
    if (!uploadModalReplaceDoc) {
      await processQueuedUploadItems();
      return;
    }

    // Single-file replacement flow
    if (!uploadModalFile) {
      setUploadModalError('Please choose a PDF, JPG, PNG, or WEBP replacement file.');
      return;
    }

    const validation = validatePassengerDocumentFile({
      originalFileName: uploadModalFile.name,
      mimeType: uploadModalFile.type,
      fileSizeBytes: uploadModalFile.size
    });
    if (!validation.valid) {
      setUploadModalError(validation.error || 'Invalid document file.');
      return;
    }

    setIsUploadingSingleDoc(true);
    setUploadModalError(null);
    setReplaceProgress({ percent: 8, stage: 'VALIDATING', message: 'Starting replacement upload...' });

    try {
      const latestBooking = db.getBookingById(booking.id, currentUser) || booking;
      const result = await replacePassengerComplianceDocument(
        {
          booking: latestBooking,
          existingDocument: uploadModalReplaceDoc,
          file: uploadModalFile,
          originalFileName: uploadModalFile.name,
          mimeType: uploadModalFile.type,
          replaceReason: uploadModalReplaceReason.trim() || undefined,
          expiryDate: uploadModalExpiry.trim() || undefined,
          onProgress: (progress) => setReplaceProgress(progress)
        },
        currentUser
      );

      if (!result.success || !result.document) {
        if (result.recoverableDraft) {
          setRecoverableDrafts(prev => [result.recoverableDraft!, ...prev]);
        }
        setUploadModalError(result.error || 'Document replacement failed. You may retry immediately.');
        setReplaceProgress({ percent: 0, stage: 'FAILED', message: result.error || 'Upload failed' });
        return;
      }

      setPersistedDocs(
        filterScopedPassengerDocuments(db.getPassengerComplianceDocuments(booking.id), booking.id)
      );
      setUploadModalPax(null);
      setUploadModalReplaceDoc(null);
      setReplaceProgress(null);
      setStatusBanner({
        type: 'success',
        message: `Replaced ${result.document.documentType} with v${result.document.version} (${result.document.originalFileName}). Previous version preserved in history.`
      });
      onRefresh();
    } catch (err: any) {
      setUploadModalError(err?.message || 'Document replacement failed.');
    } finally {
      setIsUploadingSingleDoc(false);
    }
  };

  const handleRetryRecoverableDraft = async (draft: RecoverablePassengerDocumentDraft) => {
    setIsRetryingDraftId(draft.document.id);
    try {
      const latestBooking = db.getBookingById(booking.id, currentUser) || booking;
      const res = await retrySavePassengerDocumentMetadata(draft, latestBooking, currentUser);
      if (res.success && res.document) {
        setRecoverableDrafts(prev => prev.filter(d => d.document.id !== draft.document.id));
        setPersistedDocs(
          filterScopedPassengerDocuments(db.getPassengerComplianceDocuments(booking.id), booking.id)
        );
        setStatusBanner({
          type: 'success',
          message: `Recovered and saved metadata for ${res.document.originalFileName} without duplicating files.`
        });
        onRefresh();
      } else {
        setStatusBanner({
          type: 'error',
          message: res.error || 'Metadata retry failed. Please check your connection and try again.'
        });
      }
    } finally {
      setIsRetryingDraftId(null);
    }
  };

  const handleConfirmDeletePassenger = async () => {
    if (!paxToDelete) return;
    try {
      db.deleteBookingPassenger(booking.id, paxToDelete.id, currentUser);
      const updated = db.getBookingById(booking.id, currentUser);
      if (updated) {
        await db.saveBookingAsync(updated, currentUser);
      }
      setPaxToDelete(null);
      setStatusBanner({ type: 'success', message: `Removed ${paxToDelete.name} from booking manifest.` });
      onRefresh();
    } catch (err: any) {
      setStatusBanner({ type: 'error', message: err?.message || 'Failed to remove passenger.' });
    }
  };

  const handleConfirmDeleteDocument = async () => {
    if (!docToDelete || isDeletingDoc) return;
    setIsDeletingDoc(true);
    try {
      const latestBooking = db.getBookingById(booking.id, currentUser) || booking;
      const res = await deletePassengerComplianceDocument(
        {
          booking: latestBooking,
          document: docToDelete,
          reason: deleteReason.trim() || undefined
        },
        currentUser
      );
      if (!res.success) {
        setStatusBanner({ type: 'error', message: res.error || 'Failed to delete compliance document.' });
        return;
      }
      setPersistedDocs(
        filterScopedPassengerDocuments(db.getPassengerComplianceDocuments(booking.id), booking.id)
      );
      setDocToDelete(null);
      setDeleteReason('');
      setStatusBanner({
        type: 'success',
        message: res.storageDeleted
          ? `Deleted ${docToDelete.documentType} (${docToDelete.originalFileName}) and cleaned up unreferenced Storage object.`
          : `Archived ${docToDelete.documentType} (${docToDelete.originalFileName}) with audit history preserved.`
      });
      onRefresh();
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleSaveVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyTargetDoc || isUpdatingVerification) return;
    setIsUpdatingVerification(true);
    try {
      const res = await updatePassengerDocumentVerification(
        {
          booking,
          document: verifyTargetDoc,
          verificationStatus: verifyStatus,
          verificationNotes: verifyNotes,
          expiryDate: verifyExpiry
        },
        currentUser
      );
      if (!res.success) {
        setStatusBanner({ type: 'error', message: res.error || 'Failed to update document verification.' });
        return;
      }
      setPersistedDocs(
        filterScopedPassengerDocuments(db.getPassengerComplianceDocuments(booking.id), booking.id)
      );
      setVerifyTargetDoc(null);
      setStatusBanner({
        type: 'success',
        message: `Updated verification status for ${verifyTargetDoc.originalFileName} to ${verifyStatus}.`
      });
      onRefresh();
    } finally {
      setIsUpdatingVerification(false);
    }
  };

  const handleDownloadDocument = async (docRecord: PassengerComplianceDocument) => {
    const res = await triggerAuthenticatedPassengerDocumentDownload(docRecord, booking, currentUser);
    if (!res.success) {
      setStatusBanner({
        type: 'error',
        message: res.error || 'Unable to download compliance document.'
      });
    }
  };

  const renderStandardDocRow = (
    pax: BookingPassenger,
    category: PassengerComplianceDocumentCategory,
    label: string,
    legacyUrl?: string,
    legacyName?: string,
    accentAmber = false
  ) => {
    const docRecord = findActiveDocByCategory(pax.id, category);
    const hasFile = Boolean(docRecord || (legacyUrl && !legacyUrl.startsWith('storage://')));
    const displayName = docRecord?.originalFileName || legacyName;
    const isRequired = category !== 'VISA_COPY';

    return (
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border text-xs ${
          accentAmber ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {hasFile ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : isRequired ? (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span className={`truncate font-semibold ${accentAmber ? 'text-amber-950' : 'text-slate-800'}`}>
              {label}{' '}
              {hasFile
                ? `(${displayName || 'Persisted'})`
                : isRequired
                ? '— Missing'
                : '— Optional / Pending'}
            </span>
            {docRecord && (
              <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-600 shrink-0">
                v{docRecord.version || 1}
              </span>
            )}
            {docRecord && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                  docRecord.verificationStatus === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : docRecord.verificationStatus === 'REJECTED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-sky-100 text-sky-800'
                }`}
              >
                {docRecord.verificationStatus === 'APPROVED'
                  ? 'Verified'
                  : docRecord.verificationStatus === 'REJECTED'
                  ? 'Rejected'
                  : 'Pending'}
              </span>
            )}
          </div>
          {docRecord && (
            <div className="pl-6 mt-0.5 text-[10px] text-slate-500 flex flex-wrap items-center gap-2">
              <span>{formatFileSize(docRecord.fileSizeBytes)}</span>
              <span>• Saved {new Date(docRecord.uploadedAt).toLocaleDateString()}</span>
              {docRecord.expiryDate && (
                <span className="inline-flex items-center gap-0.5 font-mono text-slate-600">
                  <Calendar className="w-3 h-3" /> Exp: {docRecord.expiryDate}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 pl-6 sm:pl-0 flex-wrap">
          {docRecord ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setPreviewTarget({
                    title: `${label} — ${pax.fullName || pax.firstName}`,
                    doc: docRecord
                  })
                }
                className="px-2 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold flex items-center gap-1 cursor-pointer"
                title="Preview Document"
              >
                <Eye className="w-3 h-3" /> View
              </button>
              <button
                type="button"
                onClick={() => handleDownloadDocument(docRecord)}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
                title="Download Document"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => openSingleDocUploadModal(pax, category, docRecord)}
                className="px-2 py-1 text-[11px] bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-lg text-teal-800 font-bold flex items-center gap-1 cursor-pointer"
                title="Replace Document (Preserves Prior Version)"
              >
                <RefreshCw className="w-3 h-3" /> Replace
              </button>
              {docRecord.versionHistory && docRecord.versionHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistoryDoc(docRecord)}
                  className="p-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-purple-700 cursor-pointer"
                  title="Version History"
                >
                  <History className="w-3 h-3" />
                </button>
              )}
              {isInternal && (
                <button
                  type="button"
                  onClick={() => {
                    setVerifyTargetDoc(docRecord);
                    setVerifyStatus(docRecord.verificationStatus || 'APPROVED');
                    setVerifyNotes(docRecord.verificationNotes || '');
                    setVerifyExpiry(docRecord.expiryDate || '');
                  }}
                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-700 cursor-pointer"
                  title="Verify / Update Notes"
                >
                  <ShieldCheck className="w-3 h-3" />
                </button>
              )}
              {canDeleteDocs && (
                <button
                  type="button"
                  onClick={() => {
                    setDocToDelete(docRecord);
                    setDeleteReason('');
                  }}
                  className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg text-rose-600 cursor-pointer"
                  title="Delete Document"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </>
          ) : legacyUrl && !legacyUrl.startsWith('storage://') ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setPreviewTarget({
                    title: `${label} — ${pax.fullName || pax.firstName}`,
                    legacyUrl,
                    legacyFileName: legacyName
                  })
                }
                className="px-2 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3 h-3" /> View
              </button>
              <button
                type="button"
                onClick={() => openSingleDocUploadModal(pax, category)}
                className="px-2 py-1 text-[11px] bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg text-teal-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3" /> Re-upload
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openSingleDocUploadModal(pax, category)}
              className="px-2.5 py-1 text-[11px] bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-lg text-[#008f77] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3 h-3" /> Upload
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      id="booking-passenger-manifest-section"
      className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs mb-6"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
              <Users className="w-5 h-5 text-[#008f77]" />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              Passenger Manifest & Compliance Documents
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                isFull
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {currentPassengers.length} / {maxPax} Passengers
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-[#008f77] border border-teal-200 font-mono">
              {persistedDocs.length} Saved Docs
            </span>
            {isLoadingDocs && (
              <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Syncing...
              </span>
            )}
            {!canAddOrDelete && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-500" />
                Submitted (Identity Locked)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Documents are stored permanently in Firebase Storage with Firestore metadata strictly scoped to this booking and individual passenger.
          </p>
        </div>

        {canAddOrDelete && (
          <button
            id="btn-add-passenger"
            type="button"
            onClick={openAddModal}
            disabled={isFull}
            className={`flex items-center px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer ${
              isFull
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 shadow-md shadow-[#00C6A6]/20'
            }`}
          >
            <span>
              Add Passenger Profile ({currentPassengers.length}/{maxPax})
            </span>
          </button>
        )}
      </div>

      {/* Operation Status Banner */}
      {statusBanner && (
        <div
          className={`p-3.5 mb-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Recoverable Metadata Save Failure Banner */}
      {recoverableDrafts.length > 0 && (
        <div className="p-4 mb-5 rounded-2xl bg-amber-50 border border-amber-300 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Action Required: {recoverableDrafts.length} Document(s) Uploaded to Storage Pending Metadata Save
            </span>
          </div>
          {recoverableDrafts.map(draft => (
            <div
              key={draft.document.id}
              className="p-3 rounded-xl bg-white border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div>
                <p className="font-bold text-slate-900">
                  {draft.document.documentType} — {draft.document.originalFileName} ({draft.document.passengerName})
                </p>
                <p className="text-[11px] text-rose-700 mt-0.5">{draft.failureReason}</p>
              </div>
              <button
                type="button"
                disabled={isRetryingDraftId === draft.document.id}
                onClick={() => handleRetryRecoverableDraft(draft)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRetryingDraftId === draft.document.id ? 'animate-spin' : ''}`}
                />
                <span>Retry Save Metadata</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Submitted Booking Read-Only Notice for External Agents */}
      {!canEditIdentity && (
        <div className="p-3.5 mb-5 rounded-2xl bg-sky-50/70 border border-sky-200 flex items-start gap-3">
          <Lock className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="text-xs text-sky-900">
            <span className="font-bold">Passenger Identity Locked:</span> This booking has been submitted. Passenger names, nationality, and birth dates are locked. You may still upload or replace travel compliance documents (Passport, Visa, PAN Card) at any time.
          </div>
        </div>
      )}

      {/* Manifest Cards List */}
      {currentPassengers.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
          <div className="p-2.5 rounded-2xl bg-teal-50 text-[#008f77] w-fit mx-auto mb-2">
            <Users className="w-8 h-8 text-[#008f77]" />
          </div>
          <p className="text-sm font-bold text-slate-800">No Passenger Profiles Configured Yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            {canAddOrDelete
              ? `Add all ${maxPax} passengers to fulfill document verification compliance.`
              : 'No passenger profiles were added before submission. Please contact operations.'}
          </p>
          {canAddOrDelete && (
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 rounded-xl text-xs font-bold shadow-md shadow-[#00C6A6]/20 inline-flex items-center cursor-pointer"
            >
              <span>Add First Passenger (Lead)</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentPassengers.map(pax => {
            const paxDocs = docsByPassenger.get(pax.id) || [];
            const frontDoc = findActiveDocByCategory(pax.id, 'PASSPORT_FRONT');
            const backDoc = findActiveDocByCategory(pax.id, 'PASSPORT_BACK');
            const extraDocs = paxDocs.filter(
              d =>
                d.category !== 'PASSPORT_FRONT' &&
                d.category !== 'PASSPORT_BACK' &&
                d.category !== 'VISA_COPY' &&
                d.category !== 'PAN_CARD'
            );

            const hasFront = Boolean(frontDoc || pax.passportFrontUrl);
            const hasBack = Boolean(backDoc || pax.passportBackUrl);
            const isLead = pax.isLeadPax;
            const verificationStatus =
              pax.documentVerificationStatus ||
              (hasFront && hasBack ? 'PENDING_REVIEW' : 'MISSING');

            return (
              <div
                key={pax.id}
                id={`pax-card-${pax.id}`}
                className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs relative transition-all hover:border-slate-300 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-teal-50 text-[#008f77] border border-teal-200 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                        #{pax.passengerNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900">
                            {pax.fullName || `${pax.firstName} ${pax.lastName}`}
                          </h4>
                          {isLead && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-600" />
                              Lead Traveler
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              verificationStatus === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : verificationStatus === 'REJECTED'
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : verificationStatus === 'PENDING_REVIEW'
                                ? 'bg-sky-50 text-sky-800 border-sky-300'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {verificationStatus === 'APPROVED'
                              ? 'Docs Approved'
                              : verificationStatus === 'REJECTED'
                              ? 'Docs Rejected'
                              : verificationStatus === 'PENDING_REVIEW'
                              ? 'Review Pending'
                              : 'Docs Missing'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono">
                          DOB: {pax.dateOfBirth || 'N/A'} • {pax.gender || 'N/A'} • {pax.nationality || 'Indian'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(pax)}
                        title={canEditIdentity ? 'Edit Passenger Profile' : 'Manage Passenger Documents'}
                        className="px-2 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 border border-slate-200"
                      >
                        {canEditIdentity ? (
                          <Edit className="w-3.5 h-3.5" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-[#008f77]" />
                        )}
                        <span>{canEditIdentity ? 'Edit' : 'Upload Docs'}</span>
                      </button>
                      {canAddOrDelete && (
                        <button
                          type="button"
                          onClick={() =>
                            setPaxToDelete({
                              id: pax.id,
                              name: pax.fullName || `${pax.firstName} ${pax.lastName}`
                            })
                          }
                          title="Remove Passenger"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rejection Alert if applicable */}
                  {verificationStatus === 'REJECTED' &&
                    (pax.documentRejectionReason || pax.documentRejectionNotes) && (
                      <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-rose-900">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          Documentation Action Required (Rejected)
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Reason: {pax.documentRejectionReason || pax.documentRejectionNotes}
                        </p>
                      </div>
                    )}

                  {/* Passport Details */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">
                          Passport Number
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {pax.passportNumber || 'Not Provided'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">
                          Passport Expiry
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {pax.passportExpiryDate || pax.passportExpiry || 'Not Provided'}
                        </span>
                      </div>
                      {pax.mealPreference && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">
                            Meal Preference
                          </span>
                          <span className="text-slate-800 font-semibold">{pax.mealPreference}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Persisted Compliance Documents */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Compliance Documents ({paxDocs.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => openSingleDocUploadModal(pax, 'TRAVEL_INSURANCE')}
                        className="text-[11px] font-bold text-[#008f77] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Add Document
                      </button>
                    </div>

                    {renderStandardDocRow(
                      pax,
                      'PASSPORT_FRONT',
                      'Passport Front',
                      pax.passportFrontUrl,
                      pax.passportFrontName
                    )}
                    {renderStandardDocRow(
                      pax,
                      'PASSPORT_BACK',
                      'Passport Back',
                      pax.passportBackUrl,
                      pax.passportBackName
                    )}
                    {renderStandardDocRow(
                      pax,
                      'VISA_COPY',
                      'Visa Copy / ETA',
                      pax.visaCopyUrl,
                      pax.visaCopyName
                    )}

                    {isLead ? (
                      renderStandardDocRow(
                        pax,
                        'PAN_CARD',
                        `PAN Card (Lead${pax.panNumber ? `: ${pax.panNumber}` : ''})`,
                        pax.panCardUrl,
                        pax.panCardName,
                        true
                      )
                    ) : (
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-400 italic">
                        PAN Card: N/A (Required for Lead Passenger only)
                      </div>
                    )}

                    {/* Additional Uploaded Compliance Documents */}
                    {extraDocs.length > 0 && (
                      <div className="pt-1 space-y-1.5">
                        {extraDocs.map(doc => (
                          <div
                            key={doc.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-teal-50/40 border border-teal-200/80 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span className="font-bold text-slate-800 truncate">
                                  {doc.documentType} ({doc.originalFileName})
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
                                  v{doc.version || 1}
                                </span>
                              </div>
                              <div className="pl-5 text-[10px] text-slate-500">
                                {formatFileSize(doc.fileSizeBytes)} • {new Date(doc.uploadedAt).toLocaleDateString()}
                                {doc.expiryDate ? ` • Exp: ${doc.expiryDate}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 pl-5 sm:pl-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewTarget({
                                    title: `${doc.documentType} — ${pax.fullName || pax.firstName}`,
                                    doc
                                  })
                                }
                                className="px-2 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadDocument(doc)}
                                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
                                title="Download"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openSingleDocUploadModal(pax, doc.category, doc)}
                                className="p-1.5 bg-white hover:bg-teal-50 border border-slate-200 rounded-lg text-teal-700 cursor-pointer"
                                title="Replace"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                              {canDeleteDocs && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDocToDelete(doc);
                                    setDeleteReason('');
                                  }}
                                  className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg text-rose-600 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Add / Edit Passenger Profile & Bulk Upload */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
                  <Users className="w-5 h-5 text-[#008f77]" />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingPassenger
                    ? canEditIdentity
                      ? `Edit Passenger #${editingPassenger.passengerNumber}`
                      : `Upload Documents for #${editingPassenger.passengerNumber} (${
                          editingPassenger.fullName || editingPassenger.firstName
                        })`
                    : `Add Passenger (#${currentPassengers.length + 1} of ${maxPax})`}
                </h3>
              </div>
              <button
                type="button"
                disabled={isSavingProfile}
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!canEditIdentity && (
              <div className="p-3 mb-4 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2">
                <Lock className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Booking Details Submitted (Read-Only):</span> Passenger identity fields cannot be modified after submission. You can upload or replace compliance documents below.
                </div>
              </div>
            )}

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSavePassenger} className="space-y-4">
              {/* Lead Passenger Toggle */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  !canEditIdentity ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-teal-50/50 border-teal-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[#008f77]" />
                  <div>
                    <span className="text-xs font-bold text-slate-900">Lead Passenger</span>
                    <p className="text-[11px] text-slate-500">
                      Designate this traveler as the primary contact. Enables PAN card requirement.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!canEditIdentity}
                  checked={isLeadPax}
                  onChange={e => setIsLeadPax(e.target.checked)}
                  className="w-4 h-4 text-[#008f77] rounded focus:ring-[#00C6A6] cursor-pointer disabled:cursor-not-allowed"
                />
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    First Name {canEditIdentity && '*'}
                  </label>
                  <input
                    type="text"
                    required={canEditIdentity}
                    disabled={!canEditIdentity}
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="e.g. Rajesh"
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      !canEditIdentity
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6]'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Middle Name</label>
                  <input
                    type="text"
                    disabled={!canEditIdentity}
                    value={middleName}
                    onChange={e => setMiddleName(e.target.value)}
                    placeholder="e.g. Kumar"
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      !canEditIdentity
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6]'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Last Name {canEditIdentity && '*'}
                  </label>
                  <input
                    type="text"
                    required={canEditIdentity}
                    disabled={!canEditIdentity}
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="e.g. Malhotra"
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      !canEditIdentity
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6]'
                    }`}
                  />
                </div>
              </div>

              {/* DOB, Gender, Nationality */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    disabled={!canEditIdentity}
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      !canEditIdentity
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6]'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    disabled={!canEditIdentity}
                    value={gender}
                    onChange={(e: any) => setGender(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      !canEditIdentity
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] cursor-pointer'
                    }`}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    disabled={!canEditIdentity}
                    value={nationality}
                    onChange={e => setNationality(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      !canEditIdentity
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6]'
                    }`}
                  />
                </div>
              </div>

              {/* Passport Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Passport Number</label>
                  <input
                    type="text"
                    value={passportNumber}
                    onChange={e => setPassportNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. Z5891243"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono uppercase bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Passport Issue Date</label>
                  <input
                    type="date"
                    value={passportIssueDate}
                    onChange={e => setPassportIssueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Passport Expiry Date</label>
                  <input
                    type="date"
                    value={passportExpiryDate}
                    onChange={e => setPassportExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>
              </div>

              {/* Document Uploads Section (Uploads directly to Firebase Storage + Firestore on Save) */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Compliance Document Attachments (PDF / JPG / PNG / WEBP, max 15 MB)
                  </h4>
                  <span className="text-[11px] text-teal-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Storage + Firestore Persisted
                  </span>
                </div>

                {/* Passport Front */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white border border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      1. Passport Front Page (Photo & Bio) *
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {pendingFrontFile
                        ? `Queued: ${pendingFrontFile.name} (${formatFileSize(pendingFrontFile.size)})`
                        : editingPassenger && findActiveDocByCategory(editingPassenger.id, 'PASSPORT_FRONT')
                        ? `Saved: ${findActiveDocByCategory(editingPassenger.id, 'PASSPORT_FRONT')!.originalFileName}`
                        : 'No file attached'}
                    </span>
                  </div>
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{pendingFrontFile ? 'Change File' : 'Select Front'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={e => handleQueueFile(e, 'FRONT')}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Passport Back */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white border border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      2. Passport Back Page (Address & Endorsement) *
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {pendingBackFile
                        ? `Queued: ${pendingBackFile.name} (${formatFileSize(pendingBackFile.size)})`
                        : editingPassenger && findActiveDocByCategory(editingPassenger.id, 'PASSPORT_BACK')
                        ? `Saved: ${findActiveDocByCategory(editingPassenger.id, 'PASSPORT_BACK')!.originalFileName}`
                        : 'No file attached'}
                    </span>
                  </div>
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{pendingBackFile ? 'Change File' : 'Select Back'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={e => handleQueueFile(e, 'BACK')}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Visa Copy */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white border border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      3. Visa Copy / Electronic Travel Authority (ETA)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {pendingVisaFile
                        ? `Queued: ${pendingVisaFile.name} (${formatFileSize(pendingVisaFile.size)})`
                        : editingPassenger && findActiveDocByCategory(editingPassenger.id, 'VISA_COPY')
                        ? `Saved: ${findActiveDocByCategory(editingPassenger.id, 'VISA_COPY')!.originalFileName}`
                        : 'No visa file attached'}
                    </span>
                  </div>
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{pendingVisaFile ? 'Change File' : 'Select Visa'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={e => handleQueueFile(e, 'VISA')}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Lead Passenger PAN Card */}
                {(editingPassenger ? editingPassenger.isLeadPax : isLeadPax) ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                        4. PAN Card (Mandatory for Lead Passenger) *
                      </span>
                      <label className="cursor-pointer px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition-colors">
                        <Upload className="w-3 h-3" />
                        <span>{pendingPanFile ? 'Change PAN' : 'Select PAN'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={e => handleQueueFile(e, 'PAN')}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={panNumber}
                        onChange={e => setPanNumber(e.target.value.toUpperCase())}
                        placeholder="PAN Number (e.g. ABCDE1234F)"
                        className="w-full px-3 py-2 rounded-xl text-xs font-mono uppercase bg-white border border-amber-300 text-slate-900 focus:outline-none"
                      />
                      <span className="text-[11px] text-slate-600 font-mono flex items-center truncate">
                        {pendingPanFile
                          ? `Queued: ${pendingPanFile.name}`
                          : editingPassenger && findActiveDocByCategory(editingPassenger.id, 'PAN_CARD')
                          ? `Saved: ${findActiveDocByCategory(editingPassenger.id, 'PAN_CARD')!.originalFileName}`
                          : 'No PAN file uploaded'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 text-center text-xs text-slate-400 italic">
                    PAN Card is only collected for the Lead Passenger.
                  </div>
                )}
              </div>

              {isSavingProfile && saveProgressText && (
                <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 space-y-2">
                  <div className="flex items-center justify-between text-xs text-teal-900 font-semibold gap-2">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-teal-700 shrink-0" />
                      <span>{saveProgressText}</span>
                    </span>
                    <span className="font-mono font-black text-teal-800">{saveProgressPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-teal-100 overflow-hidden">
                    <div
                      className="h-full bg-[#008f77] transition-all duration-200 rounded-full"
                      style={{ width: `${Math.max(5, saveProgressPercent)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingProfile}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 rounded-xl text-xs font-black shadow-md shadow-[#00C6A6]/20 cursor-pointer transition-colors inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {isSavingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {isSavingProfile
                      ? 'Saving & Uploading...'
                      : editingPassenger
                      ? canEditIdentity
                        ? 'Update Passenger & Save Docs'
                        : 'Upload & Save Documents'
                      : 'Save Passenger & Upload Docs'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Upload Multiple / Replace Compliance Documents */}
      {uploadModalPax && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <form
            onSubmit={handleSingleDocSubmit}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 border border-slate-200 shadow-2xl space-y-4 my-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  {uploadModalReplaceDoc
                    ? `Replace ${uploadModalReplaceDoc.documentType} (New v${(uploadModalReplaceDoc.version || 1) + 1})`
                    : `Upload Compliance Documents (Single or Multiple Files)`}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Passenger: {uploadModalPax.fullName || `${uploadModalPax.firstName} ${uploadModalPax.lastName}`}
                </p>
              </div>
              <button
                type="button"
                disabled={isUploadingSingleDoc}
                onClick={() => {
                  setUploadModalPax(null);
                  setUploadModalReplaceDoc(null);
                  setUploadModalQueue([]);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{uploadModalError}</span>
              </div>
            )}

            {!uploadModalReplaceDoc ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Default Document Category for Added Files
                    </label>
                    <select
                      value={uploadModalCategory}
                      disabled={isUploadingSingleDoc}
                      onChange={e => setUploadModalCategory(e.target.value as PassengerComplianceDocumentCategory)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900"
                    >
                      {ADDITIONAL_DOC_CATEGORIES.filter(cat => cat !== 'PAN_CARD' || uploadModalPax.isLeadPax).map(
                        cat => (
                          <option key={cat} value={cat}>
                            {PASSENGER_DOC_CATEGORY_LABELS[cat]}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Default Expiry Date (Optional)</label>
                    <input
                      type="date"
                      disabled={isUploadingSingleDoc}
                      value={uploadModalExpiry}
                      onChange={e => setUploadModalExpiry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Add One or More Files (PDF, JPG, PNG, WEBP — max 15 MB each) *
                  </label>
                  <input
                    type="file"
                    multiple
                    disabled={isUploadingSingleDoc}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={e => {
                      handleAddFilesToUploadQueue(e.target.files);
                      e.target.value = '';
                    }}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-800 hover:file:bg-teal-100 cursor-pointer"
                  />
                </div>

                {uploadModalQueue.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                      <span>Upload Queue ({uploadModalQueue.length} file{uploadModalQueue.length > 1 ? 's' : ''})</span>
                      {uploadModalQueue.some(q => q.status === 'FAILED') && !isUploadingSingleDoc && (
                        <button
                          type="button"
                          onClick={() => {
                            const failedIds = uploadModalQueue.filter(q => q.status === 'FAILED').map(q => q.id);
                            void processQueuedUploadItems(failedIds);
                          }}
                          className="text-amber-700 hover:text-amber-900 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" /> Retry All Failed
                        </button>
                      )}
                    </div>

                    {uploadModalQueue.map(item => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border text-xs space-y-2 ${
                          item.status === 'SAVED'
                            ? 'bg-emerald-50/60 border-emerald-200'
                            : item.status === 'FAILED'
                            ? 'bg-rose-50/70 border-rose-200'
                            : item.status === 'UPLOADING'
                            ? 'bg-teal-50/60 border-teal-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 truncate">
                              {item.file.name}{' '}
                              <span className="font-mono font-normal text-slate-500">
                                ({formatFileSize(item.file.size)})
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-600">{item.stageMessage}</p>
                            {item.error && (
                              <p className="text-[11px] text-rose-700 font-semibold mt-0.5">{item.error}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.status === 'SAVED' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                                Saved
                              </span>
                            )}
                            {item.status === 'UPLOADING' && (
                              <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-black font-mono">
                                {item.progressPercent}%
                              </span>
                            )}
                            {item.status === 'FAILED' && !isUploadingSingleDoc && (
                              <button
                                type="button"
                                onClick={() => void processQueuedUploadItems([item.id])}
                                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" /> Retry
                              </button>
                            )}
                            {item.status !== 'UPLOADING' && item.status !== 'SAVED' && (
                              <button
                                type="button"
                                onClick={() => removeQueuedItem(item.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white cursor-pointer"
                                title="Remove from queue"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {item.status === 'UPLOADING' && (
                          <div className="w-full h-1.5 rounded-full bg-teal-100 overflow-hidden">
                            <div
                              className="h-full bg-[#008f77] transition-all duration-200 rounded-full"
                              style={{ width: `${Math.max(8, item.progressPercent)}%` }}
                            />
                          </div>
                        )}

                        {item.status === 'QUEUED' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <select
                              value={item.category}
                              disabled={isUploadingSingleDoc}
                              onChange={e =>
                                updateQueuedItem(item.id, {
                                  category: e.target.value as PassengerComplianceDocumentCategory
                                })
                              }
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-800"
                            >
                              {ADDITIONAL_DOC_CATEGORIES.filter(cat => cat !== 'PAN_CARD' || uploadModalPax.isLeadPax).map(
                                cat => (
                                  <option key={cat} value={cat}>
                                    {PASSENGER_DOC_CATEGORY_LABELS[cat]}
                                  </option>
                                )
                              )}
                            </select>
                            <input
                              type="date"
                              disabled={isUploadingSingleDoc}
                              value={item.expiryDate}
                              onChange={e => updateQueuedItem(item.id, { expiryDate: e.target.value })}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] text-slate-800"
                              title="Expiry Date (Optional)"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    disabled={isUploadingSingleDoc}
                    placeholder="e.g. Verified against ticket"
                    value={uploadModalNotes}
                    onChange={e => setUploadModalNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Replacement File (PDF, JPG, PNG, WEBP — max 15 MB) *
                  </label>
                  <input
                    type="file"
                    required
                    disabled={isUploadingSingleDoc}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={e => {
                      const f = e.target.files?.[0] || null;
                      setUploadModalFile(f);
                      setUploadModalError(null);
                      setReplaceProgress(null);
                    }}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-800 hover:file:bg-teal-100 cursor-pointer"
                  />
                  {uploadModalFile && (
                    <p className="text-[11px] text-teal-700 font-mono mt-1">
                      Selected: {uploadModalFile.name} ({formatFileSize(uploadModalFile.size)})
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      disabled={isUploadingSingleDoc}
                      value={uploadModalExpiry}
                      onChange={e => setUploadModalExpiry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Replacement Reason</label>
                    <input
                      type="text"
                      disabled={isUploadingSingleDoc}
                      placeholder="e.g. Clearer scan / renewed passport"
                      value={uploadModalReplaceReason}
                      onChange={e => setUploadModalReplaceReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                    />
                  </div>
                </div>

                {replaceProgress && (
                  <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
                      <span>{replaceProgress.message}</span>
                      <span className="font-mono font-black">{replaceProgress.percent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-teal-100 overflow-hidden">
                      <div
                        className="h-full bg-[#008f77] transition-all duration-200 rounded-full"
                        style={{ width: `${Math.max(8, replaceProgress.percent)}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isUploadingSingleDoc}
                onClick={() => {
                  setUploadModalPax(null);
                  setUploadModalReplaceDoc(null);
                  setUploadModalQueue([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                {uploadModalQueue.some(q => q.status === 'SAVED') ? 'Done' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={
                  isUploadingSingleDoc ||
                  (uploadModalReplaceDoc
                    ? !uploadModalFile
                    : !uploadModalQueue.some(q => q.status === 'QUEUED' || q.status === 'FAILED'))
                }
                className="px-4 py-2 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isUploadingSingleDoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isUploadingSingleDoc
                    ? 'Uploading...'
                    : uploadModalReplaceDoc
                    ? uploadModalError
                      ? 'Retry Replacement Upload'
                      : 'Upload Replacement'
                    : uploadModalQueue.some(q => q.status === 'FAILED') && !uploadModalQueue.some(q => q.status === 'QUEUED')
                    ? 'Retry Failed Uploads'
                    : `Upload & Persist (${uploadModalQueue.filter(q => q.status === 'QUEUED' || q.status === 'FAILED').length})`}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Authenticated Document Preview Modal (Supports PDF + Images) */}
      {previewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="min-w-0">
                <h4 className="text-sm font-black text-slate-900 truncate">{previewTarget.title}</h4>
                {previewTarget.doc && (
                  <p className="text-[11px] text-slate-500 font-mono truncate">
                    {previewTarget.doc.originalFileName} • v{previewTarget.doc.version || 1} •{' '}
                    {formatFileSize(previewTarget.doc.fileSizeBytes)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewTarget.doc && (
                  <button
                    type="button"
                    onClick={() => handleDownloadDocument(previewTarget.doc!)}
                    className="px-3 py-1.5 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewTarget(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-100 min-h-[420px]">
              {isLoadingPreview ? (
                <div className="text-center space-y-2 text-xs text-slate-600">
                  <Loader2 className="w-7 h-7 animate-spin text-[#008f77] mx-auto" />
                  <p className="font-semibold">Loading authenticated document from Storage...</p>
                </div>
              ) : previewError ? (
                <div className="p-6 text-center max-w-md space-y-2">
                  <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                  <p className="text-xs font-bold text-rose-800">{previewError}</p>
                </div>
              ) : previewBlobUrl ? (
                previewMimeType === 'application/pdf' ? (
                  <iframe
                    src={previewBlobUrl}
                    title={previewTarget.title}
                    className="w-full h-[68vh] rounded-xl border border-slate-200 bg-white"
                  />
                ) : (
                  <img
                    src={previewBlobUrl}
                    alt={previewTarget.title}
                    className="max-w-full max-h-[68vh] object-contain rounded-xl shadow-sm bg-white"
                  />
                )
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Document Version History */}
      {historyDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" />
                  Document Version History
                </h4>
                <p className="text-[11px] text-slate-500">
                  {historyDoc.documentType} • Active Version: v{historyDoc.version || 1} ({historyDoc.originalFileName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto space-y-2.5 flex-1 text-xs">
              {(historyDoc.versionHistory || []).map((v, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      v{v.version} — {v.originalFileName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatFileSize(v.fileSizeBytes)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Replaced on {new Date(v.replacedAt).toLocaleString()} by {v.replacedByName || 'Authorized User'}
                  </p>
                  {v.replaceReason && (
                    <p className="text-[11px] text-slate-500 italic">"{v.replaceReason}"</p>
                  )}
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setHistoryDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Internal Document Verification */}
      {verifyTargetDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveVerification}
            className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-black text-slate-900">Verify Compliance Document</h4>
              <button
                type="button"
                onClick={() => setVerifyTargetDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600">
              <strong>{verifyTargetDoc.documentType}</strong> — {verifyTargetDoc.originalFileName}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Verification Status</label>
              <select
                value={verifyStatus}
                onChange={e => setVerifyStatus(e.target.value as PassengerDocumentVerificationStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
              >
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="APPROVED">Verified / Approved</option>
                <option value="REJECTED">Rejected (Re-upload Required)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={verifyExpiry}
                onChange={e => setVerifyExpiry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Verification Notes</label>
              <textarea
                rows={3}
                value={verifyNotes}
                onChange={e => setVerifyNotes(e.target.value)}
                placeholder="Internal compliance verification notes..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVerifyTargetDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingVerification}
                className="px-4 py-2 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isUpdatingVerification ? 'Saving...' : 'Save Verification'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 6: Inline Confirm Delete Passenger */}
      {paxToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <h4 className="text-sm font-black text-slate-900">Remove Passenger from Manifest?</h4>
            <p className="text-xs text-slate-600">
              Are you sure you want to remove <strong>{paxToDelete.name}</strong> from this booking manifest?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPaxToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePassenger}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Remove Passenger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Inline Confirm Delete Document */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <h4 className="text-sm font-black text-slate-900">Delete Compliance Document?</h4>
            <p className="text-xs text-slate-600">
              Delete <strong>{docToDelete.documentType}</strong> ({docToDelete.originalFileName}) for{' '}
              <strong>{docToDelete.passengerName}</strong>? Audit history will be preserved and the Storage object will be deleted if no other record references it.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason (Optional)</label>
              <input
                type="text"
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="e.g. Uploaded wrong passenger passport"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingDoc}
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingDoc}
                onClick={handleConfirmDeleteDocument}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingDoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeletingDoc ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
