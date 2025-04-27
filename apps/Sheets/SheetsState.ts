import type {
  Model,
  WorksheetProperties,
  SheetData,
  SelectedView,
} from "@ironcalc/wasm";
//todo - it's confusing to use range as a string and also as a type
//plus in the result from parseRange, rightCol and rightRow are optional, but they're required in Range
import type { Range } from "./utils.ts";
import {
  columnNameFromNumber,
  columnNameToNumber,
  rangeToString,
  getRanges,
} from "./utils.ts";

const TOKEN_BUDGET = 25000; //todo make configurable

interface GetSheetContextArgs {
  sheetProperties: WorksheetProperties;
  selectedView?: SelectedView;
  sheetData: SheetData;
}

/*
api:
- duplicate sheet? copy range?
- if touching a sheet, unhide it? make it current? add style to changed cells?
- style/formatting
*/

class SheetsState {
  private batchUndoTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private undoCounts: number[] = [];
  private redoCounts: number[] = [];
  private cachedWorkbookData: SheetData[] | null = null;
  private lastErrorToastTime: number = 0;
  public modelUndo: () => void = () => {};
  public modelRedo: () => void = () => {};
  public redraw: () => void = () => {};
  public addToast: (message: string, type: string) => void = () => {};

  constructor(public model: Model) {
    setInterval(() => {
      this.save();
    }, 3000);
  }

