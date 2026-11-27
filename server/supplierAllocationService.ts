import { Router, Request, Response } from 'express';
import {
  Booking,
  BookingItem,
  ConsolidatedAllocationDocument,
  ConsolidatedPriceAllocationMethod,
  CurrencyCode,
  Hotel,
  Product,
  Supplier,
  SupplierAllocationRecord,
  SupplierAllocationStatus
} from '../src/types';
import {
  distributeConsolidatedCommercialPrice,
  isItemEligibleForNewConsolidatedAllocation,
  roundCurrency,
  validateSupplierEligibilityForItems
} from '../src/services/supplierAllocationEngine';
import { fromFirestoreDocument, toFirestoreFields } from './marginGovernanceService';
import {
  extractBearerToken,
  getServerFirestoreBaseUrl,
  verifyServerFirebaseIdToken
} from './firebaseServerAuth';

function getFirestoreBaseUrl(): string {
  return getServerFirestoreBaseUrl();
}

const MASTER_ADMIN_EMAILS = new Set([
  'business@theunbound.in',
  'admin@theunbound.com',
  'marcus@theunbound.in'
]);

const INTERNAL_ALLOWED_ROLES = new Set([
  'ADMIN',
  'SUPER_ADMIN',
  'TEAM_MEMBER',
  'DMC_STAFF',
  'OPERATIONS',
  'FINANCE'
]);

export interface VerifiedInternalCaller {
  uid: string;
  email: string;
  name: string;
  role: string;
  idToken: string;
}

export type InternalCallerVerifier = (
  req: Request
) => Promise<
  { ok: true; caller: VerifiedInternalCaller } | { ok: false; status: number; error: string }
>;

export async function verifyInternalOperationsCaller(
  req: Request
): Promise<
  { ok: true; caller: VerifiedInternalCaller } | { ok: false; status: number; error: string }
