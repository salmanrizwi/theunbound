import React, { useState } from 'react';
import { QuoteItem, Product, CurrencyCode } from '../types';
import { useQuotation } from '../context/QuotationContext';
import { useRoster } from '../context/RosterContext';
import { formatCurrency } from '../services/pricingEngine';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  GripVertical, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Plus, 
  Sun, 
  Sunset, 
  Moon, 
  Compass, 
  Users,
  Eye,
  CalendarCheck,
  CalendarX,
  Shuffle
} from 'lucide-react';

interface ItineraryTimelineViewProps {
  onViewProductDetails: (product: Product) => void;
  availableProducts: Product[];
}

export const ItineraryTimelineView: React.FC<ItineraryTimelineViewProps> = ({
  onViewProductDetails,
  availableProducts
}) => {
  const { 
    items, 
    currency, 
    updateItemTravelDate, 
    removeProductFromQuote, 
    updateItemPax, 
    addProductToQuote,
    totalSellingPrice
  } = useQuotation();

  const { checkDateAvailability, getNextAvailableDate } = useRoster();

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [draggedNewProduct, setDraggedNewProduct] = useState<Product | null>(null);
  const [activeDayFilter, setActiveDayFilter] = useState<string>('ALL');

  // Sort items chronologically by travel date, then sequence
  const sortedItems = [...items].sort((a, b) => {
    if (a.travelDate === b.travelDate) return 0;
    return a.travelDate > b.travelDate ? 1 : -1;
  });

  // Group items by unique date
  const uniqueDates = Array.from(new Set(sortedItems.map(item => item.travelDate || 'Unscheduled'))).sort();

  // Auto sequence all items by 1-day step starting from the earliest date
  const handleAutoSequenceByDay = () => {
    if (items.length === 0) return;
    const baseDate = items[0].travelDate ? new Date(items[0].travelDate) : new Date();
    
    items.forEach((item, index) => {
      const itemDate = new Date(baseDate);
      itemDate.setDate(baseDate.getDate() + index);
      const formatted = itemDate.toISOString().split('T')[0];
      updateItemTravelDate(item.id, formatted);
    });
  };

  // Reorder items via drag and drop
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId);
    setDraggedItemId(itemId);
  };

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    if (draggedItemId !== itemId) {
      setDragOverItemId(itemId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    setDragOverItemId(null);
    const sourceItemId = e.dataTransfer.getData('text/plain');

    if (sourceItemId && sourceItemId !== targetItemId) {
      const sourceItem = items.find(i => i.id === sourceItemId);
      const targetItem = items.find(i => i.id === targetItemId);

      if (sourceItem && targetItem && sourceItem.travelDate !== targetItem.travelDate) {
        // Swap dates or assign target date to source item
        updateItemTravelDate(sourceItem.id, targetItem.travelDate);
      }
    }
    setDraggedItemId(null);
  };

  const handleDropOnDateContainer = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    if (draggedItemId) {
      updateItemTravelDate(draggedItemId, targetDate);
      setDraggedItemId(null);
    } else if (draggedNewProduct) {
      addProductToQuote(draggedNewProduct, { travelDate: targetDate });
      setDraggedNewProduct(null);
    }
  };

  const getTimeSlotIcon = (duration: string) => {
    const durLower = (duration || '').toLowerCase();
    if (durLower.includes('night') || durLower.includes('dinner') || durLower.includes('evening')) {
      return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
    }
    if (durLower.includes('afternoon') || durLower.includes('sunset')) {
      return <Sunset className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (durLower.includes('full') || durLower.includes('day') || durLower.includes('8') || durLower.includes('9')) {
      return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    }
    return <Clock className="w-3.5 h-3.5 text-[#00C6A6]" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Timeline Controls & Actions Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] bg-[#00C6A6]/20 px-2 py-0.5 rounded-full border border-[#00C6A6]/30">
              Interactive Itinerary Sequencing
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-300 font-semibold">{items.length} Sequenced Items</span>
          </div>
          <h3 className="text-lg font-bold text-white mt-1">Chronological Timeline & Day-by-Day Route Planner</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Drag items to reorder days or drop catalog products directly into target dates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAutoSequenceByDay}
            disabled={items.length === 0}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Automatically distribute each product into consecutive days (Day 1, Day 2...)"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#00C6A6]" />
            <span>Auto-Sequence Days</span>
          </button>

          <div className="bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Itinerary</span>
            <span className="text-sm font-black text-[#00E5C0] font-sans">
              {formatCurrency(totalSellingPrice, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Visual Timeline (Left) + Quick Drag Tray (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visual Timeline Section */}
        <div className="lg:col-span-8 space-y-6">
          {items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800">Timeline is currently empty</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
                Add travel products from the catalog or drag them from the right sidebar tray to build your day-by-day itinerary sequence.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {uniqueDates.map((dateStr, dateIdx) => {
                const dayItems = sortedItems.filter(i => (i.travelDate || 'Unscheduled') === dateStr);
                const dayDate = dateStr !== 'Unscheduled' ? new Date(dateStr) : null;
                const formattedDayHeader = dayDate && !isNaN(dayDate.getTime())
                  ? dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Unscheduled Products';

                return (
                  <div
                    key={dateStr}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnDateContainer(e, dateStr)}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs transition-all relative group"
                  >
                    {/* Day Header Badge with Visual Connector */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-black font-mono shadow-sm">
                          {dateIdx + 1}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-slate-900">
                              Day {dateIdx + 1}: {formattedDayHeader}
                            </span>
                            <span className="text-[10px] font-bold bg-[#00C6A6]/10 text-[#008972] px-2 py-0.5 rounded-full">
                              {dayItems.length} {dayItems.length === 1 ? 'Activity' : 'Activities'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Target Date: {dateStr}
                          </p>
                        </div>
                      </div>

                      {/* Quick Day Date Picker */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="date"
                          value={dateStr !== 'Unscheduled' ? dateStr : ''}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            if (newDate) {
                              dayItems.forEach(item => updateItemTravelDate(item.id, newDate));
                            }
                          }}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-mono focus:ring-1 focus:ring-[#00C6A6]"
                          title="Change date for all items on this day"
                        />
                      </div>
                    </div>

                    {/* Timeline Items for this Day */}
                    <div className="space-y-3 relative pl-4 border-l-2 border-[#00C6A6]/30 ml-4">
                      {dayItems.map((item, itemIdx) => {
                        const availability = checkDateAvailability(
                          item.product.id,
                          item.travelDate,
                          item.pax.adults + item.pax.children
                        );

                        const isDragging = draggedItemId === item.id;
                        const isDragOver = dragOverItemId === item.id;

                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragOver={(e) => handleDragOver(e, item.id)}
                            onDrop={(e) => handleDrop(e, item.id)}
                            className={`p-3.5 rounded-xl border transition-all relative bg-white cursor-grab active:cursor-grabbing ${
                              isDragging
                                ? 'opacity-40 border-dashed border-[#00C6A6]'
                                : isDragOver
                                ? 'border-[#00C6A6] ring-2 ring-[#00C6A6]/30 bg-emerald-50/30'
                                : 'border-slate-200 hover:border-slate-300 shadow-xs'
                            }`}
                          >
                            {/* Timeline Node Icon Connector */}
                            <div className="absolute -left-[25px] top-4 w-4 h-4 rounded-full bg-white border-2 border-[#00C6A6] flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#00C6A6]"></div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Left details */}
                              <div className="flex items-start space-x-3 flex-1 min-w-0">
                                <div className="p-1 text-slate-400 hover:text-slate-600 shrink-0 cursor-grab">
                                  <GripVertical className="w-4 h-4" />
                                </div>

                                <img
                                  src={item.product.images[0] || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop'}
                                  alt={item.product.name}
                                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                                />

                                <div className="min-w-0 space-y-0.5 flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                                      {item.product.category}
                                    </span>
                                    <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                                      {getTimeSlotIcon(item.product.duration)}
                                      <span>{item.product.duration}</span>
                                    </span>
                                    <span className="text-[10px] text-slate-400">•</span>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      {item.product.city}
                                    </span>
                                  </div>

                                  <h5 
                                    onClick={() => onViewProductDetails(item.product)}
                                    className="font-bold text-xs text-slate-900 hover:text-[#008972] transition-colors line-clamp-1 cursor-pointer"
                                  >
                                    {item.product.name}
                                  </h5>

                                  {/* Roster & Pax Info */}
                                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px]">
                                    <span className="font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                      Pax: {item.pax.adults} Adults {item.pax.children > 0 ? `+ ${item.pax.children} Children` : ''}
                                    </span>

                                    {availability.isAvailable ? (
                                      <span className="text-emerald-700 font-semibold flex items-center space-x-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Roster Available</span>
                                      </span>
                                    ) : (
                                      <span className="text-rose-700 font-semibold flex items-center space-x-1 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        <span>Date Conflict</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right Pricing & Actions */}
                              <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block">Selling Rate:</span>
                                  <span className="text-xs font-black text-slate-900 font-sans">
                                    {formatCurrency(item.calculation.finalTotalSellingPrice, currency)}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => onViewProductDetails(item.product)}
                                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer"
                                    title="View Product Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => removeProductFromQuote(item.id)}
                                    className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Remove from Timeline"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar: Quick Drag-and-Drop Product Tray */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>Quick Add to Timeline</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">Drag or Click (+)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Drag any experience into a target day box on the left, or click the plus button to append.
            </p>

            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1 scrollbar-thin">
              {availableProducts.slice(0, 10).map((prod) => {
                const isAlreadyInTimeline = items.some(i => i.product.id === prod.id);

                return (
                  <div
                    key={prod.id}
                    draggable
                    onDragStart={() => setDraggedNewProduct(prod)}
                    onDragEnd={() => setDraggedNewProduct(null)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-[#00C6A6] bg-slate-50 hover:bg-white transition-all flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing group shadow-2xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <img
                        src={prod.images[0]}
                        alt={prod.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 truncate group-hover:text-[#008972] transition-colors">
                          {prod.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {prod.city} • {prod.duration}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => addProductToQuote(prod)}
                      className="p-1.5 rounded-lg bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold transition-colors cursor-pointer shrink-0"
                      title="Add to Itinerary"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
