import {
  StateField,
  Annotation,
  EditorState,
  type Text,
  type ChangeSet,
} from "@codemirror/state";
import { unifiedMergeView, originalDocChangeEffect } from "@codemirror/merge";

const diffAnnotationType = Annotation.define<boolean>();

function diffExtension(doc: Text, changeSet: ChangeSet) {
  //stores the changeSet which represents the changes needed to transform the current document to the original document
  const changeSetStateField = StateField.define<ChangeSet>({
    create() {
      return changeSet;
    },
    update(value, tr) {
      if (tr.annotation(diffAnnotationType)) {
        //since we store the changes needed to go from current to original, we need to invert them
        //then compose them with the current changeSet
        return tr.changes.invert(tr.startState.doc).compose(value);
      }
      return value;
    },
  });
  //updates the original document for transactions that don't have a diff annotation
  const originalDocUpdater = EditorState.transactionExtender.of((tr) => {
    if (!tr.annotation(diffAnnotationType)) {
      return {
        effects: originalDocChangeEffect(
          tr.startState,
          //we need to map the changes (which were made to the current document) so that they can be applied to the original document
          tr.changes.map(tr.state.field(changeSetStateField)),
        ),
      };
    }
    return null;
  });
  return [
    changeSetStateField,
    originalDocUpdater,
    unifiedMergeView({ original: changeSet.apply(doc) }),
  ];
}

export { diffAnnotationType, diffExtension };
