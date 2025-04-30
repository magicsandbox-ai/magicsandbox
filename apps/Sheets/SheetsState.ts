import type { Model, SheetData } from "@ironcalc/wasm";
import { columnNameToNumber } from "./utils.ts";
import { getContext, getRangeContext } from "./context.ts";

/*
api:
- duplicate sheet? copy range?
- if touching a sheet, unhide it? make it current? add style to changed cells?
- style/formatting
*/

type SheetRange = {
  sheetIndex: number;
  leftCol: number;
  leftRow: number;
  rightCol: number;
  rightRow: number;
};

class SheetsState {
  private batchUndoTimeoutId: ReturnType<typeof setTimeout> | null = null;
  public undoCounts: number[] = [];
  public redoCounts: number[] = [];
  private cachedWorkbookData: SheetData[] | null = null;
  private lastErrorToastTime: number = 0;
  public modelUndo: () => void = () => {};
  public modelRedo: () => void = () => {};
  public redraw: () => void = () => {};
  public addToast: (message: string, type: string) => void = () => {};

  constructor(public model: Model) {
    setInterval(() => {
      this.maybeSave();
    }, 3000);
  }

  async maybeSave() {
    const userActionCount = this.addUndoCounts();
    if (userActionCount > 0) {
      this.save();
    }
  }

  async save() {
    try {
      await requestPutData("modelBytes", this.model.toBytes());
    } catch (e) {
      let message = "Unexpected error saving data";
      if (e instanceof Error && e.message === "Database size limit exceeded") {
        message =
          "Error: spreadsheet too large to save. Make sure to download it to save your progress.";
      }
      const now = Date.now();
      if (now - this.lastErrorToastTime >= 5 * 60 * 1000) {
        console.error(e);
        this.addToast(message, "error");
        this.lastErrorToastTime = now;
      }
    }
  }

  addUndoCounts() {
    const userActionCount = this.flushSendQueue();
    if (userActionCount > 0) {
      this.redoCounts = [];
      for (let i = 0; i < userActionCount; i++) {
        this.undoCounts.push(1);
      }
    }
    return userActionCount;
  }

  batchUndo() {
    // track all the actions the assistant makes synchronously as a batch that can be undone with a single undo
    this.cachedWorkbookData = null; // invalidate since making changes
    if (this.batchUndoTimeoutId !== null) {
      return;
    }
    this.addUndoCounts();
    this.redoCounts = [];
    this.batchUndoTimeoutId = setTimeout(() => {
      this.undoCounts.push(this.flushSendQueue());
      this.batchUndoTimeoutId = null;
      this.redraw();
      this.save();
    }, 0);
  }

  undo() {
    this.addUndoCounts();
    const undoCount = this.undoCounts.pop();
    if (undoCount === undefined) {
      return;
    }
    this.redoCounts.push(undoCount);
    for (let i = 0; i < undoCount; i++) {
      this.modelUndo(); //calling model.undo creates an infinite loop due to the Proxy
    }
    this.flushSendQueue(); // undo adds to send queue, but we want to remove it so that the next userActionCount is correct
    this.save();
  }

  redo() {
    this.addUndoCounts();
    const redoCount = this.redoCounts.pop();
    if (redoCount === undefined) {
      return;
    }
    this.undoCounts.push(redoCount);
    for (let i = 0; i < redoCount; i++) {
      this.modelRedo(); //calling model.redo creates an infinite loop due to the Proxy
    }
    this.flushSendQueue(); // redo adds to send queue, but we want to remove it so that the next userActionCount is correct
    this.save();
  }

  flushSendQueue() {
    return this.model.flushSendQueueCount();
  }

