const SUPABASE_URL = "https://fvigyywkoigqmzwrzvgr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5s6yCRGS2mGFpsf3yWygIg_EeBqK_Q2";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const state = { players: [], games: [], refreshTimer: null };
const el = (id) => document.getElementById(id);

function setStatus(type, text) {
  el("connectionStatus").className = `status ${type}`;
  el("connectionStatus").lastElementChild.textContent = text;
}

let toastTimer;
function toast(message, isError = false) {
  const node = el("toast");
  node.textContent = message;
  node.className = `toast show${isError ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.className = "toast"; }, 3000);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

async function loadData({ quiet = false } = {}) {
  if (!quiet) setStatus("", "Syncing…");
  const [playersResult, gamesResult] = await Promise.all([
    db.from("players").select("id,name,created_at").order("name"),
    db.from("games").select("id,player_one_id,player_two_id,winner_id,played_at").order("played_at", { ascending: false })
  ]);

  const error = playersResult.error || gamesResult.error;
  if (error) {
    console.error(error);
    setStatus("error", "Setup needed");
    toast("Could not load data. Run supabase-setup.sql first.", true);
    return;
  }

  state.players = playersResult.data || [];
  state.games = gamesResult.data || [];
  render();
  setStatus("online", "Live & synced");
}

function standings() {
  const rows = new Map(state.players.map((player) => [player.id, {
    ...player, wins: 0, losses: 0, games: 0, points: 0, winPct: 0
  }]));

  state.games.forEach((game) => {
    const one = rows.get(game.player_one_id);
    const two = rows.get(game.player_two_id);
    if (!one || !two) return;
    one.games += 1;
    two.games += 1;
    const winner = game.winner_id === one.id ? one : two;
    const loser = game.winner_id === one.id ? two : one;
    winner.wins += 1;
    winner.points += 3;
    loser.losses += 1;
  });

  rows.forEach((row) => { row.winPct = row.games ? (row.wins / row.games) * 100 : 0; });
  return [...rows.values()].sort((a, b) =>
    b.points - a.points || b.winPct - a.winPct || b.wins - a.wins || a.name.localeCompare(b.name)
  );
}

function renderLeaderboard(rows) {
  el("leaderboardEmpty").hidden = rows.length > 0;
  el("leaderboardBody").innerHTML = rows.map((row, index) => {
    const medal = ["🥇", "🥈", "🥉"][index] || index + 1;
    return `<tr>
      <td class="rank ${index < 3 ? "top" : ""}">${medal}</td>
      <td><div class="player-cell"><span class="avatar">${escapeHtml(row.name.charAt(0).toUpperCase())}</span>${escapeHtml(row.name)}</div></td>
      <td>${row.wins}</td><td>${row.losses}</td><td>${Math.round(row.winPct)}%</td><td class="points">${row.points}</td>
    </tr>`;
  }).join("");
}

function renderPlayerOptions() {
  const currentOne = el("playerOne").value;
  const currentTwo = el("playerTwo").value;
  const options = state.players.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  el("playerOne").innerHTML = `<option value="">Select player</option>${options}`;
  el("playerTwo").innerHTML = `<option value="">Select player</option>${options}`;
  if (state.players.some((p) => p.id === currentOne)) el("playerOne").value = currentOne;
  if (state.players.some((p) => p.id === currentTwo)) el("playerTwo").value = currentTwo;
  updateWinnerOptions();
}

function updateWinnerOptions() {
  const one = state.players.find((p) => p.id === el("playerOne").value);
  const two = state.players.find((p) => p.id === el("playerTwo").value);
  const valid = one && two && one.id !== two.id;
  el("winner").disabled = !valid;
  el("winner").innerHTML = valid
    ? `<option value="">Select winner</option><option value="${one.id}">${escapeHtml(one.name)}</option><option value="${two.id}">${escapeHtml(two.name)}</option>`
    : `<option value="">${one && two && one.id === two.id ? "Players must be different" : "Choose both players first"}</option>`;
}

function renderHistory() {
  const players = new Map(state.players.map((p) => [p.id, p.name]));
  const games = state.games.slice(0, 10);
  el("historyEmpty").hidden = games.length > 0;
  el("gameHistory").innerHTML = games.map((game) => {
    const one = players.get(game.player_one_id) || "Unknown";
    const two = players.get(game.player_two_id) || "Unknown";
    const winner = players.get(game.winner_id) || "Unknown";
    return `<article class="history-item">
      <div><span class="win-tag">WINNER</span><div class="matchup"><span class="winner-name">${escapeHtml(winner)}</span> defeated ${escapeHtml(winner === one ? two : one)}</div></div>
      <time class="game-time" datetime="${game.played_at}">${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(game.played_at))}</time>
    </article>`;
  }).join("");
}

function render() {
  const rows = standings();
  renderLeaderboard(rows);
  renderPlayerOptions();
  renderHistory();
  el("playerCount").textContent = state.players.length;
  el("gameCount").textContent = state.games.length;
  el("leaderName").textContent = rows[0]?.name || "—";
}

el("playerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = el("playerName");
  const name = input.value.trim().replace(/\s+/g, " ");
  if (name.length < 2) return toast("Enter at least 2 characters.", true);
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  const { error } = await db.from("players").insert({ name });
  button.disabled = false;
  if (error) {
    const duplicate = error.code === "23505";
    return toast(duplicate ? "That player already exists." : error.message, true);
  }
  input.value = "";
  toast(`${name} joined the roster.`);
  await loadData({ quiet: true });
});

el("gameForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const playerOne = el("playerOne").value;
  const playerTwo = el("playerTwo").value;
  const winner = el("winner").value;
  if (!playerOne || !playerTwo || playerOne === playerTwo || ![playerOne, playerTwo].includes(winner)) {
    return toast("Choose two different players and the winner.", true);
  }
  const button = el("recordGameButton");
  button.disabled = true;
  const { error } = await db.from("games").insert({ player_one_id: playerOne, player_two_id: playerTwo, winner_id: winner });
  button.disabled = false;
  if (error) return toast(error.message, true);
  const winnerName = state.players.find((p) => p.id === winner)?.name || "Winner";
  event.currentTarget.reset();
  updateWinnerOptions();
  toast(`Match recorded — ${winnerName} wins!`);
  await loadData({ quiet: true });
});

el("playerOne").addEventListener("change", updateWinnerOptions);
el("playerTwo").addEventListener("change", updateWinnerOptions);
el("refreshButton").addEventListener("click", () => loadData());

function scheduleRefresh() {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = setTimeout(() => loadData({ quiet: true }), 200);
}

db.channel("foosball-live")
  .on("postgres_changes", { event: "*", schema: "public", table: "players" }, scheduleRefresh)
  .on("postgres_changes", { event: "*", schema: "public", table: "games" }, scheduleRefresh)
  .subscribe((status) => {
    if (status === "SUBSCRIBED") setStatus("online", "Live & synced");
    if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) setStatus("error", "Refresh to sync");
  });

loadData();
