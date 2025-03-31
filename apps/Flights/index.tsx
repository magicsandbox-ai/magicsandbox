import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { FlightsState, Flight } from "./FlightsState.ts";

let api, flightsState: FlightsState;

async function init() {
  flightsState = new FlightsState();
  createRoot(document.getElementById("root")!).render(<App />);
  return flightsState.context(true);
}

function App() {
  const flights = useSyncExternalStore<Flight[]>(
    flightsState.subscribe("flights"),
    flightsState.getSnapshot("flights"),
  );
  return (
    <div>
      <button onClick={() => flightsState.search()}>Search</button>
      {flights.map((flight) => (
        <div key={flight.id}>{flight.id}</div>
      ))}
    </div>
  );
}

function context() {
  return flightsState.context();
}

export { init, context, api };
