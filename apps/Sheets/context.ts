import type { Model, WorksheetProperties, SheetData } from "@ironcalc/wasm";
import { columnNameFromNumber } from "./utils.ts";

/*
current sheet first
find ranges
truncate huge ranges
hidden sheets? include in context but don't show cells
*/

function context(model: Model) {
  const modelContext = getModelContext(model);

  return `# magicsandbox.Sheets

magicsandbox.Sheets lets users create and edit spreadsheets. Users can upload and download Excel files. magicsandbox.Sheets uses a spreadsheet engine called IronCalc, which aims to be Excel compatible. However, not every Excel function is supported.

## Context

${modelContext}

## API

todo

## Instructions

todo
`;
}

function getModelContext(model: Model) {
  const sheetProperties = model.getWorksheetsProperties();
  const workbookData = model.getWorkbookData();

  const sheetsContexts = sheetProperties.map((properties, index) => {
    const sheetData = workbookData[index]!;
    return getSheetContext(properties, sheetData);
  });
  return sheetsContexts.join("\n");
}

function getSheetContext(
  sheetProperties: WorksheetProperties,
  sheetData: SheetData,
) {
  const rowIndices = Array.from(sheetData.keys()).sort((a, b) => a - b);
  const allColumnIndices = new Set<number>();
  rowIndices.forEach((row) => {
    const rowData = sheetData.get(row);
    if (rowData) {
      Array.from(rowData.keys()).forEach((col) => allColumnIndices.add(col));
    }
  });
  const columnIndices = Array.from(allColumnIndices).sort((a, b) => a - b);

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
