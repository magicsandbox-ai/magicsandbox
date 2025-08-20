import React, { useState, useEffect } from "react";
import Modal from "./Modal.tsx";
import { type SavedDraft } from "./types.ts";
import { Clock, Trophy, Trash2 } from "lucide-react";
import { getRoundFromPick } from "./utils.ts";

export default function SavedDraftsModal({
  isOpen,
  onClose,
  onResumeDraft,
}: {
  isOpen: boolean;
  onClose: () => void;
  onResumeDraft: (draft: SavedDraft) => void;
}) {
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSavedDrafts();
    }
  }, [isOpen]);

  const loadSavedDrafts = async () => {
    setLoading(true);
    try {
      const allData = await requestGetAllData();
      const drafts = Object.values(allData)
        .filter((value) => value?.draftId)
        .sort((a, b) => b.lastModified - a.lastModified) as SavedDraft[];
      setSavedDrafts(drafts);
    } catch (error) {
      console.error("Error loading saved drafts:", error); //todo
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      await requestDeleteData(draftId);
      setSavedDrafts((prev) =>
        prev.filter((draft) => draft.draftId !== draftId),
      );
    } catch (error) {
      console.error("Error deleting draft:", error); //todo
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resume Draft">
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading saved drafts...</div>
          </div>
        ) : savedDrafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Trophy className="mb-2 h-12 w-12 opacity-50" />
            <div className="text-center">
              <div className="font-medium">No saved drafts</div>
              <div className="text-sm">
                Start a draft to see saved drafts here
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {savedDrafts.map((draft) => (
              <div
                key={draft.draftId}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => onResumeDraft(draft)}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {`${draft.leagueSettings.teams.length} Team ${
                        draft.draftType === "real" ? "Draft" : "Mock"
                      }, Pick ${draft.leagueSettings.draftPosition}, Round ${getRoundFromPick(
                        draft.leagueSettings,
                        draft.currentPick,
                      )}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>
                      {new Date(draft.lastModified).toLocaleString([], {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDraft(draft.draftId);
                  }}
                  className="ml-3 rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="Delete draft"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
