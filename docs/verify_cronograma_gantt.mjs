import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workbookPath = path.join(__dirname, "Cronograma_SmartPark_Gantt.xlsx");

const blob = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(blob);

const overview = await workbook.inspect({
  kind: "table",
  range: "Cronograma Gantt!A1:G10",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 7,
});

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});

const preview = await workbook.render({
  sheetName: "Cronograma Gantt",
  range: "A1:AG18",
  scale: 1,
  format: "png",
});

const previewPath = path.join(__dirname, "Cronograma_SmartPark_Gantt_preview.png");
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

console.log(JSON.stringify({
  workbookPath,
  previewPath,
  overview: overview.ndjson,
  errors: errors.ndjson,
}, null, 2));
