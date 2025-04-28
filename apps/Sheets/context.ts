import {
  Model,
  SheetData,
  SelectedView,
  WorksheetProperties,
} from "@ironcalc/wasm";
import type { Range } from "./utils";
import {
  columnNameFromNumber,
  rangeToString,
  getRanges,
  intersectRanges,
} from "./utils";

const TOKEN_BUDGET = 25000; //todo make configurable

interface SheetContextArgs {
  context: Context;
  sheetProperties: WorksheetProperties;
  selectedView?: SelectedView;
  sheetData: SheetData;
}

interface RangeContextArgs {
  context: Context;
  range: Range;
  sheetData: SheetData;
  selectedRange?: Range;
  sheetName?: string;
}

class Context {
  public tokenBudget = TOKEN_BUDGET;
  private sheetContexts: SheetContext[] = [];
  public rangeContexts: RangeContext[] = [];
  private openTag: string = "";
  private closeTag: string = "";

  constructor(private model: Model) {}

  get() {
    this.openTag = "<spreadsheet>";
    this.closeTag = "</spreadsheet>";
    this.tokenBudget -= this.openTag.length + this.closeTag.length;

    const sheetsProperties = this.model.getWorksheetsProperties();
    const selectedView = this.model.getSelectedView();
    const selectedSheet = selectedView.sheet;
    const workbookData = this.model.getWorkbookData();

    const sheetContextsArgs: SheetContextArgs[] = [];
    sheetsProperties.forEach((sheetProperties, index) => {
      if (index === selectedSheet) {
        sheetContextsArgs.unshift({
          context: this,
          sheetProperties,
          selectedView,
          sheetData: workbookData[index]!,
        });
      } else if (sheetProperties.state === "veryHidden") {
        // skip
      } else {
        sheetContextsArgs.push({
          context: this,
          sheetProperties,
          sheetData: workbookData[index]!,
        });
      }
    });

    for (const args of sheetContextsArgs) {
      this.sheetContexts.push(
        new SheetContext(
          args.context,
          args.sheetProperties,
          args.selectedView,
          args.sheetData,
        ),
      );
    }

    let activeRangeContexts = [...this.rangeContexts];
    while (activeRangeContexts.length > 0 && this.tokenBudget > 100) {
      activeRangeContexts = activeRangeContexts.filter((rangeContext) =>
        rangeContext.addRow(),
      );
    }

    return `${this.openTag}
${this.sheetContexts.map((sheetContext) => sheetContext.get()).join("\n")}
${this.closeTag}`;
  }

  getRangeContext(range: Range, sheetData: SheetData, sheetName: string) {
    const rangeContext = new RangeContext({
      context: this,
      range,
      sheetData,
      sheetName,
    });
    let addRow = true;
    while (addRow) {
      addRow = rangeContext.addRow();
    }
    return rangeContext.get();
  }
}

class SheetContext {
  private rangeContexts: RangeContext[] = [];
  private openTag: string = "";
  private closeTag: string = "";

  constructor(
    private context: Context,
    sheetProperties: WorksheetProperties,
    selectedView: SelectedView | undefined,
    sheetData: SheetData,
  ) {
    const props: Record<string, string> = {
      name: sheetProperties.name,
    };
    if (sheetProperties.state === "hidden") {
      props.hidden = "true";
    }
    let selectedRange: Range | undefined;
    if (selectedView) {
      selectedRange = {
        leftCol: selectedView.range[1],
        leftRow: selectedView.range[0],
        rightCol: selectedView.range[3],
        rightRow: selectedView.range[2],
      };
      props.selected = rangeToString(selectedRange);
    }
    const propsString = Object.entries(props)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");
    this.openTag = `<sheet ${propsString}>`;
    this.closeTag = "</sheet>";
    this.context.tokenBudget -= this.openTag.length + this.closeTag.length;

    const ranges = getRanges(sheetData);
    for (const range of ranges) {
      this.rangeContexts.push(
        new RangeContext({
          context: this.context,
          range,
          sheetData,
          selectedRange,
        }),
      );
    }
  }

  get() {
    return `${this.openTag}
${this.rangeContexts.map((rangeContext) => rangeContext.get()).join("\n")}
${this.closeTag}`;
  }
}