  context() {
    const modelContext = getContext(this.model);

    return `# magicsandbox.Sheets
  
magicsandbox.Sheets lets users create and edit spreadsheets. Users can upload and download Excel files. magicsandbox.Sheets uses a spreadsheet engine called IronCalc, which aims to be Excel compatible. However, not every Excel function is supported.

## Context

An XML representation of the user's spreadsheet is shown below. A few notes on this representation:

- Each sheet is represented by a <sheet> tag with a name attribute containing the sheet's name.
  - If the sheet is hidden, it will have hidden="true".
  - The user's currently selected sheet is listed first and will have a selected="A1" or selected="A1:B2" attribute indicating the selected cell or range.
- Each sheet is divided into <range> tags, each with a ref attribute specifying the cell range it covers (e.g., ref="A1:B2").
  - Ranges are contiguous blocks of cells separated by one or more empty rows or columns. This helps group logical sections and omits large empty areas.
  - Within a range, entire or partial rows may be truncated for brevity. Truncation is indicated by a comment containing ellipses: "<!-- ... -->".
- Each cell within a range is represented as cellRef,formula,value (e.g., A1,=SUM(B1:B2),10), with cells separated by | and rows separated by newlines.
  - If a cell has no formula, the formula field is left empty (e.g., A1,,10).
  - If a cell is blank, both fields are left empty (e.g., A1,,).
  - If a cell has an error, the value shows as an error constant followed by the error message (e.g., "#DIV/0!: Divide by 0")

${modelContext}

## API

### Range Operations
Each method takes a \`range\` argument, which can take the forms "SheetName!A1" or "SheetName!A1:B2"

- **app.api.getRange(range: string)**  
  Logs the value of a range of cells. The logs may be truncated if they're too long.

- **app.api.setRange(range: string, value: string)**  
  Set the value or formula for the specified range.
  - For values: provide the literal value as a string (e.g., "42" or "Hello"). When setting a range of multiple cells, the same value is copied to all cells in the range To set different values in different cells, call setRange multiple times.
  - For formulas: value should start with "=" (e.g., "=A1+B1"). When setting a range of multiple cells, write the formula as it should appear in the first cell of the range. The formula will then be auto-filled to subsequent cells, adjusting relative references appropriately. For example, \`app.api.setRange("SheetName!C1:C2", "=A1+B1")\` will put "=A1+B1" in C1 and "=A2+B2" in C2. Consider whether the formula should use absolute or relative references.

- **app.api.fillRange(sourceRange: string, targetRange: string)**  
  Fill a target range from a source range. Values are copied and relative references in formulas are adjusted. Can fill in all four directions.

- **app.api.clearRange(range: string)**  
  Clear a range of cells.

### Row Operations
Each method takes a \`rows\` argument, which can take the forms "SheetName!1" or "SheetName!1:2"

- **app.api.insertRows(rows: string)**  
  Insert one or more rows.

- **app.api.deleteRows(rows: string)**  
  Delete one or more rows.

### Column Operations
Each method takes a \`columns\` argument, which can take the forms "SheetName!A" or "SheetName!A:B"

- **app.api.insertColumns(columns: string)**  
  Insert one or more columns.

- **app.api.deleteColumns(columns: string)**  
  Delete one or more columns.

### Sheet Operations
Each method takes sheet names as arguments.
- **app.api.addSheet(sheetName: string)**  
  Add a new sheet.

- **app.api.renameSheet(oldSheetName: string, newSheetName: string)**  
  Rename a sheet.

- **app.api.deleteSheet(sheetName: string)**  
  Delete a sheet.

## Instructions

- The user's spreadsheet is saved across sessions, so if the user has just started a session, the current spreadsheet may be irrelevant to their request. Use your judgment to determine the best course of action:
  - If the user's request is related to the current spreadsheet, use the current spreadsheet.
  - If the user's request is unrelated to the current spreadsheet but simple (e.g., "help me build a formula that does X"), add a new sheet to use for this request.
  - If the user's request is unrelated to the current spreadsheet and complex (e.g., "help me build a financial model to value a company"), suggest that the user start a new spreadsheet.
  - If you can infer from the user's request that they have an existing spreadsheet they'd like help with, suggest that they upload it.
- If the user's request is vague (e.g., "help me fix this formula"), focus on their selected cell/range when answering.
- If the user asks for help creating a formula:
  - If it's clear the user has data they want to use in the formula (e.g., "can you create a formula that gets the first 5 letters from column A"), reference the existing data in the formula.
  - Otherwise, create some sample data to use in the formula.
- Create a detailed plan to solve the user's request before executing a script - this both helps the user understand what you're doing and helps ensure the accuracy of your script. At each step in the plan, include explicit references to the cells you plan to change, ensuring the cell references account for any changes due to inserting or deleting rows or columns. If needed, for complex plans, use multiple scripts so you can verify your incremental progress.
- Follow best practices when writing formulas rather than solely focusing on the user's current request. For example, use absolute references where appropriate so that the user can copy the formula to other cells without it breaking. Explain how your formulas work to the user and why you chose specific approaches over alternatives.
- If the user wants to undo a change you've made, suggest they use Ctrl+Z or the undo button in the toolbar - this is more reliable than you attempting to reverse the change. If the user is persistent, then attempt to reverse the change. Note: when you execute a script with multiple synchronous operations (like setting multiple cells), all those operations are batched together - when the user undoes one change from that script, all operations in the batch will be undone together.
- If the user asks you to calculate something, use a formula to do so to ensure accuracy. Don't attempt to do arithmetic.
- You're not currently able to view or edit the styles or formatting of the spreadsheet. Explain to the user that you can't do that yet.
- IronCalc is not yet completely compatible with Excel. If you run into an issue, apologize to the user and offer guidance on how they can accomplish their goal using Excel.
`;
  }

