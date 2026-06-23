import {
  BOARD_SIZE,
  DAMAGE_CHARGE_MAX,
  MAX_HP,
  OBSTACLE_CHARGE_MAX,
  applyResultToBattle,
  applySpecialAction,
  applySwapAction,
  createBattleState,
  findBestMove,
  getCellLabel,
  resolveBoard,
  takeAiTurn,
  trySwap,
} from "../../shared/game.js";
import { GAME_CONFIG } from "../../shared/config.js";
import { playSound as playAudioSound, primeAudio } from "./audio.js";

const playerBoardEl = document.querySelector("#player-board");
const aiBoardEl = document.querySelector("#ai-board");
const playerMetersEl = document.querySelector("#player-meters");
const aiMetersEl = document.querySelector("#ai-meters");
const statusEl = document.querySelector("#match-status");
const logListEl = document.querySelector("#battle-log-list");
const newMatchButton = document.querySelector("#new-match-button");
const gameMenuButton = document.querySelector("#game-menu-button");
const resultModalEl = document.querySelector("#result-modal");
const resultKickerEl = document.querySelector("#result-kicker");
const resultTitleEl = document.querySelector("#result-title");
const resultMessageEl = document.querySelector("#result-message");
const resultNewMatchButton = document.querySelector("#result-new-match-button");
const resultMenuButton = document.querySelector("#result-menu-button");
const startScreenEl = document.querySelector("#start-screen");
const gameScreenEl = document.querySelector("#game-screen");
const swimScreenEl = document.querySelector("#swim-screen");
const startMatchButton = document.querySelector("#start-match-button");
const startSwimButton = document.querySelector("#start-swim-button");
const recordToggleButton = document.querySelector("#record-toggle-button");
const recordPanelEl = document.querySelector("#record-panel");
const recordHostEl = document.querySelector("#record-host");
const recordEls = {
  boxing: {
    games: document.querySelector("#record-boxing-games"),
    wins: document.querySelector("#record-boxing-wins"),
    losses: document.querySelector("#record-boxing-losses"),
    draws: document.querySelector("#record-boxing-draws"),
    rate: document.querySelector("#record-boxing-win-rate"),
  },
  swim: {
    games: document.querySelector("#record-swim-games"),
    wins: document.querySelector("#record-swim-wins"),
    losses: document.querySelector("#record-swim-losses"),
    draws: document.querySelector("#record-swim-draws"),
    rate: document.querySelector("#record-swim-win-rate"),
  },
};
const recordResetButton = document.querySelector("#record-reset-button");
const newSwimButton = document.querySelector("#new-swim-button");
const swimMenuButton = document.querySelector("#swim-menu-button");
const swimStatusEl = document.querySelector("#swim-status");
const swimPlayerBoardEl = document.querySelector("#swim-player-board");
const swimRacersEl = document.querySelector("#swim-racers");
const swimWaveCountdownEl = document.querySelector("#swim-wave-countdown");
const swimActionSummaryEl = document.querySelector("#swim-action-summary");
const swimScreenNodesEl = document.querySelector("#swim-screen-nodes");
const swimWaveMeterEl = document.querySelector("#swim-wave-meter");

startMatchButton.textContent = "拳击 1v1";

let state = createBattleState();
let swimMatchState = createBattleState();
let swimState = null;
let appScreen = "start";
let currentMode = "boxing";
let selectedIndex = null;
let swimSelectedIndex = null;
let aiInterval = null;
let swimAiInterval = null;
let swipeStart = null;
let suppressNextClick = false;
let matchRecordSaved = true;
let swimRecordSaved = true;
let pendingPlayerSettlements = [];
let pendingAiSettlements = [];
let playerSettlementTimer = null;
const animatingBoards = new Set();
let matchRunId = 0;

const SWIPE_THRESHOLD = GAME_CONFIG.input.swipeThresholdPx;
const RECORD_HOST = window.location?.hostname || "本地文件";
const RECORD_STORAGE_KEY = `matchComboRecord:v1:${RECORD_HOST}`;
const MAX_BUFFERED_PLAYER_ACTIONS = 2;
const MAX_BUFFERED_AI_SETTLEMENTS = 2;
const BOARD_ANIMATION_MS = 660;
const PLAYER_SETTLE_DELAY_MS = 920;
const BOXING_AI_RESOLVE_OPTIONS = {
  maxCascadeSteps: 4,
  stopAfterCreatedSpecials: 1,
  refill: {
    controlledRefill: true,
    generousRefillChance: 0.08,
    avoidImmediateMatches: true,
  },
  stopRefill: {
    controlledRefill: true,
    generousRefillChance: 0,
    avoidImmediateMatches: true,
  },
};
const CREATED_SPECIAL_PRIORITY = ["colorBall", "bomb", "rocket", "propeller"];
const SWIM_RACER_COUNT = 5;
const SWIM_SCREEN_ROWS = BOARD_SIZE;
const SWIM_SCREEN_COUNT = 5;
const SWIM_TRACK_ROWS = SWIM_SCREEN_ROWS * SWIM_SCREEN_COUNT;
const SWIM_WAVE_INTERVAL = 5;
const SWIM_WAVE_PUSH_ROWS = 3;
const SWIM_AI_TURN_MS = 2350;
const SWIM_AI_DOUBLE_STEP_CHANCE = 0.21;
const SWIM_START_COL = Math.floor(BOARD_SIZE / 2);
const SWIM_RESOLVE_OPTIONS = {
  maxCascadeSteps: 8,
  resolveVisibleMatchesAfterStop: true,
  refill: {
    controlledRefill: true,
    generousRefillChance: 0.05,
    avoidImmediateMatches: true,
    refillOnlyFromTop: true,
    diagonalFall: false,
  },
  stopRefill: {
    controlledRefill: true,
    generousRefillChance: 0,
    avoidImmediateMatches: true,
    refillOnlyFromTop: true,
    diagonalFall: false,
  },
};
let swimNextPieceId = -1;
const CREATE_SPECIAL_SOUNDS = {
  propeller: "createPropeller",
  rocket: "createRocket",
  bomb: "createBomb",
  colorBall: "createColorBall",
};
const ACTIVATE_SPECIAL_SOUNDS = {
  propeller: "propeller",
  rocket: "rocket",
  bomb: "bomb",
  colorBall: "colorBall",
};

swimState = createSwimState();

const ASSET_PATHS = {
  ruby: "./assets/icons/gem-ruby.png",
  sky: "./assets/icons/gem-sky.png",
  leaf: "./assets/icons/gem-leaf.png",
  sun: "./assets/icons/gem-sun.png",
  plum: "./assets/icons/gem-plum.png",
  aqua: "./assets/icons/gem-aqua.png",
  propeller: "./assets/icons/special-propeller.png",
  rocketHorizontal: "./assets/icons/special-rocket-horizontal.png",
  rocketVertical: "./assets/icons/special-rocket-vertical.png",
  bomb: "./assets/icons/special-bomb.png",
  colorBall: "./assets/icons/special-color-ball.png",
  crate: "./assets/icons/obstacle-crate.png",
  swimDuck: "./assets/icons/swim-duck.png",
  health: "./assets/icons/ui-health.png",
  attack: "./assets/icons/ui-attack.png",
  obstacle: "./assets/icons/ui-obstacle.png",
};

function swimKey(row, col) {
  return `${row}:${col}`;
}

