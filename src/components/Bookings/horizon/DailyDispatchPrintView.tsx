import React from 'react';
import { X, Printer, Copy, Check, Calendar, FileText, MapPin, Clock, Users, Building2 } from 'lucide-react';
import { OperationalItem } from './horizonTypes';

interface DailyDispatchPrintViewProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  items: OperationalItem[];
}

export const DailyDispatchPrintView: React.FC<DailyDispatchPrintViewProps> = ({
  isOpen,
  onClose,
  selectedDate,
  items
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const lines: string[] = [];
    lines.push(`THEUNBOUND GROUND DISPATCH MANIFEST - ${selectedDate}`);
    lines.push(`Total Scheduled Operations: ${items.length}`);
    lines.push(`----------------------------------------------------------------`);
    
    items.forEach((item, idx) => {
      lines.push(`${idx + 1}. [${item.reportingTime || item.startTime || 'FLEX'}] ${item.operationalTypeLabel.toUpperCase()} - #${item.bookingReference}`);
      lines.push(`   Service: ${item.title}`);
      lines.push(`   Guest: ${item.leadPassengerName} (${item.totalPax} Pax)`);
      if (item.pickupLocation) lines.push(`   Pickup: ${item.pickupLocation}`);
      if (item.dropoffLocation) lines.push(`   Dropoff: ${item.dropoffLocation}`);
      if (item.driverName) lines.push(`   Chauffeur: ${item.driverName} (${item.driverPhone || 'N/A'}) [${item.vehicleType || 'Vehicle'}]`);
      if (item.supplierName) lines.push(`   Supplier: ${item.supplierName} (Ref: ${item.supplierConfirmationRef || 'N/A'})`);
      if (item.operationalInstructions) lines.push(`   Notes: ${item.operationalInstructions}`);
      lines.push(``);
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div 
        id="horizon-print-modal" 
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[90vh]"
      >
        {/* Modal Controls Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center space-x-2 text-slate-800">
            <FileText className="w-5 h-5 text-[#008972]" />
            <h3 className="font-bold text-sm">
              Daily Ground Dispatch Roster Preview ({selectedDate})
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copied Manifest' : 'Copy All Text'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-[#008972] text-white hover:bg-[#00705d] text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Roster</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 overflow-y-auto flex-1 font-sans print:p-0">
          {/* Company & Date Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
            <div>
              <div className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                <span>TheUnbound DMC</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase font-mono">
                  Ground Operations
                </span>
              </div>
              <h1 className="text-base font-bold text-slate-700 mt-1">
                Daily Operational Dispatch Manifest
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Target Date: <strong className="text-slate-900">{selectedDate}</strong> • Total Services: <strong className="text-slate-900">{items.length}</strong>
              </p>
            </div>

            <div className="text-right text-xs text-slate-500 font-mono">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p className="text-teal-800 font-bold">OPERATIONAL HORIZON DESK</p>
            </div>
          </div>

          {/* Table of items */}
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No services scheduled for this operational date.
            </div>
          ) : (
            <div className="space-y-4">
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                    <th className="p-2 border-r border-slate-300 w-16 text-center">Time</th>
                    <th className="p-2 border-r border-slate-300 w-28">Ref & Category</th>
                    <th className="p-2 border-r border-slate-300">Service & Passenger Details</th>
                    <th className="p-2 border-r border-slate-300 w-44">Location & Route</th>
                    <th className="p-2 border-r border-slate-300 w-36">Supplier / Chauffeur</th>
                    <th className="p-2 w-24 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((it) => (
                    <tr key={it.id} className="align-top hover:bg-slate-50">
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-center bg-slate-50/50">
                        {it.reportingTime || it.startTime || 'Flex'}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-mono">
                        <div className="font-bold text-slate-900">#{it.bookingReference}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{it.operationalTypeLabel}</div>
                      </td>
                      <td className="p-2 border-r border-slate-200">
                        <div className="font-bold text-slate-900">{it.title}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Pax: <strong>{it.leadPassengerName}</strong> ({it.totalPax} Pax)
                          {it.b2bAgentName && <span className="text-slate-400"> • Agent: {it.b2bAgentName}</span>}
                        </div>
                        {it.operationalInstructions && (
                          <div className="mt-1 text-[10px] italic text-slate-600 bg-amber-50/70 p-1 rounded border border-amber-200/50">
                            Notes: {it.operationalInstructions}
                          </div>
                        )}
                      </td>
                      <td className="p-2 border-r border-slate-200">
                        {it.pickupLocation && (
                          <div>
                            <span className="font-semibold text-[10px] text-slate-500 block">PICKUP:</span>
                            <span className="text-[11px] text-slate-800">{it.pickupLocation}</span>
                          </div>
                        )}
                        {it.dropoffLocation && (
                          <div className="mt-1">
                            <span className="font-semibold text-[10px] text-slate-500 block">DROP:</span>
                            <span className="text-[11px] text-slate-800">{it.dropoffLocation}</span>
                          </div>
                        )}
                        {!it.pickupLocation && !it.dropoffLocation && (
                          <span className="text-slate-400 italic text-[11px]">{it.hub}</span>
                        )}
                      </td>
                      <td className="p-2 border-r border-slate-200">
                        <div className="font-semibold text-slate-800">{it.supplierName || 'Unallocated'}</div>
                        {it.supplierConfirmationRef && (
                          <div className="text-[10px] font-mono text-slate-500">Ref: {it.supplierConfirmationRef}</div>
                        )}
                        {it.driverName && (
                          <div className="text-[10px] text-teal-800 font-medium mt-0.5">
                            Driver: {it.driverName} {it.driverPhone && `(${it.driverPhone})`}
                          </div>
                        )}
                        {it.vehicleType && (
                          <div className="text-[10px] text-slate-500">
                            {it.vehicleType} {it.licensePlate && `[${it.licensePlate}]`}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center font-semibold text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 block">
                          {it.operationalStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Manifest Footer */}
              <div className="pt-6 border-t border-slate-200 flex justify-between text-xs text-slate-500">
                <div>
                  <p className="font-bold text-slate-800">Ground Operations Dispatch Desk</p>
                  <p>TheUnbound Global DMC Network</p>
                </div>
                <div className="text-right">
                  <p>24/7 Operations Hotline: +971 4 200 8900</p>
                  <p>Strictly Confidential • Authorized Dispatch Manifest</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
