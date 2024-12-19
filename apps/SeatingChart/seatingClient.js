/* global Papa d3 */

let guests;
const scores = []; //guests x guests matrix, score of how much they would like to sit together
const assignments = []; //table assignment for each guest
let tableAssignments = {}; //mapping from table to guests
const tableCapacities = [12, 12, 12, 12, 12, 12, 12, 12]; //guests allowed at each table
let imputedScores; //scores matrix with null values imputed
let nicknames;
let data;

function parseCsv(file, config) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      ...config,
      complete: resolve,
      error: reject,
    });
  });
}

document
  .getElementById('csvInput')
  .addEventListener('change', async function (event) {
    const file = event.target.files[0];
    if (file) {
      const result = await parseCsv(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });
      guests = result.data;
      init();
    }
  });

function sumArray(arr) {
  return arr.reduce((partialSum, a) => partialSum + a, 0);
}

function initialScores() {
  for (const i of guests) {
    /*
    score for party i and party j sitting together
    100: 3 left clicks - must sit
    5: 2 left - very good (use this for friends, groups are initialized with this)
    1: 1 left - good (for acquaintances or those who would get along)
    0 - neutral
    -10: 1 right - bad
    -100: 2 right - must be apart
    */
    const row = [];
    scores.push(row);
    for (const j of guests) {
      if (i.party === j.party) {
        row.push(100); //parties should always sit together
      } else if (i.group === j.group) {
        row.push(5); //groups are good to keep together
      } else {
        row.push(null);
      }
    }
  }
}

function initialAssignments() {
  const tableSizes = tableCapacities.map((c) =>
    Math.floor((guests.length / sumArray(tableCapacities)) * c)
  );
  const leftoverGuests = guests.length - sumArray(tableSizes);
  for (let i = 0; i < leftoverGuests; i++) {
    tableSizes[i] += 1;
  }
  let table = 0;
  let tableCount = 0;
  for (let i = 0; i < guests.length; i++) {
    if (tableCount < tableSizes[table]) {
      assignments[i] = table;
      tableCount += 1;
    } else {
      assignments[i] = table + 1;
      table += 1;
      tableCount = 1;
    }
  }
}

function appendOrCreateArray(obj, key, val) {
  if (obj[key]) {
    obj[key].push(val);
  } else {
    obj[key] = [val];
  }
}

function calcTableAssignments() {
  tableAssignments = {}; //{k: [i, i, i]}
  assignments.forEach((k, i) => {
    appendOrCreateArray(tableAssignments, k, i);
  });
}

function makeInitialNicknames(guests) {
  const out = {};
  guests.forEach((g) => {
    appendOrCreateArray(out, g.name.split(' ')[0], g.name);
  });
  return out; //{nickname: [name]}
}

function makeNicknamesUnique(nicknames) {
  const out = Object.fromEntries(
    Object.entries(nicknames)
      // eslint-disable-next-line no-unused-vars
      .filter(([k, v]) => v.length === 1) //nickname is unique
      .map(([k, v]) => [v[0], k])
  ); //return {name: nickname} object
  // eslint-disable-next-line no-unused-vars
  const dupes = Object.entries(nicknames).filter(([k, v]) => v.length > 1);

  function addLetterToNicknames(entries) {
    const out = {};
    entries.forEach(([nickname, names]) => {
      const outOfLetters = names.filter((n) => n !== nickname).length === 0;
      names.forEach((name, i) => {
        const newNickname =
          nickname + (outOfLetters ? i : name[nickname.length] || '');
        appendOrCreateArray(out, newNickname, name);
      });
    });
    return out;
  }

  if (dupes.length === 0) {
    return out; //{name: nickname}
  } else {
    return {
      ...out,
      ...makeNicknamesUnique(addLetterToNicknames(dupes)),
    };
  }
}