function createSwimGem() {
  const colors = GAME_CONFIG.board.colors;
  return {
    id: swimNextPieceId--,
    type: "gem",
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

function createSwimCratePiece() {
  return {
    id: swimNextPieceId--,
    type: "crate",
    hp: GAME_CONFIG.obstacles.crateHp,
  };
}

function createSwimDuckPiece() {
  return {
    id: swimNextPieceId--,
    type: "gem",
    color: "swimDuck",
    swimDuck: true,
  };
}

function placeSwimCrate(board, row, col) {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return;
  }
  if (row === 0 && col === SWIM_START_COL) {
    return;
  }
  board[boardIndex(row, col)] = createSwimCratePiece();
}

function setSwimGem(board, row, col, color) {
  board[boardIndex(row, col)] = {
    id: swimNextPieceId--,
    type: "gem",
    color,
  };
}

function cloneSwimBoard(board) {
  return board.map((piece) => (piece ? { ...piece } : null));
}

function forceStarterSwimMove(board) {
  const colors = GAME_CONFIG.board.colors;
  const starterRows = [
    [1, 2],
    [2, 3],
  ];

  for (const [matchRow, helperRow] of starterRows) {
    const a = boardIndex(matchRow, 0);
    const b = boardIndex(matchRow, 1);
    const blocker = boardIndex(matchRow, 2);
    const helper = boardIndex(helperRow, 2);
    if ([a, b, blocker, helper].some((index) => board[index]?.type === "crate" || board[index]?.swimDuck)) {
      continue;
    }

    const originalPieces = [a, b, blocker, helper].map((index) => (board[index] ? { ...board[index] } : null));
    for (const color of colors) {
      const blockerColor = colors.find((candidate) => candidate !== color) ?? color;
      setSwimGem(board, matchRow, 0, color);
      setSwimGem(board, matchRow, 1, color);
      setSwimGem(board, matchRow, 2, blockerColor);
      setSwimGem(board, helperRow, 2, color);

      const idleBoard = cloneSwimBoard(board);
      if (resolveBoard(idleBoard, helper, { maxCascadeSteps: 1 }).cascades > 0) {
        continue;
      }

      const testBoard = cloneSwimBoard(board);
      if (trySwap(testBoard, blocker, helper, SWIM_RESOLVE_OPTIONS).accepted) {
        return;
      }
    }

    [a, b, blocker, helper].forEach((index, pieceIndex) => {
      board[index] = originalPieces[pieceIndex];
    });
  }
}

function hasSwimPlayableAction(board) {
  if (board.some((piece) => piece && ["propeller", "rocket", "bomb", "colorBall"].includes(piece.type))) {
    return true;
  }
  return Boolean(findBestMove(board));
}

function ensureSwimBoardPlayable(board) {
  if (hasSwimPlayableAction(board)) {
    return;
  }
  forceStarterSwimMove(board);
}

function seedSwimBoard(board, screen = 1, duckCol = SWIM_START_COL) {
  const layouts = [
    [
      [1, 0],
      [1, 7],
      [2, 0],
      [2, 7],
      [3, 6],
      [3, 7],
      [4, 6],
      [4, 7],
      [5, 0],
      [5, 1],
      [6, 1],
      [6, 2],
      [7, 1],
      [7, 2],
      [7, 6],
      [7, 7],
    ],
    [
      [1, 6],
      [1, 7],
      [2, 6],
      [2, 7],
      [3, 5],
      [3, 0],
      [3, 1],
      [3, 6],
      [4, 0],
      [4, 1],
      [4, 5],
      [5, 1],
      [5, 6],
      [6, 2],
      [6, 5],
      [7, 2],
      [7, 5],
    ],
    [
      [1, 0],
      [1, 7],
      [2, 0],
      [2, 7],
      [3, 0],
      [3, 1],
      [3, 6],
      [3, 7],
      [4, 1],
      [4, 6],
      [5, 0],
      [5, 7],
      [6, 0],
      [6, 1],
      [6, 6],
      [6, 7],
      [7, 2],
      [7, 5],
    ],
    [
      [1, 0],
      [1, 7],
      [2, 6],
      [3, 1],
      [3, 7],
      [4, 0],
      [4, 1],
      [4, 6],
      [5, 1],
      [5, 6],
      [6, 2],
      [6, 5],
      [7, 2],
      [7, 5],
    ],
    [
      [1, 0],
      [1, 6],
      [2, 5],
      [2, 6],
      [3, 6],
      [3, 7],
      [4, 0],
      [4, 1],
      [5, 0],
      [6, 1],
      [6, 2],
      [7, 2],
      [7, 5],
      [7, 6],
      [1, 7],
    ],
  ];

  const layout = layouts[(screen - 1) % layouts.length];
  for (const [row, col] of layout) {
    placeSwimCrate(board, row, col);
  }
  forceStarterSwimMove(board);
  board[boardIndex(0, duckCol)] = createSwimDuckPiece();
  ensureSwimBoardPlayable(board);
  return board;
}

function createSwimState() {
  const names = ["你", "AI-1", "AI-2", "AI-3", "AI-4"];
  return {
    status: "playing",
    turn: 0,
    screen: 1,
    duckRow: 0,
    duckCol: SWIM_START_COL,
    waveCountdown: SWIM_WAVE_INTERVAL,
    waveSurges: 0,
    placements: [],
    lastSummary: "交换鸭子，清出下方通路，让它掉到底部进入下一屏。",
    racers: Array.from({ length: SWIM_RACER_COUNT }, (_, index) => ({
      id: index === 0 ? "player" : `ai-${index}`,
      name: names[index],
      isPlayer: index === 0,
      avatar: index === 0 ? "player" : "ai",
      row: 0,
      screen: 1,
      totalRows: 0,
      finished: false,
      eliminated: false,
      finishPlace: null,
      lastMove: "待出发",
    })),
  };
}

function emptyRecord() {
  return {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  };
}

function emptyRecordBook() {
  return {
    boxing: emptyRecord(),
    swim: emptyRecord(),
  };
}

function normalizeRecord(record) {
  const wins = Math.max(0, Number(record?.wins) || 0);
  const losses = Math.max(0, Number(record?.losses) || 0);
  const draws = Math.max(0, Number(record?.draws) || 0);
  const countedGames = wins + losses + draws;
  const games = Math.max(countedGames, Number(record?.games) || 0);

  return { games, wins, losses, draws };
}

function normalizeRecordBook(record) {
  if (record?.boxing || record?.swim) {
    return {
      boxing: normalizeRecord(record.boxing),
      swim: normalizeRecord(record.swim),
    };
  }

  return {
    boxing: normalizeRecord(record),
    swim: emptyRecord(),
  };
}

function readRecord() {
  try {
    const raw = window.localStorage?.getItem(RECORD_STORAGE_KEY);
    return normalizeRecordBook(raw ? JSON.parse(raw) : emptyRecordBook());
  } catch {
    return emptyRecordBook();
  }
}

function writeRecord(record) {
  try {
    window.localStorage?.setItem(RECORD_STORAGE_KEY, JSON.stringify(normalizeRecordBook(record)));
  } catch {
    // Local storage can be unavailable in restricted browser modes.
  }
}

function renderModeRecord(mode, record) {
  const elements = recordEls[mode];
  if (!elements) {
    return;
  }
  const winRate = record.games > 0 ? Math.round((record.wins / record.games) * 100) : 0;
  elements.games.textContent = String(record.games);
  elements.wins.textContent = String(record.wins);
  elements.losses.textContent = String(record.losses);
  elements.draws.textContent = String(record.draws);
  elements.rate.textContent = `${winRate}%`;
}

function renderRecord() {
  const record = readRecord();

  recordHostEl.textContent = RECORD_HOST;
  renderModeRecord("boxing", record.boxing);
  renderModeRecord("swim", record.swim);
}

function saveMatchResultIfNeeded() {
  if (currentMode !== "boxing" || matchRecordSaved || state.status !== "ended") {
    return;
  }

  const records = readRecord();
  const record = records.boxing;
  record.games += 1;

  if (state.winner === "player") {
    record.wins += 1;
  } else if (state.winner === "ai") {
    record.losses += 1;
  } else {
    record.draws += 1;
  }

  writeRecord(records);
  matchRecordSaved = true;
  renderRecord();
}

function saveSwimResultIfNeeded() {
  if (currentMode !== "swim" || swimRecordSaved || swimState.status !== "ended") {
    return;
  }

  const player = swimState.racers.find((racer) => racer.isPlayer);
  const rank = player?.finishPlace ?? swimRankForRacer(player);
  const records = readRecord();
  const record = records.swim;
  record.games += 1;

  if (rank === 1) {
    record.wins += 1;
  } else if (rank <= 3) {
    record.draws += 1;
  } else {
    record.losses += 1;
  }

  writeRecord(records);
  swimRecordSaved = true;
  renderRecord();
}

function setRecordPanelVisible(visible) {
  recordPanelEl.classList.toggle("record-panel-hidden", !visible);
  recordToggleButton.setAttribute("aria-expanded", String(visible));
  if (visible) {
    renderRecord();
  }
}

function renderScreen() {
  startScreenEl.classList.toggle("screen-hidden", appScreen !== "start");
  gameScreenEl.classList.toggle("screen-hidden", appScreen !== "game");
  swimScreenEl.classList.toggle("screen-hidden", appScreen !== "swim");
}

function canAcceptPlayerInput() {
  return state.status === "playing" && !animatingBoards.has("player") && pendingPlayerSettlements.length < MAX_BUFFERED_PLAYER_ACTIONS;
}

function clearPendingPlayerSettlements() {
  if (playerSettlementTimer) {
    window.clearTimeout(playerSettlementTimer);
    playerSettlementTimer = null;
  }
  pendingPlayerSettlements = [];
  pendingAiSettlements = [];
}

function stopAiLoop() {
  if (!aiInterval) {
    return;
  }

  window.clearInterval(aiInterval);
  aiInterval = null;
}

function stopSwimLoop() {
  if (!swimAiInterval) {
    return;
  }

  window.clearInterval(swimAiInterval);
  swimAiInterval = null;
}

function showStartScreen() {
  stopAiLoop();
  stopSwimLoop();
  clearPendingPlayerSettlements();
  animatingBoards.clear();
  matchRunId++;
  appScreen = "start";
  resultModalEl.classList.add("result-modal-hidden");
  renderRecord();
  renderScreen();
}

function percent(value, max) {
  return `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
}

function meter(label, value, max, className) {
  const displayValue = className === "hp" ? Math.ceil(value) : Math.floor(value);
  const iconName = className === "hp" ? "health" : className === "damage" ? "attack" : "obstacle";

  return `
    <div class="meter meter-${className}">
      <span class="meter-label">
        <img class="meter-icon" src="${ASSET_PATHS[iconName]}" alt="" />
        ${label}
      </span>
      <div class="meter-track" aria-hidden="true">
        <div class="meter-fill" style="width: ${percent(value, max)}"></div>
      </div>
      <strong>${displayValue}</strong>
    </div>
  `;
}

function renderMeters(container, fighter) {
  container.innerHTML = [
    meter("生命", fighter.hp, MAX_HP, "hp"),
    meter("攻击能量", fighter.damageCharge, DAMAGE_CHARGE_MAX, "damage"),
    meter("障碍能量", fighter.obstacleCharge, OBSTACLE_CHARGE_MAX, "obstacle"),
  ].join("");
}

function pieceMarkup(piece) {
  if (!piece) {
    return "";
  }

  const attrs = `data-piece-id="${piece.id}" data-piece-type="${piece.type}"`;

  if (piece.swimDuck) {
    return `<img class="piece-icon duck-icon" ${attrs} src="${ASSET_PATHS.swimDuck}" alt="" draggable="false" />`;
  }

  if (piece.type === "gem") {
    return `<img class="piece-icon gem-icon" ${attrs} src="${ASSET_PATHS[piece.color]}" alt="" draggable="false" />`;
  }

  if (piece.type === "propeller") {
    return `<img class="piece-icon special-icon" ${attrs} src="${ASSET_PATHS.propeller}" alt="" draggable="false" />`;
  }

  if (piece.type === "rocket") {
    const rocketPath = piece.direction === "column" ? ASSET_PATHS.rocketVertical : ASSET_PATHS.rocketHorizontal;
    return `<img class="piece-icon special-icon" ${attrs} src="${rocketPath}" alt="" draggable="false" />`;
  }

  if (piece.type === "bomb") {
    return `<img class="piece-icon special-icon" ${attrs} src="${ASSET_PATHS.bomb}" alt="" draggable="false" />`;
  }

  if (piece.type === "colorBall") {
    return `<img class="piece-icon special-icon" ${attrs} src="${ASSET_PATHS.colorBall}" alt="" draggable="false" />`;
  }

  if (piece.type === "crate") {
    return `<img class="piece-icon crate-icon" ${attrs} src="${ASSET_PATHS.crate}" alt="" draggable="false" />`;
  }

  return "";
}

function renderBoard(container, side) {
  const fighter = state.players[side];
  container.innerHTML = "";

  fighter.board.forEach((piece, index) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.index = String(index);
    if (piece) {
      cell.dataset.pieceId = String(piece.id);
      cell.dataset.pieceType = piece.type;
    }
    cell.setAttribute("aria-label", `${getCellLabel(piece)}，第 ${Math.floor(index / BOARD_SIZE) + 1} 行`);
    cell.disabled = side !== "player" || !canAcceptPlayerInput();
    cell.innerHTML = pieceMarkup(piece);

    if (side === "player" && selectedIndex === index) {
      cell.classList.add("cell-selected");
    }

    if (side === "player") {
      cell.addEventListener("pointerdown", (event) => handlePointerDown(event, index));
      cell.addEventListener("pointermove", (event) => handlePointerMove(event));
      cell.addEventListener("pointerup", () => handlePointerEnd());
      cell.addEventListener("pointercancel", () => handlePointerEnd());
      cell.addEventListener("click", () => handlePlayerCell(index));
    }

    container.append(cell);
  });

  const effects = document.createElement("div");
  effects.className = "board-effects";
  effects.setAttribute("aria-hidden", "true");
  container.append(effects);
}

function renderStatus() {
  if (state.status === "ended") {
    if (state.winner === "draw") {
      statusEl.textContent = "平局";
    } else {
      statusEl.textContent = state.winner === "player" ? "胜利" : "失败";
    }
    return;
  }

  statusEl.textContent = "玩家 vs AI";
}

function renderResultModal() {
  if (currentMode === "swim") {
    const ended = swimState?.status === "ended";
    resultModalEl.classList.toggle("result-modal-hidden", !ended);
    resultModalEl.classList.remove("result-win", "result-lose", "result-draw");

    if (!ended) {
      return;
    }

    const player = swimState.racers.find((racer) => racer.isPlayer);
    const rank = player?.finishPlace ?? swimRankForRacer(player);
    const copy = {
      className: rank === 1 ? "result-win" : rank <= 3 ? "result-draw" : "result-lose",
      kicker: "游泳竞速结束",
      title: `第 ${rank} 名`,
      message: rank === 1 ? `你率先完成了 ${SWIM_SCREEN_COUNT} 屏掉落。` : `你完成了 ${SWIM_SCREEN_COUNT} 屏赛道，排名第 ${rank}。`,
    };

    resultModalEl.classList.add(copy.className);
    resultKickerEl.textContent = copy.kicker;
    resultTitleEl.textContent = copy.title;
    resultMessageEl.textContent = copy.message;
    return;
  }

  const ended = state.status === "ended";
  resultModalEl.classList.toggle("result-modal-hidden", !ended);
  resultModalEl.classList.remove("result-win", "result-lose", "result-draw");

  if (!ended) {
    return;
  }

  const copyByWinner = {
    player: {
      className: "result-win",
      kicker: "比赛结束",
      title: "胜利",
      message: "你赢下了这场对战。",
    },
    ai: {
      className: "result-lose",
      kicker: "比赛结束",
      title: "失败",
      message: "AI 赢下了这场对战。",
    },
    draw: {
      className: "result-draw",
      kicker: "比赛结束",
      title: "平局",
      message: "双方同时倒下了。",
    },
  };
  const copy = copyByWinner[state.winner] ?? copyByWinner.draw;

  resultModalEl.classList.add(copy.className);
  resultKickerEl.textContent = copy.kicker;
  resultTitleEl.textContent = copy.title;
  resultMessageEl.textContent = copy.message;
}

function renderLog() {
  logListEl.innerHTML = "";
  for (const message of state.log) {
    const item = document.createElement("li");
    item.textContent = message;
    logListEl.append(item);
  }
}

function renderChrome() {
  saveMatchResultIfNeeded();
  renderScreen();
  renderMeters(playerMetersEl, state.players.player);
  renderMeters(aiMetersEl, state.players.ai);
  renderStatus();
  renderResultModal();
  renderLog();
}

function render() {
  renderChrome();
  renderBoard(playerBoardEl, "player");
  renderBoard(aiBoardEl, "ai");
}

function canAcceptSwimInput() {
  return appScreen === "swim" && swimState.status === "playing" && !animatingBoards.has("swim");
}

function swimDuckIndex() {
  const boardIndexFromPiece = swimMatchState.players.player.board.findIndex((piece) => piece?.swimDuck);
  if (boardIndexFromPiece >= 0) {
    return boardIndexFromPiece;
  }
  return boardIndex(swimState.duckRow, swimState.duckCol);
}

function ensureSwimDuckOnBoard(board) {
  if (board.some((piece) => piece?.swimDuck)) {
    return;
  }
  board[boardIndex(Math.max(0, swimState.duckRow), swimState.duckCol)] = createSwimDuckPiece();
}

function swimTotalRowsForPlayer() {
  return (swimState.screen - 1) * BOARD_SIZE + swimState.duckRow;
}

function syncPlayerSwimRacer() {
  const duckIndex = swimDuckIndex();
  swimState.duckRow = Math.floor(duckIndex / BOARD_SIZE);
  swimState.duckCol = duckIndex % BOARD_SIZE;
  const player = swimState.racers.find((racer) => racer.isPlayer);
  if (!player) {
    return;
  }
  player.row = swimState.duckRow;
  player.screen = swimState.screen;
  player.totalRows = swimTotalRowsForPlayer();
  player.finished = swimState.status === "ended";
  if (player.finished && !player.finishPlace) {
    player.finishPlace = swimState.placements.length + 1;
    swimState.placements.push(player.id);
  }
}

function renderSwimBoard() {
  swimPlayerBoardEl.innerHTML = "";
  const board = swimMatchState.players.player.board;
  const duckIndex = swimDuckIndex();

  board.forEach((piece, index) => {
    const isDuckCell = index === duckIndex;
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.index = String(index);
    if (row >= BOARD_SIZE - Math.min(BOARD_SIZE, swimState.waveSurges * SWIM_WAVE_PUSH_ROWS)) {
      cell.classList.add("cell-swim-wave");
    }
    if (row === BOARD_SIZE - 1) {
      cell.classList.add("cell-swim-screen-gate");
    }
    if (isDuckCell) {
      cell.classList.add("cell-swim-duck");
    }
    if (piece) {
      cell.dataset.pieceId = String(piece.id);
      cell.dataset.pieceType = piece.type;
    }
    cell.setAttribute("aria-label", getCellLabel(piece));
    cell.disabled = !canAcceptSwimInput();
    cell.innerHTML = pieceMarkup(piece);

    if (swimSelectedIndex === index) {
      cell.classList.add("cell-selected");
    }

    cell.addEventListener("pointerdown", (event) => handlePointerDown(event, index, "swim"));
    cell.addEventListener("pointermove", (event) => handlePointerMove(event));
    cell.addEventListener("pointerup", () => handlePointerEnd());
    cell.addEventListener("pointercancel", () => handlePointerEnd());
    cell.addEventListener("click", () => handleSwimCell(index));
    swimPlayerBoardEl.append(cell);
  });

  const effects = document.createElement("div");
  effects.className = "board-effects";
  effects.setAttribute("aria-hidden", "true");
  swimPlayerBoardEl.append(effects);
}

function swimProgressPercent(racer) {
  const rows = racer?.totalRows ?? 0;
  return Math.round((rows / (SWIM_TRACK_ROWS - 1)) * 100);
}

function swimScreenNumber(racer) {
  return Math.min(SWIM_SCREEN_COUNT, racer?.screen ?? swimState.screen);
}

function swimScreenRow(racer) {
  return (racer?.row ?? swimState.duckRow) + 1;
}

function swimRankForRacer(racer) {
  if (!racer) {
    return SWIM_RACER_COUNT;
  }
  if (racer.finishPlace) {
    return racer.finishPlace;
  }

  const ahead = swimState.racers.filter((other) => {
    if (other === racer) {
      return false;
    }
    if (other.finishPlace) {
      return true;
    }
    return other.totalRows > racer.totalRows;
  }).length;
  return ahead + 1;
}

function renderSwimStatus() {
  const player = swimState.racers.find((racer) => racer.isPlayer);
  syncPlayerSwimRacer();
  const screen = swimState.screen;
  const rank = swimRankForRacer(player);
  const waveText = `浪潮 ${swimState.waveCountdown} 步后上推 ${SWIM_WAVE_PUSH_ROWS} 行`;
  swimStatusEl.textContent = `第 ${screen}/${SWIM_SCREEN_COUNT} 屏 · 鸭子第 ${swimState.duckRow + 1}/${BOARD_SIZE} 行 · 当前第 ${rank} 名 · ${waveText}`;
  swimWaveCountdownEl.textContent = waveText;
  swimActionSummaryEl.textContent = swimState.lastSummary;
  renderSwimHud(screen);
}

function renderSwimHud(screen) {
  if (swimScreenNodesEl) {
    swimScreenNodesEl.innerHTML = Array.from({ length: SWIM_SCREEN_COUNT }, (_, index) => {
      const screenNumber = index + 1;
      const isCurrent = screenNumber === screen;
      const isDone = screenNumber < screen;
      return `
        <span class="swim-screen-node ${isCurrent ? "swim-screen-node-current" : ""} ${isDone ? "swim-screen-node-done" : ""}">
          <b>${screenNumber}</b>
        </span>
      `;
    }).join("");
  }

  if (swimWaveMeterEl) {
    swimWaveMeterEl.innerHTML = `
      <span>浪潮</span>
      <strong>${swimState.waveCountdown}</strong>
      <em>步后上推 ${SWIM_WAVE_PUSH_ROWS} 行</em>
    `;
  }
}

function renderSwimRacers() {
  swimRacersEl.innerHTML = "";
  syncPlayerSwimRacer();
  const sorted = [...swimState.racers].sort((a, b) => {
    if (a.finishPlace && b.finishPlace) {
      return a.finishPlace - b.finishPlace;
    }
    if (a.finishPlace) {
      return -1;
    }
    if (b.finishPlace) {
      return 1;
    }
    return b.totalRows - a.totalRows;
  });

  const guide = document.createElement("div");
  guide.className = "swim-board-guide";
  guide.innerHTML = `
    <strong>同屏规则</strong>
    <span>鸭子、普通棋子、木箱都在左侧棋盘。鸭子可以和相邻非木箱棋子上下左右交换，并随棋盘重力掉落。</span>
    <span>鸭子落到棋盘底部就进入下一屏，共 ${SWIM_SCREEN_COUNT} 屏。浪潮上推 ${SWIM_WAVE_PUSH_ROWS} 行，只补普通棋子；鸭子在顶端时不推。</span>
  `;
  swimRacersEl.append(guide);

  for (const racer of sorted) {
    const card = document.createElement("section");
    card.className = "swim-racer";
    if (racer.isPlayer) {
      card.classList.add("swim-racer-player");
    }
    if (racer.finished) {
      card.classList.add("swim-racer-finished");
    }
    if (racer.eliminated) {
      card.classList.add("swim-racer-eliminated");
    }

    const rank = sorted.indexOf(racer) + 1;
    card.innerHTML = `
      <div class="swim-racer-head">
        <div class="swim-racer-avatar">
          <img src="${racer.isPlayer ? "./assets/icons/avatar-player.png" : "./assets/icons/avatar-ai.png"}" alt="" />
        </div>
        <div>
          <div class="swim-racer-name">${racer.name}</div>
          <div class="swim-racer-depth">第 ${swimScreenNumber(racer)}/${SWIM_SCREEN_COUNT} 屏 · 第 ${swimScreenRow(racer)}/${BOARD_SIZE} 行 · ${swimProgressPercent(racer)}%</div>
        </div>
        <strong class="swim-racer-rank">#${rank}</strong>
      </div>
    `;

    const place = document.createElement("div");
    place.className = "swim-place";
    place.textContent = racer.finished ? `完成 · 第 ${racer.finishPlace} 名` : racer.lastMove;
    card.append(place);
    swimRacersEl.append(card);
  }
}

function renderSwim() {
  saveSwimResultIfNeeded();
  renderScreen();
  renderSwimStatus();
  renderSwimBoard();
  renderSwimRacers();
  renderResultModal();
}

function boardElementForSide(side) {
  if (side === "swim") {
    return swimPlayerBoardEl;
  }
  return side === "player" ? playerBoardEl : aiBoardEl;
}

function renderForTimelineSide(side) {
  if (side === "swim") {
    renderSwim();
    return;
  }
  render();
}

function cloneBoardForAnimation(board) {
  return board.map((piece) => (piece ? { ...piece } : null));
}

function boardMapById(board) {
  const map = new Map();
  board.forEach((piece, index) => {
    if (piece?.id !== undefined) {
      map.set(piece.id, { piece, index });
    }
  });
  return map;
}

function pieceVisualKey(piece) {
  if (!piece) {
    return "empty";
  }

  return [
    piece.id,
    piece.type,
    piece.color ?? "",
    piece.direction ?? "",
    piece.hp ?? "",
  ].join(":");
}

function boardsVisuallyEqual(firstBoard = [], secondBoard = []) {
  if (firstBoard.length !== secondBoard.length) {
    return false;
  }

  for (let index = 0; index < firstBoard.length; index++) {
    if (pieceVisualKey(firstBoard[index]) !== pieceVisualKey(secondBoard[index])) {
      return false;
    }
  }

  return true;
}

function cellElement(boardEl, index) {
  return boardEl.querySelector(`.cell[data-index="${index}"]`);
}

function cellBox(boardEl, index) {
  const cell = cellElement(boardEl, index);
  const boardRect = boardEl.getBoundingClientRect();
  const cellRect = cell?.getBoundingClientRect();

  if (!cellRect) {
    return null;
  }

  return {
    left: cellRect.left - boardRect.left,
    top: cellRect.top - boardRect.top,
    width: cellRect.width,
    height: cellRect.height,
    centerX: cellRect.left - boardRect.left + cellRect.width / 2,
    centerY: cellRect.top - boardRect.top + cellRect.height / 2,
  };
}

function effectLayer(boardEl) {
  return boardEl.querySelector(".board-effects");
}

function animateElement(element, keyframes, options) {
  if (!element) {
    return null;
  }

  const animation = element.animate?.(keyframes, options);
  if (!animation) {
    window.setTimeout(() => element.remove?.(), options.duration || 0);
    return null;
  }
  return animation;
}

function createPieceGhost(boardEl, piece, index, className = "") {
  const layer = effectLayer(boardEl);
  const box = cellBox(boardEl, index);
  if (!layer || !box || !piece) {
    return null;
  }

  const ghost = document.createElement("div");
  ghost.className = `piece-ghost ${className}`.trim();
  ghost.innerHTML = pieceMarkup(piece);
  ghost.style.left = `${box.left}px`;
  ghost.style.top = `${box.top}px`;
  ghost.style.width = `${box.width}px`;
  ghost.style.height = `${box.height}px`;
  layer.append(ghost);
  return ghost;
}

function createEffectAt(boardEl, index, className, text = "") {
  const layer = effectLayer(boardEl);
  const box = cellBox(boardEl, index);
  if (!layer || !box) {
    return null;
  }

  const effect = document.createElement("div");
  effect.className = className;
  effect.textContent = text;
  effect.style.left = `${box.centerX}px`;
  effect.style.top = `${box.centerY}px`;
  layer.append(effect);
  return effect;
}

function boardIndex(row, col) {
  return row * BOARD_SIZE + col;
}

function rangeAround(index, radius) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const cells = [];
  for (let r = Math.max(0, row - radius); r <= Math.min(BOARD_SIZE - 1, row + radius); r++) {
    for (let c = Math.max(0, col - radius); c <= Math.min(BOARD_SIZE - 1, col + radius); c++) {
      cells.push(boardIndex(r, c));
    }
  }
  return cells;
}

function lineRange(index, direction = "row") {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  return Array.from({ length: BOARD_SIZE }, (_, offset) => (direction === "row" ? boardIndex(row, offset) : boardIndex(offset, col)));
}

function pieceForSpecial(type, direction = "row") {
  if (type === "rocket") {
    return { id: -1, type, direction };
  }
  return { id: -1, type };
}

function animateParticleBurst(boardEl, index, variant = "clear", count = 8, delay = 0) {
  const layer = effectLayer(boardEl);
  const box = cellBox(boardEl, index);
  if (!layer || !box) {
    return;
  }

  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = `effect-particle effect-particle-${variant}`;
    particle.style.left = `${box.centerX}px`;
    particle.style.top = `${box.centerY}px`;
    layer.append(particle);

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.58;
    const distance = box.width * (0.22 + Math.random() * 0.58);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - box.height * 0.08;
    animateElement(
      particle,
      [
        { opacity: 0, transform: "translate(-50%, -50%) scale(0.45)" },
        { opacity: 1, transform: "translate(-50%, -50%) scale(1)", offset: 0.18 },
        { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.25)` },
      ],
      { duration: 340 + Math.random() * 120, delay, easing: "cubic-bezier(.18,.72,.2,1)", fill: "forwards" },
    )?.finished.finally(() => particle.remove());
  }
}

