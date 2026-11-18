import {
  User,
  Booking,
  UserCashbackConfiguration,
  UserCashbackConfigHistoryRecord,
  CashbackWalletSummary,
  CashbackLedgerTransaction,
  BookingCashbackRecord,
  UserBankAccount,
  CashbackWithdrawalRequest,
  CashbackPolicyConfig,
  CashbackAuditLogRecord,
  CashbackNotificationEvent,
  WithdrawalStatus,
  CashbackAdminMetrics
} from '../types';
import { AppDatabase } from './db';
import {
  roundMoney,
  roundPercent,
  validateCashbackPercentInput,
  resolveCashbackPresetType,
  computeCreditSchedule,
  calculateEligibleBookingComponents,
  isBookingPaymentSatisfiedForCashback,
  buildInitialBookingCashbackRecord,
  evaluateDueForAutoCredit,
  maskAccountNumber,
  validateBankAccountInput,
  sanitizeBankAccountForDisplay,
  toMaskedBankSnapshot,
  canTransitionWithdrawalStatus,
  reconcileWalletFromLedger,
  normalizeDateYmd
} from './cashbackEngine';
import { isMasterAdmin } from './permissionEngine';

const KEYS = {
  USER_CONFIGS: 'cashback_user_configs',
  CONFIG_HISTORY: 'cashback_config_history',
  WALLETS: 'cashback_wallets',
  LEDGER: 'cashback_ledger_transactions',
  BOOKING_RECORDS: 'booking_cashback_records',
  BANK_ACCOUNTS: 'user_bank_accounts',
  WITHDRAWALS: 'cashback_withdrawal_requests',
  AUDIT_LOGS: 'cashback_audit_logs',
  NOTIFICATIONS: 'cashback_notifications',
  POLICY: 'cashback_policy',
  SCHEDULER_META: 'cashback_scheduler_telemetry'
} as const;

export function getDefaultCashbackPolicy(): CashbackPolicyConfig {
  return {
    id: 'cashback_policy',
    creditDelayDays: 3,
    defaultCurrency: 'INR',
    minWithdrawalAmount: 500,
    maxWithdrawalAmount: 500000,
    requireFullPaymentBeforeCredit: false,
    requireConfirmedBookingStatus: true,
    allowWithdrawalOnlyWhenActive: true,
    showCashbackTabToIneligibleUsers: false,
    holdOnDispute: true,
    maxCashbackPercentCeiling: 25,
    eligibleComponents: {
      baseProductSellPrice: true,
      hotels: false,
      transfers: true,
      activities: true,
      tours: true,
      visas: true,
      packages: true,
      includeTaxes: false,
      includeServiceFees: false,
      includeSurcharges: false,
      deductDiscounts: true
    },
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
    updatedByName: 'TheUnbound Finance Governance',
    version: 1
  };
}

function isFinanceAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isMasterAdmin(user)) return true;
  if ((user.approvalStatus || 'APPROVED') !== 'APPROVED') return false;
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
    const p = user.permissions;
    return Boolean(
      p?.canAccessFinancials === true ||
      p?.cmsFinance?.cashbackManagement === true ||
      p?.cmsFinance?.financials === true
    );
  }
  return false;
}

class CashbackService {
  private getDb(): AppDatabase {
    return AppDatabase.getInstance();
  }

  public attachToDatabase(dbInstance?: AppDatabase): void {
    const db = dbInstance || this.getDb();
    (db as any).cashbackHooks = {
      onBookingChanged: (
        booking: Booking,
        event: 'BOOKING_CREATED' | 'BOOKING_UPDATED' | 'BOOKING_STATUS_CHANGED' | 'BOOKING_CANCELLED' | 'BOOKING_REFUNDED',
        actor: User | null,
        extra?: {
          refundAmount?: number;
          isFullRefund?: boolean;
          reason?: string;
          affectedComponent?: 'LAND' | 'HOTEL' | 'MIXED' | 'AUTO';
          landRefundAmount?: number;
          hotelRefundAmount?: number;
        }
      ) => {
        if (event === 'BOOKING_REFUNDED' && extra?.refundAmount !== undefined) {
          this.applyBookingRefundOrCancellation({
            bookingId: booking.id,
            cancellation: false,
            refundAmount: extra.refundAmount,
            isFullRefund: Boolean(extra.isFullRefund),
            reason: extra.reason || 'Booking refund recorded',
            affectedComponent: extra.affectedComponent,
            landRefundAmount: extra.landRefundAmount,
            hotelRefundAmount: extra.hotelRefundAmount,
            actor
          });
        } else {
          this.syncBookingCashbackOnLifecycleEvent(booking, event, actor);
        }
      }
    };
  }

  // -------------------------------------------------------------------------
  // LOW-LEVEL DB ACCESSORS (NO MOCK DATA, NO FABRICATED BALANCES)
  // -------------------------------------------------------------------------

  public getPolicy(): CashbackPolicyConfig {
    const stored = this.getDb().getCashbackStore<CashbackPolicyConfig | null>(KEYS.POLICY, null);
    if (!stored) return getDefaultCashbackPolicy();
    return {
      ...getDefaultCashbackPolicy(),
      ...stored,
      eligibleComponents: {
        ...getDefaultCashbackPolicy().eligibleComponents,
        ...(stored.eligibleComponents || {}),
        hotels: false // Mandatory business rule: Hotels & accommodation are ALWAYS excluded
      }
    };
  }

  public updatePolicy(
    patch: Partial<CashbackPolicyConfig>,
    actor: User | null
  ): CashbackPolicyConfig {
    if (!isFinanceAdminUser(actor)) {
      throw new Error('Unauthorized: Only Administrators or Finance Managers can update Cashback Policy.');
    }
    const db = this.getDb();
    const current = this.getPolicy();
    const nowIso = new Date().toISOString();
    const delayDays = Math.max(0, Math.min(90, Math.floor(Number(patch.creditDelayDays ?? current.creditDelayDays))));
    const minW = Math.max(0, roundMoney(Number(patch.minWithdrawalAmount ?? current.minWithdrawalAmount)));
    const maxW = Math.max(minW, roundMoney(Number(patch.maxWithdrawalAmount ?? current.maxWithdrawalAmount)));
    const ceiling = Math.max(1, Math.min(100, roundPercent(Number(patch.maxCashbackPercentCeiling ?? current.maxCashbackPercentCeiling))));

    const next: CashbackPolicyConfig = {
      ...current,
      ...patch,
      id: 'cashback_policy',
      creditDelayDays: delayDays,
      minWithdrawalAmount: minW,
      maxWithdrawalAmount: maxW,
      maxCashbackPercentCeiling: ceiling,
      eligibleComponents: {
        ...current.eligibleComponents,
        ...(patch.eligibleComponents || {}),
        hotels: false // Mandatory business rule: Hotels & accommodation are ALWAYS excluded
      },
      updatedAt: nowIso,
      updatedByUid: actor?.id || 'system',
      updatedByName: actor?.name || 'Administrator',
      version: Number(current.version || 1) + 1
    };

    db.setCashbackStore(KEYS.POLICY, next);
    db.syncCashbackDoc('system_settings', 'cashback_policy', next);

    this.writeAuditLog({
      action: 'CASHBACK_POLICY_UPDATED',
      actor,
      entityType: 'POLICY',
      entityId: 'cashback_policy',
      previousValue: `delay=${current.creditDelayDays}d, minW=${current.minWithdrawalAmount}`,
      newValue: `delay=${next.creditDelayDays}d, minW=${next.minWithdrawalAmount}`,
      summary: `Updated global cashback policy (v${next.version}): credit delay=${next.creditDelayDays}d, min withdrawal=${next.defaultCurrency} ${next.minWithdrawalAmount}.`
    });

    return next;
  }

  public getAllUserConfigurations(): UserCashbackConfiguration[] {
    return this.getDb().getCashbackStore<UserCashbackConfiguration[]>(KEYS.USER_CONFIGS, []);
  }

  public getUserConfiguration(userId: string): UserCashbackConfiguration | null {
    if (!userId) return null;
    return this.getAllUserConfigurations().find((c) => c.userId === userId) || null;
  }

  public getConfigHistory(userId?: string): UserCashbackConfigHistoryRecord[] {
    const all = this.getDb().getCashbackStore<UserCashbackConfigHistoryRecord[]>(KEYS.CONFIG_HISTORY, []);
    if (!userId) return all;
    return all.filter((h) => h.userId === userId);
  }

  public canUserSeeCashbackWallet(user: User | null | undefined): boolean {
    if (!user) return false;
    if ((user.approvalStatus || 'APPROVED') !== 'APPROVED') return false;
    if (user.role === 'BUYER' || user.role === 'VIEWER' || user.role === 'PUBLIC') return false;
    const cfg = this.getUserConfiguration(user.id);
    const policy = this.getPolicy();
    if (cfg && cfg.isEligible) return true;
    // Also show if user already has historical wallet credits/transactions/records even if later disabled
    const recs = this.getBookingCashbackRecordsForUser(user.id);
    const txs = this.getLedgerTransactionsForUser(user.id);
    if (recs.length > 0 || txs.length > 0) return true;
    return Boolean(policy.showCashbackTabToIneligibleUsers || cfg?.showInformationalNoticeWhenIneligible);
  }

  // -------------------------------------------------------------------------
  // ADMIN: PER-USER CASHBACK CONFIGURATION (STRICTLY BOUND TO FIREBASE UID)
  // -------------------------------------------------------------------------

