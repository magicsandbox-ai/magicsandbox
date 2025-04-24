import { test, expect } from "@magicsandbox.ai/test";

/*
npm run test sheets

todos:
- test upload and download
*/

test("Sheets", async ({ app }) => {
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