function animateMovementTrail(boardEl, fromBox, toBox, rowDistance) {
  const layer = effectLayer(boardEl);
  if (!layer || !fromBox || !toBox || rowDistance <= 0) {
    return;
  }

  const count = Math.min(4, rowDistance + 1);
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const particle = document.createElement("div");
    particle.className = "effect-particle effect-particle-trail";
    particle.style.left = `${fromBox.centerX + (toBox.centerX - fromBox.centerX) * t}px`;
    particle.style.top = `${fromBox.centerY + (toBox.centerY - fromBox.centerY) * t}px`;
    layer.append(particle);
    animateElement(
      particle,
      [
        { opacity: 0, transform: "translate(-50%, -50%) scale(0.4)" },
        { opacity: 0.72, transform: "translate(-50%, -50%) scale(1)", offset: 0.24 },
        { opacity: 0, transform: "translate(-50%, -50%) scale(0.2)" },
      ],
      { duration: 260, delay: i * 18, easing: "ease-out", fill: "forwards" },
    )?.finished.finally(() => particle.remove());
  }
}

function animateRangeCells(boardEl, targets = [], className = "", delay = 0) {
  const layer = effectLayer(boardEl);
  if (!layer) {
    return;
  }

  const uniqueTargets = [...new Set(targets)].slice(0, 64);
  uniqueTargets.forEach((target, index) => {
    const box = cellBox(boardEl, target);
    if (!box) {
      return;
    }

    const cell = document.createElement("div");
    cell.className = `effect-range-cell ${className}`.trim();
    cell.style.left = `${box.left}px`;
    cell.style.top = `${box.top}px`;
    cell.style.width = `${box.width}px`;
    cell.style.height = `${box.height}px`;
    layer.append(cell);
    animateElement(
      cell,
      [
        { opacity: 0, transform: "scale(0.68)" },
        { opacity: 0.9, transform: "scale(1)", offset: 0.22 },
        { opacity: 0.6, transform: "scale(1)", offset: 0.68 },
        { opacity: 0, transform: "scale(1.08)" },
      ],
      { duration: 520, delay: delay + Math.min(index * 3, 90), easing: "ease-out", fill: "forwards" },
    )?.finished.finally(() => cell.remove());
  });
}

