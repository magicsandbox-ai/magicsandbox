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
  expect(rangeData1).toBe(`<range ref="Sheet1!A1">
A1,,Hello
</range>`);

  await app.evaluate(() => {
    app.api.setRange("Sheet1!A1:C3", "1");
    app.api.setRange("Sheet1!D1:D3", "=SUM(A1:C1)");
  });
  const rangeData2 = await getRange(app, "Sheet1!A1:D3");
  expect(rangeData2).toBe(`<range ref="Sheet1!A1:D3">
A1,,1|B1,,1|C1,,1|D1,=SUM(A1:C1),3
A2,,1|B2,,1|C2,,1|D2,=SUM(A2:C2),3
A3,,1|B3,,1|C3,,1|D3,=SUM(A3:C3),3
</range>`);

  //undo should undo both assistant setRange actions as a batch
  await app.getByRole("button", { name: "Undo" }).click();
  const rangeData3 = await getRange(app, "Sheet1!A1:D3");
  expect(rangeData3).toBe(`<range ref="Sheet1!A1:D3">
A1,,Hello|B1,,|C1,,|D1,,
A2,,|B2,,|C2,,|D2,,
A3,,|B3,,|C3,,|D3,,
</range>`);

  //redo should redo both assistant setRange actions as a batch
  await app.getByRole("button", { name: "Redo" }).click();
  const rangeData4 = await getRange(app, "Sheet1!A1:D3");
  expect(rangeData4).toBe(`<range ref="Sheet1!A1:D3">
A1,,1|B1,,1|C1,,1|D1,=SUM(A1:C1),3
A2,,1|B2,,1|C2,,1|D2,=SUM(A2:C2),3
A3,,1|B3,,1|C3,,1|D3,=SUM(A3:C3),3
</range>`);

  await app.evaluate(() => {
    app.api.clearRange("Sheet1!B1");
  });
  const rangeData5 = await getRange(app, "Sheet1!B1");
  expect(rangeData5).toBe(`<range ref="Sheet1!B1">
B1,,
</range>`);

  await app.evaluate(() => {
    app.api.clearRange("Sheet1!B2:B3");
  });
  const rangeData6 = await getRange(app, "Sheet1!B2:B3");
  expect(rangeData6).toBe(`<range ref="Sheet1!B2:B3">
B2,,
B3,,
</range>`);

  await app.evaluate(() => {
    //note: there's a bug in IronCalc where deleting columns A or C would create a reference error
    app.api.deleteColumns("Sheet1!B");
  });
  const rangeData7 = await getRange(app, "Sheet1!A1:C3");
  expect(rangeData7).toBe(`<range ref="Sheet1!A1:C3">
A1,,1|B1,,1|C1,=SUM(A1:B1),2
A2,,1|B2,,1|C2,=SUM(A2:B2),2
A3,,1|B3,,1|C3,=SUM(A3:B3),2
</range>`);

  await app.evaluate(() => {
    app.api.insertRows("Sheet1!2:3");
  });
  const rangeData8 = await getRange(app, "Sheet1!A1:C5");
  expect(rangeData8).toBe(`<range ref="Sheet1!A1:C5">
A1,,1|B1,,1|C1,=SUM(A1:B1),2
A2,,|B2,,|C2,,
A3,,|B3,,|C3,,
A4,,1|B4,,1|C4,=SUM(A4:B4),2
A5,,1|B5,,1|C5,=SUM(A5:B5),2
</range>`);

  await app.evaluate(() => {
    app.api.clearRange("Sheet1!A1:C5");
    app.api.setRange("Sheet1!B2", "1");
    app.api.fillRange("Sheet1!B2", "Sheet1!A1:C3");
  });
  const rangeData9 = await getRange(app, "Sheet1!A1:C3");
  expect(rangeData9).toBe(`<range ref="Sheet1!A1:C3">
A1,,1|B1,,1|C1,,1
A2,,1|B2,,1|C2,,1
A3,,1|B3,,1|C3,,1
</range>`);

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
    return app.api.getRange(range);
  }, range);
}
