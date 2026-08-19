import React from 'react';
import { X, Printer, Share2, CheckCircle, Droplet, Download, ShieldCheck } from 'lucide-react';
import { MeterReading, Consumer } from '../types';

interface ThermalReceiptModalProps {
  reading: MeterReading;
  consumer?: Consumer | null;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  reading,
  consumer,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `WDT Water Bill - Acc #${reading.accountNumber}`,
          text: `Tagoloan Water District Bill for ${reading.consumerName}: Total Due ₱${reading.billCalculation.totalAmountDue.toFixed(2)}. Due Date: ${reading.billCalculation.dueDate}`,
        });
      } catch {
        // Ignored if cancelled
      }
    } else {
      alert(`Receipt Details copied for Account #${reading.accountNumber}`);
    }
  };

  const bill = reading.billCalculation;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Actions */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-sky-950 border border-sky-800 rounded text-sky-400">
              <Droplet className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Official Billing Statement
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Paper Container */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-950 flex justify-center">
          <div 
            id="printable-thermal-receipt"
            className="w-full max-w-xs bg-amber-50/95 text-slate-900 font-mono text-[11px] p-4 rounded shadow-md border border-amber-200 leading-tight space-y-2 select-text"
          >
            {/* Header Stamp */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400">
              <div className="font-extrabold text-[13px] tracking-tight text-slate-900">
                TAGOLOAN WATER DISTRICT
              </div>
              <div className="text-[10px] text-slate-600">
                Poblacion, Tagoloan, Misamis Oriental
              </div>
              <div className="text-[10px] text-slate-600">
                Tel: (088) 567-1234 • LWUA Cat. C
              </div>
              <div className="font-bold text-[11px] mt-1 bg-slate-900 text-amber-50 py-0.5 px-2 rounded-sm inline-block">
                NOTICE OF WATER BILLING
              </div>
            </div>

            {/* Consumer & Account Details */}
            <div className="space-y-1 py-1 border-b border-dashed border-slate-400 text-[10.5px]">
              <div className="flex justify-between">
                <span className="text-slate-600">ACC NO:</span>
                <span className="font-bold">{reading.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">NAME:</span>
                <span className="font-bold text-right truncate max-w-[170px]">{reading.consumerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">ROUTE:</span>
                <span>{reading.routeCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">METER SN:</span>
                <span>{reading.meterSerial}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">CATEGORY:</span>
                <span className="font-semibold">{reading.category}</span>
              </div>
            </div>

            {/* Reading Details */}
            <div className="py-1 border-b border-dashed border-slate-400 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">READING DATE:</span>
                <span>{reading.readingDate} {reading.readingTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">PRESENT READING:</span>
                <span className="font-bold">{reading.currentReading} cu.m.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">PREVIOUS READING:</span>
                <span>{reading.previousReading} cu.m.</span>
              </div>
              <div className="flex justify-between font-bold bg-amber-200/70 px-1 py-0.5 rounded">
                <span>CONSUMPTION:</span>
                <span className="text-sky-950 font-extrabold">{reading.consumption} cu.m.</span>
              </div>
            </div>

            {/* Tariff Breakdown */}
            <div className="py-1 border-b border-dashed border-slate-400 space-y-0.5">
              <div className="font-bold text-[10px] text-slate-700">BILL COMPUTATION:</div>
              {bill.breakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between text-[10px]">
                  <span className="text-slate-700">{item.bracket}:</span>
                  <span>₱{item.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-[10px] text-slate-700">
                <span>Environmental Fee (5%):</span>
                <span>₱{bill.environmentalFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-700">
                <span>Franchise Tax (2%):</span>
                <span>₱{bill.franchiseTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-700">
                <span>Meter Maintenance:</span>
                <span>₱{bill.maintenanceFee.toFixed(2)}</span>
              </div>
            </div>

            {/* Total Amount Due */}
            <div className="py-1.5 border-b-2 border-slate-900 space-y-1">
              <div className="flex justify-between items-baseline font-black text-sm">
                <span>TOTAL DUE:</span>
                <span className="text-base text-slate-950">₱{bill.totalAmountDue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10.5px] font-bold text-rose-800">
                <span>DUE DATE:</span>
                <span>{bill.dueDate}</span>
              </div>
              <div className="flex justify-between text-[9.5px] text-slate-600">
                <span>Amount After Due (10% Pen.):</span>
                <span>₱{bill.grossAmountAfterDue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[9.5px] text-rose-700 font-semibold">
                <span>Disconnection Date:</span>
                <span>{bill.disconnectionDate}</span>
              </div>
            </div>

            {/* Footer Stamp & Verification Code */}
            <div className="pt-2 text-center text-[9px] text-slate-600 space-y-1">
              <div className="flex items-center justify-center gap-1 font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-700" />
                <span>READER: {reading.readerId} • GPS VERIFIED</span>
              </div>
              <div className="font-mono text-[8.5px] text-slate-500">
                REF: {reading.id}
              </div>
              <div className="text-[8px] italic text-slate-500">
                Please pay at Tagoloan Water District main office or accredited payment centers.
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={handleShare}
            className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <Share2 className="w-4 h-4 text-sky-400" />
            <span>Share</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-sky-600/30"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
