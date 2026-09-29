import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { 
  MASTER_SHEETS_TAB_DEFINITIONS, 
  CANONICAL_TAB_PROCESSING_ORDER, 
  CANONICAL_SCHEMA_HEADERS 
} from '../src/data/googleSheetsTemplate';

function buildMasterDemoWorkbook() {
  console.log('Generating TheUnbound Canonical 25-Tab Excel Workbook with Demo Data...');
  
  const wb = XLSX.utils.book_new();

  // 1. INSTRUCTIONS TAB
  const instructionsDef = MASTER_SHEETS_TAB_DEFINITIONS.find(t => t.tabName === 'INSTRUCTIONS');
  if (instructionsDef) {
    const headers = instructionsDef.columns.map(c => c.key);
    const rows = [headers, ...instructionsDef.sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 22 },
      { wch: 30 },
      { wch: 80 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'INSTRUCTIONS');
    console.log(`  Added tab: INSTRUCTIONS (${instructionsDef.sampleRows.length} rules)`);
  }

  // 2. ALL 25 CANONICAL TABS IN EXACT ORDER
  let totalDemoRecords = 0;
  for (const tabName of CANONICAL_TAB_PROCESSING_ORDER) {
    const tabDef = MASTER_SHEETS_TAB_DEFINITIONS.find(t => t.tabName === tabName);
    const headers = CANONICAL_SCHEMA_HEADERS[tabName] || (tabDef ? tabDef.columns.map(c => c.key) : []);
    const sampleRows = tabDef?.sampleRows || [];
    totalDemoRecords += sampleRows.length;

    const rows = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Dynamic column widths
    ws['!cols'] = headers.map((h, colIdx) => {
      let maxLen = h.length;
      sampleRows.forEach(r => {
        const val = r[colIdx];
        if (val && typeof val === 'string') {
          maxLen = Math.max(maxLen, Math.min(val.length, 45));
        }
      });
      return { wch: Math.max(maxLen + 3, 14) };
    });

    XLSX.utils.book_append_sheet(wb, ws, tabName);
    console.log(`  Added canonical tab: ${tabName} (${sampleRows.length} demo rows, ${headers.length} columns)`);
  }

  const outDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const demoFilePath = path.join(outDir, 'theunbound_master_sheets_canonical_25_tabs_demo_data.xlsx');
  XLSX.writeFile(wb, demoFilePath);
  console.log(`\nSuccessfully wrote Demo Workbook to: ${demoFilePath}`);
  console.log(`Total Canonical Tabs: ${CANONICAL_TAB_PROCESSING_ORDER.length}`);
  console.log(`Total Pre-loaded Demo Rows: ${totalDemoRecords}`);

  // Also build blank canonical template
  const blankWb = XLSX.utils.book_new();
  for (const tabName of CANONICAL_TAB_PROCESSING_ORDER) {
    const headers = CANONICAL_SCHEMA_HEADERS[tabName] || [];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 15) }));
    XLSX.utils.book_append_sheet(blankWb, ws, tabName);
  }
  const blankFilePath = path.join(outDir, 'theunbound_master_sheets_canonical_25_tabs_blank_template.xlsx');
  XLSX.writeFile(blankWb, blankFilePath);
  console.log(`Successfully wrote Blank Template to: ${blankFilePath}`);
}

buildMasterDemoWorkbook();
