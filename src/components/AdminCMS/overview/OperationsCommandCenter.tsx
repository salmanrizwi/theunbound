import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppDatabase } from '../../../services/db';
import { 
  Booking, 
  TravelLead, 
  Quotation, 
  Product, 
  Hotel, 
  Destination, 
  User, 
  Supplier, 
  AuditLog, 
  CalendarTask, 
  CurrencyCode 
} from '../../../types';
import { 
  DashboardMetricsService, 
  DateRangeOption, 
  PerformanceGranularity, 
  KeyBusinessMetrics, 
  BusinessPerformanceData, 
  NeedsAttentionItem, 
  OperationsTodayData, 
  SystemHealthReport 
} from '../../../services/dashboardMetricsService';
import { CurrencyEngine } from '../../../services/currencyEngine';

import { OverviewHeader } from './OverviewHeader';
import { KeyBusinessMetricsGrid } from './KeyBusinessMetricsGrid';
import { NeedsAttentionSection } from './NeedsAttentionSection';
import { BusinessPerformanceSection } from './BusinessPerformanceSection';
import { FinancialSnapshotSection } from './FinancialSnapshotSection';
import { OperationalHorizonSection } from './OperationalHorizonSection';
import { TeamWorkloadAndTasksSection } from './TeamWorkloadAndTasksSection';
import { AuditStreamAndQuickActionsSection } from './AuditStreamAndQuickActionsSection';

interface OperationsCommandCenterProps {
  currentUser: User | null;
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
  onLoadQuote?: (quote: Quotation) => void;
  onViewProduct?: (productId: string) => void;
}