  public configureUserCashback(params: {
    targetUserId: string;
    isEligible: boolean;
    cashbackPercent: number;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    effectiveFrom?: string;
    effectiveTo?: string | null;
    showInformationalNoticeWhenIneligible?: boolean;
    notes?: string;
    reason?: string;
    actor: User | null;
  }): UserCashbackConfiguration {
    if (!isFinanceAdminUser(params.actor)) {
      throw new Error('Unauthorized: Only Administrators or Finance Managers can configure user cashback.');
    }

    const db = this.getDb();
    const policy = this.getPolicy();
    const pctCheck = validateCashbackPercentInput(params.cashbackPercent, policy.maxCashbackPercentCeiling);
    if (!pctCheck.valid) {
      throw new Error(pctCheck.error || 'Invalid cashback percentage.');
    }

    const allUsers = db.getUsers();
    const targetUser = allUsers.find((u) => u.id === params.targetUserId);
    const targetName = targetUser?.name || params.targetUserId;
    const targetEmail = targetUser?.email || '';

    const allConfigs = this.getAllUserConfigurations();
    const idx = allConfigs.findIndex((c) => c.userId === params.targetUserId);
    const prev = idx >= 0 ? allConfigs[idx] : null;
    const nowIso = new Date().toISOString();

    const cleanPct = roundPercent(pctCheck.normalized);
    const nextStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' = !params.isEligible
      ? 'INACTIVE'
      : params.status === 'INACTIVE' || params.status === 'SUSPENDED'
        ? params.status
        : 'ACTIVE';

    const nextConfig: UserCashbackConfiguration = {
      userId: params.targetUserId,
      agencyId: targetUser?.agencyId || prev?.agencyId,
      userName: targetName,
      userEmail: targetEmail,
      isEligible: Boolean(params.isEligible),
      cashbackPercent: cleanPct,
      presetType: resolveCashbackPresetType(cleanPct),
      status: nextStatus,
      effectiveFrom: params.effectiveFrom ? normalizeDateYmd(params.effectiveFrom) : (prev?.effectiveFrom || nowIso.slice(0, 10)),
      effectiveTo: params.effectiveTo ? normalizeDateYmd(params.effectiveTo) : null,
      showInformationalNoticeWhenIneligible: params.showInformationalNoticeWhenIneligible ?? prev?.showInformationalNoticeWhenIneligible ?? false,
      notes: params.notes !== undefined ? params.notes.trim() : prev?.notes,
      configVersion: Number(prev?.configVersion || 0) + 1,
      createdAt: prev?.createdAt || nowIso,
      createdByUid: prev?.createdByUid || params.actor?.id || 'system',
      updatedAt: nowIso,
      updatedByUid: params.actor?.id || 'system',
      updatedByName: params.actor?.name || 'Administrator'
    };

    if (idx >= 0) {
      allConfigs[idx] = nextConfig;
    } else {
      allConfigs.unshift(nextConfig);
    }
    db.setCashbackStore(KEYS.USER_CONFIGS, allConfigs);
    db.syncCashbackDoc('cashback_user_configs', params.targetUserId, nextConfig);

    // Record immutable configuration history entry
    const historyEntry: UserCashbackConfigHistoryRecord = {
      id: `CBCH-${params.targetUserId}-${nextConfig.configVersion}-${Date.now()}`,
      userId: params.targetUserId,
      previousPercent: prev ? prev.cashbackPercent : null,
      newPercent: cleanPct,
      previousEligible: prev ? prev.isEligible : false,
      newEligible: nextConfig.isEligible,
      previousStatus: prev ? prev.status : 'NONE',
      newStatus: nextConfig.status,
      reason: (params.reason || 'Updated via Cashback Governance').trim(),
      changedAt: nowIso,
      changedByUid: params.actor?.id || 'system',
      changedByName: params.actor?.name || 'Administrator',
      changedByEmail: params.actor?.email
    };
    const historyList = this.getConfigHistory();
    historyList.unshift(historyEntry);
    db.setCashbackStore(KEYS.CONFIG_HISTORY, historyList);
    db.syncCashbackDoc('cashback_config_history', historyEntry.id, historyEntry);

    const action = !prev && nextConfig.isEligible
      ? 'CASHBACK_ELIGIBILITY_ENABLED'
      : prev?.isEligible && !nextConfig.isEligible
        ? 'CASHBACK_ELIGIBILITY_DISABLED'
        : 'CASHBACK_CONFIG_UPDATED';

    this.writeAuditLog({
      action,
      actor: params.actor,
      targetUserId: params.targetUserId,
      entityType: 'USER_CONFIG',
      entityId: params.targetUserId,
      previousValue: prev ? `${prev.cashbackPercent}% (${prev.status}, eligible=${prev.isEligible})` : 'NONE',
      newValue: `${nextConfig.cashbackPercent}% (${nextConfig.status}, eligible=${nextConfig.isEligible})`,
      reason: historyEntry.reason,
      summary: `Configured cashback for ${targetName} (${targetEmail || params.targetUserId}): ${nextConfig.cashbackPercent}% [${nextConfig.status}, eligible=${nextConfig.isEligible}].`
    });

    if (!prev || prev.cashbackPercent !== nextConfig.cashbackPercent || prev.isEligible !== nextConfig.isEligible) {
      this.createNotification({
        userId: params.targetUserId,
        type: 'CONFIG_CHANGED',
        title: nextConfig.isEligible ? 'Cashback Rate Updated' : 'Cashback Eligibility Updated',
        message: nextConfig.isEligible
          ? `Your Cashback & Rewards rate is now ${nextConfig.cashbackPercent}% on eligible bookings. Historical booking cashback snapshots remain unchanged.`
          : 'Your Cashback & Rewards earning eligibility for new bookings has been paused. Existing wallet balances remain unaffected.',
        deduplicationKey: `cfg:${params.targetUserId}:v${nextConfig.configVersion}`
      });
    }

    return nextConfig;
  }

  // -------------------------------------------------------------------------
  // BOOKING CASHBACK RECORD SNAPSHOTS & LIFECYCLE SYNC (IMMUTABILITY)
  // -------------------------------------------------------------------------

  public getAllBookingCashbackRecords(): BookingCashbackRecord[] {
    return this.getDb().getCashbackStore<BookingCashbackRecord[]>(KEYS.BOOKING_RECORDS, []);
  }

  public getBookingCashbackRecordsForUser(userId: string, sanitizeForAgent = false): BookingCashbackRecord[] {
    const records = this.getAllBookingCashbackRecords().filter((r) => r.userId === userId);
    if (!sanitizeForAgent) return records;
    return records.map((r) => {
      // Never leak internal costs even if caller inspects object
      const copy = { ...r } as any;
      delete copy.internalNettCost;
      delete copy.supplierCost;
      delete copy.internalProfit;
      delete copy.internalMargin;
      return copy as BookingCashbackRecord;
    });
  }

  public syncBookingCashbackOnLifecycleEvent(
    booking: Booking,
    event: 'BOOKING_CREATED' | 'BOOKING_UPDATED' | 'BOOKING_STATUS_CHANGED' | 'BOOKING_CANCELLED' | 'BOOKING_REFUNDED',
    actor: User | null
  ): BookingCashbackRecord | null {
    if (!booking?.id) return null;
    const db = this.getDb();
    const policy = this.getPolicy();
    const nowIso = new Date().toISOString();

    const ownerUid = booking.submittedByUserId || booking.agentId || booking.userId;
    if (!ownerUid) return null;

    const allRecs = this.getAllBookingCashbackRecords();
    const existingIdx = allRecs.findIndex((r) => r.bookingId === booking.id);
    const existingRec = existingIdx >= 0 ? allRecs[existingIdx] : null;
    const userConfig = this.getUserConfiguration(ownerUid);

    // Handle booking cancellation cleanly
    if (booking.status === 'CANCELLED' || event === 'BOOKING_CANCELLED') {
      if (!existingRec) return null;
      return this.applyBookingRefundOrCancellation({
        bookingId: booking.id,
        cancellation: true,
        refundAmount: booking.totalAmount || existingRec.eligibleAmount,
        isFullRefund: true,
        reason: 'Booking cancelled',
        actor
      });
    }

    // First-time snapshot creation for eligible user
    if (!existingRec) {
      const bookingDateYmd = normalizeDateYmd(booking.createdAt || nowIso);
      const created = buildInitialBookingCashbackRecord({
        booking,
        userConfig,
        policy,
        bookingCreatedDateYmd: bookingDateYmd,
        nowIso
      });
      if (!created) return null;

      allRecs.unshift(created);
      db.setCashbackStore(KEYS.BOOKING_RECORDS, allRecs);
      db.syncCashbackDoc('booking_cashback_records', created.id, created);
      this.reconcileAndPersistUserWallet(ownerUid, created.currency, nowIso);

      this.writeAuditLog({
        action: created.verificationStatus === 'UNVERIFIED_HOLD' ? 'CASHBACK_ON_HOLD' : 'CASHBACK_PENDING_CREATED',
        actor,
        targetUserId: ownerUid,
        entityType: 'BOOKING_CASHBACK',
        entityId: created.id,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        amount: created.cashbackAmount,
        currency: created.currency,
        summary:
          created.verificationStatus === 'UNVERIFIED_HOLD'
            ? `Held cashback snapshot for ${booking.bookingReference}: ${created.holdReason}`
            : created.status === 'NOT_ELIGIBLE'
              ? `Recorded non-eligible hotel-only snapshot (${created.currency} ${created.hotelAccommodationTotal.toLocaleString()} hotel excluded; Land Part Total = 0) for ${booking.bookingReference}.`
              : `Captured ${created.cashbackPercent}% Land-Part-Only cashback (${created.currency} ${created.cashbackAmount.toLocaleString()} on Land ${created.currency} ${created.landPartTotal.toLocaleString()}; Hotel ${created.currency} ${created.hotelAccommodationTotal.toLocaleString()} excluded) for booking ${booking.bookingReference}; scheduled credit ${created.scheduledCreditDate} (${created.destinationTimezone}).`
      });

      if (created.verificationStatus === 'VERIFIED' && created.cashbackAmount > 0) {
        this.createNotification({
          userId: ownerUid,
          type: 'CASHBACK_PENDING_CREATED',
          title: 'Pending Cashback Recorded',
          message: `${created.currency} ${created.cashbackAmount.toLocaleString()} (${created.cashbackPercent}% on eligible Land Part ${created.currency} ${created.landPartTotal.toLocaleString()}) cashback recorded for booking ${booking.bookingReference}. Eligible to credit on ${created.scheduledCreditDate} (3 days after completion).`,
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
          amount: created.cashbackAmount,
          currency: created.currency,
          deduplicationKey: `pending:${booking.id}:${created.id}`
        });
      }

      return created;
    }

    // Existing record: check travelEndDate or Land Part / Hotel amendments WITHOUT altering snapshot cashbackPercent!
    const nextTravelEnd = normalizeDateYmd(booking.travelEndDate || existingRec.travelEndDate);
    const travelEndChanged = nextTravelEnd !== existingRec.travelEndDate;
    const comp = calculateEligibleBookingComponents(booking, policy);
    const prevHotelTotal = roundMoney(existingRec.hotelAccommodationTotal ?? existingRec.componentBreakdown?.hotelAccommodationTotal ?? 0);
    const prevLandTotal = roundMoney(existingRec.landPartTotal ?? existingRec.eligibleAmount ?? 0);
    const prevVerification = existingRec.verificationStatus || 'VERIFIED';

    const hotelChanged = Math.abs(comp.hotelAccommodationTotal - prevHotelTotal) >= 0.01;
    const landChanged =
      comp.verificationStatus === 'VERIFIED' &&
      (Math.abs(comp.landPartTotal - prevLandTotal) >= 0.01 || Math.abs(comp.eligibleAmount - existingRec.eligibleAmount) >= 0.01);
    const verificationChanged = comp.verificationStatus !== prevVerification;

    if (!travelEndChanged && !hotelChanged && !landChanged && !verificationChanged) {
      // Check payment release if previously HELD due to unpaid (never release UNVERIFIED_HOLD automatically)
      if (
        existingRec.status === 'HELD' &&
        existingRec.verificationStatus !== 'UNVERIFIED_HOLD' &&
        !existingRec.isDisputed &&
        prevLandTotal > 0 &&
        isBookingPaymentSatisfiedForCashback(booking, policy)
      ) {
        const released: BookingCashbackRecord = {
          ...existingRec,
          status: 'PENDING',
          holdReason: undefined,
          updatedAt: nowIso
        };
        allRecs[existingIdx] = released;
        db.setCashbackStore(KEYS.BOOKING_RECORDS, allRecs);
        db.syncCashbackDoc('booking_cashback_records', released.id, released);
        this.reconcileAndPersistUserWallet(ownerUid, released.currency, nowIso);
        return released;
      }
      return existingRec;
    }

    const amendments = [...(existingRec.amendmentHistory || [])];
    let updated: BookingCashbackRecord = {
      ...existingRec,
      pricingSnapshotVersion: comp.pricingSnapshotVersion ?? existingRec.pricingSnapshotVersion,
      calculatedAt: nowIso,
      updatedAt: nowIso
    };

    if (travelEndChanged) {
      const destName = booking.items?.[0]?.destinationName || existingRec.destinationName;
      const sched = computeCreditSchedule(nextTravelEnd, policy.creditDelayDays, destName, existingRec.destinationTimezone);
      amendments.push({
        amendedAt: nowIso,
        amendedByUid: actor?.id || 'system',
        amendedByName: actor?.name || 'Operations',
        reason: `Travel completion date updated (${existingRec.travelEndDate} -> ${nextTravelEnd})`,
        previousTravelEndDate: existingRec.travelEndDate,
        newTravelEndDate: nextTravelEnd
      });
      updated = {
        ...updated,
        travelEndDate: nextTravelEnd,
        scheduledCreditDate: sched.scheduledCreditDate,
        scheduledCreditAtUtc: sched.scheduledCreditAtUtc
      };
    }

    if (comp.verificationStatus === 'UNVERIFIED_HOLD') {
      amendments.push({
        amendedAt: nowIso,
        amendedByUid: actor?.id || 'system',
        amendedByName: actor?.name || 'Operations',
        reason: comp.holdReason || 'Breakdown unverified after amendment — placed on Admin hold',
        previousHotelTotal: prevHotelTotal,
        newHotelTotal: 0,
        previousLandPartTotal: prevLandTotal,
        newLandPartTotal: 0,
        previousEligibleAmount: existingRec.eligibleAmount,
        newEligibleAmount: 0,
        previousCashbackAmount: existingRec.cashbackAmount,
        newCashbackAmount: existingRec.status === 'CREDITED' ? existingRec.cashbackAmount : 0
      });
      updated = {
        ...updated,
        verificationStatus: 'UNVERIFIED_HOLD',
        status: existingRec.status === 'CREDITED' ? existingRec.status : 'HELD',
        holdReason: comp.holdReason || 'Unverified Land Part breakdown. Held for Admin review.',
        bookingTotalSnapshot: comp.totalBookingAmount,
        componentBreakdown: comp.breakdown
      };
    } else if (hotelChanged && !landChanged && prevVerification === 'VERIFIED') {
      // Hotel-only modification -> cashback remains strictly unchanged!
      amendments.push({
        amendedAt: nowIso,
        amendedByUid: actor?.id || 'system',
        amendedByName: actor?.name || 'Operations',
        reason: `Hotel accommodation total updated (${prevHotelTotal} -> ${comp.hotelAccommodationTotal}); Land Part Total (${comp.landPartTotal}) and cashback (${existingRec.cashbackAmount}) unchanged.`,
        previousHotelTotal: prevHotelTotal,
        newHotelTotal: comp.hotelAccommodationTotal,
        previousLandPartTotal: prevLandTotal,
        newLandPartTotal: comp.landPartTotal,
        previousEligibleAmount: existingRec.eligibleAmount,
        newEligibleAmount: existingRec.eligibleAmount,
        previousCashbackAmount: existingRec.cashbackAmount,
        newCashbackAmount: existingRec.cashbackAmount
      });
      updated = {
        ...updated,
        hotelAccommodationTotal: comp.hotelAccommodationTotal,
        bookingTotalSnapshot: comp.totalBookingAmount,
        componentBreakdown: comp.breakdown
      };
    } else if (landChanged || (prevVerification === 'UNVERIFIED_HOLD' && comp.verificationStatus === 'VERIFIED')) {
      // Re-calculate strictly on Land Part Total using SNAPSHOTTED cashbackPercent
      const newGrossCashback = roundMoney((comp.eligibleAmount * existingRec.cashbackPercent) / 100);
      const delta = roundMoney(newGrossCashback - existingRec.cashbackAmount);
      amendments.push({
        amendedAt: nowIso,
        amendedByUid: actor?.id || 'system',
        amendedByName: actor?.name || 'Operations',
        reason: `Land Part Total updated (${prevLandTotal} -> ${comp.landPartTotal}); hotel accommodation (${comp.hotelAccommodationTotal}) excluded; locked rate ${existingRec.cashbackPercent}% preserved.`,
        previousHotelTotal: prevHotelTotal,
        newHotelTotal: comp.hotelAccommodationTotal,
        previousLandPartTotal: prevLandTotal,
        newLandPartTotal: comp.landPartTotal,
        previousEligibleAmount: existingRec.eligibleAmount,
        newEligibleAmount: comp.eligibleAmount,
        previousCashbackAmount: existingRec.cashbackAmount,
        newCashbackAmount: newGrossCashback
      });

      const isAlreadyCredited = existingRec.status === 'CREDITED' || existingRec.status === 'PARTIALLY_REVERSED';
      if (isAlreadyCredited && delta < 0) {
        const revAmt = Math.min(roundMoney(existingRec.remainingCashbackAmount), Math.abs(delta));
        if (revAmt > 0) {
          this.postReversalLedgerEntry({
            record: updated,
            reversalAmount: revAmt,
            reason: `Land Part value reduction on ${updated.bookingReference}`,
            actor,
            nowIso
          });
        }
        const nextRem = Math.max(0, roundMoney(existingRec.remainingCashbackAmount - revAmt));
        updated = {
          ...updated,
          verificationStatus: 'VERIFIED',
          hotelAccommodationTotal: comp.hotelAccommodationTotal,
          landPartTotal: comp.landPartTotal,
          eligibleAmount: comp.eligibleAmount,
          cashbackAmount: newGrossCashback,
          reversedAmount: roundMoney((existingRec.reversedAmount || 0) + revAmt),
          remainingCashbackAmount: nextRem,
          status: nextRem <= 0 ? 'REVERSED' : 'PARTIALLY_REVERSED',
          bookingTotalSnapshot: comp.totalBookingAmount,
          componentBreakdown: comp.breakdown
        };
      } else if (isAlreadyCredited && delta > 0) {
        this.postAmendmentCreditLedgerEntry({
          record: updated,
          creditDelta: delta,
          reason: `Land Part value increase on ${updated.bookingReference} (${prevLandTotal} -> ${comp.landPartTotal})`,
          actor,
          nowIso
        });
        updated = {
          ...updated,
          verificationStatus: 'VERIFIED',
          hotelAccommodationTotal: comp.hotelAccommodationTotal,
          landPartTotal: comp.landPartTotal,
          eligibleAmount: comp.eligibleAmount,
          cashbackAmount: newGrossCashback,
          remainingCashbackAmount: roundMoney((existingRec.remainingCashbackAmount || 0) + delta),
          bookingTotalSnapshot: comp.totalBookingAmount,
          componentBreakdown: comp.breakdown
        };
      } else {
        const netRemaining = Math.max(0, roundMoney(newGrossCashback - (updated.reversedAmount || 0)));
        const paymentOk = isBookingPaymentSatisfiedForCashback(booking, policy);
        let nextStatus = existingRec.status;
        let nextHoldReason = existingRec.holdReason;
        if (comp.eligibleAmount <= 0 || newGrossCashback <= 0) {
          nextStatus = 'NOT_ELIGIBLE';
          nextHoldReason = 'Hotel-only booking: Hotel Accommodation Total is excluded from cashback (Land Part Total = 0).';
        } else if (existingRec.status === 'NOT_ELIGIBLE' || prevVerification === 'UNVERIFIED_HOLD') {
          nextStatus = existingRec.isDisputed ? 'HELD' : paymentOk ? 'PENDING' : 'HELD';
          nextHoldReason = existingRec.isDisputed
            ? existingRec.holdReason
            : paymentOk
              ? undefined
              : 'Waiting for booking payment verification before credit release.';
        }
        updated = {
          ...updated,
          verificationStatus: 'VERIFIED',
          status: nextStatus,
          holdReason: nextHoldReason,
          hotelAccommodationTotal: comp.hotelAccommodationTotal,
          landPartTotal: comp.landPartTotal,
          eligibleAmount: comp.eligibleAmount,
          cashbackAmount: newGrossCashback,
          remainingCashbackAmount: netRemaining,
          bookingTotalSnapshot: comp.totalBookingAmount,
          componentBreakdown: comp.breakdown
        };
      }
    }

    updated.amendmentHistory = amendments;
    allRecs[existingIdx] = updated;
    db.setCashbackStore(KEYS.BOOKING_RECORDS, allRecs);
    db.syncCashbackDoc('booking_cashback_records', updated.id, updated);
    this.reconcileAndPersistUserWallet(ownerUid, updated.currency, nowIso);

    this.writeAuditLog({
      action: 'BOOKING_CASHBACK_AMENDED',
      actor,
      targetUserId: ownerUid,
      entityType: 'BOOKING_CASHBACK',
      entityId: updated.id,
      bookingId: updated.bookingId,
      bookingReference: updated.bookingReference,
      amount: updated.cashbackAmount,
      currency: updated.currency,
      summary: `Amended cashback snapshot for ${updated.bookingReference} (Land=${updated.landPartTotal}, Hotel=${updated.hotelAccommodationTotal}, Cashback=${updated.cashbackAmount} @ ${updated.cashbackPercent}%).`
    });

    return updated;
  }

