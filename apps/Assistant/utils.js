/* global requestGetAllKeysData, requestGetAllData, requestPutData, requestDeleteData */
import { ToastError } from "@components/Toasts.js";

function parseInput(input, bangs) {
  const match = input.match(/!\S+/);
  let bang = match ? match[0] : undefined;
  let app;
  if (bang) {
    input = input.replace(new RegExp(`\\s*${bang}\\s*`, "g"), "");
    if (bang === "!magic") {
      return { input, magic: true };
    }
    bang = bang.replace("!", "");
    app = bangs[bang] || (bang.includes(".") ? bang : undefined);
    if (!app) {
      throw new ToastError(
        `Unknown bang: ${bang}. Configure bangs by clicking the exclamation mark icon below`,
        "error",
      );
    }
    return { input, app };
  }
  return { input };
}

/**
 * Keeps one backup per app in each time range:
 *
 * [now - 10 mins ago], [10 mins ago - 30 mins ago], [30 mins ago - 70 mins ago], ..., [~3.5 days ago - 7 days ago]
 *
 * Takes a backup if one hasn't been taken in the last 10 mins
 *
 * - apps: string[]
 */
async function manageBackups(apps, toastsRef) {
  function errorHandler(error) {
    console.error(error);
    toastsRef.current.addToast("Assistant failed to backup data", "error");
  }
  try {
    const backups = await requestGetAllKeysData("magicsandbox.Assistant", {
      backup: true,
    });
    const appBackups = Object.fromEntries(apps.map((app) => [app, []]));
    const appsSet = new Set(apps);
    backups.forEach((key) => {
      const [app, ts] = key.split("@");
      if (appsSet.has(app)) {
        appBackups[app].push(ts);
      }
    });
    const backupsToTake = [];
    const backupsToDelete = [];
    Object.entries(appBackups).forEach(([app, tsArray]) => {
      tsArray.sort((a, b) => b - a); //descending
      let maxTs = Date.now();
      let minTs = maxTs - 1000 * 60 * 10;
      const minMinTs = Date.now() - 1000 * 60 * 60 * 24 * 7;
      if (tsArray[0] || 0 < minTs) {
        backupsToTake.push(app);
      }
      function updateMinMaxTs(minTs, maxTs) {
        const prevMinTs = minTs;
        minTs = minTs - (maxTs - minTs) * 2;
        return [minTs, prevMinTs];
      }
      let i = 0;
      while (i < tsArray.length) {
        const ts = tsArray[i];
        if (ts < minMinTs) {
          backupsToDelete.push(`${app}@${ts}`);
          i++;
        } else if (ts < minTs) {
          [minTs, maxTs] = updateMinMaxTs(minTs, maxTs);
        } else if (ts >= minTs && ts < maxTs) {
          [minTs, maxTs] = updateMinMaxTs(minTs, maxTs);
          i++;
        } else {
          backupsToDelete.push(`${app}@${ts}`);
          i++;
        }
      }
    });
    await Promise.all(
      backupsToTake.map(async (app) => {
        const data = await requestGetAllData(app);
        if (data) {
          await requestPutData(
            "magicsandbox.Assistant",
            `${app}@${Date.now()}`,
            data,
            {
              evictionPolicy: "fifo",
              backup: true,
            },
          );
        }
      }),
    );
    for (const key of backupsToDelete) {
      requestDeleteData("magicsandbox.Assistant", key, { backup: true }).catch(
        errorHandler,
      );
    }
  } catch (error) {
    errorHandler(error);
  }
}

export { parseInput, manageBackups };