function animateAreaRange(boardEl, centerIndex, radius, className = "", delay = 0) {
  const layer = effectLayer(boardEl);
  const center = cellBox(boardEl, centerIndex);
  if (!layer || !center) {
    return;
  }

  const row = Math.floor(centerIndex / BOARD_SIZE);
  const col = centerIndex % BOARD_SIZE;
  const topLeftIndex = boardIndex(Math.max(0, row - radius), Math.max(0, col - radius));
  const bottomRightIndex = boardIndex(Math.min(BOARD_SIZE - 1, row + radius), Math.min(BOARD_SIZE - 1, col + radius));
  const topLeft = cellBox(boardEl, topLeftIndex);
  const bottomRight = cellBox(boardEl, bottomRightIndex);
  if (!topLeft || !bottomRight) {
    return;
  }

  const area = document.createElement("div");
  area.className = `effect-range-area ${className}`.trim();
  area.style.left = `${topLeft.left}px`;
  area.style.top = `${topLeft.top}px`;
  area.style.width = `${bottomRight.left + bottomRight.width - topLeft.left}px`;
  area.style.height = `${bottomRight.top + bottomRight.height - topLeft.top}px`;
  layer.append(area);
  animateElement(
    area,
    [
      { opacity: 0, transform: "scale(0.76)" },
      { opacity: 0.82, transform: "scale(1)", offset: 0.22 },
      { opacity: 0.55, transform: "scale(1)", offset: 0.68 },
      { opacity: 0, transform: "scale(1.05)" },
    ],
    { duration: 500, delay, easing: "ease-out", fill: "forwards" },
  )?.finished.finally(() => area.remove());
}

function animateClearedPieces(boardEl, beforeBoard, afterBoard) {
  const beforeById = boardMapById(beforeBoard);
  const afterById = boardMapById(afterBoard);

  for (const [id, entry] of beforeById) {
    if (afterById.has(id)) {
      continue;
    }

    const ghost = createPieceGhost(boardEl, entry.piece, entry.index, "piece-ghost-clearing");
    if (!ghost) {
      continue;
    }

    animateParticleBurst(boardEl, entry.index, entry.piece.type === "crate" ? "wood" : "clear", entry.piece.type === "crate" ? 12 : 8, 40);
    animateElement(
      ghost,
      [
        { opacity: 1, transform: "scale(1) rotate(0deg)", filter: "brightness(1.06)" },
        { opacity: 0.9, transform: "scale(1.14) rotate(6deg)", offset: 0.28 },
        { opacity: 0, transform: "scale(0.34) rotate(-10deg)", filter: "brightness(1.38)" },
      ],
      { duration: 220, easing: "cubic-bezier(.18,.82,.24,1)", fill: "forwards" },
    )?.finished.finally(() => ghost.remove());
  }
}

function animateCreatedSpecials(boardEl, beforeBoard, afterBoard, result) {
  if (!result?.createdSpecials?.length) {
    return;
  }

  const beforeById = boardMapById(beforeBoard);
  afterBoard.forEach((piece, index) => {
    if (!piece || piece.type === "gem" || piece.type === "crate" || beforeById.has(piece.id)) {
      return;
    }

    const image = boardEl.querySelector(`.piece-icon[data-piece-id="${piece.id}"]`);
    if (!image) {
      return;
    }

    animateElement(
      image,
      [
        { transform: "scale(0.82) rotate(-4deg)", filter: "brightness(1.18)" },
        { transform: "scale(1.08) rotate(2deg)", filter: "brightness(1.13)", offset: 0.42 },
        { transform: "scale(1) rotate(0deg)", filter: "brightness(1)" },
      ],
      { duration: 190, easing: "cubic-bezier(.18,.82,.22,1.02)" },
    );
    animateParticleBurst(boardEl, index, "transform", 4, 40);
  });
}

function animateMovedPieces(boardEl, beforeBoard, afterBoard) {
  const beforeById = boardMapById(beforeBoard);
  const speedScale = boardEl === swimPlayerBoardEl ? 0.64 : 1;

  afterBoard.forEach((piece, index) => {
    if (!piece) {
      return;
    }

    const image = boardEl.querySelector(`.piece-icon[data-piece-id="${piece.id}"]`);
    const currentBox = cellBox(boardEl, index);
    if (!image || !currentBox) {
      return;
    }

    const previous = beforeById.get(piece.id);
    if (previous) {
      if (previous.index === index) {
        return;
      }

      const previousBox = cellBox(boardEl, previous.index);
      if (!previousBox) {
        return;
      }

      const dx = previousBox.centerX - currentBox.centerX;
      const dy = previousBox.centerY - currentBox.centerY;
      const rowDistance = Math.abs(Math.floor(previous.index / BOARD_SIZE) - Math.floor(index / BOARD_SIZE));
      animateMovementTrail(boardEl, previousBox, currentBox, rowDistance);
      animateElement(
        image,
        [
          { transform: `translate(${dx}px, ${dy}px) scale(1.01)` },
          { transform: "translate(0, 4px) scale(1.015)", offset: 0.82 },
          { transform: "translate(0, 0) scale(1)" },
        ],
        {
          duration: Math.round(Math.min(360, 125 + rowDistance * 32) * speedScale),
          easing: "cubic-bezier(.16,.78,.24,1.08)",
        },
      );
      return;
    }

    const row = Math.floor(index / BOARD_SIZE);
    const dropDistance = currentBox.height * (row + 2.5);
    animateParticleBurst(boardEl, index, "trail", 3, Math.min(90, row * 8));
    animateElement(
      image,
      [
        { opacity: 0.76, transform: `translateY(${-dropDistance}px) scale(0.97)` },
        { opacity: 1, transform: "translateY(5px) scale(1.025)", offset: 0.8 },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      {
        duration: Math.round(Math.min(390, 165 + row * 22) * speedScale),
        easing: "cubic-bezier(.12,.74,.16,1)",
      },
    );
  });
}

function targetDirection(targets = []) {
  const rows = new Set(targets.map((index) => Math.floor(index / BOARD_SIZE)));
  const cols = new Set(targets.map((index) => index % BOARD_SIZE));
  if (rows.size === 1) {
    return "row";
  }
  if (cols.size === 1) {
    return "column";
  }
  return null;
}

function animateHitMarks(boardEl, targets = [], strong = false, baseDelay = 0) {
  targets.slice(0, 64).forEach((target, index) => {
    const hit = createEffectAt(boardEl, target, strong ? "effect-hit effect-hit-strong" : "effect-hit");
    if (!hit) {
      return;
    }

    animateElement(
      hit,
      [
        { opacity: 0, transform: "translate(-50%, -50%) scale(0.35)" },
        { opacity: 1, transform: "translate(-50%, -50%) scale(1.06)", offset: 0.28 },
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.65)" },
      ],
      { duration: 250, delay: baseDelay + Math.min(index * 8, 110), easing: "ease-out", fill: "forwards" },
    )?.finished.finally(() => hit.remove());
  });
}

function animateRocketEffect(boardEl, targets = [], delay = 0) {
  const direction = targetDirection(targets);
  if (!direction || targets.length === 0) {
    return;
  }

  const layer = effectLayer(boardEl);
  const first = cellBox(boardEl, targets[0]);
  const last = cellBox(boardEl, targets[targets.length - 1]);
  if (!layer || !first || !last) {
    return;
  }

  const beam = document.createElement("div");
  beam.className = `effect-rocket effect-rocket-${direction}`;
  if (direction === "row") {
    const left = Math.min(first.left, last.left);
    const right = Math.max(first.left + first.width, last.left + last.width);
    beam.style.left = `${left}px`;
    beam.style.top = `${first.centerY}px`;
    beam.style.width = `${right - left}px`;
  } else {
    const top = Math.min(first.top, last.top);
    const bottom = Math.max(first.top + first.height, last.top + last.height);
    beam.style.left = `${first.centerX}px`;
    beam.style.top = `${top}px`;
    beam.style.height = `${bottom - top}px`;
  }
  layer.append(beam);
  animateElement(
    beam,
    [
      { opacity: 0, transform: direction === "row" ? "scaleX(0.2)" : "scaleY(0.2)" },
      { opacity: 1, transform: direction === "row" ? "scaleX(1)" : "scaleY(1)", offset: 0.25 },
      { opacity: 0, transform: direction === "row" ? "scaleX(1.08)" : "scaleY(1.08)" },
    ],
    { duration: 300, delay, easing: "cubic-bezier(.16,.72,.28,1)", fill: "forwards" },
  )?.finished.finally(() => beam.remove());
}

function animateBombEffect(boardEl, originIndex, combo = false, delay = 0) {
  const blast = createEffectAt(boardEl, originIndex, combo ? "effect-bomb effect-bomb-large" : "effect-bomb");
  if (!blast) {
    return;
  }
  animateElement(
    blast,
    [
      { opacity: 0.95, transform: "translate(-50%, -50%) scale(0.25)" },
      { opacity: 0.65, transform: "translate(-50%, -50%) scale(1.15)", offset: 0.42 },
      { opacity: 0, transform: "translate(-50%, -50%) scale(2.1)" },
    ],
    { duration: combo ? 580 : 430, delay, easing: "ease-out", fill: "forwards" },
  )?.finished.finally(() => blast.remove());
}

function animatePropellerEffect(boardEl, beforeBoard, originIndex, targets = []) {
  const farTarget =
    targets
      .filter((target) => target !== originIndex)
      .sort((a, b) => {
        const ad = Math.abs(Math.floor(a / BOARD_SIZE) - Math.floor(originIndex / BOARD_SIZE)) + Math.abs((a % BOARD_SIZE) - (originIndex % BOARD_SIZE));
        const bd = Math.abs(Math.floor(b / BOARD_SIZE) - Math.floor(originIndex / BOARD_SIZE)) + Math.abs((b % BOARD_SIZE) - (originIndex % BOARD_SIZE));
        return bd - ad;
      })[0] ?? originIndex;
  const originPiece = beforeBoard[originIndex] || { id: -1, type: "propeller" };
  const ghost = createPieceGhost(boardEl, originPiece, originIndex, "piece-ghost-propeller");
  const from = cellBox(boardEl, originIndex);
  const to = cellBox(boardEl, farTarget);
  if (!ghost || !from || !to) {
    ghost?.remove();
    return;
  }

  animateElement(
    ghost,
    [
      { opacity: 1, transform: "translate(0, 0) scale(1.05) rotate(0deg)" },
      {
        opacity: 1,
        transform: `translate(${to.centerX - from.centerX}px, ${to.centerY - from.centerY}px) scale(0.92) rotate(560deg)`,
      },
    ],
    { duration: 560, easing: "cubic-bezier(.2,.82,.18,1)", fill: "forwards" },
  )?.finished.finally(() => ghost.remove());
}

function animateColorBallEffect(boardEl, originIndex, targets = []) {
  const pulse = createEffectAt(boardEl, originIndex, "effect-color-ball");
  animateElement(
    pulse,
    [
      { opacity: 0.95, transform: "translate(-50%, -50%) scale(0.5) rotate(0deg)" },
      { opacity: 0.7, transform: "translate(-50%, -50%) scale(1.5) rotate(160deg)", offset: 0.55 },
      { opacity: 0, transform: "translate(-50%, -50%) scale(2.25) rotate(260deg)" },
    ],
    { duration: 430, easing: "ease-out", fill: "forwards" },
  )?.finished.finally(() => pulse?.remove());

  const layer = effectLayer(boardEl);
  const origin = cellBox(boardEl, originIndex);
  if (!layer || !origin) {
    return;
  }

  targets.slice(0, 18).forEach((target, index) => {
    const box = cellBox(boardEl, target);
    if (!box) {
      return;
    }

    const dx = box.centerX - origin.centerX;
    const dy = box.centerY - origin.centerY;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const ray = document.createElement("div");
    ray.className = "effect-ray";
    ray.style.left = `${origin.centerX}px`;
    ray.style.top = `${origin.centerY}px`;
    ray.style.width = `${length}px`;
    ray.style.transform = `rotate(${angle}deg) scaleX(0)`;
    layer.append(ray);
    animateElement(
      ray,
      [
        { opacity: 0, transform: `rotate(${angle}deg) scaleX(0)` },
        { opacity: 0.9, transform: `rotate(${angle}deg) scaleX(1)`, offset: 0.35 },
        { opacity: 0, transform: `rotate(${angle}deg) scaleX(1)` },
      ],
      { duration: 260, delay: Math.min(index * 9, 90), easing: "ease-out", fill: "forwards" },
    )?.finished.finally(() => ray.remove());
  });
}

