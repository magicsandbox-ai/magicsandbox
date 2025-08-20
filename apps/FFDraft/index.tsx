import React, { useState, useEffect } from "react";
import WelcomeScreen from "./WelcomeScreen.tsx";
import DraftScreen from "./DraftScreen.tsx";
import { createRoot } from "react-dom/client";
//@ts-ignore
import rankingsCSV from "./rankings.csv";
import {
  type LeagueSettings,
  type State,
  type DraftType,
  type SavedDraft,
} from "./types.ts";
import { parsePlayersData } from "./utils.ts";

/*
todo later:
- react window or similar for AvailableTab
- User can edit ranks and icons in the UI without uploading their own CSV
- User can add custom columns in the UI that are displayed in the player card without uploading their own CSV
- User can enter a custom player name if a player is drafted who isn't in the rankings
- More robust Assistant context: summary of players drafted by team (i.e. to understand if every other player has drafted a QB already, the user should not be in a rush to draft a QB)
- User can edit team names on the welcome screen
- User can see other teams and who they've drafted
- Instead of just undoing the latest pick, user can edit an earlier pick by swapping in a different player in case of a mistake
*/

function getDefaultTeamNames(n: number) {
  return Array.from({ length: n }, (_, i) => `Team ${i + 1}`);
}

function init() {
  createRoot(document.getElementById("root")!).render(<App />);
}

const state: State = {};

function context() {
  let context = "The draft hasn't started yet.";
  if (state.getContext) {
    context = state.getContext();
  }
  return `# magicsandbox.FFDraft

This is an AI powered fantasy football draft app. Help the user draft the best team possible!

## Context

${context}

## Instructions

- Ask the user what their draft strategy is to inform your recommendations
- Inform the user that you may not know the latest information regarding players (e.g. injuries) and that recent news may not be reflected in the rankings
- Rely on your NFL knowledge when making recommendations. Share what you know, but if required, explain to the user that you don't have access to specific stats or other detailed information beyond the rankings in the app
- The current date is ${new Date().toLocaleDateString()}. Make sure your recommendations and reasoning are based on the upcoming NFL season
`;
}

function App() {
  const [screen, setScreen] = useState<"welcome" | "draft">("welcome");
  const [draftType, setDraftType] = useState<DraftType>("real");
  const [leagueSettings, setLeagueSettings] = useState<LeagueSettings>({
    teams: getDefaultTeamNames(12),
    draftPosition: 1, // 1-indexed
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    K: 1,
    DST: 1,
    BENCH: 7,
  });
  const [players, setPlayers] = useState(() => parsePlayersData(rankingsCSV));
  const [currentPick, setCurrentPick] = useState(1);
  const [currentDraftId, setCurrentDraftId] = useState<string>(
    String(Date.now()),
  );

  useEffect(() => {
    async function saveDraft(draft: SavedDraft) {
      try {
        await requestPutData(draft.draftId, draft);
      } catch (error) {
        console.error("Error saving draft:", error); //todo
      }
    }
    if (currentPick > 1) {
      saveDraft({
        draftId: currentDraftId,
        draftType,
        leagueSettings,
        players,
        currentPick,
        lastModified: Date.now(),
      });
    }
  }, [currentPick]);

  const handleStartDraft = async (type: DraftType) => {
    setDraftType(type);
    setScreen("draft");
  };

  const handleResumeDraft = (draft: SavedDraft) => {
    setDraftType(draft.draftType);
    setLeagueSettings(draft.leagueSettings);
    setPlayers(draft.players);
    setCurrentPick(draft.currentPick);
    setCurrentDraftId(draft.draftId);
    setScreen("draft");
  };

  const handleExitDraft = () => {
    setScreen("welcome");
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        draftedAt: undefined,
      })),
    );
    setCurrentPick(1);
    setCurrentDraftId(String(Date.now()));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="mx-auto max-w-xl">
        {screen === "welcome" ? (
          <WelcomeScreen
            leagueSettings={leagueSettings}
            setLeagueSettings={setLeagueSettings}
            players={players}
            setPlayers={setPlayers}
            getDefaultTeamNames={getDefaultTeamNames}
            onStartDraft={handleStartDraft}
            onResumeDraft={handleResumeDraft}
          />
        ) : (
          <DraftScreen
            state={state}
            draftType={draftType}
            leagueSettings={leagueSettings}
            players={players}
            setPlayers={setPlayers}
            currentPick={currentPick}
            setCurrentPick={setCurrentPick}
            onExitDraft={handleExitDraft}
          />
        )}
      </div>
    </div>
  );
}

export { init, context };