  public applyBookingRefundOrCancellation(params: {
    bookingId: string;
    cancellation: boolean;
    refundAmount: number;
    isFullRefund: boolean;
    reason?: string;
    affectedComponent?: 'LAND' | 'HOTEL' | 'MIXED' | 'AUTO';
    landRefundAmount?: number;
    hotelRefundAmount?: number;
    actor: User | null;
  }): BookingCashbackRecord | null {
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const allRecs = this.getAllBookingCashbackRecords();
    const idx = allRecs.findIndex((r) => r.bookingId === params.bookingId);
    if (idx < 0) return null;

    const rec = allRecs[idx];
    const cleanReason = (params.reason || (params.cancellation ? 'Booking cancelled' : 'Refund processed')).trim();

    // Hotel-only refund (without full booking cancellation) leaves Land Part cashback strictly unchanged
    if (!params.cancellation && !params.isFullRefund && params.affectedComponent === 'HOTEL') {
      const updated: BookingCashbackRecord = {
        ...rec,
        updatedAt: nowIso,
        amendmentHistory: [
          ...(rec.amendmentHistory || []),
          {
            amendedAt: nowIso,
            amendedByUid: params.actor?.id || 'system',
            amendedByName: params.actor?.name || 'Finance',
            reason: `Hotel-only refund (${rec.currency} ${roundMoney(params.refundAmount).toLocaleString()}) excluded — Land Part cashback unchanged (${cleanReason}).`,
            previousLandPartTotal: rec.landPartTotal,
            newLandPartTotal: rec.landPartTotal,
            previousCashbackAmount: rec.remainingCashbackAmount,
            newCashbackAmount: rec.remainingCashbackAmount
          }
        ]
      };
      allRecs[idx] = updated;
      db.setCashbackStore(KEYS.BOOKING_RECORDS, allRecs);
      db.syncCashbackDoc('booking_cashback_records', updated.id, updated);
      this.writeAuditLog({
        action: 'BOOKING_CASHBACK_AMENDED',
        actor: params.actor,
        targetUserId: rec.userId,
        entityType: 'BOOKING_CASHBACK',
        entityId: rec.id,
        bookingId: rec.bookingId,
        bookingReference: rec.bookingReference,
        amount: 0,
        currency: rec.currency,
        reason: cleanReason,
        summary: `Hotel-only refund recorded on ${rec.bookingReference}; cashback remains ${rec.currency} ${rec.remainingCashbackAmount.toLocaleString()} (Hotel excluded).`
      });
      return updated;
    }

    // If still pending/held/not-eligible and full refund or cancelled -> cancel/void without deleting record
    if ((params.cancellation || params.isFullRefund) && (rec.status === 'PENDING' || rec.status === 'HELD' || rec.status === 'NOT_ELIGIBLE')) {
      const updated: BookingCashbackRecord = {
        ...rec,
        status: 'CANCELLED',
        remainingCashbackAmount: 0,
        holdReason: cleanReason,
        cancelledAt: nowIso,
        updatedAt: nowIso,
        amendmentHistory: [
          ...(rec.amendmentHistory || []),
          {
            amendedAt: nowIso,
            amendedByUid: params.actor?.id || 'system',
            amendedByName: params.actor?.name || 'Finance',
            reason: cleanReason,
            previousLandPartTotal: rec.landPartTotal,
            newLandPartTotal: 0,
            previousCashbackAmount: rec.remainingCashbackAmount,
            newCashbackAmount: 0
          }
        ]
      };
      allRecs[idx] = updated;
      db.setCashbackStore(KEYS.BOOKING_RECORDS, allRecs);
      db.syncCashbackDoc('booking_cashback_records', updated.id, updated);
      this.reconcileAndPersistUserWallet(rec.userId, rec.currency, nowIso);

      this.writeAuditLog({
        action: 'CASHBACK_CANCELLED',
        actor: params.actor,
        targetUserId: rec.userId,
        entityType: 'BOOKING_CASHBACK',
        entityId: rec.id,
        bookingId: rec.bookingId,
        bookingReference: rec.bookingReference,
        amount: rec.cashbackAmount,
        currency: rec.currency,
        reason: cleanReason,
        summary: `Cancelled pending cashback (${rec.currency} ${rec.cashbackAmount.toLocaleString()}) for ${rec.bookingReference}: ${cleanReason}.`
      });

      if (rec.cashbackAmount > 0) {
        this.createNotification({
          userId: rec.userId,
          type: 'CASHBACK_REVERSED',
          title: 'Pending Cashback Cancelled',
          message: `Pending cashback for booking ${rec.bookingReference} was cancelled (${cleanReason}).`,
          bookingId: rec.bookingId,
          bookingReference: rec.bookingReference,
          deduplicationKey: `cancel:${rec.bookingId}:${rec.id}`
        });
      }

      return updated;
    }

    // Determine effective Land Part refund strictly (never dividing a Land refund by hotel+land total!)
    const prevLandTotal = roundMoney(rec.landPartTotal ?? rec.eligibleAmount ?? 0);
    if (prevLandTotal <= 0 || rec.cashbackAmount <= 0 || rec.status === 'NOT_ELIGIBLE') {
      return rec;
    }

    let effectiveLandRefund = 0;
    if (params.cancellation || params.isFullRefund) {
      effectiveLandRefund = prevLandTotal;
    } else if (typeof params.landRefundAmount === 'number') {
      effectiveLandRefund = Math.max(0, roundMoney(params.landRefundAmount));
    } else if (params.affectedComponent === 'LAND') {
      effectiveLandRefund = Math.max(0, roundMoney(params.refundAmount));
    } else if (typeof params.hotelRefundAmount === 'number') {
      effectiveLandRefund = Math.max(0, roundMoney(params.refundAmount - params.hotelRefundAmount));
    } else if ((rec.hotelAccommodationTotal || 0) > 0 && (rec.bookingTotalSnapshot || 0) > 0) {
      // Unspecified mixed partial refund: prorate Land share cleanly rather than treating entire refund as Land or dividing Land by Hotel+Land
      effectiveLandRefund = roundMoney(Math.max(0, params.refundAmount) * (prevLandTotal / rec.bookingTotalSnapshot));
    } else {
      effectiveLandRefund = Math.max(0, roundMoney(params.refundAmount));
    }

    if (effectiveLandRefund <= 0) {
      return rec;
    }

    const refundRatio =
      params.cancellation || params.isFullRefund
        ? 1
        : Math.min(1, Math.max(0, effectiveLandRefund / Math.max(prevLandTotal, 1)));

    const reversalNeeded =
      params.cancellation || params.isFullRefund
        ? roundMoney(rec.remainingCashbackAmount)
        : Math.min(roundMoney(rec.remainingCashbackAmount), roundMoney(rec.cashbackAmount * refundRatio));

    if (reversalNeeded <= 0) return rec;

    const nextLandPartTotal = Math.max(0, roundMoney(prevLandTotal - effectiveLandRefund));
    const nextEligibleAmount = Math.max(0, roundMoney(rec.eligibleAmount - effectiveLandRefund));

    if (rec.status === 'PENDING' || rec.status === 'HELD') {
      const nextRemaining = Math.max(0, roundMoney(rec.remainingCashbackAmount - reversalNeeded));
      const updated: BookingCashbackRecord = {
        ...rec,
        landPartTotal: nextLandPartTotal,
        eligibleAmount: nextEligibleAmount,
        remainingCashbackAmount: nextRemaining,
        reversedAmount: roundMoney((rec.reversedAmount || 0) + reversalNeeded),
        status: nextRemaining <= 0 ? 'REVERSED' : rec.status,
        holdReason: nextRemaining <= 0 ? cleanReason : `Adjusted for Land Part refund (${cleanReason})`,
        updatedAt: nowIso,
        amendmentHistory: [
          ...(rec.amendmentHistory || []),
          {
            amendedAt: nowIso,
            amendedByUid: params.actor?.id || 'system',
            amendedByName: params.actor?.name || 'Finance',
            reason: cleanReason,
            previousLandPartTotal: prevLandTotal,
            newLandPartTotal: nextLandPartTotal,
            previousEligibleAmount: rec.eligibleAmount,
            newEligibleAmount: nextEligibleAmount,
            previousCashbackAmount: rec.remainingCashbackAmount,
            newCashbackAmount: nextRemaining
          }
        ]
      };
      allRecs[idx] = updated;
      db.setCashbackStore(KEYS.BOOKING_RECORDS, allRecs);
      db.syncCashbackDoc('booking_cashback_records', updated.id, updated);
      this.reconcileAndPersistUserWallet(rec.userId, rec.currency, nowIso);
      return updated;
    }

    // CREDITED or PARTIALLY_REVERSED -> create an explicit CASHBACK_REVERSAL ledger transaction!
    const actualReversal = Math.min(roundMoney(rec.remainingCashbackAmount), reversalNeeded);
    if (actualReversal > 0) {
      this.postReversalLedgerEntry({
        record: rec,
        reversalAmount: actualReversal,
        reason: cleanReason,
        actor: params.actor,
        nowIso
      });
    }

    const newRemaining = Math.max(0, roundMoney(rec.remainingCashbackAmount - actualReversal));
    const nextStatus = newRemaining <= 0 ? 'REVERSED' : 'PARTIALLY_REVERSED';
    const updated: BookingCashbackRecord = {
      ...rec,
      landPartTotal: nextLandPartTotal,
      eligibleAmount: nextEligibleAmount,
      remainingCashbackAmount: newRemaining,
      reversedAmount: roundMoney((rec.reversedAmount || 0) + actualReversal),
      status: nextStatus,
      holdReason: cleanReason,
      updatedAt: nowIso,
      amendmentHistory: [
        ...(rec.amendmentHistory || []),
        {
          amendedAt: nowIso,
          amendedByUid: params.actor?.id || 'system',
          amendedByName: params.actor?.name || 'Finance',
          reason: cleanReason,
          previousLandPartTotal: prevLandTotal,
          newLandPartTotal: nextLandPartTotal,
          previousEligibleAmount: rec.eligibleAmount,
          newEligibleAmount: nextEligibleAmount,
          previousCashbackAmount: rec.remainingCashbackAmount,
          newCashbackAmount: newRemaining
        }
      ]
    };

    allRecs[idx] = updated;
    db.setCashbackStore(KEYS.BOOKING_RECORDS, allRecs);
    db.syncCashbackDoc('booking_cashback_records', updated.id, updated);
    this.reconcileAndPersistUserWallet(rec.userId, rec.currency, nowIso);

    this.createNotification({
      userId: rec.userId,
      type: 'CASHBACK_REVERSED',
      title: 'Cashback Reversed',
      message: `${rec.currency} ${actualReversal.toLocaleString()} cashback for booking ${rec.bookingReference} was reversed (${cleanReason}).`,
      bookingId: rec.bookingId,
      bookingReference: rec.bookingReference,
      amount: actualReversal,
      currency: rec.currency,
      deduplicationKey: `rev:${rec.bookingId}:${Math.round(actualReversal * 100)}:${nowIso.slice(0, 13)}`
    });

    return updated;
  }