function animateTransformGhost(boardEl, index, special, direction, delay) {
  const ghost = createPieceGhost(boardEl, pieceForSpecial(special, direction), index, "piece-ghost-transform");
  if (!ghost) {
    return;
  }

  animateElement(
    ghost,
    [
      { opacity: 0, transform: "scale(0.35) rotate(-18deg)", filter: "brightness(1.55)" },
      { opacity: 1, transform: "scale(1.18) rotate(8deg)", filter: "brightness(1.28)", offset: 0.48 },
      { opacity: 0, transform: "scale(1.02) rotate(0deg)", filter: "brightness(1)" },
    ],
    { duration: 520, delay, easing: "cubic-bezier(.18,.86,.22,1.04)", fill: "forwards" },
  )?.finished.finally(() => ghost.remove());
}

function transformedSpecialPiece(sourcePiece, special, direction, index) {
  const id = sourcePiece?.id ?? -(index + 1);
  if (special === "rocket") {
    return { id, type: "rocket", direction: direction || "row" };
  }
  if (special === "bomb") {
    return { id, type: "bomb" };
  }
  if (special === "propeller") {
    return { id, type: "propeller" };
  }
  if (special === "colorBall") {
    return { id, type: "colorBall" };
  }
  return sourcePiece;
}

function buildComboTransformBoard(beforeBoard, transform) {
  const board = cloneBoardForAnimation(beforeBoard);
  const centers = transform?.centers ?? [];
  const special = transform?.special;
  if (!special) {
    return board;
  }

  for (const center of centers) {
    if (center < 0 || center >= board.length) {
      continue;
    }
    board[center] = transformedSpecialPiece(board[center], special, transform.direction, center);
  }

  return board;
}

function animateTransformedSpecialPieces(boardEl, centers = []) {
  for (const center of centers.slice(0, 24)) {
    const image = cellElement(boardEl, center)?.querySelector(".piece-icon");
    if (!image) {
      continue;
    }

    animateElement(
      image,
      [
        { transform: "scale(0.58) rotate(-10deg)", filter: "brightness(1.35)" },
        { transform: "scale(1.13) rotate(4deg)", filter: "brightness(1.18)", offset: 0.42 },
        { transform: "scale(1) rotate(0deg)", filter: "brightness(1)" },
      ],
      { duration: 210, easing: "cubic-bezier(.18,.82,.22,1.04)" },
    );
    animateParticleBurst(boardEl, center, "transform", 4, 28);
  }
}

function animateTransformedComboDetonation(boardEl, transform, result) {
  const centers = transform?.centers ?? [];
  const special = transform?.special;
  const direction = transform?.direction || "row";

  if (special === "bomb") {
    centers.slice(0, 12).forEach((center, index) => {
      const delay = Math.min(index * 14, 150);
      animateAreaRange(boardEl, center, 2, "effect-range-bomb", delay);
      animateBombEffect(boardEl, center, true, delay + 86);
      animateParticleBurst(boardEl, center, "blast", 5, delay + 110);
    });
    animateHitMarks(boardEl, result.targets, true, 330);
    return;
  }

  if (special === "rocket") {
    centers.slice(0, 14).forEach((center, index) => {
      const delay = Math.min(index * 12, 140);
      const range = lineRange(center, direction);
      animateRangeCells(boardEl, range, "effect-range-rocket", delay);
      animateRocketEffect(boardEl, range, delay + 70);
      animateParticleBurst(boardEl, center, "blast", 4, delay + 88);
    });
    animateHitMarks(boardEl, result.targets, true, 300);
    return;
  }

  if (special === "propeller") {
    const flightTargets = transform?.flightTargets ?? [];
    centers.slice(0, 16).forEach((center, index) => {
      const delay = Math.min(index * 12, 140);
      animateRangeCells(boardEl, propellerCrossTargets(center), "effect-range-propeller", delay);
      animateParticleBurst(boardEl, center, "transform", 4, delay + 50);
    });
    animateRangeCells(boardEl, flightTargets, "effect-range-propeller", 260);
    animateHitMarks(boardEl, result.targets, true, 330);
    return;
  }

  animateRangeCells(boardEl, result.targets, "effect-range-combo", 120);
  animateHitMarks(boardEl, result.targets, true, 260);
}

function propellerCrossTargets(center) {
  const row = Math.floor(center / BOARD_SIZE);
  const col = center % BOARD_SIZE;
  return [
    center,
    row > 0 ? boardIndex(row - 1, col) : null,
    row < BOARD_SIZE - 1 ? boardIndex(row + 1, col) : null,
    col > 0 ? boardIndex(row, col - 1) : null,
    col < BOARD_SIZE - 1 ? boardIndex(row, col + 1) : null,
  ].filter((cell) => cell !== null);
}

function animateColorTransformCombo(boardEl, originIndex, transform, result) {
  const centers = transform.centers ?? [];
  const special = transform.special;
  const direction = transform.direction || "row";

  animateColorBallEffect(boardEl, originIndex, centers);
  centers.slice(0, 20).forEach((center, index) => {
    const delay = 90 + Math.min(index * 10, 130);
    animateTransformGhost(boardEl, center, special, direction, delay);
    animateParticleBurst(boardEl, center, "transform", 4, delay + 16);
  });

  if (special === "bomb") {
    centers.slice(0, 10).forEach((center, index) => {
      const delay = 220 + Math.min(index * 18, 170);
      animateAreaRange(boardEl, center, 2, "effect-range-bomb", delay);
      animateBombEffect(boardEl, center, true, delay + 105);
      animateParticleBurst(boardEl, center, "blast", 6, delay + 130);
    });
    animateHitMarks(boardEl, result.targets, true, 430);
    return;
  }

  if (special === "rocket") {
    centers.slice(0, 12).forEach((center, index) => {
      const delay = 210 + Math.min(index * 16, 150);
      const range = lineRange(center, direction);
      animateRangeCells(boardEl, range, "effect-range-rocket", delay);
      animateRocketEffect(boardEl, range, delay + 80);
      animateParticleBurst(boardEl, center, "blast", 5, delay + 100);
    });
    animateHitMarks(boardEl, result.targets, true, 390);
    return;
  }

  if (special === "propeller") {
    const flightTargets = transform.flightTargets ?? [];
    centers.slice(0, 14).forEach((center, index) => {
      const delay = 210 + Math.min(index * 14, 150);
      animateRangeCells(boardEl, propellerCrossTargets(center), "effect-range-propeller", delay);
      animateParticleBurst(boardEl, center, "transform", 5, delay + 60);
    });
    animateRangeCells(boardEl, flightTargets, "effect-range-propeller", 360);
    animateHitMarks(boardEl, result.targets, true, 430);
    return;
  }

  animateRangeCells(boardEl, result.targets, "effect-range-combo", 180);
  animateHitMarks(boardEl, result.targets, true, 360);
}

function animateFullBoardCombo(boardEl, originIndex, transform, result) {
  animateColorBallEffect(boardEl, originIndex, transform.centers ?? result.targets);
  animateRangeCells(boardEl, result.targets, "effect-range-combo", 180);
  animateHitMarks(boardEl, result.targets, true, 520);
  animateParticleBurst(boardEl, originIndex, "blast", 18, 420);
}

function animateComboTransform(boardEl, originIndex, result) {
  const transform = result.comboTransform;
  if (!transform) {
    return false;
  }

  if (transform.type === "fullBoard") {
    animateFullBoardCombo(boardEl, originIndex, transform, result);
    return true;
  }

  if (transform.type === "colorTransform") {
    animateColorTransformCombo(boardEl, originIndex, transform, result);
    return true;
  }

  return false;
}

function animateComboBadge(boardEl, originIndex, comboKey) {
  if (!comboKey) {
    return;
  }

  const badge = createEffectAt(boardEl, originIndex, "effect-combo", "组合!");
  if (!badge) {
    return;
  }
  badge.textContent = "组合!";

  animateElement(
    badge,
    [
      { opacity: 0, transform: "translate(-50%, -50%) scale(0.5)" },
      { opacity: 1, transform: "translate(-50%, -72%) scale(1.08)", offset: 0.28 },
      { opacity: 0, transform: "translate(-50%, -118%) scale(1)" },
    ],
    { duration: 640, easing: "cubic-bezier(.18,.82,.24,1)", fill: "forwards" },
  )?.finished.finally(() => badge.remove());
}

function animateSpecialEffect(side, beforeBoard, result, action = {}) {
  if (!result?.accepted) {
    return;
  }

  const boardEl = boardElementForSide(side);
  const originIndex = result.comboIndex ?? action.to ?? action.index ?? action.from ?? result.targets?.[0] ?? 0;
  const strong = Boolean(result.comboKey || result.comboSpecials);
  animateComboBadge(boardEl, originIndex, result.comboKey);

  if (animateComboTransform(boardEl, originIndex, result)) {
    return;
  }

  if (result.targets?.length) {
    if (strong || result.activatedSpecial === "bomb") {
      animateRangeCells(boardEl, result.targets, strong ? "effect-range-combo" : "effect-range-bomb");
    }
    animateHitMarks(boardEl, result.targets, strong, strong ? 120 : 0);
  }

  if (result.activatedSpecial === "rocket") {
    animateRocketEffect(boardEl, result.targets);
  } else if (result.activatedSpecial === "bomb") {
    animateBombEffect(boardEl, originIndex, strong);
  } else if (result.activatedSpecial === "propeller") {
    animatePropellerEffect(boardEl, beforeBoard, originIndex, result.targets);
  } else if (result.activatedSpecial === "colorBall") {
    animateColorBallEffect(boardEl, originIndex, result.targets);
  } else if (strong) {
    animateBombEffect(boardEl, originIndex, true);
  }
}

