/*
"lucide-react": "^0.408.0",

todo careful with lucide styling
*/
import React, { useState, useEffect } from "react";
// @ts-ignore
import { Trash2 } from "lucide-react";

interface RowData {
  data: { [column: string]: string };
  id: number;
}

type TableData = RowData[];

const tdStyle = "border border-stone-500 text-center";

function HeaderRow({ columns }: { columns: string[] }) {
  return (
    <tr>
      {columns.map((column, i) => (
        <th key={i} className={tdStyle + " bg-stone-100 px-2"}>
          {column}
        </th>
      ))}
    </tr>
  );
}

function Row({
  columns,
  row,
  data,
  setData,
  allowAdd,
}: {
  columns: string[];
  row: RowData;
  data: TableData;
  setData: (data: TableData) => void;
  allowAdd: boolean;
}) {
  return (
    <tr>
      {columns.map((column, i) => (
        <Cell
          key={i}
          id={row.id}
          column={column}
          value={row.data[column] || ""}
          data={data}
          setData={setData}
        />
      ))}
      {allowAdd && (
        <td className="w-6">
          <button
            className="align-middle"
            onClick={() => {
              if (data.length > 1) {
                setData(data.filter((r) => r.id !== row.id));
              }
            }}
          >
            <Trash2 />
            <span className="sr-only">Delete</span>
          </button>
        </td>
      )}
    </tr>
  );
}

function Cell({
  id,
  column,
  value,
  data,
  setData,
}: {
  id: number;
  column: string;
  value: string;
  data: TableData;
  setData: (data: TableData) => void;
}) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setData(
      data.map((row) =>
        row.id === id
          ? { ...row, data: { ...row.data, [column]: event.target.value } }
          : row,
      ),
    );
  }

  return (
    <td className={tdStyle}>
      <input
        className="w-full text-center"
        type="text"
        value={value}
        onChange={handleChange}
        spellCheck={false}
        aria-label={column}
      />
    </td>
  );
}

let nextId = 0;

function Table({
  initData,
  onChange,
  allowAdd,
}: {
  initData: { [column: string]: string }[];
  onChange: (data: { [column: string]: string }[]) => void;
  allowAdd: boolean;
}) {
  const [data, setData] = useState<TableData>(
    initData.map((d) => ({ data: d, id: nextId++ })),
  );

  useEffect(() => {
    onChange(data.map((d) => d.data));
  }, [data]);

  if (data.length === 0) {
    return <div>Error: Table is empty</div>;
  }

  const columns = Object.keys(data[0]!.data);

  function addData() {
    const newData = Object.fromEntries(columns.map((c) => [c, ""]));
    setData([...data, { data: newData, id: nextId++ }]);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <table className="w-full">
        {columns.length > 1 && (
          <thead>
            <HeaderRow columns={columns} />
          </thead>
        )}
        <tbody>
          {data.map((row) => (
            <Row
              key={row.id}
              columns={columns}
              row={row}
              data={data}
              setData={setData}
              allowAdd={allowAdd}
            />
          ))}
        </tbody>
      </table>
      {allowAdd && (
        <button
          className="w-20 rounded-lg border-2 border-stone-500 bg-stone-100 px-2 py-1 font-bold"
          onClick={addData}
        >
          Add
        </button>
      )}
    </div>
  );
}

export default Table;
