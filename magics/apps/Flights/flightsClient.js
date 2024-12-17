import React from 'react';
import ReactDOM from 'react-dom';
import { useImmer } from 'use-immer';

function Title() {
  return (
    <h1>
      Flights from {window.state.origin} to {window.state.destination}
    </h1>
  );
}

function Flights() {
  return (
    <ul>
      {window.state.flights.map((f, i) => (
        <li key={i}>{f}</li>
      ))}
    </ul>
  );
}

function App() {
  const [state, updateState] = useImmer(null);
  window.state = state;
  window.updateState = updateState;
  return (
    <div>
      <Title />
      <Flights />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

//window.updateState(data);