function animateBoardTransition(side, beforeBoard, afterBoard, result, action) {
  const boardEl = boardElementForSide(side);
  animateClearedPieces(boardEl, beforeBoard, afterBoard);
  animateMovedPieces(boardEl, beforeBoard, afterBoard);
  animateCreatedSpecials(boardEl, beforeBoard, afterBoard, result);
  animateSpecialEffect(side, beforeBoard, result, action);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function timelineMs(side, ms) {
  return Math.round(ms * (side === "swim" ? 0.62 : 1));
}

function setVisualBoard(side, board) {
  if (side === "swim") {
    swimMatchState.players.player.board = cloneBoardForAnimation(board);
    renderSwim();
    return;
  }

  state.players[side].board = cloneBoardForAnimation(board);
  renderChrome();
  renderBoard(boardElementForSide(side), side);
}

function stepCreatedSpecialNames(step) {
  return [...new Set((step.createdSpecials ?? []).map((special) => special.special))];
}

function stepSpecialResult(step, result) {
  return {
    ...result,
    accepted: true,
    activatedSpecial: step.activatedSpecial ?? result.activatedSpecial,
    comboKey: step.comboKey ?? result.comboKey,
    comboSpecials: step.comboSpecials ?? result.comboSpecials,
    comboTransform: step.comboTransform ?? result.comboTransform,
    comboIndex: step.originIndex ?? result.comboIndex,
    targets: step.targets ?? result.targets ?? [],
  };
}

function timelineDelayForSpecial(step) {
  if (step.comboTransform?.special === "bomb") {
    return 620;
  }
  if (step.comboTransform) {
    return 540;
  }
  if (step.comboKey) {
    return 440;
  }
  return 300;
}

async function playCascadeStep(side, step) {
  const boardEl = boardElementForSide(side);
  setVisualBoard(side, step.before);

  if (step.matchedCells?.length) {
    animateRangeCells(boardEl, step.matchedCells, "effect-range-match");
    await wait(timelineMs(side, 70));
  }

  setVisualBoard(side, step.afterClear);
  animateClearedPieces(boardEl, step.before, step.afterClear);
  await wait(timelineMs(side, 180));

  if (step.createdSpecials?.length) {
    setVisualBoard(side, step.afterCreate);
    animateCreatedSpecials(boardEl, step.afterClear, step.afterCreate, {
      createdSpecials: stepCreatedSpecialNames(step),
    });
    await wait(timelineMs(side, 190));
  } else {
    setVisualBoard(side, step.afterCreate);
    await wait(timelineMs(side, 20));
  }

  if (!boardsVisuallyEqual(step.afterCreate, step.afterGravity)) {
    setVisualBoard(side, step.afterGravity);
    animateMovedPieces(boardEl, step.afterCreate, step.afterGravity);
    await wait(timelineMs(side, 285));
  } else {
    await wait(timelineMs(side, 40));
  }
}

async function playColorTransformStep(side, step, result) {
  const boardEl = boardElementForSide(side);
  const stagedResult = stepSpecialResult(step, result);
  const transform = stagedResult.comboTransform;
  const originIndex = step.originIndex ?? stagedResult.comboIndex ?? stagedResult.targets?.[0] ?? 0;
  const centers = transform?.centers ?? [];
  const transformedBoard = buildComboTransformBoard(step.before, transform);

  setVisualBoard(side, step.before);
  animateComboBadge(boardEl, originIndex, stagedResult.comboKey);
  animateColorBallEffect(boardEl, originIndex, centers);
  await wait(timelineMs(side, 210));

  setVisualBoard(side, transformedBoard);
  animateTransformedSpecialPieces(boardEl, centers);
  await wait(timelineMs(side, 170));

  animateTransformedComboDetonation(boardEl, transform, stagedResult);
  await wait(timelineMs(side, timelineDelayForSpecial(step)));

  setVisualBoard(side, step.afterDamage);
  animateClearedPieces(boardEl, transformedBoard, step.afterDamage);
  await wait(timelineMs(side, 170));

  if (step.afterGravity && !boardsVisuallyEqual(step.afterDamage, step.afterGravity)) {
    setVisualBoard(side, step.afterGravity);
    animateMovedPieces(boardEl, step.afterDamage, step.afterGravity);
    await wait(timelineMs(side, 285));
  }
}

async function playSpecialStep(side, step, result) {
  if (step.comboTransform?.type === "colorTransform") {
    await playColorTransformStep(side, step, result);
    return;
  }

  setVisualBoard(side, step.before);
  animateSpecialEffect(side, step.before, stepSpecialResult(step, result), {
    index: step.originIndex,
  });
  await wait(timelineMs(side, timelineDelayForSpecial(step)));

  setVisualBoard(side, step.afterDamage);
  animateClearedPieces(boardElementForSide(side), step.before, step.afterDamage);
  await wait(timelineMs(side, 180));

  if (step.afterGravity && !boardsVisuallyEqual(step.afterDamage, step.afterGravity)) {
    setVisualBoard(side, step.afterGravity);
    animateMovedPieces(boardElementForSide(side), step.afterDamage, step.afterGravity);
    await wait(timelineMs(side, 285));
  }
}

async function playBoardTimeline(side, beforeBoard, finalBoard, result, action = {}, runId = matchRunId) {
  const expectedScreen = side === "swim" ? "swim" : "game";
  const isCurrentRun = () => runId === matchRunId && appScreen === expectedScreen;
  if (!result?.steps?.length) {
    if (!isCurrentRun()) {
      return;
    }
    renderForTimelineSide(side);
    animateBoardTransition(side, beforeBoard, finalBoard, result, action);
    await wait(timelineMs(side, BOARD_ANIMATION_MS));
    return;
  }

  animatingBoards.add(side);
  try {
    if (!isCurrentRun()) {
      return;
    }
    setVisualBoard(side, beforeBoard);
    await wait(timelineMs(side, 35));

    const firstStepBoard = result.steps[0]?.before;
    if (action.type === "swap" && firstStepBoard) {
      if (!isCurrentRun()) {
        return;
      }
      setVisualBoard(side, firstStepBoard);
      animateMovedPieces(boardElementForSide(side), beforeBoard, firstStepBoard);
      await wait(timelineMs(side, 135));
    }

    for (const step of result.steps) {
      if (!isCurrentRun()) {
        return;
      }
      if (step.type === "specialActivation") {
        await playSpecialStep(side, step, result);
      } else if (step.type === "cascade") {
        await playCascadeStep(side, step);
      }
    }

    if (!isCurrentRun()) {
      return;
    }
    setVisualBoard(side, finalBoard);
  } finally {
    animatingBoards.delete(side);
    if (isCurrentRun()) {
      if (side === "swim") {
        swimMatchState.players.player.board = cloneBoardForAnimation(finalBoard);
        renderSwim();
      } else {
        state.players[side].board = cloneBoardForAnimation(finalBoard);
        if (side === "ai" && animatingBoards.has("player")) {
          renderChrome();
          renderBoard(aiBoardEl, "ai");
        } else {
          render();
        }
      }
    }
  }
}

function animateInvalidSwap(from, to, boardEl = playerBoardEl) {
  const fromIcon = cellElement(boardEl, from)?.querySelector(".piece-icon");
  const toBox = cellBox(boardEl, to);
  const fromBox = cellBox(boardEl, from);
  if (!fromIcon || !toBox || !fromBox) {
    return;
  }

  const dx = (toBox.centerX - fromBox.centerX) * 0.34;
  const dy = (toBox.centerY - fromBox.centerY) * 0.34;
  animateElement(
    fromIcon,
    [
      { transform: "translate(0, 0)" },
      { transform: `translate(${dx}px, ${dy}px)`, offset: 0.48 },
      { transform: "translate(0, 0)" },
    ],
    { duration: 180, easing: "ease-out" },
  );
}

function bestCreatedSpecial(createdSpecials = []) {
  return CREATED_SPECIAL_PRIORITY.find((special) => createdSpecials.includes(special)) ?? null;
}

function playRoundResultSound(previousStatus) {
  if (previousStatus === "ended" || state.status !== "ended") {
    return;
  }

  const resultSound = state.winner === "player" ? "win" : state.winner === "ai" ? "lose" : "draw";
  playAudioSound(resultSound, { volume: 0.9, delay: 0.32 });
}

function playBattleEventSounds(result, side, previousStatus) {
  const sideVolume = side === "ai" ? 0.38 : 1;
  let battleDelay = 0.02;

  for (const event of result?.battleEvents ?? []) {
    if (event.type === "attack") {
      playAudioSound("attack", { volume: 0.8 * sideVolume, delay: battleDelay });
    } else if (event.type === "crate") {
      playAudioSound("crate", { volume: 0.72 * sideVolume, delay: battleDelay });
    }
    battleDelay += 0.13;
  }

  playRoundResultSound(previousStatus);
}

function playActionSounds(result, side, previousStatus, options = {}) {
  if (!result?.accepted) {
    return;
  }

  const includeBoard = options.includeBoard ?? true;
  const includeBattle = options.includeBattle ?? true;
  const includeResult = options.includeResult ?? true;
  const sideVolume = side === "player" ? 1 : 0.38;

  if (result.reshuffled) {
    playAudioSound("cascade", { volume: 0.35 * sideVolume, rate: 0.82 });
    if (includeResult) {
      playRoundResultSound(previousStatus);
    }
    return;
  }

  const activatedSound = ACTIVATE_SPECIAL_SOUNDS[result.activatedSpecial];
  if (includeBoard && activatedSound) {
    playAudioSound(activatedSound, { volume: 0.85 * sideVolume });
  }

  if (includeBoard && result.cleared > 0) {
    playAudioSound(result.cascades > 1 ? "cascade" : "match", {
      volume: (activatedSound ? 0.32 : 0.62) * sideVolume,
      delay: activatedSound ? 0.08 : 0,
      rateJitter: 0.035,
    });
  }

  const createdSpecial = bestCreatedSpecial(result.createdSpecials);
  const createdSound = CREATE_SPECIAL_SOUNDS[createdSpecial];
  if (includeBoard && createdSound) {
    playAudioSound(createdSound, { volume: 0.78 * sideVolume, delay: 0.08 });
  }

  if (includeBattle) {
    playBattleEventSounds(result, side, previousStatus);
  } else if (includeResult) {
    playRoundResultSound(previousStatus);
  }
}

function createGlobalEffect(className, text, rect) {
  const effect = document.createElement("div");
  effect.className = className;
  effect.textContent = text;
  effect.style.left = `${rect.left + rect.width / 2}px`;
  effect.style.top = `${rect.top + rect.height / 2}px`;
  document.body.append(effect);
  return effect;
}

function animateBattleEvents(result) {
  for (const event of result?.battleEvents ?? []) {
    const targetBoard = boardElementForSide(event.target);
    const targetPanel = targetBoard.closest(".fighter") || targetBoard;
    const rect = targetPanel.getBoundingClientRect();
    targetPanel.classList.add(event.type === "attack" ? "fighter-hit" : "fighter-crated");
    window.setTimeout(() => targetPanel.classList.remove("fighter-hit", "fighter-crated"), 380);

    if (event.type === "attack") {
      const damage = createGlobalEffect("damage-float", `-${event.amount}`, rect);
      animateElement(
        damage,
        [
          { opacity: 0, transform: "translate(-50%, -20%) scale(0.72)" },
          { opacity: 1, transform: "translate(-50%, -68%) scale(1.12)", offset: 0.22 },
          { opacity: 0, transform: "translate(-50%, -128%) scale(1)" },
        ],
        { duration: 760, easing: "cubic-bezier(.18,.82,.24,1)", fill: "forwards" },
      )?.finished.finally(() => damage.remove());
    } else if (event.type === "crate") {
      const warning = createGlobalEffect("crate-float", "木箱+1", rect);
      animateElement(
        warning,
        [
          { opacity: 0, transform: "translate(-50%, -30%) scale(0.72)" },
          { opacity: 1, transform: "translate(-50%, -72%) scale(1.05)", offset: 0.26 },
          { opacity: 0, transform: "translate(-50%, -116%) scale(1)" },
        ],
        { duration: 720, easing: "ease-out", fill: "forwards" },
      )?.finished.finally(() => warning.remove());
    }
  }
}

function flushPendingPlayerSettlements() {
  if (playerSettlementTimer) {
    window.clearTimeout(playerSettlementTimer);
    playerSettlementTimer = null;
  }

  if (pendingPlayerSettlements.length === 0) {
    render();
    return;
  }

  const settlements = pendingPlayerSettlements;
  pendingPlayerSettlements = [];

  for (const settlement of settlements) {
    applyResultToBattle(state, "player", settlement.result);
  }

  render();

  for (const settlement of settlements) {
    playBattleEventSounds(settlement.result, "player", settlement.previousStatus);
    animateBattleEvents(settlement.result);
  }

  flushPendingAiSettlements();
}

function applyPlayerBattleResultNow(result, previousStatus) {
  applyResultToBattle(state, "player", result);
  renderChrome();
  renderBoard(aiBoardEl, "ai");
  return { result, previousStatus };
}

function playPlayerBattleFeedback(settlement) {
  playBattleEventSounds(settlement.result, "player", settlement.previousStatus);
  animateBattleEvents(settlement.result);
  flushPendingAiSettlements();
}

function schedulePendingPlayerSettlement(result, previousStatus) {
  pendingPlayerSettlements.push({ result, previousStatus });

  if (playerSettlementTimer) {
    window.clearTimeout(playerSettlementTimer);
  }

  const delay =
    pendingPlayerSettlements.length >= MAX_BUFFERED_PLAYER_ACTIONS
      ? BOARD_ANIMATION_MS + 80
      : PLAYER_SETTLE_DELAY_MS;
  playerSettlementTimer = window.setTimeout(flushPendingPlayerSettlements, delay);
}

function playerBoardBusyForAiBattle() {
  return animatingBoards.has("player") || pendingPlayerSettlements.length > 0;
}

function renderAiActionResult() {
  if (animatingBoards.has("player")) {
    renderChrome();
    renderBoard(aiBoardEl, "ai");
    return;
  }
  render();
}

function flushPendingAiSettlements() {
  if (pendingAiSettlements.length === 0 || playerBoardBusyForAiBattle() || animatingBoards.has("ai")) {
    return;
  }

  if (state.status !== "playing") {
    pendingAiSettlements = [];
    render();
    return;
  }

  const settlements = pendingAiSettlements;
  pendingAiSettlements = [];

  for (const settlement of settlements) {
    if (state.status !== "playing") {
      break;
    }
    applyResultToBattle(state, "ai", settlement.result);
  }

  render();

  for (const settlement of settlements) {
    playBattleEventSounds(settlement.result, "ai", settlement.previousStatus);
    animateBattleEvents(settlement.result);
  }
}

function schedulePendingAiSettlement(result, previousStatus) {
  pendingAiSettlements.push({ result, previousStatus });
}

function activeSwimRacer(racer) {
  return racer && !racer.finished && !racer.eliminated;
}

function setSwimRacerRows(racer, totalRows) {
  const clamped = Math.max(0, Math.min(SWIM_TRACK_ROWS - 1, totalRows));
  racer.totalRows = clamped;
  racer.screen = Math.min(SWIM_SCREEN_COUNT, Math.floor(clamped / BOARD_SIZE) + 1);
  racer.row = clamped % BOARD_SIZE;
}

function countBoardPieces(board, type) {
  return board.filter((piece) => piece?.type === type).length;
}

function finishSwimRacer(racer) {
  if (!activeSwimRacer(racer)) {
    return;
  }

  racer.finished = true;
  setSwimRacerRows(racer, SWIM_TRACK_ROWS - 1);
  racer.finishPlace = swimState.placements.length + 1;
  swimState.placements.push(racer.id);
  racer.lastMove = `第 ${racer.finishPlace} 名完成`;

  if (racer.isPlayer) {
    swimState.status = "ended";
  }
}

function createNextSwimScreen() {
  const nextCol = swimState.duckCol;
  swimState.screen++;
  swimState.duckRow = 0;
  swimState.duckCol = nextCol;
  swimMatchState.players.player.board = seedSwimBoard(createBattleState().players.player.board, swimState.screen, swimState.duckCol);
  syncPlayerSwimRacer();
}

function maybeAdvanceSwimScreen() {
  if (swimState.duckRow < BOARD_SIZE - 1 || swimState.status !== "playing") {
    return { screenAdvanced: false, finished: false };
  }

  if (swimState.screen >= SWIM_SCREEN_COUNT) {
    const player = swimState.racers.find((racer) => racer.isPlayer);
    finishSwimRacer(player);
    return { screenAdvanced: false, finished: true };
  }

  createNextSwimScreen();
  return { screenAdvanced: true, finished: false };
}

function advanceSwimRacer(racer, steps) {
  if (!activeSwimRacer(racer)) {
    return { moved: 0, blocked: false };
  }

  const nextRows = racer.totalRows + steps;
  if (nextRows >= SWIM_TRACK_ROWS - 1) {
    finishSwimRacer(racer);
    return { moved: Math.max(0, SWIM_TRACK_ROWS - 1 - racer.totalRows), blocked: false };
  }
  setSwimRacerRows(racer, nextRows);
  return { moved: steps, blocked: false };
}

function swimColumnHasCrate(board, col) {
  for (let row = 0; row < BOARD_SIZE; row++) {
    if (board[boardIndex(row, col)]?.type === "crate") {
      return true;
    }
  }
  return false;
}

function pushSwimColumnUp(board, col) {
  for (let row = 0; row < BOARD_SIZE - 1; row++) {
    board[boardIndex(row, col)] = board[boardIndex(row + 1, col)];
  }
  board[boardIndex(BOARD_SIZE - 1, col)] = createSwimGem();
}

function pushSwimBoardUpOnce(board) {
  if (swimState.duckRow <= 0) {
    return false;
  }

  let pushedColumns = 0;
  for (let col = 0; col < BOARD_SIZE; col++) {
    if (swimColumnHasCrate(board, col)) {
      continue;
    }
    pushSwimColumnUp(board, col);
    pushedColumns++;
  }

  if (pushedColumns === 0) {
    return false;
  }

  ensureSwimDuckOnBoard(board);
  syncPlayerSwimRacer();
  return true;
}

function triggerSwimWave() {
  const board = swimMatchState.players.player.board;
  let pushed = 0;
  for (let i = 0; i < SWIM_WAVE_PUSH_ROWS; i++) {
    if (!pushSwimBoardUpOnce(board)) {
      break;
    }
    pushed++;
  }

  if (pushed > 0) {
    swimState.waveSurges++;
    resolveBoard(board, swimDuckIndex(), SWIM_RESOLVE_OPTIONS);
  }
  swimState.waveCountdown = SWIM_WAVE_INTERVAL;

  for (const racer of swimState.racers) {
    if (racer.isPlayer || !activeSwimRacer(racer)) {
      continue;
    }
    setSwimRacerRows(racer, racer.totalRows - pushed);
    racer.lastMove = pushed > 0 ? `浪潮后退 ${pushed} 行` : "鸭子在顶端，浪潮未推";
  }

  return { pushed };
}

function applySwimResult(result, context = {}) {
  const player = swimState.racers.find((racer) => racer.isPlayer);
  const cratesBefore = context.cratesBefore ?? countBoardPieces(swimMatchState.players.player.board, "crate");
  const cratesAfter = countBoardPieces(swimMatchState.players.player.board, "crate");
  const cleared = Math.max(0, cratesBefore - cratesAfter);
  const beforeDuckIndex = context.duckIndexBefore ?? swimDuckIndex();
  syncPlayerSwimRacer();
  const afterDuckIndex = swimDuckIndex();
  const rowDelta = Math.floor(afterDuckIndex / BOARD_SIZE) - Math.floor(beforeDuckIndex / BOARD_SIZE);
  const colDelta = (afterDuckIndex % BOARD_SIZE) - (beforeDuckIndex % BOARD_SIZE);
  const progression = maybeAdvanceSwimScreen();

  swimState.turn++;
  swimState.waveCountdown--;
  const duckAtBottom = swimState.duckRow >= BOARD_SIZE - 1;
  const movedText = progression.finished
    ? "五屏完成"
    : progression.screenAdvanced
      ? `进入第 ${swimState.screen}/${SWIM_SCREEN_COUNT} 屏`
      : rowDelta > 0
        ? `掉落 ${rowDelta} 格`
        : rowDelta < 0
          ? `上移 ${Math.abs(rowDelta)} 格`
          : colDelta !== 0
            ? `横移 ${Math.abs(colDelta)} 格`
            : duckAtBottom
              ? "鸭子已到底部"
              : "鸭子位置未变化";
  const clearText =
    progression.screenAdvanced || progression.finished
      ? `上一屏剩余 ${cratesAfter} 个木箱`
      : cleared > 0
        ? `清理 ${cleared} 个木箱，剩余 ${cratesAfter} 个`
        : `本屏剩余 ${cratesAfter} 个木箱`;
  player.lastMove = `${movedText} · ${clearText}`;
  swimState.lastSummary = `本次行动：${movedText}，${clearText}。`;

  if (swimState.waveCountdown <= 0 && swimState.status === "playing") {
    const wave = triggerSwimWave();
    swimState.lastSummary +=
      wave.pushed > 0 ? ` 浪潮上推 ${wave.pushed} 行，鸭子和棋盘一起后退。` : " 鸭子已在本屏顶端，浪潮本次不上推。";
  }
  if (swimState.status === "playing") {
    ensureSwimBoardPlayable(swimMatchState.players.player.board);
  }
  syncPlayerSwimRacer();
}

function tickSwimAi() {
  if (appScreen !== "swim" || swimState.status !== "playing") {
    stopSwimLoop();
    return;
  }

  for (const racer of swimState.racers) {
    if (racer.isPlayer || !activeSwimRacer(racer)) {
      continue;
    }

    const speed = Math.random() < SWIM_AI_DOUBLE_STEP_CHANCE ? 2 : 1;
    const movement = advanceSwimRacer(racer, speed);
    racer.lastMove = racer.finished ? `第 ${racer.finishPlace} 名完成` : `推进 ${movement.moved} 行`;
  }

  renderSwim();
}

function runAcceptedSwimAction(beforeBoard, finalBoard, result, action) {
  const runId = matchRunId;
  const cratesBefore = countBoardPieces(beforeBoard, "crate");
  const duckIndexBefore = beforeBoard.findIndex((piece) => piece?.swimDuck);
  playActionSounds(result, "swim", "playing", { includeBattle: false, includeResult: false });
  void playBoardTimeline("swim", beforeBoard, finalBoard, result, action, runId).then(() => {
    if (runId !== matchRunId || appScreen !== "swim") {
      return;
    }
    applySwimResult(result, { cratesBefore, duckIndexBefore });
    renderSwim();
  });
}

function swapBoardPieces(board, first, second) {
  const piece = board[first];
  board[first] = board[second];
  board[second] = piece;
}

function swimMoveResult(cascade = null, flags = {}) {
  return {
    accepted: true,
    cleared: cascade?.cleared ?? 0,
    damageCharge: cascade?.damageCharge ?? 0,
    obstacleCharge: cascade?.obstacleCharge ?? 0,
    createdSpecials: cascade?.createdSpecials ?? [],
    cascades: cascade?.cascades ?? 0,
    targets: [],
    steps: cascade?.steps ?? [],
    ...flags,
  };
}

function applySwimMovementAction(board, from, to) {
  if (!isAdjacentIndex(from, to)) {
    return { accepted: false, reason: "not-adjacent" };
  }

  const fromPiece = board[from];
  const toPiece = board[to];
  if (!fromPiece && !toPiece) {
    return { accepted: false, reason: "empty" };
  }
  if (fromPiece?.type === "crate" || toPiece?.type === "crate") {
    return { accepted: false, reason: "blocked" };
  }

  if (!fromPiece || !toPiece) {
    const movingPiece = fromPiece ?? toPiece;
    const emptyIndex = fromPiece ? to : from;
    swapBoardPieces(board, from, to);
    const cascade = resolveBoard(board, emptyIndex, SWIM_RESOLVE_OPTIONS);
    return swimMoveResult(cascade, {
      emptyMove: true,
      duckMove: Boolean(movingPiece?.swimDuck),
    });
  }

  if (!fromPiece.swimDuck && !toPiece.swimDuck) {
    return null;
  }

  const otherIndex = fromPiece.swimDuck ? to : from;
  const otherPiece = board[otherIndex];
  if (otherPiece?.type !== "gem" || otherPiece.swimDuck) {
    return { accepted: false, reason: "blocked" };
  }

  swapBoardPieces(board, from, to);
  const gemTriggerIndex = fromPiece.swimDuck ? from : to;
  const cascade = resolveBoard(board, gemTriggerIndex, SWIM_RESOLVE_OPTIONS);
  return swimMoveResult(cascade, { duckMove: true });
}

function applySwimSwap(from, to) {
  if (!canAcceptSwimInput()) {
    return { accepted: false, reason: "settling" };
  }

  const beforeBoard = cloneBoardForAnimation(swimMatchState.players.player.board);
  const directSwimMove = applySwimMovementAction(swimMatchState.players.player.board, from, to);
  const result =
    directSwimMove ??
    applySwapAction(swimMatchState, "player", from, to, {
      deferBattle: true,
      resolveOptions: SWIM_RESOLVE_OPTIONS,
    });
  swimSelectedIndex = null;

  if (result.accepted) {
    const finalBoard = cloneBoardForAnimation(swimMatchState.players.player.board);
    runAcceptedSwimAction(beforeBoard, finalBoard, result, { type: "swap", from, to });
    return result;
  }

  renderSwim();
  animateInvalidSwap(from, to, swimPlayerBoardEl);
  return result;
}

function applySwimSpecial(index) {
  if (!canAcceptSwimInput()) {
    return { accepted: false, reason: "settling" };
  }

  const beforeBoard = cloneBoardForAnimation(swimMatchState.players.player.board);
  const result = applySpecialAction(swimMatchState, "player", index, {
    deferBattle: true,
    resolveOptions: SWIM_RESOLVE_OPTIONS,
  });
  swimSelectedIndex = null;

  if (result.accepted) {
    const finalBoard = cloneBoardForAnimation(swimMatchState.players.player.board);
    runAcceptedSwimAction(beforeBoard, finalBoard, result, { type: "special", index });
    return result;
  }

  renderSwim();
  return result;
}

function applyPlayerSwap(from, to) {
  if (!canAcceptPlayerInput()) {
    return { accepted: false, reason: "settling" };
  }

  const previousStatus = state.status;
  const beforeBoard = cloneBoardForAnimation(state.players.player.board);
  const result = applySwapAction(state, "player", from, to, { deferBattle: true });
  selectedIndex = result.accepted ? null : to;

  if (result.accepted) {
    const finalBoard = cloneBoardForAnimation(state.players.player.board);
    const runId = matchRunId;
    const settlement = applyPlayerBattleResultNow(result, previousStatus);
    playActionSounds(result, "player", previousStatus, { includeBattle: false, includeResult: false });
    void playBoardTimeline("player", beforeBoard, finalBoard, result, { type: "swap", from, to }, runId).then(() => {
      if (runId !== matchRunId || appScreen !== "game") {
        return;
      }
      playPlayerBattleFeedback(settlement);
    });
    return result;
  }

  render();
  animateInvalidSwap(from, to);
  return result;
}

function applyPlayerSpecial(index) {
  if (!canAcceptPlayerInput()) {
    return { accepted: false, reason: "settling" };
  }

  const previousStatus = state.status;
  const beforeBoard = cloneBoardForAnimation(state.players.player.board);
  const result = applySpecialAction(state, "player", index, { deferBattle: true });
  selectedIndex = null;

  if (result.accepted) {
    const finalBoard = cloneBoardForAnimation(state.players.player.board);
    const runId = matchRunId;
    const settlement = applyPlayerBattleResultNow(result, previousStatus);
    playActionSounds(result, "player", previousStatus, { includeBattle: false, includeResult: false });
    void playBoardTimeline("player", beforeBoard, finalBoard, result, { type: "special", index }, runId).then(() => {
      if (runId !== matchRunId || appScreen !== "game") {
        return;
      }
      playPlayerBattleFeedback(settlement);
    });
    return result;
  }

  render();
  return result;
}

function isSpecialType(piece) {
  return piece && ["propeller", "rocket", "bomb", "colorBall"].includes(piece.type);
}

function adjacentSpecialIndex(index, board = state.players.player.board) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const neighbors = [
    row > 0 ? index - BOARD_SIZE : null,
    row < BOARD_SIZE - 1 ? index + BOARD_SIZE : null,
    col > 0 ? index - 1 : null,
    col < BOARD_SIZE - 1 ? index + 1 : null,
  ];
  const specialNeighbors = neighbors.filter((target) => target !== null && isSpecialType(board[target]));
  return specialNeighbors.sort((a, b) => {
    const aType = board[a]?.type;
    const bType = board[b]?.type;
    return CREATED_SPECIAL_PRIORITY.indexOf(aType) - CREATED_SPECIAL_PRIORITY.indexOf(bType);
  })[0] ?? null;
}