  private postAmendmentCreditLedgerEntry(params: {
    record: BookingCashbackRecord;
    creditDelta: number;
    reason: string;
    actor: User | null;
    nowIso: string;
  }): CashbackLedgerTransaction {
    const db = this.getDb();
    const { record, creditDelta, reason, actor, nowIso } = params;
    const txId = `CBTX-AMDCR-${record.id}-${Date.now()}`;
    const userTxs = this.getLedgerTransactionsForUser(record.userId);
    const walletBefore = reconcileWalletFromLedger({
      userId: record.userId,
      defaultCurrency: record.currency,
      ledgerTransactions: userTxs,
      bookingRecords: []
    });
    const availBefore = walletBefore.balancesByCurrency[record.currency]?.availableBalance ?? 0;

    const tx: CashbackLedgerTransaction = {
      id: txId,
      userId: record.userId,
      agencyId: record.agencyId,
      type: 'ADMIN_CREDIT_ADJUSTMENT',
      direction: 'CREDIT',
      amount: roundMoney(creditDelta),
      currency: record.currency,
      balanceAfterAvailable: roundMoney(availBefore + creditDelta),
      bookingId: record.bookingId,
      bookingReference: record.bookingReference,
      bookingCashbackRecordId: record.id,
      idempotencyKey: `amend-credit:${record.id}:${Date.now()}`,
      description: `Cashback upward amendment credit for booking ${record.bookingReference}: ${reason}.`,
      createdAt: nowIso,
      createdByUid: actor?.id || 'system',
      createdByName: actor?.name || 'Finance Governance'
    };

    const allTxs = this.getAllLedgerTransactions();
    allTxs.unshift(tx);
    db.setCashbackStore(KEYS.LEDGER, allTxs);
    db.syncCashbackDoc('cashback_ledger_transactions', txId, tx);
    return tx;
  }

  private postReversalLedgerEntry(params: {
    record: BookingCashbackRecord;
    reversalAmount: number;
    reason: string;
    actor: User | null;
    nowIso: string;
  }): CashbackLedgerTransaction {
    const db = this.getDb();
    const { record, reversalAmount, reason, actor, nowIso } = params;
    const txId = `CBTX-REV-${record.id}-${Date.now()}`;
    const userTxs = this.getLedgerTransactionsForUser(record.userId);
    const walletBefore = reconcileWalletFromLedger({
      userId: record.userId,
      defaultCurrency: record.currency,
      ledgerTransactions: userTxs,
      bookingRecords: []
    });
    const availBefore = walletBefore.balancesByCurrency[record.currency]?.availableBalance ?? 0;

    const tx: CashbackLedgerTransaction = {
      id: txId,
      userId: record.userId,
      agencyId: record.agencyId,
      type: 'CASHBACK_REVERSAL',
      direction: 'REVERSAL',
      amount: roundMoney(reversalAmount),
      currency: record.currency,
      balanceAfterAvailable: Math.max(0, roundMoney(availBefore - reversalAmount)),
      bookingId: record.bookingId,
      bookingReference: record.bookingReference,
      bookingCashbackRecordId: record.id,
      idempotencyKey: `reversal:${record.id}:${Date.now()}`,
      description: `Cashback reversal for booking ${record.bookingReference}: ${reason}.`,
      createdAt: nowIso,
      createdByUid: actor?.id || 'system',
      createdByName: actor?.name || 'Finance Governance'
    };

    const allTxs = this.getAllLedgerTransactions();
    allTxs.unshift(tx);
    db.setCashbackStore(KEYS.LEDGER, allTxs);
    db.syncCashbackDoc('cashback_ledger_transactions', txId, tx);

    this.writeAuditLog({
      action: 'CASHBACK_REVERSED',
      actor,
      targetUserId: record.userId,
      entityType: 'BOOKING_CASHBACK',
      entityId: record.id,
      bookingId: record.bookingId,
      bookingReference: record.bookingReference,
      amount: reversalAmount,
      currency: record.currency,
      reason,
      summary: `Reversed ${record.currency} ${reversalAmount.toLocaleString()} cashback for ${record.bookingReference} (${reason}).`
    });

    return tx;
  }

  public setBookingDisputeHold(params: {
    bookingId: string;
    isDisputed: boolean;
    reason?: string;
    actor: User | null;
  }): BookingCashbackRecord | null {
    if (!isFinanceAdminUser(params.actor)) {
      throw new Error('Unauthorized: Only Finance Admins can place or release cashback dispute holds.');
    }
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const allRecs = this.getAllBookingCashbackRecords();
    const idx = allRecs.findIndex((r) => r.bookingId === params.bookingId);
    if (idx < 0) return null;

    const rec = allRecs[idx];
    if (rec.status === 'CREDITED' || rec.status === 'CANCELLED' || rec.status === 'REVERSED' || rec.status === 'NOT_ELIGIBLE') {
      throw new Error(`Cannot change dispute hold for booking cashback in terminal status ${rec.status}.`);
    }

    const stillUnverifiedHold = !params.isDisputed && rec.verificationStatus === 'UNVERIFIED_HOLD';
    const updated: BookingCashbackRecord = {
      ...rec,
      isDisputed: params.isDisputed,
      status: params.isDisputed || stillUnverifiedHold ? 'HELD' : 'PENDING',
      holdReason: params.isDisputed
        ? (params.reason || 'Placed on dispute hold by Finance')
        : stillUnverifiedHold
          ? rec.holdReason
          : undefined,
      updatedAt: nowIso
    };

    allRecs[idx] = updated;
    db.setCashbackStore(KEYS.BOOKING_RECORDS, allRecs);
    db.syncCashbackDoc('booking_cashback_records', updated.id, updated);
    this.reconcileAndPersistUserWallet(rec.userId, rec.currency, nowIso);

    this.writeAuditLog({
      action: params.isDisputed ? 'CASHBACK_HELD' : 'CASHBACK_HOLD_RELEASED',
      actor: params.actor,
      targetUserId: rec.userId,
      entityType: 'BOOKING_CASHBACK',
      entityId: rec.id,
      bookingId: rec.bookingId,
      bookingReference: rec.bookingReference,
      reason: params.reason,
      summary: `${params.isDisputed ? 'Placed hold on' : 'Released hold on'} cashback for ${rec.bookingReference}.`
    });

    return updated;
  }

