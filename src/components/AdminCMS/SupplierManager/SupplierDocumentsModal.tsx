import React, { useState } from 'react';
import { SupplierDocument } from '../../../types';
import { X, FileText, UploadCloud, AlertCircle } from 'lucide-react';

interface SupplierDocumentsModalProps {
  supplierId: string;
  supplierName: string;
  onClose: () => void;
  onUpload: (docData: Omit<SupplierDocument, 'id' | 'uploadedAt'>) => void;
  currentUserName: string;
}

export const SupplierDocumentsModal: React.FC<SupplierDocumentsModalProps> = ({
  supplierId,
  supplierName,
  onClose,
  onUpload,
  currentUserName
}) => {
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<SupplierDocument['documentType']>('CONTRACT');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Document title is required');
      return;
    }
    const finalFileName = fileName.trim() || `${title.trim().toLowerCase().replace(/\s+/g, '_')}.pdf`;

    onUpload({
      supplierId,
      title: title.trim(),
      documentType,
      fileName: finalFileName,
      fileUrl: `#doc-${Date.now()}`,
      fileSize: '1.2 MB',
      mimeType: 'application/pdf',
      uploadedBy: currentUserName,
      notes: notes.trim() || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              Upload Supplier Contract / Document
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Supplier: {supplierName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">Document Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Master Ground Handling Agreement 2026-2027"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">Document Classification</label>
            <select
              value={documentType}
              onChange={e => setDocumentType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
            >
              <option value="CONTRACT">Master Service Contract (MSA)</option>
              <option value="RATE_SHEET">Contracted Rate Sheet / Tariff</option>
              <option value="INSURANCE">Liability & Travel Insurance</option>
              <option value="BUSINESS_LICENSE">Commercial / Tour Operator License</option>
              <option value="BANK_PROOF">Bank Account Verification Document</option>
              <option value="COMPLIANCE">Safety & Compliance Audit</option>
              <option value="OTHER">Other Documentation</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">Upload File</label>
            <div className="mt-1 border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-2xl p-4 text-center bg-slate-50/50 transition-colors">
              <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-700">
                {fileName ? <strong className="text-teal-700">{fileName}</strong> : 'Choose PDF, DOCX, or Excel file'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Max file size: 25MB</p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
                onChange={handleSimulatedFileUpload}
                className="mt-2 text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">Document Notes / Expiry</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Valid until Dec 31, 2026. Signed by General Manager."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer"
            >
              Attach Document
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
