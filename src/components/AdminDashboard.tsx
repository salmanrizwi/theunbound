import React, { useState } from 'react';
import { Product } from '../types';
import { AppDatabase } from '../services/db';
import { formatCurrency } from '../services/pricingEngine';
import { RosterAdminManager } from './RosterAdminManager';
import { BookingsManager } from './AdminCMS/BookingsManager';
import { 
  ShieldCheck, 
  Table, 
  Building2, 
  Eye, 
  Calendar, 
  CalendarCheck, 
  Search,
  Inbox
} from 'lucide-react';

interface AdminDashboardProps {
  products: Product[];
  onProductsUpdated?: (products: Product[]) => void;
  onViewProduct: (product: Product) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  products,
  onViewProduct
}) => {
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'BOOKINGS' | 'PRODUCTS' | 'SUPPLIERS'>('ROSTER');
  const [productFilter, setProductFilter] = useState('');
  const db = AppDatabase.getInstance();
  const suppliers = db.getSuppliers();

  const safeProducts = products || [];
  const filteredProducts = safeProducts.filter(p => 
    p.name.toLowerCase().includes(productFilter.toLowerCase()) ||
    p.sku.toLowerCase().includes(productFilter.toLowerCase()) ||
    p.city.toLowerCase().includes(productFilter.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/40 mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>TheUnbound DMC Operational Administration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-sans">
            Ground Operations & Booking Management Engine
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Monitor ground driver and guide rosters, track incoming agent product bookings with 24–48h confirmation SLAs, and oversee confidential contracted supplier networks.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 overflow-x-auto">
        {[
          { id: 'ROSTER', label: 'Operations Roster & Calendar', icon: Calendar },
          { id: 'BOOKINGS', label: 'Bookings & 24-48h SLA Dispatch', icon: CalendarCheck },
          { id: 'PRODUCTS', label: `Master Product Inventory (${safeProducts.length})`, icon: Table },
          { id: 'SUPPLIERS', label: `Contracted Ground Suppliers (${suppliers.length})`, icon: Building2 }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'text-slate-900 border-b-2 border-[#00C6A6]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#008972]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 0: OPERATIONS ROSTER & MASTER CALENDAR */}
      {activeTab === 'ROSTER' && (
        <RosterAdminManager products={products} />
      )}

      {/* TAB 1: BOOKINGS & SLA CONSOLE */}
      {activeTab === 'BOOKINGS' && (
        <BookingsManager />
      )}

      {/* TAB 2: PRODUCT INVENTORY */}
      {activeTab === 'PRODUCTS' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by tour title, SKU, or city..."
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
              />
            </div>
            <div className="text-xs text-slate-500">
              Displaying <strong className="text-slate-900">{filteredProducts.length}</strong> of {safeProducts.length} products
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">SKU</th>
                    <th className="p-3.5">Tour / Ground Service</th>
                    <th className="p-3.5">Destination / City</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Duration</th>
                    <th className="p-3.5">Pricing Model</th>
                    <th className="p-3.5">Min Pax</th>
                    <th className="p-3.5 text-right">Wholesale Base</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-slate-900">{product.sku}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 line-clamp-1">{product.name}</div>
                        <div className="text-[11px] text-slate-400">{product.supplierName}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-medium text-slate-700">{product.city}</span>
                        <span className="text-slate-400 text-[11px] block">{product.destinationName}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                          {product.category}
                        </span>
                      </td>
                      <td className="p-3.5">{product.duration}</td>
                      <td className="p-3.5">
                        <span className="font-mono text-[11px] text-slate-600">
                          {product.pricingModel ? product.pricingModel.replace('_', ' ') : 'Standard'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono">{product.minPax || 1}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(product.baseRateWholesale, product.currency)}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => onViewProduct(product)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
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

      {/* TAB 3: SUPPLIERS */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-6">
          {suppliers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No contracted ground suppliers found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Authoritative supplier contracts configured in Firebase will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{supplier.name}</h3>
                        <span className="text-[11px] text-slate-500">{supplier.destination} ({supplier.country})</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      supplier.contractStatus === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {supplier.contractStatus}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {supplier.paymentTerms} • {supplier.cancellationTerms}
                  </p>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Contact Person:</span>
                      <span className="font-semibold text-slate-800">{supplier.contactPerson}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="font-mono text-slate-800">{supplier.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Currency:</span>
                      <span className="font-mono text-[#008972] font-bold">{supplier.currency}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
