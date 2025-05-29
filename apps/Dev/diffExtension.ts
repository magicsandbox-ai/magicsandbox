import {
  StateField,
  Annotation,
  EditorState,
  Compartment,
  type ChangeSet,
  type Extension,
} from "@codemirror/state";
import {
  unifiedMergeView,
  originalDocChangeEffect,
  getChunks,
} from "@codemirror/merge";

const diffAnnotationType = Annotation.define<boolean>();

function diffExtension(changeSet: ChangeSet | undefined): Extension {
  const compartment = new Compartment();
  //stores the changeSet which represents the changes needed to transform the current document to the original document
  const changeSetStateField = StateField.define<ChangeSet | undefined>({
    create(editorState) {
      if (changeSet) {
        //activate the other extensions if initialized with a changeSet
        editorState.update({
          effects: compartment.reconfigure([
            originalDocUpdater,
            unifiedMergeView({ original: changeSet.apply(editorState.doc) }),
          ]),
        });
      }
      return changeSet;
    },
    update(currentChangeSet, tr) {
      if (tr.annotation(diffAnnotationType)) {
        //since we store the changes needed to go from current to original, we need to invert them
        const newChangeSet = tr.changes.invert(tr.startState.doc);
        if (currentChangeSet) {
          //if there's a current changeSet, we compose the changes
          return newChangeSet.compose(currentChangeSet);
        } else {
          //we didn't have a diff before, but now we do, so we need to activate the other extensions
          tr.state.update({
            effects: compartment.reconfigure([
              originalDocUpdater,
              unifiedMergeView({ original: tr.startState.doc }),
            ]),
          });
          return newChangeSet;
        }
      } else {
        //check if we need to deactivate the other extensions - if there are no chunks, we can
        const chunks = getChunks(tr.state);
        if (chunks?.chunks.length === 0) {
          tr.state.update({
            effects: compartment.reconfigure([]),
          });
          return undefined;
        } else {
          return currentChangeSet;
        }
      }
    },
  });
  //updates the original document for transactions that don't have a diff annotation
  const originalDocUpdater = EditorState.transactionExtender.of((tr) => {
    if (!tr.annotation(diffAnnotationType)) {
      const changeSet = tr.state.field(changeSetStateField);
      if (!changeSet) return null; //this should never happen as this extension is only active if there's a changeSet
      return {
        effects: originalDocChangeEffect(
          tr.startState,
          //we need to map the changes (which were made to the current document) so that they can be applied to the original document
          tr.changes.map(changeSet),
        ),
      };
    }
    return null;
  });
  return [changeSetStateField, compartment.of([])];
}

export { diffAnnotationType, diffExtension };