> {
  const bearer = extractBearerToken(req);
  if (!bearer.ok) {
    return bearer;
  }
  const idToken = bearer.idToken;

  const verified = await verifyServerFirebaseIdToken(idToken);
  if (!verified.ok) {
    return verified;
  }
  const { uid, email, displayName } = verified.token;

  let userDoc: Record<string, any> | null = null;
  try {
    const userRes = await fetch(`${getFirestoreBaseUrl()}/users/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(5000)
    });
    if (userRes.ok) {
      userDoc = fromFirestoreDocument(await userRes.json());
    }
  } catch {
    // Fallback to master admin email allowlist below
  }

  const isMaster = MASTER_ADMIN_EMAILS.has(email);
  const role = String(userDoc?.role || (isMaster ? 'ADMIN' : 'B2B_AGENT')).toUpperCase();
  const approvalStatus = String(userDoc?.approvalStatus || (isMaster ? 'APPROVED' : 'PENDING')).toUpperCase();
  const isInternal = isMaster || (INTERNAL_ALLOWED_ROLES.has(role) && approvalStatus === 'APPROVED');

  if (!isInternal) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: Internal Admin, Operations, or Finance authorization is required for supplier allocations and net cost data.'
    };
  }

  return {
    ok: true,
    caller: {
      uid,
      email,
      name: String(userDoc?.displayName || userDoc?.name || displayName || email || 'Operations Admin'),
      role,
      idToken
    }
  };
}

// ============================================================================
// FIRESTORE REST HELPERS
// ============================================================================

async function fetchFirestoreDoc<T>(
  collection: string,
  docId: string,
  idToken: string
): Promise<T | null> {
  const res = await fetch(
    `${getFirestoreBaseUrl()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`,
    {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(8000)
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Firestore read failed for ${collection}/${docId} (${res.status})`);
  }
  return fromFirestoreDocument(await res.json()) as T;
}

async function listFirestoreCollection<T>(
  collection: string,
  idToken: string,
  pageSize = 300
): Promise<T[]> {
  const res = await fetch(
    `${getFirestoreBaseUrl()}/${encodeURIComponent(collection)}?pageSize=${pageSize}`,
    {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(10000)
    }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  const docs = Array.isArray(data.documents) ? data.documents : [];
  return docs.map((d: any) => fromFirestoreDocument(d) as T);
}

async function writeFirestoreDoc(
  collection: string,
  docId: string,
  payload: Record<string, any>,
  idToken: string
): Promise<void> {
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  const res = await fetch(
    `${getFirestoreBaseUrl()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: toFirestoreFields(cleanPayload) }),
      signal: AbortSignal.timeout(10000)
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore write failed for ${collection}/${docId} (${res.status}): ${errText}`);
  }
}

function mapParentStatusToItemStatus(
  status: SupplierAllocationRecord['status']
): {
  allocationStatus: SupplierAllocationStatus;
  supplierStatus: BookingItem['supplierStatus'];
  confirmationStatus: BookingItem['supplierConfirmationStatus'];
  operationalStatus: BookingItem['operationalStatus'];
} {
  switch (status) {
    case 'CONFIRMED':
      return {
        allocationStatus: 'Supplier Confirmed',
        supplierStatus: 'CONFIRMED_BY_SUPPLIER',
        confirmationStatus: 'Confirmed',
        operationalStatus: 'Confirmed'
      };
    case 'SENT_TO_SUPPLIER':
      return {
        allocationStatus: 'Sent to Supplier',
        supplierStatus: 'SENT_TO_SUPPLIER',
        confirmationStatus: 'Confirmation Pending',
        operationalStatus: 'Confirmation Pending'
      };
    case 'AWAITING_CONFIRMATION':
      return {
        allocationStatus: 'Awaiting Supplier Confirmation',
        supplierStatus: 'SENT_TO_SUPPLIER',
        confirmationStatus: 'Confirmation Pending',
        operationalStatus: 'Confirmation Pending'
      };
    case 'AMENDMENT_REQUIRED':
      return {
        allocationStatus: 'Amendment Required',
        supplierStatus: 'AMENDMENT_REQUESTED',
        confirmationStatus: 'Confirmation Pending',
        operationalStatus: 'Confirmation Pending'
      };
    case 'CANCELLED':
    case 'REMOVED':
      return {
        allocationStatus: 'Pending Allocation',
        supplierStatus: 'PENDING_DISPATCH',
        confirmationStatus: 'Not Confirmed',
        operationalStatus: 'Supplier Not Allocated'
      };
    default:
      return {
        allocationStatus: 'Supplier Selected',
        supplierStatus: 'SENT_TO_SUPPLIER',
        confirmationStatus: 'Not Confirmed',
        operationalStatus: 'Confirmation Pending'
      };
  }
}

function isValidDocumentId(id: string): boolean {
  return typeof id === 'string' && id.trim().length > 0 && id.length <= 140 && !id.includes('/');
}

// ============================================================================
// ADMIN SUPPLIER ALLOCATION EXPRESS ROUTER
// ============================================================================

export function createAdminSupplierAllocationRouter(
  customVerifier?: InternalCallerVerifier
): Router {
  const router = Router();
  const verifyCaller = customVerifier || verifyInternalOperationsCaller;

  /**
   * POST /api/admin/supplier-allocations/preview
   * Validates supplier-category eligibility, currency consistency, and returns exact decimal-safe distribution.
   */
  router.post('/preview', async (req: Request, res: Response) => {
    const auth = await verifyCaller(req);
    if (auth.ok === false) return res.status(auth.status).json({ error: auth.error });

    try {
      const {
        bookingId,
        serviceItemIds,
        supplierId,
        consolidatedCommercialPrice,
        allocationMethod = 'PROPORTIONAL_NET_COST',
        manualAllocations,
        authorizedCommonCurrency,
        authorizedFxRates
      } = req.body || {};

      if (!isValidDocumentId(bookingId)) {
        return res.status(400).json({ error: 'Valid bookingId is required.' });
      }
      if (!Array.isArray(serviceItemIds) || serviceItemIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one Service Item.' });
      }

      const [booking, supplier, allProducts, allHotels, allAllocations] = await Promise.all([
        fetchFirestoreDoc<Booking>('bookings', bookingId, auth.caller.idToken),
        isValidDocumentId(supplierId)
          ? fetchFirestoreDoc<Supplier>('suppliers', supplierId, auth.caller.idToken)
          : Promise.resolve(null),
        listFirestoreCollection<Product>('products', auth.caller.idToken),
        listFirestoreCollection<Hotel>('hotels', auth.caller.idToken),
        listFirestoreCollection<SupplierAllocationRecord>('supplier_allocations', auth.caller.idToken)
      ]);

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }

      const productMap = new Map<string, Product>(allProducts.filter(p => p?.id).map(p => [p.id, p]));
      const hotelMap = new Map<string, Hotel>(allHotels.filter(h => h?.id).map(h => [h.id, h]));
      const bookingAllocations = allAllocations.filter(a => a.bookingId === booking.id);

      const selectedItems = (booking.items || []).filter(it => serviceItemIds.includes(it.id));
      if (selectedItems.length !== serviceItemIds.length) {
        return res.status(400).json({ error: 'One or more selected Service Items do not exist on this booking.' });
      }

      const duplicateConflicts = selectedItems
        .map(it => ({ item: it, check: isItemEligibleForNewConsolidatedAllocation(it, bookingAllocations) }))
        .filter(x => !x.check.eligible)
        .map(x => ({ serviceItemId: x.item.id, productName: x.item.productName, reason: x.check.reason }));

      const supplierEligibility = supplier
        ? validateSupplierEligibilityForItems(supplier, selectedItems, productMap, hotelMap)
        : null;

      const distribution = distributeConsolidatedCommercialPrice({
        items: selectedItems,
        booking,
        productMap,
        hotelMap,
        consolidatedCommercialPrice: Number(consolidatedCommercialPrice ?? 0),
        allocationMethod: allocationMethod as ConsolidatedPriceAllocationMethod,
        manualAllocations,
        authorizedCommonCurrency: authorizedCommonCurrency as CurrencyCode | undefined,
        authorizedFxRates
      });

      return res.json({
        success: true,
        duplicateConflicts,
        supplierEligibility,
        distribution
      });
    } catch (err: any) {
      console.error('[SUPPLIER-ALLOCATION-API] preview failed:', err);
      return res.status(500).json({ error: err?.message || 'Failed to compute consolidated allocation preview.' });
    }
  });

  /**
   * GET /api/admin/supplier-allocations/booking/:bookingId
   * Returns all consolidated supplier allocations linked to a booking (Internal Admin/Ops/Finance only).
   */
  router.get('/booking/:bookingId', async (req: Request, res: Response) => {
    const auth = await verifyCaller(req);
    if (auth.ok === false) return res.status(auth.status).json({ error: auth.error });

    try {
      const bookingId = String(req.params.bookingId || '');
      if (!isValidDocumentId(bookingId)) {
        return res.status(400).json({ error: 'Valid bookingId is required.' });
      }
      const allAllocations = await listFirestoreCollection<SupplierAllocationRecord>(
        'supplier_allocations',
        auth.caller.idToken
      );
      const matching = allAllocations
        .filter(a => a.bookingId === bookingId || a.bookingReference === bookingId)
        .sort((a, b) => new Date(b.allocatedAt || 0).getTime() - new Date(a.allocatedAt || 0).getTime());

      return res.json({ success: true, allocations: matching });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch supplier allocations.' });
    }
  });

  /**
   * POST /api/admin/supplier-allocations/consolidated
   * Creates one parent consolidated SupplierAllocationRecord and links all selected Booking Service Items.
   */
  router.post('/consolidated', async (req: Request, res: Response) => {
    const auth = await verifyCaller(req);
    if (auth.ok === false) return res.status(auth.status).json({ error: auth.error });

    try {
      const {
        bookingId,
        serviceItemIds,
        supplierId,
        consolidatedCommercialPrice,
        allocationMethod = 'PROPORTIONAL_NET_COST',
        manualAllocations,
        status = 'ALLOCATED',
        confirmationRef,
        internalNotes,
        supplierNotes,
        supportingDocuments,
        idempotencyKey,
        authorizedCommonCurrency,
        authorizedFxRates
      } = req.body || {};

      if (!isValidDocumentId(bookingId)) {
        return res.status(400).json({ error: 'Valid bookingId is required.' });
      }
      if (!isValidDocumentId(supplierId)) {
        return res.status(400).json({ error: 'Valid supplierId is required.' });
      }
      if (!Array.isArray(serviceItemIds) || serviceItemIds.length === 0) {
        return res.status(400).json({ error: 'At least one Service Item must be selected.' });
      }
      const uniqueItemIds = Array.from(new Set(serviceItemIds.map((x: any) => String(x).trim()).filter(Boolean)));
      if (uniqueItemIds.length === 0) {
        return res.status(400).json({ error: 'Valid Service Item IDs are required.' });
      }

      const [booking, supplier, allProducts, allHotels, allAllocations] = await Promise.all([
        fetchFirestoreDoc<Booking>('bookings', bookingId, auth.caller.idToken),
        fetchFirestoreDoc<Supplier>('suppliers', supplierId, auth.caller.idToken),
        listFirestoreCollection<Product>('products', auth.caller.idToken),
        listFirestoreCollection<Hotel>('hotels', auth.caller.idToken),
        listFirestoreCollection<SupplierAllocationRecord>('supplier_allocations', auth.caller.idToken)
      ]);

      if (!booking) return res.status(404).json({ error: 'Booking not found.' });
      if (!supplier) return res.status(404).json({ error: 'Supplier not found in Supplier Management.' });

      // Idempotency protection against double submission
      if (idempotencyKey && typeof idempotencyKey === 'string') {
        const existingByKey = allAllocations.find(
          a => a.bookingId === booking.id && a.idempotencyKey === idempotencyKey
        );
        if (existingByKey) {
          return res.status(200).json({
            success: true,
            idempotentReplay: true,
            allocation: existingByKey,
            booking
          });
        }
      }

      const bookingAllocations = allAllocations.filter(a => a.bookingId === booking.id);
      const selectedItems = (booking.items || []).filter(it => uniqueItemIds.includes(it.id));
      if (selectedItems.length !== uniqueItemIds.length) {
        return res.status(400).json({ error: 'One or more selected Service Items were not found on this booking.' });
      }

      // Duplicate active allocation guard
      for (const item of selectedItems) {
        const eligibility = isItemEligibleForNewConsolidatedAllocation(item, bookingAllocations);
        if (!eligibility.eligible) {
          return res.status(409).json({
            error: `Duplicate allocation blocked for "${item.productName}": ${eligibility.reason}`
          });
        }
      }

      const productMap = new Map<string, Product>(allProducts.filter(p => p?.id).map(p => [p.id, p]));
      const hotelMap = new Map<string, Hotel>(allHotels.filter(h => h?.id).map(h => [h.id, h]));

      // Strict supplier-category eligibility enforcement
      const supplierCheck = validateSupplierEligibilityForItems(supplier, selectedItems, productMap, hotelMap);
      if (!supplierCheck.eligible) {
        return res.status(422).json({
          error: 'Supplier is not eligible for one or more selected Service Items.',
          incompatibleItems: supplierCheck.incompatibleItems,
          warnings: supplierCheck.warnings
        });
      }

      // Exact decimal-safe distribution & reconciliation
      const dist = distributeConsolidatedCommercialPrice({
        items: selectedItems,
        booking,
        productMap,
        hotelMap,
        consolidatedCommercialPrice: Number(consolidatedCommercialPrice),
        allocationMethod: allocationMethod as ConsolidatedPriceAllocationMethod,
        manualAllocations,
        authorizedCommonCurrency: authorizedCommonCurrency as CurrencyCode | undefined,
        authorizedFxRates
      });

      if (!dist.valid) {
        return res.status(422).json({
          error: dist.errors.join(' '),
          errors: dist.errors,
          distribution: dist
        });
      }

      const now = new Date().toISOString();
      const allocationId = `csa-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const normalizedStatus = (
        ['ALLOCATED', 'SENT_TO_SUPPLIER', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'AMENDMENT_REQUIRED'].includes(status)
          ? status
          : 'ALLOCATED'
      ) as SupplierAllocationRecord['status'];
      const mappedItemState = mapParentStatusToItemStatus(normalizedStatus);

      const finalItemAllocations = dist.itemAllocations.map(a => ({
        ...a,
        confirmationStatus: mappedItemState.allocationStatus,
        itemConfirmationRef: confirmationRef ? String(confirmationRef).trim() : a.itemConfirmationRef
      }));

      const sanitizedDocs: ConsolidatedAllocationDocument[] = Array.isArray(supportingDocuments)
        ? supportingDocuments
            .filter((d: any) => d && typeof d.name === 'string' && d.name.trim())
            .map((d: any, idx: number) => ({
              id: String(d.id || `doc-${Date.now()}-${idx}`),
              name: String(d.name).trim(),
              url: typeof d.url === 'string' ? d.url.trim() : undefined,
              uploadedAt: String(d.uploadedAt || now),
              uploadedBy: auth.caller.name
            }))
        : [];

      const allocationRecord: SupplierAllocationRecord = {
        id: allocationId,
        allocationType: 'CONSOLIDATED',
        supplierId: supplier.id,
        supplierNameSnapshot: supplier.name,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        serviceItemId: uniqueItemIds[0],
        serviceItemIds: uniqueItemIds,
        productIds: Array.from(new Set(selectedItems.map(i => i.productId).filter(Boolean))),
        serviceName: `${selectedItems.length} Consolidated Services (${selectedItems.map(i => i.productName).slice(0, 2).join(', ')}${selectedItems.length > 2 ? ` +${selectedItems.length - 2} more` : ''})`,
        customerName: booking.customer?.leadTravelerName || booking.customer?.name || 'Guest',
        travelDate: selectedItems[0]?.serviceDate || selectedItems[0]?.travelDate || booking.travelStartDate,
        allocatedAt: now,
        allocatedBy: auth.caller.uid,
        allocatedByName: auth.caller.name,
        updatedAt: now,
        status: normalizedStatus,
        confirmationRef: confirmationRef ? String(confirmationRef).trim() : undefined,
        consolidatedCommercialPrice: dist.consolidatedCommercialPrice,
        totalNetCost: dist.totalNetCost,
        totalSellingPrice: dist.totalSellingPrice,
        totalMarginAmount: dist.totalMarginAmount,
        totalMarginPercent: dist.totalMarginPercent,
        currency: dist.currency,
        allocationMethod: dist.allocationMethod,
        itemAllocations: finalItemAllocations,
        internalNotes: internalNotes ? String(internalNotes).trim() : undefined,
        supplierNotes: supplierNotes ? String(supplierNotes).trim() : undefined,
        supportingDocuments: sanitizedDocs,
        statusHistory: [
          {
            timestamp: now,
            status: normalizedStatus,
            actorId: auth.caller.uid,
            actorName: auth.caller.name,
            note: `Consolidated allocation created across ${uniqueItemIds.length} Service Items (${dist.allocationMethod}).`
          }
        ],
        idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
        version: 1
      };

      const allocationByItemId = new Map(finalItemAllocations.map(a => [a.serviceItemId, a]));

      // Link individual Service Items WITHOUT duplicating, merging, or overwriting customer selling prices
      const updatedItems = (booking.items || []).map(item => {
        const distItem = allocationByItemId.get(item.id);
        if (!distItem) return item;

        const nextHistory = [
          {
            timestamp: now,
            actorId: auth.caller.uid,
            actorName: auth.caller.name,
            action: 'ALLOCATED' as const,
            previousSupplierId: item.supplierId,
            previousSupplierName: item.supplierName,
            newSupplierId: supplier.id,
            newSupplierName: supplier.name,
            previousConfirmationRef: item.supplierConfirmationRef,
            newConfirmationRef: distItem.itemConfirmationRef || item.supplierConfirmationRef,
            previousStatus: item.supplierAllocationStatus,
            newStatus: mappedItemState.allocationStatus,
            reason: `Linked to Consolidated Supplier Allocation ${allocationId} (${dist.allocationMethod})`
          },
          ...(item.allocationHistory || [])
        ];

        return {
          ...item,
          consolidatedAllocationId: allocationId,
          allocationMethod: dist.allocationMethod,
          allocatedCommercialPrice: distItem.allocatedCommercialPrice,
          netPrice: item.netPrice !== undefined ? item.netPrice : distItem.netCost,
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierNameSnapshot: supplier.name,
          supplierContact: (supplier as any).primaryContact?.name || supplier.contactPerson || supplier.email || item.supplierContact,
          supplierPhone: (supplier as any).primaryContact?.phone || supplier.phone || item.supplierPhone,
          supplierEmail: (supplier as any).primaryContact?.email || supplier.email || item.supplierEmail,
          supplierCurrency: dist.currency,
          supplierConfirmationRef: distItem.itemConfirmationRef || item.supplierConfirmationRef,
          supplierAllocationStatus: mappedItemState.allocationStatus,
          supplierStatus: mappedItemState.supplierStatus,
          supplierConfirmationStatus: mappedItemState.confirmationStatus,
          operationalStatus: mappedItemState.operationalStatus,
          supplierAllocatedAt: now,
          supplierAllocatedBy: auth.caller.name,
          supplierNotes: supplierNotes ? String(supplierNotes).trim() : item.supplierNotes,
          allocationHistory: nextHistory
        };
      });

      const updatedBooking: Booking = {
        ...booking,
        items: updatedItems,
        consolidatedAllocations: [
          allocationRecord,
          ...((booking.consolidatedAllocations || []).filter(a => a.id !== allocationId))
        ],
        updatedAt: now
      };

      await writeFirestoreDoc('supplier_allocations', allocationId, allocationRecord, auth.caller.idToken);
      await writeFirestoreDoc('bookings', booking.id, updatedBooking, auth.caller.idToken);

      return res.status(201).json({
        success: true,
        allocation: allocationRecord,
        booking: updatedBooking
      });
    } catch (err: any) {
      console.error('[SUPPLIER-ALLOCATION-API] create consolidated failed:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create consolidated supplier allocation.' });
    }
  });

  /**
   * PATCH /api/admin/supplier-allocations/:allocationId
   * Updates parent status/ref, notes, documents, or independent per-item confirmation status/refs.
   * Preserves status history and enforces optimistic concurrency via expectedVersion.
   */
  router.patch('/:allocationId', async (req: Request, res: Response) => {
    const auth = await verifyCaller(req);
    if (auth.ok === false) return res.status(auth.status).json({ error: auth.error });

    try {
      const allocationId = String(req.params.allocationId || '');
      if (!isValidDocumentId(allocationId)) {
        return res.status(400).json({ error: 'Valid allocationId is required.' });
      }

      const existing = await fetchFirestoreDoc<SupplierAllocationRecord>(
        'supplier_allocations',
        allocationId,
        auth.caller.idToken
      );
      if (!existing) {
        return res.status(404).json({ error: 'Supplier allocation not found.' });
      }

      const {
        expectedVersion,
        status,
        confirmationRef,
        internalNotes,
        supplierNotes,
        supportingDocuments,
        itemUpdates,
        applyStatusToAllItems = false,
        note
      } = req.body || {};

      const currentVersion = existing.version || 1;
      if (expectedVersion !== undefined && Number(expectedVersion) !== currentVersion) {
        return res.status(409).json({
          error: `Concurrent modification detected (expected v${expectedVersion}, current v${currentVersion}). Refresh and retry.`
        });
      }

      const booking = await fetchFirestoreDoc<Booking>('bookings', existing.bookingId, auth.caller.idToken);
      if (!booking) {
        return res.status(404).json({ error: 'Linked booking not found.' });
      }

      const now = new Date().toISOString();
      const nextStatus = (status || existing.status) as SupplierAllocationRecord['status'];
      const isCancelling = nextStatus === 'CANCELLED' || nextStatus === 'REMOVED';
      const itemUpdateMap = new Map<
        string,
        { confirmationStatus?: SupplierAllocationStatus; itemConfirmationRef?: string }
      >();

      if (Array.isArray(itemUpdates)) {
        for (const u of itemUpdates) {
          if (u && typeof u.serviceItemId === 'string') {
            itemUpdateMap.set(u.serviceItemId, {
              confirmationStatus: u.confirmationStatus,
              itemConfirmationRef: u.itemConfirmationRef
            });
          }
        }
      }

      const mappedParent = mapParentStatusToItemStatus(nextStatus);
      const nextItemAllocations = (existing.itemAllocations || []).map(a => {
        const directUpdate = itemUpdateMap.get(a.serviceItemId);
        if (isCancelling) {
          return {
            ...a,
            confirmationStatus: 'Pending Allocation' as SupplierAllocationStatus
          };
        }
        return {
          ...a,
          confirmationStatus: directUpdate?.confirmationStatus
            ? directUpdate.confirmationStatus
            : applyStatusToAllItems
            ? mappedParent.allocationStatus
            : a.confirmationStatus,
          itemConfirmationRef:
            directUpdate?.itemConfirmationRef !== undefined
              ? directUpdate.itemConfirmationRef
              : confirmationRef !== undefined && applyStatusToAllItems
              ? String(confirmationRef).trim()
              : a.itemConfirmationRef
        };
      });

      const nextHistory = [
        {
          timestamp: now,
          status: nextStatus,
          actorId: auth.caller.uid,
          actorName: auth.caller.name,
          note: note ? String(note).trim() : `Allocation updated to ${nextStatus}.`
        },
        ...(existing.statusHistory || [])
      ];

      const updatedRecord: SupplierAllocationRecord = {
        ...existing,
        status: nextStatus,
        confirmationRef:
          confirmationRef !== undefined ? String(confirmationRef).trim() : existing.confirmationRef,
        internalNotes: internalNotes !== undefined ? String(internalNotes).trim() : existing.internalNotes,
        supplierNotes: supplierNotes !== undefined ? String(supplierNotes).trim() : existing.supplierNotes,
        supportingDocuments: Array.isArray(supportingDocuments)
          ? supportingDocuments
          : existing.supportingDocuments,
        itemAllocations: nextItemAllocations,
        statusHistory: nextHistory,
        version: currentVersion + 1,
        updatedAt: now
      };

      const updatedAllocMap = new Map(nextItemAllocations.map(a => [a.serviceItemId, a]));

      const updatedItems = (booking.items || []).map(item => {
        if (item.consolidatedAllocationId !== allocationId && !(existing.serviceItemIds || []).includes(item.id)) {
          return item;
        }
        if (isCancelling) {
          const clone = { ...item };
          delete clone.consolidatedAllocationId;
          delete clone.allocatedCommercialPrice;
          delete clone.allocationMethod;
          delete clone.supplierId;
          delete clone.supplierName;
          delete clone.supplierNameSnapshot;
          delete clone.supplierConfirmationRef;
          return {
            ...clone,
            supplierAllocationStatus: 'Pending Allocation' as SupplierAllocationStatus,
            supplierStatus: 'PENDING_DISPATCH' as const,
            supplierConfirmationStatus: 'Not Confirmed' as const,
            operationalStatus: 'Supplier Not Allocated' as const
          };
        }

        const itemEntry = updatedAllocMap.get(item.id);
        if (!itemEntry) return item;

        const isConfirmedItem = itemEntry.confirmationStatus === 'Supplier Confirmed' || itemEntry.confirmationStatus === 'Confirmed';
        const isAmendItem = itemEntry.confirmationStatus === 'Amendment Required';

        return {
          ...item,
          supplierConfirmationRef:
            itemEntry.itemConfirmationRef !== undefined
              ? itemEntry.itemConfirmationRef
              : item.supplierConfirmationRef,
          supplierAllocationStatus: itemEntry.confirmationStatus,
          supplierStatus: isConfirmedItem
            ? ('CONFIRMED_BY_SUPPLIER' as const)
            : isAmendItem
            ? ('AMENDMENT_REQUESTED' as const)
            : ('SENT_TO_SUPPLIER' as const),
          supplierConfirmationStatus: isConfirmedItem
            ? ('Confirmed' as const)
            : ('Confirmation Pending' as const),
          operationalStatus: isConfirmedItem
            ? ('Confirmed' as const)
            : ('Confirmation Pending' as const),
          supplierNotes: supplierNotes !== undefined ? String(supplierNotes).trim() : item.supplierNotes
        };
      });

      const updatedBooking: Booking = {
        ...booking,
        items: updatedItems,
        consolidatedAllocations: [
          updatedRecord,
          ...((booking.consolidatedAllocations || []).filter(a => a.id !== allocationId))
        ],
        updatedAt: now
      };

      await writeFirestoreDoc('supplier_allocations', allocationId, updatedRecord, auth.caller.idToken);
      await writeFirestoreDoc('bookings', booking.id, updatedBooking, auth.caller.idToken);

      return res.json({
        success: true,
        allocation: updatedRecord,
        booking: updatedBooking
      });
    } catch (err: any) {
      console.error('[SUPPLIER-ALLOCATION-API] update failed:', err);
      return res.status(500).json({ error: err?.message || 'Failed to update consolidated supplier allocation.' });
    }
  });

  return router;
}