export const OperationsCommandCenter: React.FC<OperationsCommandCenterProps> = ({
  currentUser,
  onNavigate,
  onLoadQuote,
  onViewProduct
}) => {
  const db = AppDatabase.getInstance();
  const fx = CurrencyEngine.getInstance();
  const metricsService = DashboardMetricsService.getInstance();

  // State
  const [dbTick, setDbTick] = useState(0);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeOption>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => (fx.getSettings().baseCurrency || 'USD') as CurrencyCode);
  const [granularity, setGranularity] = useState<PerformanceGranularity>('DAILY');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealthReport | null>(null);

  // Subscribe to DB updates
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setDbTick(t => t + 1);
      setLastUpdated(new Date());
    });
    return () => unsub();
  }, [db]);

  // Load system health report on mount & refresh
  const loadSystemHealth = useCallback(async () => {
    try {
      const report = await metricsService.getSystemHealthReport();
      setSystemHealth(report);
    } catch (err) {
      console.warn('Could not load system health:', err);
    }
  }, [metricsService]);

  useEffect(() => {
    loadSystemHealth();
  }, [loadSystemHealth]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setDbTick(t => t + 1);
    await loadSystemHealth();
    setLastUpdated(new Date());
    setTimeout(() => setIsRefreshing(false), 300);
  };

  // Authoritative Records directly from Database
  const bookings: Booking[] = useMemo(() => db.getAllBookings(), [db, dbTick]);
  const leads: TravelLead[] = useMemo(() => db.getLeads(), [db, dbTick]);
  const quotes: Quotation[] = useMemo(() => db.getAllSavedQuotes(), [db, dbTick]);
  const products: Product[] = useMemo(() => db.getProducts(), [db, dbTick]);
  const users: User[] = useMemo(() => db.getUsers(), [db, dbTick]);
  const suppliers: Supplier[] = useMemo(() => db.getSuppliers(), [db, dbTick]);
  const tasks: CalendarTask[] = useMemo(() => db.getCalendarTasks(), [db, dbTick]);
  const auditLogs: AuditLog[] = useMemo(() => db.getAuditLogs(), [db, dbTick]);

  // Financial clearance check
  const isAuthorizedForFinance = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'ADMIN' || currentUser.role === 'FINANCE' || currentUser.permissions?.canAccessFinancials === true;
  }, [currentUser]);

  // Period comparison
  const comparison = useMemo(() => {
    return metricsService.getDateInterval(selectedDateRange, customStartDate, customEndDate);
  }, [metricsService, selectedDateRange, customStartDate, customEndDate]);

  // 1. Key Business Metrics
  const keyMetrics: KeyBusinessMetrics = useMemo(() => {
    return metricsService.calculateKeyMetrics({
      bookings,
      leads,
      quotes,
      users,
      suppliers,
      currentUser,
      comparison,
      baseCurrency: selectedCurrency
    });
  }, [metricsService, bookings, leads, quotes, users, suppliers, currentUser, comparison, selectedCurrency]);

  // 2. Business Performance & Sales Funnel
  const businessPerformance: BusinessPerformanceData = useMemo(() => {
    return metricsService.calculateBusinessPerformance({
      bookings,
      leads,
      quotes,
      products,
      comparison,
      granularity,
      baseCurrency: selectedCurrency,
      isAuthorizedForFinance
    });
  }, [metricsService, bookings, leads, quotes, products, comparison, granularity, selectedCurrency, isAuthorizedForFinance]);

  // 3. Needs Attention Items
  const needsAttentionItems: NeedsAttentionItem[] = useMemo(() => {
    return metricsService.calculateNeedsAttention({
      leads,
      quotes,
      bookings,
      suppliers,
      tasks
    });
  }, [metricsService, leads, quotes, bookings, suppliers, tasks]);

  // 4. Operations Today & Dispatch Horizon
  const operationsToday: OperationsTodayData = useMemo(() => {
    return metricsService.calculateOperationsToday({
      bookings,
      suppliers,
      todayDate: new Date()
    });
  }, [metricsService, bookings, suppliers]);

  const handleCurrencyChange = (curr: CurrencyCode) => {
    setSelectedCurrency(curr);
    fx.updateSettings({ baseCurrency: curr }, currentUser);
  };

  return (
    <div id="cms-operations-command-center" className="space-y-6 pb-12">
      {/* 1. Command Center Header & Global Period/Currency Controls */}
      <OverviewHeader
        currentUser={currentUser}
        selectedDateRange={selectedDateRange}
        onSelectDateRange={setSelectedDateRange}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onChangeCustomStart={setCustomStartDate}
        onChangeCustomEnd={setCustomEndDate}
        selectedCurrency={selectedCurrency}
        onSelectCurrency={handleCurrencyChange}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        comparisonLabel={comparison.label}
      />

      {/* 2. Key Business Metrics Grid (8 Core KPI Cards) */}
      <KeyBusinessMetricsGrid
        metrics={keyMetrics}
        onNavigate={onNavigate}
      />

      {/* 3. Needs Attention Section (Critical operational and pipeline exceptions) */}
      <NeedsAttentionSection
        items={needsAttentionItems}
        onNavigate={onNavigate}
      />

      {/* 4. Business Performance & Funnel (Trajectory Timeline, Conversion Funnel & Demand) */}
      <BusinessPerformanceSection
        performance={businessPerformance}
        onSelectGranularity={setGranularity}
        baseCurrency={selectedCurrency}
        isAuthorizedForFinance={isAuthorizedForFinance}
        onNavigate={onNavigate}
      />

      {/* 5. Authoritative Financial Snapshot (Gross Selling Values, Received, Outstanding, Payables) */}
      <FinancialSnapshotSection
        bookings={bookings}
        currency={selectedCurrency}
        currentUser={currentUser}
        onNavigate={onNavigate}
      />

      {/* 6. Operational Horizon & Ground Dispatch (Arrivals, Departures, Excursions, Transfers) */}
      <OperationalHorizonSection
        operationsToday={operationsToday}
        bookings={bookings}
        onNavigate={onNavigate}
      />

      {/* 7. Team Workload & Operational Task Backlog */}
      <TeamWorkloadAndTasksSection
        users={users}
        leads={leads}
        quotes={quotes}
        bookings={bookings}
        tasks={tasks}
        onNavigate={onNavigate}
      />

      {/* 8. Live Operational Audit Stream & Quick Actions Launchpad */}
      <AuditStreamAndQuickActionsSection
        auditLogs={auditLogs}
        systemHealth={systemHealth}
        currentUser={currentUser}
        onNavigate={onNavigate}
      />
    </div>
  );
};
