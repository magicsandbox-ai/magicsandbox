import {
  StateField,
  EditorState,
  Text,
  type ChangeSet,
  type Extension,
} from "@codemirror/state";
import {
  unifiedMergeView,
  originalDocChangeEffect,
  getChunks,
} from "@codemirror/merge";

function diffExtension(changeSet: ChangeSet, doc: string): Extension {
  //stores the changeSet which represents the changes needed to transform the current document to the original document
  const changeSetStateField = StateField.define<ChangeSet | undefined>({
    create() {
      return changeSet;
    },
    //the changeSet has to be managed externally, as the API can update files that are not in the editor currently
    //so whenever the changeSet is updated, we reconfigure the extensions, so we don't need to worry about updating it here
    //however, we do want to check if there are no chunks, which means the user has accepted/rejected all diffs
    //that indicates to the external changeSet manager that the diff is no longer needed
    update(currentChangeSet, tr) {
      //there's some kind of race condition where the chunks are not updated immmediately
      //so we check if the start state has chunks and the current state does not
      if (
        //@ts-ignore
        getChunks(tr.startState)?.chunks.length > 0 &&
        getChunks(tr.state)?.chunks.length === 0
      ) {
        return undefined;
      } else {
        return currentChangeSet;
      }
    },
  });
  //updates the original document for transactions that don't have a diff annotation
  const originalDocUpdater = EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    const changeSet = tr.state.field(changeSetStateField, false);
    if (!changeSet) return tr;
    return [
      tr,
      {
        effects: originalDocChangeEffect(
          tr.startState,
          //we need to map the changes (which were made to the current document) so that they can be applied to the original document
          tr.changes.map(changeSet),
        ),
      },
    ];
  });
  return [
    changeSetStateField,
    originalDocUpdater,
    unifiedMergeView({ original: changeSet.apply(Text.of(doc.split("\n"))) }),
  ];
}

function applyChangeSet(changeSet: ChangeSet, file: string) {
  return changeSet.apply(Text.of(file.split("\n"))).toString();
}

export { diffExtension, applyChangeSet };
