import type { Model } from "@ironcalc/workbook";
import type { WorksheetProperties, SheetData } from "@ironcalc/wasm";
import { columnNameFromNumber } from "./utils.ts";

function context(model: Model) {
  const sheetProperties = model.getWorksheetsProperties();
  const workbookData = model.getWorkbookData();

  const sheetsContexts = sheetProperties.map((properties, index) => {
    const sheetData = workbookData[index]!;
    return sheetContext(properties, sheetData);
  });

  return `# magicsandbox.Sheets

magicsandbox.Sheets is a work in progress spreadsheet app with limited functionality at the moment.

## Context

${sheetsContexts.join("\n")}
`;
}

function sheetContext(
  sheetProperties: WorksheetProperties,
  sheetData: SheetData,
) {
  // Get all row and column indices
  const rowIndices = Array.from(sheetData.keys()).sort((a, b) => a - b);
  const allColumnIndices = new Set<number>();
  rowIndices.forEach((row) => {
    const rowData = sheetData.get(row);
    if (rowData) {
      Array.from(rowData.keys()).forEach((col) => allColumnIndices.add(col));
    }
  });
  const columnIndices = Array.from(allColumnIndices).sort((a, b) => a - b);

  // Build the cells string
  const cells = rowIndices
    .map((row) => {
      const rowData = sheetData.get(row);
      return columnIndices
        .map((col) => {
          const cell = rowData?.get(col);
          const cellRef = `${columnNameFromNumber(col)}${row}`;
          if (cell) {
            return `${cellRef},${cell.formula || ""},${cell.value}`;
          }
          return `${cellRef},,`;
        })
        .join("|");
    })
    .join("\n");

  return `<${sheetProperties.name}>
${cells}
</${sheetProperties.name}>`;
}

export { context };