  async save() {
    const userActionCount = this.addUndoCounts();
    if (userActionCount > 0) {
      try {
        await requestPutData("modelBytes", this.model.toBytes());
      } catch (e) {
        let message = "Unexpected error saving data";
        if (
          e instanceof Error &&
          e.message === "Database size limit exceeded"
        ) {
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
  }

  addUndoCounts() {
    const userActionCount = this.flushSendQueue("addUndoCounts").length;
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
      this.undoCounts.push(this.flushSendQueue("batchUndo").length);
      this.batchUndoTimeoutId = null;
      this.redraw();
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
    this.flushSendQueue("undo"); // undo adds to send queue, but we want to remove it so that the next userActionCount is correct
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
    this.flushSendQueue("redo"); // redo adds to send queue, but we want to remove it so that the next userActionCount is correct
  }

  flushSendQueue(debug: string) {
    // const q = this.model.debugFlushSendQueue();
    // console.log(debug, q);
    const q = this.model.flushSendQueue();
    return q;
  }

  getModelContext() {
    const sheetsProperties = this.model.getWorksheetsProperties();
    const selectedView = this.model.getSelectedView();
    const selectedSheet = selectedView.sheet;
    const workbookData = this.model.getWorkbookData();

    const getSheetContextArgs: GetSheetContextArgs[] = [];
    sheetsProperties.forEach((sheetProperties, index) => {
      if (index === selectedSheet) {
        getSheetContextArgs.unshift({
          sheetProperties,
          selectedView,
          sheetData: workbookData[index]!,
        });
      } else if (sheetProperties.state === "veryHidden") {
        // skip
      } else {
        getSheetContextArgs.push({
          sheetProperties,
          sheetData: workbookData[index]!,
        });
      }
    });

    let tokenBudget = TOKEN_BUDGET;
    const sheetContexts: string[] = [];
    for (const args of getSheetContextArgs) {
      const sheetContext = this.getSheetContext(args, tokenBudget);
      tokenBudget -= sheetContext.length;
      sheetContexts.push(sheetContext);
    }

    return `<spreadsheet>
${sheetContexts.join("\n")}
</spreadsheet>`;
  }

  getSheetContext(
    { sheetProperties, selectedView, sheetData }: GetSheetContextArgs,
    tokenBudget: number,
  ) {
    const props: Record<string, string> = {
      name: sheetProperties.name,
    };
    if (sheetProperties.state === "hidden") {
      props.hidden = "true";
    }
    if (selectedView) {
      const range = {
        leftCol: selectedView.range[1],
        leftRow: selectedView.range[0],
        rightCol: selectedView.range[3],
        rightRow: selectedView.range[2],
      };
      props.selected = rangeToString(range);
    }
    const propsString = Object.entries(props)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");
    const ranges = getRanges(sheetData);
    const rangeContexts: string[] = [];
    //todo - prioritize range(s) that contain selectedView?
    for (const range of ranges) {
      const rangeContext = this.getRangeContext(
        sheetData,
        range,
        tokenBudget,
        selectedView,
      );
      tokenBudget -= rangeContext.length;
      rangeContexts.push(rangeContext);
    }
    return `<sheet ${propsString}>
${rangeContexts.join("\n")}
</sheet>`;
  }

  getRangeContext(
    sheetData: SheetData,
    range: Range,
    tokenBudget: number,
    selectedView?: SelectedView,
  ) {
    const rangeString = rangeToString(range);
    return `<range ref="${rangeString}">
todo
</range>`;
  }

  context() {
    const modelContext = this.getModelContext();

    return `# magicsandbox.Sheets
  
magicsandbox.Sheets lets users create and edit spreadsheets. Users can upload and download Excel files. magicsandbox.Sheets uses a spreadsheet engine called IronCalc, which aims to be Excel compatible. However, not every Excel function is supported.

## Context

An XML representation of the user's spreadsheet is shown below. A few notes on this representation:

- Each sheet is represented by a <sheet> tag with a name attribute containing the sheet's name.
  - If the sheet is hidden, it will have hidden="true".
  - The user's currently selected sheet is listed first and will have a selected="A1" or selected="A1:B2" attribute indicating the selected cell or range.
- Each sheet is divided into one or more <range> tags, each with a ref attribute specifying the cell range it covers (e.g., ref="A1:B2").
  - Ranges are contiguous blocks of cells separated by one or more empty rows or columns. This helps group logical sections and omits large empty areas.
  - Within a range, entire or partial rows may be truncated for brevity. Truncation is indicated by a comment containing ellipses: "<!-- ... -->".
- Each cell within a range is represented as cellRef,formula,value (e.g., A1,=SUM(B1:B2),10), with cells separated by | and rows separated by newlines.
  - If a cell has no formula, the formula field is left empty (e.g., A1,,10).
  - If a cell is blank, both fields are left empty (e.g., A1,,).

${modelContext}

## API

### Range Operations
Each method takes a \`range\` argument, which can take the forms "SheetName!A1" or "SheetName!A1:B2"

- **app.api.getRange(range: string)**  
  Logs the value of a range of cells. The logs may be truncated if they're too long.

- **app.api.setRange(range: string, value: string)**  
  Set the value or formula for the specified range.
  - For values: provide the literal value as a string (e.g., "42" or "Hello"). When setting a range of multiple cells, the same value is copied to all cells in the range.
  - For formulas: value should start with "=" (e.g., "=A1+B1"). When setting a range of multiple cells, write the formula as it should appear in the first cell of the range. The formula will then be auto-filled to subsequent cells, adjusting relative references appropriately. For example, \`app.api.setRange("SheetName!C1:C2", "=A1+B1")\` will put "=A1+B1" in C1 and "=A2+B2" in C2.

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

- If the user's question or request is vague (e.g., "help me fix this formula"), focus on their selected cell/range when answering.
- Explain to the user what actions you're taking - it's not always easy for the user to see every change you make.
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
    const rangeContext = this.getRangeContext(
      sheetData,
      {
        leftCol,
        leftRow,
        rightCol: rightCol || leftCol,
        rightRow: rightRow || leftRow,
      },
      10000,
    );
    assistant.full(rangeContext);
    return rangeContext;
  }

  setRange(range: string, value: string) {
    this.batchUndo();
    const { sheetIndex, leftCol, leftRow, rightCol, rightRow } =
      this.parseRange(range);
    this.model.setUserInput(sheetIndex, leftRow, leftCol, String(value));
    if (rightCol && rightRow) {
      if (rightCol !== leftCol) {
        this.model.autoFillColumns(
          {
            sheet: sheetIndex,
            row: leftRow,
            column: leftCol,
            width: 1,
            height: 1,
          },
          rightCol,
        );
      }
      if (rightRow !== leftRow) {
        this.model.autoFillRows(
          {
            sheet: sheetIndex,
            row: leftRow,
            column: leftCol,
            width: rightCol - leftCol + 1,
            height: 1,
          },
          rightRow,
        );
      }
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