class RangeContext {
  private context: Context;
  private range: Range;
  private sheetData: SheetData;
  private openTag: string = "";
  private closeTag: string = "";
  private priorityRows: number[] = [];
  private nextRow: number;
  private rows: Map<number, string> = new Map();

  constructor({
    context,
    range,
    sheetData,
    selectedRange,
    sheetName,
  }: RangeContextArgs) {
    this.context = context;
    this.range = range;
    this.sheetData = sheetData;

    this.context.rangeContexts.push(this);

    const rangeString = sheetName
      ? `${sheetName}!${rangeToString(range)}`
      : rangeToString(range);
    this.openTag = `<range ref="${rangeString}">`;
    this.closeTag = "</range>";
    this.context.tokenBudget -= this.openTag.length + this.closeTag.length;

    this.priorityRows = [
      this.range.leftRow, //first row
      this.range.rightRow, //last row
    ];
    if (selectedRange) {
      const intersectedRange = intersectRanges(this.range, selectedRange);
      //first 5 rows of selected range
      this.addPriorityRows(
        intersectedRange.leftRow,
        intersectedRange.leftRow + 4,
      );
      //last 5 rows of selected range
      this.addPriorityRows(
        intersectedRange.rightRow - 4,
        intersectedRange.rightRow,
      );
    }
    //first 5 rows of range (first already added)
    this.addPriorityRows(this.range.leftRow + 1, this.range.leftRow + 4);
    //last 5 rows of range (last already added)
    this.addPriorityRows(this.range.rightRow - 4, this.range.rightRow - 1);

    this.nextRow = this.range.leftRow;
  }

  /**
   * Adds priority rows. Double checks range bounds. rightRow is inclusive.
   */
  addPriorityRows(leftRow: number, rightRow: number) {
    for (
      let row = Math.max(leftRow, this.range.leftRow);
      row <= Math.min(rightRow, this.range.rightRow);
      row++
    ) {
      this.priorityRows.push(row);
    }
  }

  /**
   * Adds a row to the range context. Returns true if more rows can be added, false if not.
   */
  addRow() {
    let row;
    let formattedRow;
    while (this.priorityRows.length > 0) {
      row = this.priorityRows.shift();
      if (this.rows.has(row!)) {
        continue;
      } else {
        formattedRow = this.formatRow(row!);
        break;
      }
    }
    while (this.nextRow <= this.range.rightRow) {
      row = this.nextRow;
      if (this.rows.has(row)) {
        this.nextRow++;
      } else {
        formattedRow = this.formatRow(row);
        this.nextRow++;
        break;
      }
    }
    if (row === undefined || formattedRow === undefined) {
      return false;
    }
    let ret = true;
    if (formattedRow.length > this.context.tokenBudget) {
      formattedRow =
        formattedRow.slice(0, this.context.tokenBudget) + "<!-- ... -->";
      ret = false;
    }
    this.rows.set(row, formattedRow);
    this.context.tokenBudget -= formattedRow.length;
    return ret;
  }

  formatRow(row: number) {
    const colMap = this.sheetData.get(row);
    const cols = [];
    for (let col = this.range.leftCol; col <= this.range.rightCol; col++) {
      const cell = colMap?.get(col);
      const cellRef = `${columnNameFromNumber(col)}${row}`;
      const formula = cell?.formula || "";
      let value = cell?.value || "";
      if (cell?.error) {
        value += `: ${cell.error}`;
      }
      cols.push(`${cellRef},${formula},${value}`);
    }
    return cols.join("|");
  }

  get() {
    const finalRows = [];
    const indices = Array.from(this.rows.keys()).sort((a, b) => a - b);
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      if (i > 0 && idx! > indices[i - 1]! + 1) {
        finalRows.push("<!-- ... -->");
      }
      finalRows.push(this.rows.get(idx!)!);
    }
    if (indices[indices.length - 1]! < this.range.rightRow) {
      finalRows.push("<!-- ... -->");
    }
    return `${this.openTag}
${finalRows.join("\n")}
${this.closeTag}`;
  }
}

function getContext(model: Model) {
  return new Context(model).get();
}

function getRangeContext(
  model: Model,
  range: Range,
  sheetData: SheetData,
  sheetName: string,
) {
  return new Context(model).getRangeContext(range, sheetData, sheetName);
}

export { getContext, getRangeContext };