function isAdjacentIndex(first, second) {
  return Math.abs(Math.floor(first / BOARD_SIZE) - Math.floor(second / BOARD_SIZE)) + Math.abs((first % BOARD_SIZE) - (second % BOARD_SIZE)) === 1;
}

function handleSwimCell(index) {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  if (!canAcceptSwimInput()) {
    return;
  }

  const board = swimMatchState.players.player.board;
  const piece = board[index];
  if (piece?.type === "crate") {
    swimSelectedIndex = null;
    renderSwim();
    return;
  }

  if (swimSelectedIndex === null) {
    if (!piece) {
      swimSelectedIndex = null;
      renderSwim();
      return;
    }
    if (isSpecialType(piece)) {
      const adjacentSpecial = adjacentSpecialIndex(index, board);
      if (adjacentSpecial !== null) {
        applySwimSwap(index, adjacentSpecial);
        return;
      }
      applySwimSpecial(index);
      return;
    }
    swimSelectedIndex = index;
    renderSwim();
    return;
  }

  if (swimSelectedIndex === index) {
    if (isSpecialType(piece)) {
      swimSelectedIndex = null;
      applySwimSpecial(index);
      return;
    }
    swimSelectedIndex = null;
    renderSwim();
    return;
  }

  const selectedPiece = board[swimSelectedIndex];
  if (!selectedPiece) {
    swimSelectedIndex = null;
    renderSwim();
    return;
  }
  if (!piece) {
    applySwimSwap(swimSelectedIndex, index);
    return;
  }
  if (isSpecialType(selectedPiece) || isSpecialType(piece)) {
    if (isAdjacentIndex(swimSelectedIndex, index)) {
      applySwimSwap(swimSelectedIndex, index);
      return;
    }

    if (isSpecialType(piece) && adjacentSpecialIndex(index, board) === null) {
      swimSelectedIndex = null;
      renderSwim();
      applySwimSpecial(index);
      return;
    }
  }

  applySwimSwap(swimSelectedIndex, index);
}

