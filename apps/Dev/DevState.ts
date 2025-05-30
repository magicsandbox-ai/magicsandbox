import SyncExternalStore from "@utils/SyncExternalStore.ts";
import { ChangeSet } from "@codemirror/state";

type Props = {
  selectedFilename: string;
  changeSets: Record<string, ChangeSet>;
};

class DevState extends SyncExternalStore<Props> {
  constructor(defaultProps: Props) {
    super(defaultProps);
  }
  updateChangeSets(
    update: Record<string, ChangeSet | undefined> | ChangeSet | undefined,
  ) {
    if (update === undefined) {
      this.set(
        "changeSets",
        Object.fromEntries(
          Object.entries(this.get("changeSets")).filter(
            ([key]) => key !== this.get("selectedFilename"),
          ),
        ),
      );
    } else if (update instanceof ChangeSet) {
      this.set("changeSets", {
        ...this.get("changeSets"),
        [this.get("selectedFilename")]: update,
      });
    } else {
      const keysToRemove = new Set(
        Object.entries(update)
          .filter(([, value]) => value === undefined)
          .map(([key]) => key),
      );
      const newChangeSets = Object.fromEntries(
        Object.entries(update).filter(([, value]) => value !== undefined),
      ) as Record<string, ChangeSet>;
      this.set("changeSets", {
        ...Object.fromEntries(
          Object.entries(this.get("changeSets")).filter(
            ([key]) => !keysToRemove.has(key),
          ),
        ),
        ...newChangeSets,
      });
    }
  }
}

export { DevState };
