import { SheetData } from "@ironcalc/wasm";

type Range = {
  leftCol: number;
  leftRow: number;
  rightCol: number;
  rightRow: number;
};

type Cell = { row: number; col: number };

//SheetData allows lookup by row then col
//ColData allows lookup by col then row
type ColData = Map<number, Set<number>>;

type Direction = "up" | "down" | "left" | "right";

function columnNameFromNumber(column: number): string {
  let name = "";
  while (column > 0) {
    name = String.fromCharCode(65 + ((column - 1) % 26)) + name;
    column = Math.floor((column - 1) / 26);
  }
  return name;
}

function columnNameToNumber(name: string): number {
  return name.split("").reduce((acc, char) => {
    return acc * 26 + (char.charCodeAt(0) - 64);
  }, 0);
}

function rangeToString(range: Range): string {
  if (range.leftCol === range.rightCol && range.leftRow === range.rightRow) {
    return `${columnNameFromNumber(range.leftCol)}${range.leftRow}`;
  }
  return `${columnNameFromNumber(range.leftCol)}${range.leftRow}:${columnNameFromNumber(range.rightCol)}${range.rightRow}`;
}

function intersectRanges(range1: Range, range2: Range): Range {
  return {
    leftCol: Math.max(range1.leftCol, range2.leftCol),
    leftRow: Math.max(range1.leftRow, range2.leftRow),
    rightCol: Math.min(range1.rightCol, range2.rightCol),
    rightRow: Math.min(range1.rightRow, range2.rightRow),
  };
}

function getRanges(sheetData: SheetData): Range[] {
  const ranges: Range[] = [];
  let remainingCells: Cell[] = [];
  const colData: ColData = new Map();
  for (const [row, colMap] of sheetData.entries()) {
    for (const [col] of colMap.entries()) {
      remainingCells.push({ row, col });
      if (!colData.has(col)) {
        colData.set(col, new Set());
      }
      colData.get(col)!.add(row);
    }
  }
  while (remainingCells[0]) {
    let currentRange: Range = {
      leftCol: remainingCells[0].col,
      leftRow: remainingCells[0].row,
      rightCol: remainingCells[0].col,
      rightRow: remainingCells[0].row,
    };
    while (true) {
      if (expandRange(sheetData, colData, currentRange)) {
        continue;
      }
      break;
    }
    remainingCells = remainingCells.filter((cell) => {
      return !(
        cell.col >= currentRange.leftCol &&
        cell.col <= currentRange.rightCol &&
        cell.row >= currentRange.leftRow &&
        cell.row <= currentRange.rightRow
      );
    });
    ranges.push(currentRange);
  }
  ranges.sort((a, b) => a.leftRow - b.leftRow || a.leftCol - b.leftCol);
  return ranges;
}

/**
 * Checks if the range can be expanded in any direction. If so, mutates the range and returns true, else returns false.
 */
function expandRange(
  sheetData: SheetData,
  colData: ColData,
  range: Range,
): boolean {
  const directions: Direction[] = ["up", "down", "left", "right"];
  for (const direction of directions) {
    if (
      _expandRange(
        direction === "up" || direction === "down" ? sheetData : colData,
        range,
        direction,
      )
    ) {
      return true;
    }
  }
  return false;
}

function _expandRange(
  sheetData: SheetData | ColData,
  range: Range,
  direction: Direction,
): boolean {
  let newRowOrCol: number;
  let lowerBound: number;
  let upperBound: number;
  let updateRange: (range: Range) => void;
  if (direction === "up") {
    newRowOrCol = range.leftRow - 1;
    lowerBound = range.leftCol;
    upperBound = range.rightCol;
    updateRange = (range: Range) => {
      range.leftRow--;
    };
  } else if (direction === "down") {
    newRowOrCol = range.rightRow + 1;
    lowerBound = range.leftCol;
    upperBound = range.rightCol;
    updateRange = (range: Range) => {
      range.rightRow++;
    };
  } else if (direction === "left") {
    newRowOrCol = range.leftCol - 1;
    lowerBound = range.leftRow;
    upperBound = range.rightRow;
    updateRange = (range: Range) => {
      range.leftCol--;
    };
  } else {
    newRowOrCol = range.rightCol + 1;
    lowerBound = range.leftRow;
    upperBound = range.rightRow;
    updateRange = (range: Range) => {
      range.rightCol++;
    };
  }
  const data = sheetData.get(newRowOrCol);
  if (data) {
    const entries = [...data.entries()];
    if (entries.length < upperBound - lowerBound + 1) {
      //quicker to iterate over the entries than the range
      for (const [cell] of entries) {
        if (cell >= lowerBound && cell <= upperBound) {
          updateRange(range);
          return true;
        }
      }
    } else {
      //iterate over the range
      for (let i = lowerBound; i <= upperBound; i++) {
        if (data.has(i)) {
          updateRange(range);
          return true;
        }
      }
    }
  }
  return false;
}

export {
  columnNameFromNumber,
  columnNameToNumber,
  rangeToString,
  intersectRanges,
  getRanges,
};
export type { Range };