function init() {
  if (guests.length > sumArray(tableCapacities)) {
    console.error('Too many guests to fit at your tables.'); //todo
  }
  //sort by group and party to get good initial assignments
  guests.sort((a, b) => {
    if (a.group < b.group) {
      return -1;
    } else if (a.group > b.group) {
      return 1;
    } else if (a.party < b.party) {
      return -1;
    } else if (a.party > b.party) {
      return 1;
    }
    return 0;
  });

  initialScores();
  initialAssignments();
  calcTableAssignments();
  nicknames = makeNicknamesUnique(makeInitialNicknames(guests)); //{name: nickname}
  viz();
}

function impute(scores) {
  /*
    what does person i think of person j if scores[i, j] is null?
    weighted average of what person i's neighbors think of person j
    todo iterate this multiple times?
    */
  const out = JSON.parse(JSON.stringify(scores)); //clone
  for (let i = 0; i < scores.length; i++) {
    for (let j = 0; j < scores.length; j++) {
      if (scores[i][j] == null) {
        let s = 0;
        let w = 0;
        for (let k = 0; k < scores.length; k++) {
          if (scores[i][k] > 0) {
            s += scores[i][k] * (scores[k][j] === null ? 0 : scores[k][j]);
            w += scores[i][k];
          }
        }
        out[i][j] = s / w;
      }
    }
  }
  return out;
}

function handleScoreChange(newScore, i, j) {
  const oldScore = scores[i][j];
  scores[i][j] = newScore;
  scores[j][i] = newScore;
  imputedScores = impute(scores);
  let newAssignments;
  if (newScore > oldScore && assignments[i] !== assignments[j]) {
    ({ newAssignments } = join(i, j));
  } else if (newScore < oldScore && assignments[i] === assignments[j]) {
    ({ newAssignments } = separate(i, j));
  }
  updateAssignments(newAssignments);
  viz();
}

function join(i, j) {
  //joins i with j's table or vice versa, whichever is better
  const res1 = subJoin(i, j);
  const res2 = subJoin(j, i);
  if (res1.objectiveChange > res2.objectiveChange) {
    return res1;
  }
  return res2;
}

function subJoin(i, j) {
  //move i from their table to j's table
  const fromTable = assignments[i];
  const toTable = assignments[j];
  const candidates = tableAssignments[toTable].filter((x) => x !== j);
  let bestCandidate = null;
  let bestScore = -1000000000;
  for (const candidate of candidates) {
    //candidate to move from toTable to fromTable
    const candidateScore = score(i, candidate);
    if (candidateScore > bestScore) {
      bestCandidate = candidate;
      bestScore = candidateScore;
    }
  }
  const newAssignments = {};
  newAssignments[i] = toTable;
  newAssignments[bestCandidate] = fromTable;
  return { newAssignments: newAssignments, objectiveChange: bestScore };
}

function score(i, j) {
  //score swapping i and j
  const fromTable = assignments[i];
  const toTable = assignments[j];
  const fromTableParties = tableAssignments[fromTable].filter((x) => x !== i);
  const toTableParties = tableAssignments[toTable].filter((x) => x !== j);
  let s = 0;
  for (const fromTableParty of fromTableParties) {
    s += imputedScores[j][fromTableParty]; //add score of j joining
    s -= imputedScores[i][fromTableParty]; //subtract score of i leaving
  }
  for (const toTableParty of toTableParties) {
    s += imputedScores[i][toTableParty]; //add score of i joining
    s -= imputedScores[j][toTableParty]; //subtract score of j leaving
  }
  return s;
}

function separate(i, j) {
  //move i away from j's table or vice versa, whichever is better
  const res1 = subSeparate(i);
  const res2 = subSeparate(j);
  if (res1.objectiveChange > res2.objectiveChange) {
    return res1;
  }
  return res2;
}

function subSeparate(i) {
  //move i away from their table by finding them a new friend to sit with
  let newFriend;
  let newFriendScore = -1000000000;
  for (let k = 0; k < guests.length; k++) {
    if (
      imputedScores[i][k] > newFriendScore &&
      assignments[i] !== assignments[k]
    ) {
      newFriend = k;
      newFriendScore = imputedScores[i][k];
    }
  }
  return join(i, newFriend);
}