  getRange(range: string) {
    if (this.cachedWorkbookData === null) {
      this.cachedWorkbookData = this.model.getWorkbookData();
      setTimeout(() => {
        //create a task to invalidate the cache, since any user action could change the workbook
        this.cachedWorkbookData = null;
      }, 0);
    }
    const { sheetIndex, leftCol, leftRow, rightCol, rightRow } =
      this.parseRange(range);
    const sheetData = this.cachedWorkbookData[sheetIndex];
    if (!sheetData) {
      throw new Error("Unexpected getRange error");
    }
    const [sheetName] = range.split("!");
    const rangeContext = getRangeContext(
      this.model,
      {
        leftCol,
        leftRow,
        rightCol: rightCol || leftCol,
        rightRow: rightRow || leftRow,
      },
      sheetData,
      sheetName || "",
    );
    assistant.full(rangeContext);
    return rangeContext;
  }

  setRange(range: string, value: string) {
    this.batchUndo();
    const { sheetIndex, leftCol, leftRow, rightCol, rightRow } =
      this.parseRange(range);
    this.model.setUserInput(sheetIndex, leftRow, leftCol, String(value));
    this.fillRange(
      { sheetIndex, leftCol, leftRow, rightCol: leftCol, rightRow: leftRow },
      {
        sheetIndex,
        leftCol,
        leftRow,
        rightCol: rightCol || leftCol,
        rightRow: rightRow || leftRow,
      },
    );
  }