  // -------------------------------------------------------------------------
  // SCHEDULED AUTOMATIC CREDITING (3 DAYS AFTER DESTINATION COMPLETION)
  // -------------------------------------------------------------------------

  public runScheduledAutoCreditBatch(params?: {
    nowIsoOverride?: string;
    actor?: User | null;
    source?: 'MANUAL_ADMIN' | 'SCHEDULER' | 'SYSTEM';
  }): {
    creditedCount: number;
    heldCount: number;
    cancelledCount: number;
    skippedCount: number;
    creditedBookingIds: string[];
    runAt: string;
  } {
    const db = this.getDb();
    const policy = this.getPolicy();
    const nowIso = params?.nowIsoOverride || new Date().toISOString();
    const allRecs = this.getAllBookingCashbackRecords();
    const allBookings = db.getAllBookings();
    const allTxs = this.getAllLedgerTransactions();

    const bookingById = new Map<string, Booking>();
    allBookings.forEach((b) => {
      if (b?.id) bookingById.set(b.id, b);
    });

    const existingIdempotencyKeys = new Set<string>(
      allTxs.map((t) => t.idempotencyKey).filter((k): k is string => Boolean(k))
    );

    let creditedCount = 0;
    let heldCount = 0;
    let cancelledCount = 0;
    let skippedCount = 0;
    const creditedBookingIds: string[] = [];
    const affectedUsers = new Set<string>();

    for (let i = 0; i < allRecs.length; i++) {
      const rec = allRecs[i];
      if (rec.status !== 'PENDING' && rec.status !== 'HELD') continue;

      const linkedBooking = bookingById.get(rec.bookingId);
      const cfg = this.getUserConfiguration(rec.userId);

      const decision = evaluateDueForAutoCredit({
        record: rec,
        booking: linkedBooking,
        policy,
        userConfig: cfg,
        nowIso
      });

      if (decision.action === 'WAIT') {
        skippedCount += 1;
        continue;
      }

      if (decision.action === 'HOLD') {
        if (rec.status !== 'HELD' || rec.holdReason !== decision.reason) {
          allRecs[i] = {
            ...rec,
            status: 'HELD',
            holdReason: decision.reason,
            updatedAt: nowIso
          };
          db.syncCashbackDoc('booking_cashback_records', rec.id, allRecs[i]);
          heldCount += 1;
          affectedUsers.add(rec.userId);
        } else {
          skippedCount += 1;
        }
        continue;
      }

      if (decision.action === 'CANCEL') {
        allRecs[i] = {
          ...rec,
          status: 'CANCELLED',
          remainingCashbackAmount: 0,
          holdReason: decision.reason,
          cancelledAt: nowIso,
          updatedAt: nowIso
        };
        db.syncCashbackDoc('booking_cashback_records', rec.id, allRecs[i]);
        cancelledCount += 1;
        affectedUsers.add(rec.userId);
        continue;
      }

      // CREDIT: strict idempotency guarantee
      const idempotencyKey = `credit:${rec.bookingId}:${rec.id}`;
      const deterministicTxId = `CBTX-CRED-${rec.id}`;
      if (existingIdempotencyKeys.has(idempotencyKey) || allTxs.some((t) => t.id === deterministicTxId)) {
        skippedCount += 1;
        continue;
      }

      const creditAmount = roundMoney(rec.remainingCashbackAmount ?? rec.cashbackAmount);
      if (creditAmount <= 0) {
        skippedCount += 1;
        continue;
      }

      const userTxs = allTxs.filter((t) => t.userId === rec.userId);
      const walletBefore = reconcileWalletFromLedger({
        userId: rec.userId,
        defaultCurrency: rec.currency,
        ledgerTransactions: userTxs,
        bookingRecords: []
      });
      const availBefore = walletBefore.balancesByCurrency[rec.currency]?.availableBalance ?? 0;

      const ledgerTx: CashbackLedgerTransaction = {
        id: deterministicTxId,
        userId: rec.userId,
        agencyId: rec.agencyId,
        type: 'CASHBACK_CREDIT',
        direction: 'CREDIT',
        amount: creditAmount,
        currency: rec.currency,
        balanceAfterAvailable: roundMoney(availBefore + creditAmount),
        bookingId: rec.bookingId,
        bookingReference: rec.bookingReference,
        bookingCashbackRecordId: rec.id,
        idempotencyKey,
        description: `Automatic cashback credit (+${rec.cashbackPercent}%) for booking ${rec.bookingReference} completed ${rec.travelEndDate} (+${policy.creditDelayDays}d).`,
        createdAt: nowIso,
        createdByUid: params?.actor?.id || 'system-scheduler',
        createdByName: params?.actor?.name || 'Automated Cashback Scheduler'
      };

      allTxs.unshift(ledgerTx);
      existingIdempotencyKeys.add(idempotencyKey);
      db.syncCashbackDoc('cashback_ledger_transactions', deterministicTxId, ledgerTx);

      allRecs[i] = {
        ...rec,
        status: 'CREDITED',
        holdReason: undefined,
        creditedAt: nowIso,
        creditLedgerTransactionId: deterministicTxId,
        updatedAt: nowIso
      };
      db.syncCashbackDoc('booking_cashback_records', rec.id, allRecs[i]);

      this.writeAuditLog({
        action: 'CASHBACK_CREDITED',
        actor: params?.actor || null,
        targetUserId: rec.userId,
        entityType: 'BOOKING_CASHBACK',
        entityId: rec.id,
        bookingId: rec.bookingId,
        bookingReference: rec.bookingReference,
        amount: creditAmount,
        currency: rec.currency,
        summary: `Automatically credited ${rec.currency} ${creditAmount.toLocaleString()} for booking ${rec.bookingReference}.`
      });

      this.createNotification({
        userId: rec.userId,
        type: 'CASHBACK_CREDITED',
        title: 'Cashback Credited to Wallet',
        message: `${rec.currency} ${creditAmount.toLocaleString()} cashback for booking ${rec.bookingReference} is now credited and available for withdrawal.`,
        bookingId: rec.bookingId,
        bookingReference: rec.bookingReference,
        amount: creditAmount,
        currency: rec.currency,
        deduplicationKey: `credited:${rec.bookingId}:${rec.id}`
      });

      creditedCount += 1;
      creditedBookingIds.push(rec.bookingId);
      affectedUsers.add(rec.userId);
    }

    db.setCashbackStore(KEYS.BOOKING_RECORDS, allRecs);
    db.setCashbackStore(KEYS.LEDGER, allTxs);

    affectedUsers.forEach((uid) => {
      this.reconcileAndPersistUserWallet(uid, policy.defaultCurrency, nowIso);
    });

    db.setCashbackStore(KEYS.SCHEDULER_META, {
      lastRunAt: nowIso,
      lastRunSource: params?.source || 'SCHEDULER',
      creditedCount,
      heldCount,
      cancelledCount,
      skippedCount
    });

    return {
      creditedCount,
      heldCount,
      cancelledCount,
      skippedCount,
      creditedBookingIds,
      runAt: nowIso
    };
  }

  // -------------------------------------------------------------------------
  // LEDGER, WALLET RECONCILIATION & MANUAL ADJUSTMENTS
  // -------------------------------------------------------------------------

  public getAllLedgerTransactions(): CashbackLedgerTransaction[] {
    return this.getDb().getCashbackStore<CashbackLedgerTransaction[]>(KEYS.LEDGER, []);
  }

  public getLedgerTransactionsForUser(userId: string): CashbackLedgerTransaction[] {
    return this.getAllLedgerTransactions().filter((t) => t.userId === userId);
  }

  public getWalletForUser(userId: string): CashbackWalletSummary {
    const policy = this.getPolicy();
    const userTxs = this.getLedgerTransactionsForUser(userId);
    const userBookingRecs = this.getBookingCashbackRecordsForUser(userId);
    return reconcileWalletFromLedger({
      userId,
      defaultCurrency: policy.defaultCurrency,
      ledgerTransactions: userTxs,
      bookingRecords: userBookingRecs
    });
  }

  public getAllWallets(): CashbackWalletSummary[] {
    const allUsers = new Set<string>();
    this.getAllUserConfigurations().forEach((c) => allUsers.add(c.userId));
    this.getAllBookingCashbackRecords().forEach((r) => allUsers.add(r.userId));
    this.getAllLedgerTransactions().forEach((t) => allUsers.add(t.userId));
    const storedWallets = this.getDb().getCashbackStore<CashbackWalletSummary[]>(KEYS.WALLETS, []);
    storedWallets.forEach((w) => allUsers.add(w.userId));

    return Array.from(allUsers).map((uid) => this.getWalletForUser(uid));
  }

  public reconcileAndPersistUserWallet(userId: string, preferredCurrency?: string, nowIso?: string): CashbackWalletSummary {
    const db = this.getDb();
    const policy = this.getPolicy();
    const ts = nowIso || new Date().toISOString();
    const reconciled = reconcileWalletFromLedger({
      userId,
      defaultCurrency: preferredCurrency || policy.defaultCurrency,
      ledgerTransactions: this.getLedgerTransactionsForUser(userId),
      bookingRecords: this.getBookingCashbackRecordsForUser(userId),
      nowIso: ts
    });
    const allWallets = db.getCashbackStore<CashbackWalletSummary[]>(KEYS.WALLETS, []);
    const idx = allWallets.findIndex((w) => w.userId === userId);
    if (idx >= 0) {
      allWallets[idx] = reconciled;
    } else {
      allWallets.unshift(reconciled);
    }
    db.setCashbackStore(KEYS.WALLETS, allWallets);
    db.syncCashbackDoc('cashback_wallets', userId, reconciled);
    return reconciled;
  }

  public createManualLedgerAdjustment(params: {
    targetUserId: string;
    type: 'ADMIN_CREDIT_ADJUSTMENT' | 'ADMIN_DEBIT_ADJUSTMENT';
    amount: number;
    currency: string;
    reason: string;
    actor: User | null;
  }): CashbackLedgerTransaction {
    if (!isFinanceAdminUser(params.actor)) {
      throw new Error('Unauthorized: Only Finance Admins can create manual ledger adjustments.');
    }
    const cleanReason = (params.reason || '').trim();
    if (!cleanReason) {
      throw new Error('Audit reason is mandatory for manual cashback ledger adjustments.');
    }
    const amt = roundMoney(Number(params.amount));
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new Error('Adjustment amount must be greater than zero.');
    }
    const currency = (params.currency || 'INR').trim().toUpperCase();
    const walletBefore = this.getWalletForUser(params.targetUserId);
    const availBefore = walletBefore.balancesByCurrency[currency]?.availableBalance ?? 0;

