import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { BookingInvoice, BookingVoucher, JobSheet, Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  FileText, 
  DollarSign, 
  Receipt, 
  ClipboardCheck, 
  Plus, 
  Search, 
  Printer, 
  Download, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Building2,
  Calendar,
  X,
  FileSpreadsheet
} from 'lucide-react';

export const FinancialsManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'VOUCHERS' | 'JOBSHEETS' | 'MARGINS'>('INVOICES');
  
  const [invoices, setInvoices] = useState<BookingInvoice[]>(db.getInvoices());
  const [vouchers, setVouchers] = useState<BookingVoucher[]>(db.getVouchers());
  const [jobSheets, setJobSheets] = useState<JobSheet[]>(db.getJobSheets());
  const [bookings, setBookings] = useState<Booking[]>(db.getAllBookings());
  
  const [selectedInvoice, setSelectedInvoice] = useState<BookingInvoice | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<BookingVoucher | null>(null);
  const [selectedJobSheet, setSelectedJobSheet] = useState<JobSheet | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setInvoices(db.getInvoices());
      setVouchers(db.getVouchers());
      setJobSheets(db.getJobSheets());
      setBookings(db.getAllBookings());
    });
  }, []);

  // Quick generators from existing bookings
  const handleGenerateInvoiceForBooking = (booking: Booking) => {
    const totalPax = booking.items.reduce((sum, item) => sum + item.totalPax, 0) || 2;
    const taxAmt = Math.round(booking.totalAmount * 0.05);
    const subtotalAmt = booking.totalAmount - taxAmt;

    const newInvoice: BookingInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      customerName: booking.customer.leadTravelerName,
      customerEmail: booking.customer.email,
      customerPhone: booking.customer.phone,
      agencyName: booking.customer.agencyName || 'Direct Client',
      companyName: 'Unbound Experiences India Pvt Ltd',
      companyAddress: 'A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi',
      companyTaxNumber: 'GSTIN07AAACU9821K1Z2',
      currency: booking.currency,
      subtotal: subtotalAmt,
      taxTotal: taxAmt,
      serviceFeeTotal: 0,
      discountTotal: 0,
      totalAmount: booking.totalAmount,
      amountPaid: booking.totalAmount,
      balanceDue: 0,
      paymentStatus: 'PAID',
      paymentMethod: 'Corporate Wire Transfer / Stripe Direct',
      dueDate: new Date().toISOString().split('T')[0],
      invoiceDate: new Date().toISOString().split('T')[0],
      services: booking.items.map((item, idx) => ({
        id: `srv-${idx}-${Date.now()}`,
        serviceName: item.productName,
        category: item.category,
        travelDate: item.travelDate,
        quantity: item.totalPax,
        unitPrice: item.unitSellingPrice,
        taxAmount: Math.round(item.totalPrice * 0.05),
        totalPrice: item.totalPrice,
        currency: item.currency
      })),
      notes: 'Thank you for choosing TheUnbound DMC.',
      terms: 'Non-refundable within 7 days of scheduled departure. 24/7 emergency dispatch included.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.saveInvoice(newInvoice, user);
    setSelectedInvoice(newInvoice);
  };

  const handleGenerateVoucherForBooking = (booking: Booking) => {
    const primaryItem = booking.items[0];
    const newVoucher: BookingVoucher = {
      id: `vch-${Date.now()}`,
      voucherNumber: `VCH-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      serviceItemId: primaryItem ? primaryItem.id : 'srv-default',
      serviceName: primaryItem ? primaryItem.productName : 'Ground Package Service',
      destination: primaryItem ? primaryItem.destinationName : 'Japan',
      city: primaryItem ? primaryItem.city : 'Tokyo',
      customerName: booking.customer.leadTravelerName,
      leadPaxName: booking.customer.leadTravelerName,
      totalPax: primaryItem ? primaryItem.totalPax : 2,
      serviceDate: booking.travelStartDate || new Date().toISOString().split('T')[0],
      serviceTime: '08:30 AM',
      supplierName: 'TheUnbound Ground Operations Network',
      supplierContact: '+81 3 5555 0192 (TheUnbound 24/7 Operations Desk)',
      meetingPoint: booking.customer.pickupLocation || 'Hotel Lobby / Airport Arrival Terminal',
      pickupInfo: 'Chauffeur / Guide will hold digital name board with guest surname.',
      emergencyContact: '+91 9811654959 (TheUnbound 24/7 Agent Dispatch)',
      passengerBreakdown: `${primaryItem ? primaryItem.adults : 2} Adults`,
      specialInstructions: 'Luggage assistance included. Blue badge guide assigned.',
      status: 'ISSUED',
      issuedAt: new Date().toISOString()
    };
    db.saveVoucher(newVoucher, user);
    setSelectedVoucher(newVoucher);
  };

  // Financial summary metrics
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalTax = invoices.reduce((sum, inv) => sum + inv.taxTotal, 0);
  const estimatedCost = totalRevenue * 0.72; // 28% margin model
  const grossMargin = totalRevenue - estimatedCost;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Unbound Experiences India Pvt Ltd • Financials</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Financial Operations & Dispatch Documents</h2>
          <p className="text-sm text-slate-500">
            Generate GST / VAT Tax Invoices, Ground Service Vouchers, Chauffeur/Guide Job Sheets, and track real-time operational margins.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('INVOICES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'INVOICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('VOUCHERS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'VOUCHERS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vouchers ({vouchers.length})
          </button>
          <button
            onClick={() => setActiveTab('JOBSHEETS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'JOBSHEETS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Job Sheets ({jobSheets.length})
          </button>
          <button
            onClick={() => setActiveTab('MARGINS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'MARGINS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Margin Dashboard
          </button>
        </div>
      </div>

      {/* TAB 1: INVOICES */}
      {activeTab === 'INVOICES' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Tax Invoices (Unbound Experiences India Pvt Ltd)</h3>
              <span className="text-xs text-slate-500">Auto-generated from B2B & B2C Bookings</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Booking Ref</th>
                    <th className="p-3">Issued To</th>
                    <th className="p-3">Total Amount</th>
                    <th className="p-3">Tax / GST</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="p-3 font-mono text-slate-600">{inv.bookingReference}</td>
                      <td className="p-3 font-medium text-slate-800">{inv.customerName}</td>
                      <td className="p-3 font-mono font-bold text-[#008f77]">{inv.currency || 'USD'} {(Number(inv.totalAmount) || 0).toLocaleString()}</td>
                      <td className="p-3 font-mono text-slate-500">{inv.currency} {inv.taxTotal}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-3 py-1 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 cursor-pointer"
                        >
                          View / Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SERVICE VOUCHERS */}
      {activeTab === 'VOUCHERS' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Ground Service Vouchers (Client & Supplier Confirmation)</h3>
              <span className="text-xs text-slate-500">Official dispatch ticket for drivers, guides, and hotels</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="p-3">Voucher #</th>
                    <th className="p-3">Service Name</th>
                    <th className="p-3">Lead Traveler</th>
                    <th className="p-3">Service Date</th>
                    <th className="p-3">Pickup Time</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vouchers.map(vch => (
                    <tr key={vch.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">{vch.voucherNumber}</td>
                      <td className="p-3 font-semibold text-slate-800">{vch.serviceName}</td>
                      <td className="p-3 text-slate-700">{vch.leadPaxName} ({vch.totalPax} Pax)</td>
                      <td className="p-3 font-medium text-slate-600">{vch.serviceDate}</td>
                      <td className="p-3 font-mono text-[#008f77] font-bold">{vch.serviceTime}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {vch.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedVoucher(vch)}
                          className="px-3 py-1 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 cursor-pointer"
                        >
                          View / Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Available Bookings for Dispatch Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Quick Dispatch Generator from Active Bookings
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {bookings.map(b => (
            <div key={b.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-slate-900">{b.bookingReference}</span>
                <span className="text-[10px] font-bold bg-[#00C6A6]/20 text-slate-900 px-2 py-0.5 rounded">
                  {b.currency} {b.totalAmount}
                </span>
              </div>
              <p className="text-xs text-slate-600 line-clamp-1">{b.customer.leadTravelerName} • {b.items[0]?.productName}</p>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => handleGenerateInvoiceForBooking(b)}
                  className="flex-1 text-[11px] font-bold py-1 px-2 bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-800 cursor-pointer"
                >
                  + Generate Invoice
                </button>
                <button
                  onClick={() => handleGenerateVoucherForBooking(b)}
                  className="flex-1 text-[11px] font-bold py-1 px-2 bg-[#00C6A6] hover:bg-[#00b094] rounded text-slate-950 cursor-pointer"
                >
                  + Issue Voucher
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
