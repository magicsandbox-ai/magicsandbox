import {
  EditorState,
  Text,
  Annotation,
  type ChangeSet,
  type Extension,
} from "@codemirror/state";
import {
  unifiedMergeView,
  getChunks,
  updateOriginalDoc,
  getOriginalDoc,
} from "@codemirror/merge";
import type { DevState } from "./DevState.ts";

const externalAnnotationType = Annotation.define<boolean>();

function diffExtension(
  devState: DevState,
  changeSet: ChangeSet,
  doc: string,
): Extension {
  //manages the changeSet, which is the set of changes needed to transform the current document to the original document
  //and updates the original document for non-external transactions (i.e. the user typing in the editor)
  const diffHandler = EditorState.transactionFilter.of((tr) => {
    //changing the selection triggers a transaction - ignore these
    //unless the transaction is updating the original document without changing the document (when the user accepts a diff)
    if (!tr.docChanged && !tr.effects.some((e) => e.is(updateOriginalDoc))) {
      return tr;
    }
    //ignore an external change (i.e. the app's api) - the external change is responsible for updating the changeSet
    if (tr.annotation(externalAnnotationType)) return tr;
    const changeSet =
      devState.selectedApp.files[devState.selectedApp.selectedFileName]
        ?.changeSet;
    if (!changeSet) return tr;
    //check if we should deactivate the changeSet - if there are no chunks in the new state, then the user has accepted/rejected all diffs
    if (
      getChunks(tr.startState)?.chunks.length === 1 &&
      (tr.isUserEvent("accept") || tr.isUserEvent("revert"))
    ) {
      devState.updateFile({ changeSet: undefined });
      return tr;
    }
    //update the changeSet based on the current transaction
    devState.updateFile({
      changeSet: changeSet.map(tr.changes),
    });
    const originalDocChanges = tr.changes.map(changeSet);
    return [
      tr,
      {
        effects: updateOriginalDoc.of({
          doc: originalDocChanges.apply(getOriginalDoc(tr.startState)),
          changes: originalDocChanges,
        }),
      },
    ];
  });
  return [
    diffHandler,
    unifiedMergeView({ original: changeSet.apply(Text.of(doc.split("\n"))) }),
  ];
}

export { diffExtension, externalAnnotationType };
