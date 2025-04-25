import { test, expect } from "@magicsandbox.ai/test";

/*
npm run test sheets

todos:
- test upload and download
*/

//init waits for the wasm to initialize, so we'll disable autoInit and wait for init before testing
test.use({ appOptions: { autoInit: false } });

test("Sheets", async ({ app }) => {
  await app.evaluate(async () => {
    return await app.init();
  });

  await app.evaluate(() => {
    app.api.setRange("Sheet1!A1", "Hello");
  });
  const rangeData1 = await getRange(app, "Sheet1!A1");
  expect(rangeData1[1][1].value).toBe("Hello");

  await app.evaluate(() => {
    app.api.setRange("Sheet1!A1:C3", "1");
    app.api.setRange("Sheet1!D1:D3", "=SUM(A1:C1)");
  });
  const rangeData2 = await getRange(app, "Sheet1!A1:D3");
  expect(rangeData2[1][1].value).toBe("1");
  expect(rangeData2[1][4].value).toBe("3");
  expect(rangeData2[3][4].value).toBe("3");
  expect(rangeData2[3][4].formula).toBe("=SUM(A3:C3)");

  //undo should undo both assistant setRange actions as a batch
  await app.getByRole("button", { name: "Undo" }).click();
  const rangeData3 = await getRange(app, "Sheet1!A1:D3");
  expect(Object.keys(rangeData3).length).toBe(0);

  //redo should redo both assistant setRange actions as a batch
  await app.getByRole("button", { name: "Redo" }).click();
  const rangeData4 = await getRange(app, "Sheet1!A1:D3");
  expect(rangeData4[1][1].value).toBe("1");
  expect(rangeData4[1][4].value).toBe("3");
  expect(rangeData4[3][4].value).toBe("3");
  expect(rangeData4[3][4].formula).toBe("=SUM(A3:C3)");

  await app.evaluate(() => {
    app.api.clearRange("Sheet1!B1");
  });
  const rangeData5 = await getRange(app, "Sheet1!B1");
  expect(rangeData5[1][2]).toBeUndefined();

  await app.evaluate(() => {
    app.api.clearRange("Sheet1!B2:B3");
  });
  const rangeData6 = await getRange(app, "Sheet1!B2:B3");
  expect(rangeData6[2][2]).toBeUndefined();
  expect(rangeData6[3][2]).toBeUndefined();

  await app.evaluate(() => {
    //note: there's a bug in IronCalc where deleting columns A or C would create a reference error
    app.api.deleteColumns("Sheet1!B");
  });
  const rangeData7 = await getRange(app, "Sheet1!A1:C3");
  expect(rangeData7[1][1].value).toBe("1");
  expect(rangeData7[1][3].value).toBe("2");

  await app.evaluate(() => {
    app.api.insertRows("Sheet1!2:3");
  });
  const rangeData8 = await getRange(app, "Sheet1!A1:C5");
  expect(rangeData8[1][1].value).toBe("1");
  expect(rangeData8[1][3].value).toBe("2");
  expect(rangeData8[2]).toBeUndefined();
  expect(rangeData8[5][3].value).toBe("2");

  await app.evaluate(() => {
    app.api.addSheet("API Sheet");
  });
  await expect(app.getByText("API Sheet")).toBeVisible();

  await app.evaluate(() => {
    app.api.renameSheet("API Sheet", "Renamed Sheet");
  });
  await expect(app.getByText("Renamed Sheet")).toBeVisible();

  await app.evaluate(() => {
    app.api.deleteSheet("Renamed Sheet");
  });
  await expect(app.getByText("Renamed Sheet")).not.toBeVisible();
});

async function getRange(app, range) {
  return await app.evaluate((range) => {
    const rangeData = app.api.getRange(range);
    // rangeData is Map<number, Map<number, CellData>>;
    // convert to an object so Playwright can serialize it
    const serializable = Object.fromEntries(
      Array.from(rangeData).map(([rowKey, rowMap]) => [
        rowKey,
        Object.fromEntries(rowMap),
      ]),
    );
    return serializable;
  }, range);
}
