import React, { useState } from "react";
import WelcomeScreen from "./WelcomeScreen.tsx";
import DraftScreen from "./DraftScreen.tsx";
import { createRoot } from "react-dom/client";
//@ts-ignore
import rankingsCSV from "./rankings.csv";
import {
  type LeagueSettings,
  type Player,
  type State,
  isValidPosition,
} from "./types.ts";

/*
todos:
- When clicking on a player, it opens a player card in a modal
- Show depth chart in player card
- Mock draft mode
- Draft state is saved - on welcome screen, user can start a new draft or resume an earlier one
- User can download rankings and upload their own CSV

maybe later:
- User can edit ranks and icons in the UI without uploading their own CSV
- User can add custom columns in the UI that are displayed in the player card without uploading their own CSV
- User can enter a custom player name if a player is drafted who isn't in the rankings
- More robust Assistant context: summary of players drafted by team (i.e. to understand if every other player has drafted a QB already, the user should not be in a rush to draft a QB)
- User can edit team names on the welcome screen
- User can see other teams and who they've drafted
- Instead of just undoing the latest pick, user can edit an earlier pick by swapping in a different player in case of a mistake
*/

// Parse CSV data once - this only needs to run once, not on every render
const parsePlayersData = (): Player[] => {
  const lines = (rankingsCSV as string).trim().split("\n");
  const headers = lines[0]!.split(",");
  let playerIndex: number | undefined;
  let teamIndex: number | undefined;
  let posIndex: number | undefined;
  let iconIndex: number | undefined;
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]!.trim().toLowerCase();
    if (header === "player") {
      playerIndex = i;
    } else if (header === "team") {
      teamIndex = i;
    } else if (header === "pos") {
      posIndex = i;
    } else if (header === "icon") {
      iconIndex = i;
    }
  }
  if (
    playerIndex === undefined ||
    teamIndex === undefined ||
    posIndex === undefined
  ) {
    throw new Error("Missing required headers in CSV");
  }
  return lines
    .slice(1)
    .map((line, index) => {
      const values = line.split(",");
      const playerName = values[playerIndex];
      const team = values[teamIndex];
      const pos = values[posIndex];
      if (playerName === undefined || team === undefined) {
        return undefined; //todo better empty row handling - check if entire row is empty
      }
      if (!isValidPosition(pos)) {
        throw new Error(`Invalid position: ${pos} in row ${index + 1}`);
      }
      const player: Player = {
        player: playerName,
        team,
        pos,
        rank: index + 1, // rank is the row number (1-indexed)
        draftedAt: undefined, // pick number when drafted (1-indexed), undefined if not drafted
      };
      if (iconIndex !== undefined) {
        player.icon = values[iconIndex];
      }
      return player;
    })
    .filter((player) => player !== undefined); // filter out any empty rows
};

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
`;
}

function App() {
  const [screen, setScreen] = useState<"welcome" | "draft">("welcome");
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
  const [players, setPlayers] = useState(() => parsePlayersData());
  const [currentPick, setCurrentPick] = useState(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="mx-auto max-w-xl">
        {screen === "welcome" ? (
          <WelcomeScreen
            leagueSettings={leagueSettings}
            setLeagueSettings={setLeagueSettings}
            getDefaultTeamNames={getDefaultTeamNames}
            onStartDraft={() => setScreen("draft")}
          />
        ) : (
          <DraftScreen
            state={state}
            leagueSettings={leagueSettings}
            players={players}
            setPlayers={setPlayers}
            currentPick={currentPick}
            setCurrentPick={setCurrentPick}
            onExitDraft={() => {
              setScreen("welcome");
              setPlayers(parsePlayersData());
              setCurrentPick(1);
            }}
          />
        )}
      </div>
    </div>
  );
}

export { init, context };