  fillRange(
    sourceRange: string | SheetRange,
    targetRange: string | SheetRange,
  ) {
    this.batchUndo();
    let source: SheetRange;
    let target: SheetRange;
    if (typeof sourceRange === "string") {
      const parsedSource = this.parseRange(sourceRange);
      source = {
        sheetIndex: parsedSource.sheetIndex,
        leftCol: parsedSource.leftCol,
        leftRow: parsedSource.leftRow,
        rightCol: parsedSource.rightCol || parsedSource.leftCol,
        rightRow: parsedSource.rightRow || parsedSource.leftRow,
      };
    } else {
      source = sourceRange;
    }
    if (typeof targetRange === "string") {
      const parsedTarget = this.parseRange(targetRange);
      target = {
        sheetIndex: parsedTarget.sheetIndex,
        leftCol: parsedTarget.leftCol,
        leftRow: parsedTarget.leftRow,
        rightCol: parsedTarget.rightCol || parsedTarget.leftCol,
        rightRow: parsedTarget.rightRow || parsedTarget.leftRow,
      };
    } else {
      target = targetRange;
    }
    if (source.sheetIndex !== target.sheetIndex) {
      throw new Error(
        `fillRange: sourceRange ${sourceRange} and targetRange ${targetRange} must be on the same sheet`,
      );
    }
    if (
      //fillRange("SheetName!A1:B1", "SheetName!D1:E1")
      (target.rightCol > source.rightCol &&
        target.leftCol - source.rightCol > 1) ||
      //fillRange("SheetName!A1:A2", "SheetName!A4:A5")
      (target.rightRow > source.rightRow &&
        target.leftRow - source.rightRow > 1) ||
      //fillRange("SheetName!D1:E1", "SheetName!A1:B1")
      (target.leftCol < source.leftCol &&
        target.rightCol - source.leftCol < -1) ||
      //fillRange("SheetName!A4:A5", "SheetName!A1:A2")
      (target.leftRow < source.leftRow && target.rightRow - source.leftRow < -1)
    ) {
      throw new Error(
        `fillRange: sourceRange ${sourceRange} and targetRange ${targetRange} must be adjacent`,
      );
    }
    const sheetRange = {
      sheetIndex: source.sheetIndex,
      leftRow: source.leftRow,
      leftCol: source.leftCol,
      rightRow: source.rightRow,
      rightCol: source.rightCol,
    };
    function areaFromSheetRange(sheetRange: SheetRange) {
      return {
        sheet: sheetRange.sheetIndex,
        row: sheetRange.leftRow,
        column: sheetRange.leftCol,
        width: sheetRange.rightCol - sheetRange.leftCol + 1,
        height: sheetRange.rightRow - sheetRange.leftRow + 1,
      };
    }
    if (target.rightCol > source.rightCol) {
      this.model.autoFillColumns(
        areaFromSheetRange(sheetRange),
        target.rightCol,
      );
      sheetRange.rightCol = target.rightCol;
    }
    if (target.rightRow > source.rightRow) {
      this.model.autoFillRows(areaFromSheetRange(sheetRange), target.rightRow);
      sheetRange.rightRow = target.rightRow;
    }
    if (target.leftCol < source.leftCol) {
      this.model.autoFillColumns(
        areaFromSheetRange(sheetRange),
        target.leftCol,
      );
      sheetRange.leftCol = target.leftCol;
    }
    if (target.leftRow < source.leftRow) {
      this.model.autoFillRows(areaFromSheetRange(sheetRange), target.leftRow);
    }
  }

  clearRange(range: string) {
    this.batchUndo();
    const { sheetIndex, leftCol, leftRow, rightCol, rightRow } =
      this.parseRange(range);
    this.model.rangeClearAll(
      sheetIndex,
      leftRow,
      leftCol,
      rightRow || leftRow,
      rightCol || leftCol,
    );
  }

  insertRows(rows: string) {
    this.batchUndo();
    const { sheetIndex, leftRow, rightRow } = this.parseRows(rows);
    const rowsToInsert = (rightRow || leftRow) - leftRow + 1;
    for (let i = 0; i < rowsToInsert; i++) {
      this.model.insertRow(sheetIndex, leftRow);
    }
  }

  deleteRows(rows: string) {
    this.batchUndo();
    const { sheetIndex, leftRow, rightRow } = this.parseRows(rows);
    const rowsToDelete = (rightRow || leftRow) - leftRow + 1;
    for (let i = 0; i < rowsToDelete; i++) {
      this.model.deleteRow(sheetIndex, leftRow);
    }
  }

  insertColumns(columns: string) {
    this.batchUndo();
    const { sheetIndex, leftCol, rightCol } = this.parseColumns(columns);
    const columnsToInsert = (rightCol || leftCol) - leftCol + 1;
    for (let i = 0; i < columnsToInsert; i++) {
      this.model.insertColumn(sheetIndex, leftCol);
    }
  }

  deleteColumns(columns: string) {
    this.batchUndo();
    const { sheetIndex, leftCol, rightCol } = this.parseColumns(columns);
    const columnsToDelete = (rightCol || leftCol) - leftCol + 1;
    for (let i = 0; i < columnsToDelete; i++) {
      this.model.deleteColumn(sheetIndex, leftCol);
    }
  }

  addSheet(name: string) {
    this.batchUndo();
    this.model.newSheet();
    const worksheetsProperties = this.model.getWorksheetsProperties();
    this.model.renameSheet(worksheetsProperties.length - 1, name);
  }