    if (params.type === 'ADMIN_DEBIT_ADJUSTMENT' && amt > availBefore) {
      throw new Error(`Cannot debit ${currency} ${amt.toLocaleString()}: available balance is ${currency} ${availBefore.toLocaleString()}. Negative available balances are prohibited.`);
    }

    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const txId = `CBTX-ADJ-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const direction = params.type === 'ADMIN_CREDIT_ADJUSTMENT' ? 'CREDIT' : 'DEBIT';
    const nextAvail = direction === 'CREDIT' ? roundMoney(availBefore + amt) : roundMoney(availBefore - amt);

    const tx: CashbackLedgerTransaction = {
      id: txId,
      userId: params.targetUserId,
      type: params.type,
      direction,
      amount: amt,
      currency,
      balanceAfterAvailable: nextAvail,
      idempotencyKey: `adj:${txId}`,
      description: `Manual Admin ${direction === 'CREDIT' ? 'Credit' : 'Debit'} Adjustment: ${cleanReason}`,
      createdAt: nowIso,
      createdByUid: params.actor?.id || 'system',
      createdByName: params.actor?.name || 'Finance Admin'
    };

    const allTxs = this.getAllLedgerTransactions();
    allTxs.unshift(tx);
    db.setCashbackStore(KEYS.LEDGER, allTxs);
    db.syncCashbackDoc('cashback_ledger_transactions', txId, tx);
    this.reconcileAndPersistUserWallet(params.targetUserId, currency, nowIso);

    this.writeAuditLog({
      action: 'MANUAL_CASHBACK_ADJUSTMENT',
      actor: params.actor,
      targetUserId: params.targetUserId,
      entityType: 'LEDGER_TX',
      entityId: txId,
      amount: amt,
      currency,
      reason: cleanReason,
      summary: `Manual ${direction} adjustment of ${currency} ${amt.toLocaleString()} on user ${params.targetUserId}: ${cleanReason}.`
    });

    return tx;
  }

  public reconcileAllWallets(): {
    checkedUsers: number;
    discrepancyCount: number;
    discrepancies: Array<{ userId: string; storedAvailable: number; ledgerAvailable: number }>;
  } {
    const db = this.getDb();
    const policy = this.getPolicy();
    const storedWallets = db.getCashbackStore<CashbackWalletSummary[]>(KEYS.WALLETS, []);
    const storedByUid = new Map<string, CashbackWalletSummary>();
    storedWallets.forEach((w) => storedByUid.set(w.userId, w));

    const uids = new Set<string>([
      ...storedWallets.map((w) => w.userId),
      ...this.getAllUserConfigurations().map((c) => c.userId),
      ...this.getAllLedgerTransactions().map((t) => t.userId),
      ...this.getAllBookingCashbackRecords().map((r) => r.userId)
    ]);

    const discrepancies: Array<{ userId: string; storedAvailable: number; ledgerAvailable: number }> = [];
    uids.forEach((uid) => {
      const ledgerReconciled = reconcileWalletFromLedger({
        userId: uid,
        defaultCurrency: policy.defaultCurrency,
        ledgerTransactions: this.getLedgerTransactionsForUser(uid),
        bookingRecords: this.getBookingCashbackRecordsForUser(uid)
      });
      const stored = storedByUid.get(uid);
      if (stored && Math.abs(stored.availableBalance - ledgerReconciled.availableBalance) >= 0.01) {
        discrepancies.push({
          userId: uid,
          storedAvailable: stored.availableBalance,
          ledgerAvailable: ledgerReconciled.availableBalance
        });
      }
      this.reconcileAndPersistUserWallet(uid, policy.defaultCurrency);
    });

    return {
      checkedUsers: uids.size,
      discrepancyCount: discrepancies.length,
      discrepancies
    };
  }

  // -------------------------------------------------------------------------
  // USER BANK ACCOUNT MANAGEMENT (STRICT MASKING & VALIDATION)
  // -------------------------------------------------------------------------

  public getBankAccountsForUser(userId: string, includeMaskedOnly = true): UserBankAccount[] {
    const all = this.getDb().getCashbackStore<UserBankAccount[]>(KEYS.BANK_ACCOUNTS, []);
    const mine = all.filter((a) => a.userId === userId);
    if (!includeMaskedOnly) return mine;
    return mine.map((a) => sanitizeBankAccountForDisplay(a));
  }

  public getUnmaskedBankAccountForFinancePayout(params: {
    bankAccountId: string;
    withdrawalRequestId: string;
    actor: User | null;
  }): UserBankAccount | null {
    if (!isFinanceAdminUser(params.actor)) {
      throw new Error('Unauthorized: Only Finance Administrators can view unmasked payout bank account details.');
    }
    const all = this.getDb().getCashbackStore<UserBankAccount[]>(KEYS.BANK_ACCOUNTS, []);
    const found = all.find((a) => a.id === params.bankAccountId);
    if (!found) return null;

    this.writeAuditLog({
      action: 'PAYOUT_BANK_DETAILS_VIEWED',
      actor: params.actor,
      targetUserId: found.userId,
      entityType: 'WITHDRAWAL_REQUEST',
      entityId: params.withdrawalRequestId,
      withdrawalRequestId: params.withdrawalRequestId,
      summary: `Finance Admin ${params.actor?.name || params.actor?.id} viewed payout bank details (${found.accountNumberMasked}) for withdrawal ${params.withdrawalRequestId}.`
    });
    return { ...found };
  }

  public saveBankAccount(params: {
    id?: string;
    userId: string;
    accountHolderName: string;
    bankName: string;
    branchName?: string;
    accountNumber: string;
    accountType?: 'SAVINGS' | 'CURRENT';
    ifscCode?: string;
    swiftCode?: string;
    iban?: string;
    country?: string;
    currency?: string;
    isDefault?: boolean;
    actor: User | null;
  }): UserBankAccount {
    if (!params.actor || (params.actor.id !== params.userId && !isFinanceAdminUser(params.actor))) {
      throw new Error('Unauthorized: You can only manage your own bank account details.');
    }

    const validation = validateBankAccountInput(params);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    const db = this.getDb();
    const all = db.getCashbackStore<UserBankAccount[]>(KEYS.BANK_ACCOUNTS, []);
    const nowIso = new Date().toISOString();
    const cleanNum = params.accountNumber.replace(/\s+/g, '');
    const masked = maskAccountNumber(cleanNum);

    const mine = all.filter((a) => a.userId === params.userId);
    const existingIdx = params.id ? all.findIndex((a) => a.id === params.id && a.userId === params.userId) : -1;
    const isDefault = params.isDefault === true || mine.length === 0 || (existingIdx >= 0 && all[existingIdx].isDefault);

    const record: UserBankAccount = {
      id: existingIdx >= 0 ? all[existingIdx].id : `BANK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      userId: params.userId,
      accountHolderName: params.accountHolderName.trim(),
      bankName: params.bankName.trim(),
      branchName: params.branchName?.trim() || undefined,
      accountNumberMasked: masked,
      accountNumberLast4: cleanNum.slice(-4),
      accountNumberStored: cleanNum,
      accountType: params.accountType === 'SAVINGS' || params.accountType === 'CURRENT' ? params.accountType : 'CURRENT',
      ifscCode: params.ifscCode ? params.ifscCode.trim().toUpperCase() : undefined,
      swiftCode: params.swiftCode ? params.swiftCode.trim().toUpperCase() : undefined,
      iban: params.iban ? params.iban.trim().toUpperCase() : undefined,
      country: (params.country || 'India').trim(),
      currency: (params.currency || 'INR').trim().toUpperCase(),
      isDefault,
      isVerified: true,
      createdAt: existingIdx >= 0 ? all[existingIdx].createdAt : nowIso,
      updatedAt: nowIso
    };

    if (isDefault) {
      all.forEach((a) => {
        if (a.userId === params.userId && a.id !== record.id && a.isDefault) {
          a.isDefault = false;
          a.updatedAt = nowIso;
          db.syncCashbackDoc('user_bank_accounts', a.id, a);
        }
      });
    }

    if (existingIdx >= 0) {
      all[existingIdx] = record;
    } else {
      all.unshift(record);
    }

    db.setCashbackStore(KEYS.BANK_ACCOUNTS, all);
    db.syncCashbackDoc('user_bank_accounts', record.id, record);

    this.writeAuditLog({
      action: existingIdx >= 0 ? 'BANK_ACCOUNT_UPDATED' : 'BANK_ACCOUNT_ADDED',
      actor: params.actor,
      targetUserId: params.userId,
      entityType: 'BANK_ACCOUNT',
      entityId: record.id,
      summary: `${existingIdx >= 0 ? 'Updated' : 'Added'} bank account ${record.bankName} (${masked}).`
    });

    return sanitizeBankAccountForDisplay(record);
  }

  public deleteBankAccount(params: {
    bankAccountId: string;
    userId: string;
    actor: User | null;
  }): void {
    if (!params.actor || (params.actor.id !== params.userId && !isFinanceAdminUser(params.actor))) {
      throw new Error('Unauthorized: Cannot remove another user\'s bank account.');
    }
    const db = this.getDb();
    const all = db.getCashbackStore<UserBankAccount[]>(KEYS.BANK_ACCOUNTS, []);
    const target = all.find((a) => a.id === params.bankAccountId && a.userId === params.userId);
    if (!target) throw new Error('Bank account not found.');

    const remaining = all.filter((a) => a.id !== params.bankAccountId);
    if (target.isDefault) {
      const nextMine = remaining.find((a) => a.userId === params.userId);
      if (nextMine) {
        nextMine.isDefault = true;
        db.syncCashbackDoc('user_bank_accounts', nextMine.id, nextMine);
      }
    }
    db.setCashbackStore(KEYS.BANK_ACCOUNTS, remaining);

    this.writeAuditLog({
      action: 'BANK_ACCOUNT_DELETED',
      actor: params.actor,
      targetUserId: params.userId,
      entityType: 'BANK_ACCOUNT',
      entityId: params.bankAccountId,
      summary: `Removed bank account ${target.bankName} (${target.accountNumberMasked}).`
    });
  }

  // -------------------------------------------------------------------------
  // WITHDRAWAL REQUEST LIFECYCLE (TWO-STEP HOLD -> PAID DEBIT / REJECT RELEASE)
  // -------------------------------------------------------------------------

  public getAllWithdrawalRequests(): CashbackWithdrawalRequest[] {
    return this.getDb().getCashbackStore<CashbackWithdrawalRequest[]>(KEYS.WITHDRAWALS, []);
  }

  public getWithdrawalRequestsForUser(userId: string): CashbackWithdrawalRequest[] {
    return this.getAllWithdrawalRequests().filter((w) => w.userId === userId);
  }

  public submitWithdrawalRequest(params: {
    userId: string;
    requestedAmount: number;
    currency: string;
    bankAccountId: string;
    userNotes?: string;
    idempotencyKey?: string;
    actor: User | null;
  }): CashbackWithdrawalRequest {
    if (!params.actor || params.actor.id !== params.userId) {
      throw new Error('Unauthorized: Withdrawal requests can only be submitted by the authenticated wallet owner.');
    }

    const db = this.getDb();
    const policy = this.getPolicy();
    const nowIso = new Date().toISOString();
    const idempotencyKey = (params.idempotencyKey || `wd:${params.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`).trim();

    const existingAll = this.getAllWithdrawalRequests();
    const dup = existingAll.find((w) => w.userId === params.userId && w.idempotencyKey === idempotencyKey);
    if (dup) return dup;

    const cfg = this.getUserConfiguration(params.userId);
    if (policy.allowWithdrawalOnlyWhenActive && (!cfg || !cfg.isEligible || cfg.status !== 'ACTIVE')) {
      throw new Error('Cashback withdrawals require an ACTIVE eligible cashback configuration.');
    }

    const requestedAmount = roundMoney(Number(params.requestedAmount));
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero.');
    }

    const currency = (params.currency || policy.defaultCurrency).trim().toUpperCase();
    if (requestedAmount < policy.minWithdrawalAmount) {
      throw new Error(`Minimum withdrawal amount is ${currency} ${policy.minWithdrawalAmount.toLocaleString()}.`);
    }
    if (policy.maxWithdrawalAmount > 0 && requestedAmount > policy.maxWithdrawalAmount) {
      throw new Error(`Maximum single withdrawal limit is ${currency} ${policy.maxWithdrawalAmount.toLocaleString()}.`);
    }

    const rawBanks = db.getCashbackStore<UserBankAccount[]>(KEYS.BANK_ACCOUNTS, []);
    const bank = rawBanks.find((b) => b.id === params.bankAccountId && b.userId === params.userId);
    if (!bank) {
      throw new Error('Selected bank account was not found or does not belong to your account.');
    }
    const bankCheck = validateBankAccountInput({
      accountHolderName: bank.accountHolderName,
      bankName: bank.bankName,
      accountNumber: bank.accountNumberStored || bank.accountNumberMasked,
      ifscCode: bank.ifscCode,
      swiftCode: bank.swiftCode,
      iban: bank.iban,
      country: bank.country,
      currency: bank.currency
    });
    if (!bankCheck.valid) {
      throw new Error(`Bank details incomplete or invalid: ${bankCheck.errors.join(' ')}`);
    }

    const wallet = this.getWalletForUser(params.userId);
    const availableInCurr = wallet.balancesByCurrency[currency]?.availableBalance ?? 0;
    if (requestedAmount > availableInCurr) {
      throw new Error(`Insufficient available cashback balance (${currency} ${availableInCurr.toLocaleString()}) for requested withdrawal of ${currency} ${requestedAmount.toLocaleString()}.`);
    }

    const reqId = `CBWD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const holdTxId = `CBTX-HOLD-${reqId}`;
    const maskedSnapshot = toMaskedBankSnapshot(bank);

    const holdTx: CashbackLedgerTransaction = {
      id: holdTxId,
      userId: params.userId,
      agencyId: params.actor.agencyId,
      type: 'WITHDRAWAL_HOLD',
      direction: 'HOLD',
      amount: requestedAmount,
      currency,
      balanceAfterAvailable: roundMoney(availableInCurr - requestedAmount),
      withdrawalRequestId: reqId,
      idempotencyKey: `hold:${reqId}`,
      description: `Held ${currency} ${requestedAmount.toLocaleString()} for withdrawal ${reqId} (${maskedSnapshot.bankName} ${maskedSnapshot.accountNumberMasked}).`,
      createdAt: nowIso,
      createdByUid: params.userId,
      createdByName: params.actor.name
    };

    const allTxs = this.getAllLedgerTransactions();
    allTxs.unshift(holdTx);
    db.setCashbackStore(KEYS.LEDGER, allTxs);
    db.syncCashbackDoc('cashback_ledger_transactions', holdTxId, holdTx);

    const wdReq: CashbackWithdrawalRequest = {
      id: reqId,
      requestNumber: reqId,
      userId: params.userId,
      userName: params.actor.name,
      userEmail: params.actor.email,
      agencyId: params.actor.agencyId,
      agencyName: params.actor.agencyName || params.actor.companyName,
      requestedAmount,
      currency,
      bankAccountId: bank.id,
      bankSnapshotMasked: maskedSnapshot,
      status: 'SUBMITTED',
      holdLedgerTransactionId: holdTxId,
      userNotes: params.userNotes?.trim() || undefined,
      statusHistory: [
        {
          status: 'SUBMITTED',
          changedAt: nowIso,
          changedByUid: params.actor.id,
          changedByName: params.actor.name,
          note: 'Withdrawal request submitted and balance placed on hold.'
        }
      ],
      idempotencyKey,
      submittedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    existingAll.unshift(wdReq);
    db.setCashbackStore(KEYS.WITHDRAWALS, existingAll);
    db.syncCashbackDoc('cashbackWithdrawalRequests', reqId, wdReq);
    this.reconcileAndPersistUserWallet(params.userId, currency, nowIso);

    this.writeAuditLog({
      action: 'WITHDRAWAL_SUBMITTED',
      actor: params.actor,
      targetUserId: params.userId,
      entityType: 'WITHDRAWAL_REQUEST',
      entityId: reqId,
      withdrawalRequestId: reqId,
      amount: requestedAmount,
      currency,
      summary: `Submitted withdrawal request ${reqId} for ${currency} ${requestedAmount.toLocaleString()} to ${maskedSnapshot.bankName} (${maskedSnapshot.accountNumberMasked}).`
    });

    this.createNotification({
      userId: params.userId,
      type: 'WITHDRAWAL_SUBMITTED',
      title: 'Withdrawal Request Submitted',
      message: `Withdrawal ${reqId} for ${currency} ${requestedAmount.toLocaleString()} to ${maskedSnapshot.bankName} (${maskedSnapshot.accountNumberMasked}) is pending Finance review.`,
      withdrawalRequestId: reqId,
      amount: requestedAmount,
      currency,
      deduplicationKey: `wd-sub:${reqId}`
    });

    try {
      db.recordAdminActivity({
        entityId: reqId,
        entityType: 'WITHDRAWAL_REQUEST',
        category: 'PAYMENT',
        activityType: 'CASHBACK_WITHDRAWAL_SUBMITTED',
        actorId: params.actor.id,
        actorName: params.actor.name,
        actorType: 'B2B_AGENT',
        severity: 'WARNING',
        actionRequired: true,
        actionLabel: 'Review Cashback Withdrawal',
        summary: `New Cashback Withdrawal Request [${reqId}]: ${params.actor.name} requested ${currency} ${requestedAmount.toLocaleString()} to ${maskedSnapshot.bankName} (${maskedSnapshot.accountNumberMasked}).`,
        details: {
          agentName: params.actor.name,
          totalAmount: requestedAmount,
          currency,
          actionNeeded: 'Review and approve/reject cashback withdrawal request'
        },
        targetSection: 'CASHBACK_MANAGEMENT',
        targetSubTab: 'WITHDRAWALS'
      });
    } catch {
      // ignore if activity stream unavailable in headless test
    }

    return wdReq;
  }

  public cancelOwnWithdrawal(params: {
    withdrawalRequestId: string;
    actor: User | null;
  }): CashbackWithdrawalRequest {
    const db = this.getDb();
    const all = this.getAllWithdrawalRequests();
    const idx = all.findIndex((w) => w.id === params.withdrawalRequestId);
    if (idx < 0) throw new Error('Withdrawal request not found.');
    const wd = all[idx];
    if (!params.actor || wd.userId !== params.actor.id) {
      throw new Error('Unauthorized: You can only cancel your own withdrawal requests.');
    }
    if (!canTransitionWithdrawalStatus(wd.status, 'CANCELLED')) {
      throw new Error(`Withdrawal request ${wd.id} cannot be cancelled in status ${wd.status}.`);
    }

    const nowIso = new Date().toISOString();
    const relTxId = `CBTX-REL-${wd.id}`;
    const walletBefore = this.getWalletForUser(wd.userId);
    const availBefore = walletBefore.balancesByCurrency[wd.currency]?.availableBalance ?? 0;

    const releaseTx: CashbackLedgerTransaction = {
      id: relTxId,
      userId: wd.userId,
      agencyId: wd.agencyId,
      type: 'WITHDRAWAL_RELEASE',
      direction: 'RELEASE',
      amount: wd.requestedAmount,
      currency: wd.currency,
      balanceAfterAvailable: roundMoney(availBefore + wd.requestedAmount),
      withdrawalRequestId: wd.id,
      idempotencyKey: `release:${wd.id}`,
      description: `Released held funds for user-cancelled withdrawal ${wd.id}.`,
      createdAt: nowIso,
      createdByUid: params.actor.id,
      createdByName: params.actor.name
    };

    const allTxs = this.getAllLedgerTransactions();
    if (!allTxs.some((t) => t.id === relTxId)) {
      allTxs.unshift(releaseTx);
      db.setCashbackStore(KEYS.LEDGER, allTxs);
      db.syncCashbackDoc('cashback_ledger_transactions', relTxId, releaseTx);
    }

    const updated: CashbackWithdrawalRequest = {
      ...wd,
      status: 'CANCELLED',
      releaseLedgerTransactionId: relTxId,
      statusHistory: [
        ...(wd.statusHistory || []),
        {
          status: 'CANCELLED',
          changedAt: nowIso,
          changedByUid: params.actor.id,
          changedByName: params.actor.name,
          note: 'Cancelled by user prior to Finance approval; held funds restored to available balance.'
        }
      ],
      updatedAt: nowIso
    };

    all[idx] = updated;
    db.setCashbackStore(KEYS.WITHDRAWALS, all);
    db.syncCashbackDoc('cashbackWithdrawalRequests', wd.id, updated);
    this.reconcileAndPersistUserWallet(wd.userId, wd.currency, nowIso);

    this.writeAuditLog({
      action: 'WITHDRAWAL_CANCELLED',
      actor: params.actor,
      targetUserId: wd.userId,
      entityType: 'WITHDRAWAL_REQUEST',
      entityId: wd.id,
      withdrawalRequestId: wd.id,
      amount: wd.requestedAmount,
      currency: wd.currency,
      summary: `User cancelled withdrawal ${wd.id}; released ${wd.currency} ${wd.requestedAmount.toLocaleString()} back to available balance.`
    });

    return updated;
  }

  public transitionWithdrawalRequest(params: {
    withdrawalRequestId: string;
    targetStatus: WithdrawalStatus;
    internalNotes?: string;
    rejectionReason?: string;
    paymentReference?: string;
    paymentMethod?: string;
    paymentDate?: string;
    actor: User | null;
  }): CashbackWithdrawalRequest {
    if (!isFinanceAdminUser(params.actor)) {
      throw new Error('Unauthorized: Only Administrators or Finance Managers can approve, reject, or settle withdrawals.');
    }

    const db = this.getDb();
    const all = this.getAllWithdrawalRequests();
    const idx = all.findIndex((w) => w.id === params.withdrawalRequestId);
    if (idx < 0) throw new Error('Withdrawal request not found.');
    const wd = all[idx];

    if (wd.userId === params.actor?.id && params.targetStatus !== 'CANCELLED') {
      throw new Error('Segregation of Duties Violation: Administrators cannot approve, process, or mark paid their own cashback withdrawal requests.');
    }

    if (!canTransitionWithdrawalStatus(wd.status, params.targetStatus)) {
      throw new Error(`Invalid withdrawal status transition: ${wd.status} → ${params.targetStatus}.`);
    }

    if (params.targetStatus === 'REJECTED' && !String(params.rejectionReason || '').trim()) {
      throw new Error('Rejection reason is mandatory when rejecting a withdrawal request.');
    }

    if (params.targetStatus === 'PAID' && (!String(params.paymentReference || '').trim() || !String(params.paymentDate || '').trim())) {
      throw new Error('Payment reference and payment date are mandatory when marking a withdrawal as PAID.');
    }

    const nowIso = new Date().toISOString();
    const allTxs = this.getAllLedgerTransactions();
    const walletBefore = this.getWalletForUser(wd.userId);
    const availBefore = walletBefore.balancesByCurrency[wd.currency]?.availableBalance ?? 0;

    const updated: CashbackWithdrawalRequest = {
      ...wd,
      status: params.targetStatus,
      internalNotes: params.internalNotes !== undefined ? params.internalNotes.trim() : wd.internalNotes,
      updatedAt: nowIso
    };

    if (params.targetStatus === 'APPROVED') {
      updated.approvedAt = nowIso;
      updated.approvedByUid = params.actor?.id;
      updated.approvedByName = params.actor?.name;
    } else if (params.targetStatus === 'PAID') {
      const debitTxId = `CBTX-DEBIT-${wd.id}`;
      if (!allTxs.some((t) => t.id === debitTxId)) {
        const debitTx: CashbackLedgerTransaction = {
          id: debitTxId,
          userId: wd.userId,
          agencyId: wd.agencyId,
          type: 'WITHDRAWAL_DEBIT',
          direction: 'DEBIT',
          amount: wd.requestedAmount,
          currency: wd.currency,
          balanceAfterAvailable: availBefore,
          withdrawalRequestId: wd.id,
          idempotencyKey: `debit:${wd.id}`,
          description: `Payout settled for withdrawal ${wd.id} (Ref: ${String(params.paymentReference).trim()}) to ${wd.bankSnapshotMasked.bankName} ${wd.bankSnapshotMasked.accountNumberMasked}.`,
          createdAt: nowIso,
          createdByUid: params.actor?.id || 'finance-admin',
          createdByName: params.actor?.name || 'Finance Admin'
        };
        allTxs.unshift(debitTx);
        db.setCashbackStore(KEYS.LEDGER, allTxs);
        db.syncCashbackDoc('cashback_ledger_transactions', debitTxId, debitTx);
      }
      updated.paidAt = nowIso;
      updated.paidByUid = params.actor?.id;
      updated.paidByName = params.actor?.name;
      updated.paymentReference = String(params.paymentReference).trim();
      updated.paymentMethod = String(params.paymentMethod || 'BANK_TRANSFER').trim();
      updated.paymentDate = String(params.paymentDate).trim();
      updated.debitLedgerTransactionId = debitTxId;
    } else if (params.targetStatus === 'REJECTED') {
      const releaseTxId = `CBTX-REL-${wd.id}`;
      if (!allTxs.some((t) => t.id === releaseTxId)) {
        const releaseTx: CashbackLedgerTransaction = {
          id: releaseTxId,
          userId: wd.userId,
          agencyId: wd.agencyId,
          type: 'WITHDRAWAL_RELEASE',
          direction: 'RELEASE',
          amount: wd.requestedAmount,
          currency: wd.currency,
          balanceAfterAvailable: roundMoney(availBefore + wd.requestedAmount),
          withdrawalRequestId: wd.id,
          idempotencyKey: `release:${wd.id}`,
          description: `Released held funds for rejected withdrawal ${wd.id}: ${String(params.rejectionReason).trim()}.`,
          createdAt: nowIso,
          createdByUid: params.actor?.id || 'finance-admin',
          createdByName: params.actor?.name || 'Finance Admin'
        };
        allTxs.unshift(releaseTx);
        db.setCashbackStore(KEYS.LEDGER, allTxs);
        db.syncCashbackDoc('cashback_ledger_transactions', releaseTxId, releaseTx);
      }
      updated.rejectedAt = nowIso;
      updated.rejectedByUid = params.actor?.id;
      updated.rejectedByName = params.actor?.name;
      updated.rejectionReason = String(params.rejectionReason).trim();
      updated.releaseLedgerTransactionId = releaseTxId;
    }

    updated.statusHistory = [
      ...(wd.statusHistory || []),
      {
        status: params.targetStatus,
        changedAt: nowIso,
        changedByUid: params.actor?.id || 'finance-admin',
        changedByName: params.actor?.name || 'Finance Admin',
        note: params.rejectionReason || params.paymentReference || params.internalNotes || `Transitioned to ${params.targetStatus}`
      }
    ];

    all[idx] = updated;
    db.setCashbackStore(KEYS.WITHDRAWALS, all);
    db.syncCashbackDoc('cashbackWithdrawalRequests', wd.id, updated);
    this.reconcileAndPersistUserWallet(wd.userId, wd.currency, nowIso);

    const actionMap: Record<WithdrawalStatus, CashbackAuditLogRecord['action']> = {
      SUBMITTED: 'WITHDRAWAL_SUBMITTED',
      UNDER_REVIEW: 'WITHDRAWAL_UNDER_REVIEW',
      APPROVED: 'WITHDRAWAL_APPROVED',
      PROCESSING: 'WITHDRAWAL_PROCESSING',
      PAID: 'WITHDRAWAL_PAID',
      REJECTED: 'WITHDRAWAL_REJECTED',
      CANCELLED: 'WITHDRAWAL_CANCELLED'
    };

    this.writeAuditLog({
      action: actionMap[params.targetStatus],
      actor: params.actor,
      targetUserId: wd.userId,
      entityType: 'WITHDRAWAL_REQUEST',
      entityId: wd.id,
      withdrawalRequestId: wd.id,
      amount: wd.requestedAmount,
      currency: wd.currency,
      reason: params.rejectionReason || params.paymentReference || params.internalNotes,
      summary: `Withdrawal ${wd.id} transitioned ${wd.status} → ${params.targetStatus} (${wd.currency} ${wd.requestedAmount.toLocaleString()}, ${wd.bankSnapshotMasked.accountNumberMasked}).`
    });

    this.createNotification({
      userId: wd.userId,
      type:
        params.targetStatus === 'APPROVED'
          ? 'WITHDRAWAL_APPROVED'
          : params.targetStatus === 'PAID'
            ? 'WITHDRAWAL_PAID'
            : params.targetStatus === 'REJECTED'
              ? 'WITHDRAWAL_REJECTED'
              : 'WITHDRAWAL_SUBMITTED',
      title: `Withdrawal ${params.targetStatus === 'PAID' ? 'Paid' : params.targetStatus === 'REJECTED' ? 'Rejected' : params.targetStatus === 'APPROVED' ? 'Approved' : 'Updated'}`,
      message:
        params.targetStatus === 'PAID'
          ? `Payout of ${wd.currency} ${wd.requestedAmount.toLocaleString()} for ${wd.id} to ${wd.bankSnapshotMasked.bankName} (${wd.bankSnapshotMasked.accountNumberMasked}) completed. Ref: ${updated.paymentReference}.`
          : params.targetStatus === 'REJECTED'
            ? `Withdrawal ${wd.id} was rejected (${updated.rejectionReason}). Held funds (${wd.currency} ${wd.requestedAmount.toLocaleString()}) have been restored to your available balance.`
            : `Withdrawal ${wd.id} (${wd.currency} ${wd.requestedAmount.toLocaleString()}) status updated to ${params.targetStatus}.`,
      withdrawalRequestId: wd.id,
      amount: wd.requestedAmount,
      currency: wd.currency,
      deduplicationKey: `wd:${wd.id}:${params.targetStatus}`
    });

    return updated;
  }

  // -------------------------------------------------------------------------
  // ADMIN METRICS, NOTIFICATIONS & AUDIT TRAIL
  // -------------------------------------------------------------------------

  public getDashboardMetrics(): CashbackAdminMetrics {
    const configs = this.getAllUserConfigurations();
    const wallets = this.getAllWallets();
    const bookingRecords = this.getAllBookingCashbackRecords();
    const withdrawals = this.getAllWithdrawalRequests();

    const pendingTotal = bookingRecords
      .filter((r) => r.status === 'PENDING' || r.status === 'HELD')
      .reduce((s, r) => s + (r.remainingCashbackAmount ?? r.cashbackAmount ?? 0), 0);

    return {
      totalCashbackUsers: configs.length,
      eligibleUsersCount: configs.filter((c) => c.isEligible && c.status === 'ACTIVE').length,
      totalPendingCashback: roundMoney(pendingTotal),
      totalCreditedCashback: roundMoney(wallets.reduce((s, w) => s + w.totalCredited, 0)),
      totalAvailableForWithdrawal: roundMoney(wallets.reduce((s, w) => s + w.availableBalance, 0)),
      totalWithdrawalRequests: withdrawals.length,
      pendingWithdrawalRequests: withdrawals.filter((w) => w.status === 'SUBMITTED' || w.status === 'UNDER_REVIEW').length,
      approvedWithdrawalsCount: withdrawals.filter((w) => w.status === 'APPROVED' || w.status === 'PROCESSING').length,
      paidWithdrawalsCount: withdrawals.filter((w) => w.status === 'PAID').length,
      rejectedWithdrawalsCount: withdrawals.filter((w) => w.status === 'REJECTED').length,
      totalPaidOut: roundMoney(withdrawals.filter((w) => w.status === 'PAID').reduce((s, w) => s + w.requestedAmount, 0))
    };
  }

  public getAuditLogs(limit = 500): CashbackAuditLogRecord[] {
    return this.getDb().getCashbackStore<CashbackAuditLogRecord[]>(KEYS.AUDIT_LOGS, []).slice(0, limit);
  }

  public getNotificationsForUser(userId: string): CashbackNotificationEvent[] {
    return this.getDb()
      .getCashbackStore<CashbackNotificationEvent[]>(KEYS.NOTIFICATIONS, [])
      .filter((n) => n.userId === userId);
  }

  public getSchedulerMeta(): {
    lastRunAt?: string;
    lastRunSource?: string;
    creditedCount?: number;
    heldCount?: number;
    cancelledCount?: number;
    skippedCount?: number;
  } {
    return this.getDb().getCashbackStore(KEYS.SCHEDULER_META, {});
  }

  private writeAuditLog(params: {
    action: CashbackAuditLogRecord['action'];
    actor: User | null;
    targetUserId?: string;
    entityType: CashbackAuditLogRecord['entityType'];
    entityId: string;
    bookingId?: string;
    bookingReference?: string;
    withdrawalRequestId?: string;
    previousValue?: string;
    newValue?: string;
    amount?: number;
    currency?: string;
    reason?: string;
    summary: string;
  }): void {
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const entry: CashbackAuditLogRecord = {
      id: `CBAUD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      action: params.action,
      actorUid: params.actor?.id || 'system',
      actorName: params.actor?.name || 'System Automation',
      actorRole: params.actor?.role || 'SYSTEM',
      targetUserId: params.targetUserId,
      entityType: params.entityType,
      entityId: params.entityId,
      bookingId: params.bookingId,
      bookingReference: params.bookingReference,
      withdrawalRequestId: params.withdrawalRequestId,
      previousValue: params.previousValue,
      newValue: params.newValue,
      amount: params.amount,
      currency: params.currency,
      reason: params.reason,
      summary: params.summary,
      timestamp: nowIso
    };
    const logs = db.getCashbackStore<CashbackAuditLogRecord[]>(KEYS.AUDIT_LOGS, []);
    db.setCashbackStore(KEYS.AUDIT_LOGS, [entry, ...logs.slice(0, 999)]);
    db.syncCashbackDoc('cashback_audit_logs', entry.id, entry);

    try {
      db.logAudit(
        params.actor ? { id: params.actor.id, name: params.actor.name, role: params.actor.role } : null,
        params.action as any,
        'Cashback',
        params.entityId,
        params.summary,
        params.previousValue,
        params.newValue
      );
    } catch {
      // safe fallback
    }
  }

  private createNotification(params: {
    userId: string;
    type: CashbackNotificationEvent['type'];
    title: string;
    message: string;
    bookingId?: string;
    bookingReference?: string;
    withdrawalRequestId?: string;
    amount?: number;
    currency?: string;
    deduplicationKey: string;
  }): CashbackNotificationEvent {
    const db = this.getDb();
    const all = db.getCashbackStore<CashbackNotificationEvent[]>(KEYS.NOTIFICATIONS, []);
    const existing = all.find((n) => n.deduplicationKey === params.deduplicationKey);
    if (existing) return existing;

    const nowIso = new Date().toISOString();
    const notif: CashbackNotificationEvent = {
      id: `CBNOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      bookingId: params.bookingId,
      bookingReference: params.bookingReference,
      withdrawalRequestId: params.withdrawalRequestId,
      amount: params.amount,
      currency: params.currency,
      deduplicationKey: params.deduplicationKey,
      isRead: false,
      createdAt: nowIso
    };

    all.unshift(notif);
    db.setCashbackStore(KEYS.NOTIFICATIONS, all.slice(0, 500));
    db.syncCashbackDoc('cashback_notifications', notif.id, notif);

    // Bridge into B2B Agent Notification Bell with deep link to My Cashback
    try {
      const agentNotifs = db.getCashbackStore<any[]>('agent_notifications', []);
      if (!agentNotifs.some((n) => n.deduplicationKey === params.deduplicationKey)) {
        const bridged = {
          id: notif.id,
          deduplicationKey: params.deduplicationKey,
          entityType: params.withdrawalRequestId ? 'WITHDRAWAL' : 'CASHBACK',
          entityId: params.withdrawalRequestId || params.bookingId || notif.id,
          entityReference: params.bookingReference || params.withdrawalRequestId || 'WALLET',
          agentUserId: params.userId,
          assignedByUserId: 'system-cashback',
          assignedByName: 'Cashback & Rewards',
          title: params.title,
          message: params.message,
          isRead: false,
          createdAt: nowIso,
          deepLinkTab: 'my-cashback'
        };
        agentNotifs.unshift(bridged);
        db.setCashbackStore('agent_notifications', agentNotifs.slice(0, 500));
        db.syncCashbackDoc('agent_notifications', bridged.id, bridged);
      }
    } catch {
      // ignore
    }

    return notif;
  }
}

export const cashbackService = new CashbackService();
try {
  cashbackService.attachToDatabase();
} catch {
  // Deferred attachment if AppDatabase is not initialized yet
}