function handlePlayerCell(index) {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  if (!canAcceptPlayerInput()) {
    return;
  }

  const piece = state.players.player.board[index];
  if (!piece || piece.type === "crate") {
    selectedIndex = null;
    render();
    return;
  }

  if (selectedIndex === null) {
    if (isSpecialType(piece)) {
      const adjacentSpecial = adjacentSpecialIndex(index);
      if (adjacentSpecial !== null) {
        applyPlayerSwap(index, adjacentSpecial);
        return;
      }
      applyPlayerSpecial(index);
      return;
    }
    selectedIndex = index;
    render();
    return;
  }

  if (selectedIndex === index) {
    if (isSpecialType(piece)) {
      selectedIndex = null;
      applyPlayerSpecial(index);
      return;
    }
    selectedIndex = null;
    render();
    return;
  }

  const selectedPiece = state.players.player.board[selectedIndex];
  if (isSpecialType(selectedPiece) || isSpecialType(piece)) {
    if (Math.abs(Math.floor(selectedIndex / BOARD_SIZE) - Math.floor(index / BOARD_SIZE)) + Math.abs((selectedIndex % BOARD_SIZE) - (index % BOARD_SIZE)) === 1) {
      applyPlayerSwap(selectedIndex, index);
      return;
    }

    if (isSpecialType(piece) && adjacentSpecialIndex(index) === null) {
      selectedIndex = null;
      render();
      applyPlayerSpecial(index);
      return;
    }
  }

  applyPlayerSwap(selectedIndex, index);
}

function handlePointerDown(event, index, mode = "boxing") {
  void primeAudio();

  const isSwim = mode === "swim";
  const board = isSwim ? swimMatchState.players.player.board : state.players.player.board;
  const canInput = isSwim ? canAcceptSwimInput() : canAcceptPlayerInput();
  if (!canInput || event.button > 0) {
    return;
  }

  const piece = board[index];
  if ((isSwim && piece?.type === "crate") || (!isSwim && (!piece || piece.type === "crate"))) {
    return;
  }

  swipeStart = {
    index,
    mode,
    boardEl: isSwim ? swimPlayerBoardEl : playerBoardEl,
    x: event.clientX,
    y: event.clientY,
    pointerId: event.pointerId,
    resolved: false,
  };
  event.currentTarget.classList.add("cell-dragging");
  event.currentTarget.style.setProperty("--drag-x", "0px");
  event.currentTarget.style.setProperty("--drag-y", "0px");
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function resetDragVisual(index, animateBack, boardEl = playerBoardEl) {
  const cell = cellElement(boardEl, index);
  if (!cell) {
    return;
  }

  if (animateBack) {
    cell.classList.add("cell-drag-return");
  }
  cell.style.setProperty("--drag-x", "0px");
  cell.style.setProperty("--drag-y", "0px");
  window.setTimeout(() => {
    cell.classList.remove("cell-dragging", "cell-drag-return");
    cell.style.removeProperty("--drag-x");
    cell.style.removeProperty("--drag-y");
  }, animateBack ? 150 : 0);
}

function handlePointerMove(event) {
  if (!swipeStart || swipeStart.resolved || event.pointerId !== swipeStart.pointerId) {
    return;
  }

  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  const boardEl = swipeStart.boardEl ?? playerBoardEl;
  const isSwim = swipeStart.mode === "swim";
  const cell = cellElement(boardEl, swipeStart.index);
  if (cell) {
    cell.style.setProperty("--drag-x", `${dx}px`);
    cell.style.setProperty("--drag-y", `${dy}px`);
  }
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
    return;
  }

  const target = targetIndexForSwipe(swipeStart.index, dx, dy);
  if (target === null) {
    swipeStart.resolved = true;
    suppressNextClick = true;
    if (isSwim) {
      swimSelectedIndex = null;
    } else {
      selectedIndex = null;
    }
    resetDragVisual(swipeStart.index, true, boardEl);
    return;
  }

  swipeStart.resolved = true;
  suppressNextClick = true;
  if (isSwim) {
    swimSelectedIndex = null;
  } else {
    selectedIndex = null;
  }
  resetDragVisual(swipeStart.index, false, boardEl);
  if (isSwim) {
    applySwimSwap(swipeStart.index, target);
  } else {
    applyPlayerSwap(swipeStart.index, target);
  }
  event.preventDefault();
}

function handlePointerEnd() {
  if (swipeStart && !swipeStart.resolved) {
    resetDragVisual(swipeStart.index, true, swipeStart.boardEl ?? playerBoardEl);
  }
  swipeStart = null;
}

function targetIndexForSwipe(index, dx, dy) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && col < BOARD_SIZE - 1) {
      return index + 1;
    }
    if (dx < 0 && col > 0) {
      return index - 1;
    }
    return null;
  }

  if (dy > 0 && row < BOARD_SIZE - 1) {
    return index + BOARD_SIZE;
  }
  if (dy < 0 && row > 0) {
    return index - BOARD_SIZE;
  }

  return null;
}

function startAiLoop() {
  if (aiInterval) {
    window.clearInterval(aiInterval);
  }

  aiInterval = window.setInterval(() => {
    if (appScreen !== "game" || currentMode !== "boxing" || state.status !== "playing") {
      window.clearInterval(aiInterval);
      aiInterval = null;
      render();
      return;
    }

    if (animatingBoards.has("ai")) {
      return;
    }

    if (pendingAiSettlements.length > 0 && !playerBoardBusyForAiBattle()) {
      flushPendingAiSettlements();
      return;
    }

    const deferBattle = playerBoardBusyForAiBattle();
    if (deferBattle && pendingAiSettlements.length >= MAX_BUFFERED_AI_SETTLEMENTS) {
      return;
    }

    const previousStatus = state.status;
    const beforeBoard = cloneBoardForAnimation(state.players.ai.board);
    const result = takeAiTurn(state, {
      deferBattle,
      resolveOptions: BOXING_AI_RESOLVE_OPTIONS,
    });
    const finalBoard = cloneBoardForAnimation(state.players.ai.board);
    const runId = matchRunId;
    playActionSounds(result, "ai", previousStatus);
    if (deferBattle && result.accepted && !result.reshuffled) {
      schedulePendingAiSettlement(result, previousStatus);
    }
    if (result.accepted && !result.reshuffled) {
      void playBoardTimeline("ai", beforeBoard, finalBoard, result, {}, runId);
    } else {
      renderAiActionResult();
    }
  }, GAME_CONFIG.battle.aiTurnMs);
}

function startNewMatch() {
  matchRunId++;
  currentMode = "boxing";
  stopSwimLoop();
  appScreen = "game";
  matchRecordSaved = false;
  swimRecordSaved = true;
  state = createBattleState();
  selectedIndex = null;
  swipeStart = null;
  suppressNextClick = false;
  animatingBoards.clear();
  clearPendingPlayerSettlements();
  render();
  startAiLoop();
}

function startSwimLoop() {
  if (swimAiInterval) {
    window.clearInterval(swimAiInterval);
  }
  swimAiInterval = window.setInterval(tickSwimAi, SWIM_AI_TURN_MS);
}

function startSwimRace() {
  matchRunId++;
  currentMode = "swim";
  stopAiLoop();
  clearPendingPlayerSettlements();
  appScreen = "swim";
  matchRecordSaved = true;
  swimRecordSaved = false;
  swimMatchState = createBattleState();
  seedSwimBoard(swimMatchState.players.player.board, 1);
  swimMatchState.players.ai.board = [];
  swimState = createSwimState();
  swimSelectedIndex = null;
  swipeStart = null;
  suppressNextClick = false;
  animatingBoards.clear();
  renderSwim();
  startSwimLoop();
}

function handleNewMatchButton() {
  void primeAudio();
  playAudioSound("uiTap", { volume: 0.6 });
  if (currentMode === "swim") {
    startSwimRace();
    return;
  }
  startNewMatch();
}

function handleStartMatchButton() {
  void primeAudio();
  playAudioSound("uiTap", { volume: 0.6 });
  startNewMatch();
}

function handleStartSwimButton() {
  void primeAudio();
  playAudioSound("uiTap", { volume: 0.6 });
  startSwimRace();
}

function handleRecordToggleButton() {
  void primeAudio();
  playAudioSound("uiTap", { volume: 0.45 });
  setRecordPanelVisible(recordPanelEl.classList.contains("record-panel-hidden"));
}

function handleRecordResetButton() {
  void primeAudio();
  playAudioSound("uiTap", { volume: 0.45 });
  writeRecord(emptyRecordBook());
  renderRecord();
}

function handleResultMenuButton() {
  void primeAudio();
  playAudioSound("uiTap", { volume: 0.5 });
  showStartScreen();
}

document.addEventListener?.("pointerdown", () => void primeAudio(), { once: true, passive: true });
document.addEventListener?.("keydown", () => void primeAudio(), { once: true });
startMatchButton.addEventListener("click", handleStartMatchButton);
startSwimButton.addEventListener("click", handleStartSwimButton);
gameMenuButton.addEventListener("click", handleResultMenuButton);
newMatchButton.addEventListener("click", handleNewMatchButton);
newSwimButton.addEventListener("click", () => {
  void primeAudio();
  playAudioSound("uiTap", { volume: 0.6 });
  startSwimRace();
});
swimMenuButton.addEventListener("click", handleResultMenuButton);
resultNewMatchButton.addEventListener("click", handleNewMatchButton);
resultMenuButton.addEventListener("click", handleResultMenuButton);
recordToggleButton.addEventListener("click", handleRecordToggleButton);
recordResetButton.addEventListener("click", handleRecordResetButton);

window.matchComboDebug = {
  getState: () => state,
  getSwimState: () => swimState,
  findPlayerMove: () => findBestMove(state.players.player.board),
  findSwimMove: () => findBestMove(swimMatchState.players.player.board),
  startNewMatch,
  startSwimRace,
  showStartScreen,
  getRecord: readRecord,
  forceRender: render,
  forceSwimRender: renderSwim,
  playSound: (name) => {
    void primeAudio().then(() => playAudioSound(name));
  },
  forceResult: (winner) => {
    const previousStatus = state.status;
    state.status = "ended";
    state.winner = winner;
    playRoundResultSound(previousStatus);
    render();
  },
};

function startupModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get("mode");
  const versionTag = params.get("v") || "";
  if (requestedMode === "swim" || versionTag.startsWith("swim-")) {
    return "swim";
  }
  if (requestedMode === "boxing") {
    return "boxing";
  }
  return "start";
}

const startupMode = startupModeFromUrl();
if (startupMode === "swim") {
  startSwimRace();
} else if (startupMode === "boxing") {
  startNewMatch();
} else {
  showStartScreen();
}
