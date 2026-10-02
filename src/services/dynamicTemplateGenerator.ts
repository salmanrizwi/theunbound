import * as XLSX from 'xlsx';
import { DynamicModulePresetId } from '../types';
import { CanonicalSchemaRegistry, CanonicalModuleSchema } from './canonicalSchemaRegistry';
import { ModulePresetRegistry } from './modulePresetRegistry';

export class DynamicTemplateGenerator {
  /**
   * Generates a valid .xlsx Excel workbook Blob for a given preset.
   */
  public static generateWorkbookForPreset(
    presetId: DynamicModulePresetId, 
    includeDemoData: boolean = false
  ): Blob {
    const wb = XLSX.utils.book_new();
    const schemas = ModulePresetRegistry.getSchemasForPreset(presetId, true);

    for (const schema of schemas) {
      const headers = schema.columns.map(c => c.key);
      const dataRows = includeDemoData ? schema.sampleRows : [];
      const sheetAoa = [headers, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(sheetAoa);

      // Auto calculate column widths
      ws['!cols'] = headers.map((h, i) => {
        let maxLen = h.length;
        if (includeDemoData) {
          for (const row of dataRows) {
            if (row[i]) maxLen = Math.max(maxLen, String(row[i]).length);
          }
        }
        return { wch: Math.min(Math.max(maxLen + 4, 14), 45) };
      });

      XLSX.utils.book_append_sheet(wb, ws, schema.canonicalTabName);
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /**
   * Generates a single CSV string for a specific schema.
   */
  public static generateCsvForSchema(
    schemaId: string, 
    includeDemoData: boolean = false
  ): string {
    const schema = CanonicalSchemaRegistry.getSchema(schemaId);
    if (!schema) return '';

    const headers = schema.columns.map(c => c.key);
    const dataRows = includeDemoData ? schema.sampleRows : [];
    const allRows = [headers, ...dataRows];

    return allRows
      .map(row => 
        row.map(val => {
          const s = String(val ?? '');
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        }).join(',')
      )
      .join('\n');
  }

  /**
   * Generates a bundle of CSV strings for all tabs in a preset.
   */
  public static generateCsvBundleForPreset(
    presetId: DynamicModulePresetId, 
    includeDemoData: boolean = false
  ): Record<string, string> {
    const bundle: Record<string, string> = {};
    const schemas = ModulePresetRegistry.getSchemasForPreset(presetId, true);

    for (const schema of schemas) {
      bundle[schema.canonicalTabName] = this.generateCsvForSchema(schema.schemaId, includeDemoData);
    }

    return bundle;
  }

  /**
   * Triggers browser download for a Blob file.
   */
  public static downloadBlob(blob: Blob, filename: string): void {
    if (typeof window === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Triggers browser download for a CSV string.
   */
  public static downloadCsv(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, filename);
  }
}