  renameSheet(oldName: string, newName: string) {
    this.batchUndo();
    const sheetIndex = this.parseSheet(oldName);
    this.model.renameSheet(sheetIndex, newName);
  }

  deleteSheet(name: string) {
    this.batchUndo();
    const sheetIndex = this.parseSheet(name);
    this.model.deleteSheet(sheetIndex);
  }

  parseSheetRange(range: string): SheetRange {
    const { sheetIndex, leftCol, leftRow, rightCol, rightRow } =
      this.parseRange(range);
    return {
      sheetIndex,
      leftCol,
      leftRow,
      rightCol: rightCol || leftCol,
      rightRow: rightRow || leftRow,
    };
  }

  parseRange(range: string) {
    const { sheetIndex, leftCol, leftRow, rightCol, rightRow } =
      this.parseRef(range);
    if (sheetIndex === -1) {
      throw new Error("Invalid range, sheet not found: " + range);
    }
    if (!leftCol || !leftRow) {
      throw new Error("Invalid range: " + range);
    }
    if ((rightCol && !rightRow) || (rightRow && !rightCol)) {
      throw new Error("Invalid range: " + range);
    }
    return {
      sheetIndex,
      leftCol,
      leftRow,
      rightCol,
      rightRow,
    };
  }

  parseRows(rows: string) {
    const { sheetIndex, leftRow, rightRow } = this.parseRef(rows);
    if (sheetIndex === -1) {
      throw new Error("Invalid rows, sheet not found: " + rows);
    }
    if (!leftRow) {
      throw new Error("Invalid rows: " + rows);
    }
    return {
      sheetIndex,
      leftRow,
      rightRow,
    };
  }

  parseColumns(columns: string) {
    const { sheetIndex, leftCol, rightCol } = this.parseRef(columns);
    if (sheetIndex === -1) {
      throw new Error("Invalid columns, sheet not found: " + columns);
    }
    if (!leftCol) {
      throw new Error("Invalid columns: " + columns);
    }
    return {
      sheetIndex,
      leftCol,
      rightCol,
    };
  }

  parseSheet(sheet: string) {
    const { sheetIndex } = this.parseRef(sheet);
    if (sheetIndex === -1) {
      throw new Error("Invalid sheet: " + sheet);
    }
    return sheetIndex;
  }

  parseRef(ref: string) {
    const out: {
      sheetIndex: number;
      leftCol?: number;
      leftRow?: number;
      rightCol?: number;
      rightRow?: number;
    } = {
      sheetIndex: -1,
    };
    const [sheetName, rangeString] = ref.split("!");
    if (!sheetName) {
      return out;
    }
    const worksheetsProperties = this.model.getWorksheetsProperties();
    const sheetIndex = worksheetsProperties.findIndex(
      (sheet) => sheet.name === sheetName,
    );
    out.sheetIndex = sheetIndex;
    if (!rangeString) {
      return out;
    }
    const [leftCellString, rightCellString] = rangeString.split(":");
    if (leftCellString) {
      const leftCell = this.parseCellString(leftCellString);
      out.leftCol = leftCell.col;
      out.leftRow = leftCell.row;
    }
    if (rightCellString) {
      const rightCell = this.parseCellString(rightCellString);
      out.rightCol = rightCell.col;
      out.rightRow = rightCell.row;
    }
    // ensure rightCol >= leftCol
    if (out.rightCol && out.leftCol && out.rightCol < out.leftCol) {
      const t = out.rightCol;
      out.rightCol = out.leftCol;
      out.leftCol = t;
    }
    // ensure rightRow >= leftRow
    if (out.rightRow && out.leftRow && out.rightRow < out.leftRow) {
      const t = out.rightRow;
      out.rightRow = out.leftRow;
      out.leftRow = t;
    }
    return out;
  }

  parseCellString(cellString: string) {
    const out: { col?: number; row?: number } = {};
    const match = cellString.toUpperCase().match(/^([A-Z]*)(\d*)$/);
    if (match?.[1]) {
      out.col = columnNameToNumber(match[1]);
    }
    if (match?.[2]) {
      out.row = parseInt(match[2]);
    }
    return out;
  }
}

export { SheetsState };
