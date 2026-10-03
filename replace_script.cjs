const fs = require('fs');
let file = 'src/components/B2BAgentPortal/StepByStepQuotationWorkspace.tsx';
let text = fs.readFileSync(file, 'utf8');

// Replace Block 1 Badge
const bad1 = 'Accommodates Group ({totalPax} Pax / {maxSeats} Seats)';
const startIdx1 = text.indexOf('{!isCapacityExceeded ? (');
if (startIdx1 !== -1) {
  const endIdx1 = text.indexOf('</div>', startIdx1);
  if (endIdx1 !== -1) {
    const origBadge = text.substring(startIdx1, endIdx1);
    const newBadge = `{tierRes.hasMatchedTier ? (
                                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                <Check className="w-3 h-3 text-emerald-600" />
                                                <span>Step 3 Tier Matched ({totalPax} Pax / {tierRes.minPassengers}–{tierRes.maxPassengers} Pax)</span>
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                                <span>{tierRes.validationError || 'No configured pricing tier is available for this passenger count.'}</span>
                                              </span>
                                            )}`;
    text = text.substring(0, startIdx1) + newBadge + '\n                                          ' + text.substring(endIdx1);
    console.log('Successfully replaced Block 1 Badge!');
  }
}

// Replace Block 2 Loop
const startIdx2 = text.indexOf('const totalPax = adultsCount + childrenCount;');
if (startIdx2 !== -1) {
  const mapIdx = text.lastIndexOf('.map(prod => {', startIdx2);
  const endIdx2 = text.indexOf('B2B Wholesale Price', startIdx2);
  if (mapIdx !== -1 && endIdx2 !== -1) {
    // Find the end of the divs and outer block
    const divEndIdx = text.indexOf('</div>', endIdx2);
    if (divEndIdx !== -1) {
      const origBlock = text.substring(mapIdx, divEndIdx + 6);
      const newBlock = `.map(prod => {
                              const totalPax = adultsCount + childrenCount;
                              const tierRes = resolveCapacityPricingTier({ product: prod, passengerCount: totalPax });
                              const maxSeats = tierRes.maxPassengers;
                              const maxLuggage = prod.vehicleConfig?.maxLuggage || 4;
                              const convertedSelling = convertCurrency(tierRes.calculatedPrice, tierRes.currency, currency);

                              return (
                                <div key={prod.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between space-y-3 hover:shadow-xs transition-shadow">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                        {tierRes.vehicleType || prod.vehicleConfig?.vehicleType || prod.subcategory || 'Private Chauffeur'}
                                      </span>
                                      <span className="text-[10px] text-teal-700 font-bold">
                                        {prod.fromHubName && prod.toHubName ? \`\${prod.fromHubName} ➔ \${prod.toHubName}\` : prod.city || currentDestination.name}
                                      </span>
                                    </div>

                                    <div>
                                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                                        {tierRes.vehicleName || prod.vehicleConfig?.vehicleName || prod.name}
                                      </h4>
                                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                        {prod.shortDescription || prod.longDescription}
                                      </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium">👥 Capacity: {tierRes.minPassengers}–{tierRes.maxPassengers} Pax</span>
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium">🧳 {maxLuggage} Luggage</span>
                                      {prod.duration && <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium">⏱️ {prod.duration}</span>}
                                    </div>

                                    <div className="pt-1">
                                      {tierRes.hasMatchedTier ? (
                                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                          ✓ Step 3 Tier Matched ({totalPax} Pax / {tierRes.minPassengers}–{tierRes.maxPassengers} Pax)
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                          ⛔ {tierRes.validationError || 'No configured pricing tier is available for this passenger count.'}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <div className="text-xs font-black text-slate-900 font-mono">
                                        {formatCurrency(convertedSelling, currency)}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {tierRes.vehiclesRequired > 1 ? \`\${tierRes.vehiclesRequired} Vehicles\` : 'B2B Wholesale Price'}
                                      </div>
                                    </div>`;
      text = text.replace(origBlock, newBlock);
      console.log('Successfully replaced Block 2 Loop!');
    }
  }
}

fs.writeFileSync(file, text, 'utf8');