function updateAssignments(newAssignments) {
  Object.keys(newAssignments).forEach((x) => {
    assignments[x] = newAssignments[x];
  });
  calcTableAssignments();
}

function anneal() {
  const maxIter = 1000;
  for (let n = 0; n < maxIter; n++) {
    const i = Math.round(Math.random * guests.length);
    const j = Math.round(Math.random * guests.length);
    if (assignments[i] !== assignments[j]) {
      const { newAssignments, objectiveChange } = join(i, j);
      const T = 1 - n / maxIter;
      if (objectiveChange > 0 || Math.random() < Math.exp(objectiveChange / T))
        updateAssignments(newAssignments);
    }
  }
  viz();
}

function viz() {
  data = guests.map((g, i) => ({
    name: nicknames[g.name],
    table: assignments[i] + 1, //1 based index
  }));
  console.log(data);

  const tableGroups = d3.group(data, (d) => d.table);

  const numTables = tableGroups.size;
  const maxNumSeats = Math.max(
    ...Object.values(tableAssignments).map((t) => t.length)
  );
  const width = 1000;
  const height = 500;
  const tableRadius = 90;
  const seatRadius = Math.min(360 / maxNumSeats, 30);
  const totalTableRadius = tableRadius + seatRadius * 2;
  const tablesPerRow = 6;
  const gap = (width - tablesPerRow * totalTableRadius) / (tablesPerRow + 1);

  /*
  rows * columns >= tables
  columns <= 2 * rows
  1: 1x1
  2: 1x2
  3: 2x2
  4: 2x2
  5: 2x3
  6: 2x3
  7: 2x4
  8: 2x4
  9: 3x3
  10: 3x4
  12: 3x4
  */

  function getNumRowsCols(numTables, width, height) {
    const aspectRatio = width / height;
    const rowsFloat = Math.sqrt(numTables / aspectRatio);
    const rowsFloor = Math.max(Math.floor(rowsFloat), 1);
    const colsRowsFloor = Math.ceil(numTables / rowsFloor);
    const rowsCeil = Math.ceil(rowsFloat);
    const colsRowsCeil = Math.ceil(numTables / rowsCeil);
    if (
      Math.abs(colsRowsFloor / rowsFloor - aspectRatio) <
      Math.abs(colsRowsCeil / rowsCeil - aspectRatio)
    ) {
      return [rowsFloor, colsRowsFloor];
    } else {
      return [rowsCeil, colsRowsCeil];
    }
  }

  const svg = d3
    .select('#viz')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%');

  const tables = svg
    .selectAll('g')
    .data(tableGroups)
    .enter()
    .append('g')
    .attr(
      'transform',
      (d, i) =>
        `translate(${(i + 1) * gap + (i + 0.5) * totalTableRadius}, ${0})`
    );

  // Draw tables
  tables
    .append('circle')
    .attr('r', tableRadius)
    .attr('fill', '#f0f0f0')
    .attr('stroke', '#000');

  // Add table numbers
  tables
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.3em')
    .text((d) => `Table ${d[0]}`);

  // Draw seats
  tables.each(function (d) {
    const seats = d3
      .select(this)
      .selectAll('.seat')
      .data(d[1])
      .enter()
      .append('g')
      .attr('class', 'seat')
      .attr('transform', (_, i) => {
        const angle = (i / d[1].length) * 2 * Math.PI;
        return `translate(${(tableRadius + seatRadius) * Math.cos(angle)}, ${(tableRadius + seatRadius) * Math.sin(angle)})`;
      });

    seats
      .append('circle')
      .attr('r', seatRadius)
      .attr('fill', '#fff')
      .attr('stroke', '#000');

    seats
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .text((d) => d.name);
  });
}

/*
display HTML rather than command line, run in devtools
UI
 undo button
 input table capacities
error popup if not enough capacity
*/
