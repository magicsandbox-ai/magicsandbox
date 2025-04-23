import type { Model, Area } from "@ironcalc/wasm";

/*
get and set range (or auto fill?)
clear range style?
convert cells to row/col
convert sheet names to index?
rename sheet? delete sheet?
if touching a sheet, unhide it? make it current? add style to changed cells?
get methods need to log

later: style
*/

function addSheet(model: Model, name: string) {
  model.newSheet();
  const worksheetsProperties = model.getWorksheetsProperties();
  model.renameSheet(worksheetsProperties.length - 1, name);
}

function setCellValue(
  model: Model,
  sheet: number,
  row: number,
  column: number,
  value: string,
) {
  model.setUserInput(sheet, row, column, value);
}

function getCellValue(
  model: Model,
  sheet: number,
  row: number,
  column: number,
): string {
  return model.getFormattedCellValue(sheet, row, column);
}

function getCellContent(
  model: Model,
  sheet: number,
  row: number,
  column: number,
): string {
  return model.getCellContent(sheet, row, column);
}

function clearRange(
  model: Model,
  sheet: number,
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
) {
  model.rangeClearContents(sheet, startRow, startColumn, endRow, endColumn);
}

function insertRow(model: Model, sheet: number, row: number) {
  model.insertRow(sheet, row);
}

function insertColumn(model: Model, sheet: number, column: number) {
  model.insertColumn(sheet, column);
}

function deleteRow(model: Model, sheet: number, row: number) {
  model.deleteRow(sheet, row);
}

function deleteColumn(model: Model, sheet: number, column: number) {
  model.deleteColumn(sheet, column);
}

export {
  addSheet,
  setCellValue,
  getCellValue,
  getCellContent,
  clearRange,
  insertRow,
  insertColumn,
  deleteRow,
  deleteColumn,
};
