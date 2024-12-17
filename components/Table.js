import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

const tdStyle = 'border border-stone-500 text-center';

function HeaderRow({ columns }) {
  return (
    <tr>
      {columns.map((column, i) => (
        <th key={i} className={tdStyle + ' bg-stone-100 px-2'}>
          {column}
        </th>
      ))}
    </tr>
  );
}

function Row({ columns, row, data, setData, allowAdd }) {
  return (
    <tr>
      {columns.map((column, i) => (
        <Cell
          key={i}
          id={row.id}
          column={column}
          value={row[column]}
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
          </button>
        </td>
      )}
    </tr>
  );
}

function Cell({ id, column, value, data, setData }) {
  function handleChange(event) {
    setData(
      data.map((row) =>
        row.id === id ? { ...row, [column]: event.target.value } : row
      )
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
      />
    </td>
  );
}

let nextId = 0;

function Table({ initData, onChange, allowAdd }) {
  const [data, setData] = useState(
    initData.map((d) => ({ ...d, id: nextId++ }))
  );

  useEffect(() => {
    onChange(data);
  }, [data]);

  if (data.length === 0) {
    return <div>Error: Table is empty</div>;
  }

  const columns = Object.keys(data[0]).filter((c) => c !== 'id');

  function addData() {
    const newData = Object.fromEntries(columns.map((c) => [c, '']));
    setData([...data, { ...newData, id: nextId++ }]);
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
