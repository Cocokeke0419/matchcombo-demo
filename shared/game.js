import { GAME_CONFIG } from "./config.js";

export const BOARD_SIZE = GAME_CONFIG.board.size;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const COLORS = GAME_CONFIG.board.colors;

export const MAX_HP = GAME_CONFIG.battle.maxHp;
export const DAMAGE_CHARGE_MAX = GAME_CONFIG.battle.damageChargeMax;
export const OBSTACLE_CHARGE_MAX = GAME_CONFIG.battle.obstacleChargeMax;
export const DAMAGE_PER_ATTACK = GAME_CONFIG.battle.damagePerAttack;

let nextPieceId = 1;

function indexOf(row, col) {
  return row * BOARD_SIZE + col;
}

export function rowOf(index) {
  return Math.floor(index / BOARD_SIZE);
}

export function colOf(index) {
  return index % BOARD_SIZE;
}

export function isAdjacent(a, b) {
  const dr = Math.abs(rowOf(a) - rowOf(b));
  const dc = Math.abs(colOf(a) - colOf(b));
  return dr + dc === 1;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function weightedChoice(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.value;
    }
  }

  return items[items.length - 1].value;
}

function createGem(color = randomChoice(COLORS)) {
  return {
    id: nextPieceId++,
    type: "gem",
    color,
  };
}

function createRocket(direction) {
  return {
    id: nextPieceId++,
    type: "rocket",
    direction,
  };
}

function createBomb() {
  return {
    id: nextPieceId++,
    type: "bomb",
  };
}

function createPropeller() {
  return {
    id: nextPieceId++,
    type: "propeller",
  };
}

function createColorBall() {
  return {
    id: nextPieceId++,
    type: "colorBall",
  };
}

function createCrate(hp = 1) {
  return {
    id: nextPieceId++,
    type: "crate",
    hp,
  };
}

function clonePiece(piece) {
  return piece ? { ...piece } : null;
}

function cloneBoard(board) {
  return board.map(clonePiece);
}

function canMatch(piece) {
  return piece?.type === "gem" && !piece.swimDuck;
}

function sameColorGem(a, b) {
  return canMatch(a) && canMatch(b) && a.color === b.color;
}

function wouldCreateInitialMatch(board, row, col, color) {
  if (col >= 2) {
    const a = board[indexOf(row, col - 1)];
    const b = board[indexOf(row, col - 2)];
    if (a?.color === color && b?.color === color) {
      return true;
    }
  }

  if (row >= 2) {
    const a = board[indexOf(row - 1, col)];
    const b = board[indexOf(row - 2, col)];
    if (a?.color === color && b?.color === color) {
      return true;
    }
  }

  if (row >= 1 && col >= 1) {
    const left = board[indexOf(row, col - 1)];
    const up = board[indexOf(row - 1, col)];
    const diagonal = board[indexOf(row - 1, col - 1)];
    if (left?.color === color && up?.color === color && diagonal?.color === color) {
      return true;
    }
  }

  return false;
}

export function createBoard() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const board = Array(CELL_COUNT).fill(null);

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const options = COLORS.filter((color) => !wouldCreateInitialMatch(board, row, col, color));
        board[indexOf(row, col)] = createGem(randomChoice(options.length ? options : COLORS));
      }
    }

    if (findBestMove(board)) {
      return board;
    }
  }

  return Array.from({ length: CELL_COUNT }, () => createGem());
}

function findLineMatches(board) {
  const groups = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    let col = 0;
    while (col < BOARD_SIZE) {
      const start = col;
      const first = board[indexOf(row, col)];
      col++;

      while (col < BOARD_SIZE && sameColorGem(first, board[indexOf(row, col)])) {
        col++;
      }

      const length = col - start;
      if (canMatch(first) && length >= 3) {
        groups.push({
          orientation: "row",
          cells: Array.from({ length }, (_, offset) => indexOf(row, start + offset)),
        });
      }
    }
  }

  for (let col = 0; col < BOARD_SIZE; col++) {
    let row = 0;
    while (row < BOARD_SIZE) {
      const start = row;
      const first = board[indexOf(row, col)];
      row++;

      while (row < BOARD_SIZE && sameColorGem(first, board[indexOf(row, col)])) {
        row++;
      }

      const length = row - start;
      if (canMatch(first) && length >= 3) {
        groups.push({
          orientation: "column",
          cells: Array.from({ length }, (_, offset) => indexOf(start + offset, col)),
        });
      }
    }
  }

  return groups;
}

function findSquareMatches(board) {
  const groups = [];

  for (let row = 0; row < BOARD_SIZE - 1; row++) {
    for (let col = 0; col < BOARD_SIZE - 1; col++) {
      const topLeft = board[indexOf(row, col)];
      const cells = [
        indexOf(row, col),
        indexOf(row, col + 1),
        indexOf(row + 1, col),
        indexOf(row + 1, col + 1),
      ];

      if (canMatch(topLeft) && cells.every((cell) => sameColorGem(topLeft, board[cell]))) {
        groups.push({
          orientation: "square",
          cells,
        });
      }
    }
  }

  return groups;
}

function mergeMatchGroups(groups) {
  const components = [];

  for (const group of groups) {
    const overlaps = [];
    const groupSet = new Set(group.cells);

    components.forEach((component, componentIndex) => {
      if (group.cells.some((cell) => component.cells.has(cell))) {
        overlaps.push(componentIndex);
      }
    });

    if (overlaps.length === 0) {
      components.push({
        cells: groupSet,
        groups: [group],
      });
      continue;
    }

    const target = components[overlaps[0]];
    group.cells.forEach((cell) => target.cells.add(cell));
    target.groups.push(group);

    for (let i = overlaps.length - 1; i >= 1; i--) {
      const merged = components[overlaps[i]];
      merged.cells.forEach((cell) => target.cells.add(cell));
      target.groups.push(...merged.groups);
      components.splice(overlaps[i], 1);
    }
  }

  return components;
}

export function findMatchComponents(board) {
  return mergeMatchGroups([...findLineMatches(board), ...findSquareMatches(board)]);
}

function summarizeComponent(component) {
  const hasRow = component.groups.some((group) => group.orientation === "row");
  const hasColumn = component.groups.some((group) => group.orientation === "column");
  const hasSquare = component.groups.some((group) => group.orientation === "square");
  const lineGroups = component.groups.filter((group) => group.orientation === "row" || group.orientation === "column");
  const lineMaxLength = lineGroups.length ? Math.max(...lineGroups.map((group) => group.cells.length)) : 0;

  if (lineMaxLength >= 5) {
    return {
      special: "colorBall",
      damageBonus: GAME_CONFIG.specials.colorBall.create.damageCharge,
      obstacleBonus: GAME_CONFIG.specials.colorBall.create.obstacleCharge,
    };
  }

  if (hasRow && hasColumn) {
    return {
      special: "bomb",
      damageBonus: GAME_CONFIG.specials.bomb.create.damageCharge,
      obstacleBonus: GAME_CONFIG.specials.bomb.create.obstacleCharge,
    };
  }

  if (lineMaxLength >= 4) {
    const longest = lineGroups.find((group) => group.cells.length === lineMaxLength);
    return {
      special: "rocket",
      direction: longest.orientation === "row" ? "column" : "row",
      damageBonus: GAME_CONFIG.specials.rocket.create.damageCharge,
      obstacleBonus: GAME_CONFIG.specials.rocket.create.obstacleCharge,
    };
  }

  if (hasSquare) {
    return {
      special: "propeller",
      damageBonus: GAME_CONFIG.specials.propeller.create.damageCharge,
      obstacleBonus: GAME_CONFIG.specials.propeller.create.obstacleCharge,
    };
  }

  return { special: null, damageBonus: 0, obstacleBonus: 0 };
}

function scoreSpecialForRefill(special) {
  if (special === "colorBall") {
    return GAME_CONFIG.drop.refillScore.colorBall;
  }

  if (special === "bomb") {
    return GAME_CONFIG.drop.refillScore.bomb;
  }

  if (special === "rocket") {
    return GAME_CONFIG.drop.refillScore.rocket;
  }

  if (special === "propeller") {
    return GAME_CONFIG.drop.refillScore.propeller;
  }

  return 0;
}

function scoreRefillColor(board, index, color) {
  const previousPiece = board[index];
  board[index] = { id: -1, type: "gem", color };

  const components = findMatchComponents(board).filter((component) => component.cells.has(index));
  board[index] = previousPiece;

  if (components.length === 0) {
    return GAME_CONFIG.drop.refillScore.neutral;
  }

  let score = 0;
  for (const component of components) {
    const summary = summarizeComponent(component);
    score += component.cells.size * GAME_CONFIG.drop.refillScore.matchCell;
    score += scoreSpecialForRefill(summary.special);
  }

  return score;
}

function createRefillGem(board, index, options = {}) {
  const controlledRefill = options.controlledRefill ?? GAME_CONFIG.drop.controlledRefill;
  const generousRefillChance = options.generousRefillChance ?? GAME_CONFIG.drop.generousRefillChance;

  if (options.avoidImmediateMatches) {
    const choices = COLORS.map((color) => ({
      value: color,
      score: scoreRefillColor(board, index, color),
    }));
    const bestScore = Math.min(...choices.map((choice) => choice.score));
    return createGem(randomChoice(choices.filter((choice) => choice.score === bestScore)).value);
  }

  if (!controlledRefill || Math.random() > generousRefillChance) {
    return createGem();
  }

  const choices = COLORS.map((color) => ({
    value: color,
    weight: scoreRefillColor(board, index, color),
  }));

  return createGem(weightedChoice(choices));
}

function chooseSpecialIndex(component, triggerIndex) {
  if (component.cells.has(triggerIndex)) {
    return triggerIndex;
  }

  return [...component.cells].sort((a, b) => a - b)[0];
}

function damageCrate(board, index, amount = 1) {
  const piece = board[index];
  if (piece?.type !== "crate") {
    return false;
  }

  piece.hp -= amount;
  if (piece.hp <= 0) {
    board[index] = null;
  }
  return true;
}

function damageAdjacentCrates(board, clearedCells) {
  const damaged = new Set();

  for (const cell of clearedCells) {
    const row = rowOf(cell);
    const col = colOf(cell);
    const neighbors = [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ];

    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
        continue;
      }

      const target = indexOf(nr, nc);
      if (!damaged.has(target) && damageCrate(board, target, 1)) {
        damaged.add(target);
      }
    }
  }

  return damaged.size;
}

export function resolveBoard(board, triggerIndex = -1, options = {}) {
  const result = {
    cleared: 0,
    damageCharge: 0,
    obstacleCharge: 0,
    createdSpecials: [],
    cascades: 0,
    steps: [],
  };

  const maxCascadeSteps = options.maxCascadeSteps ?? GAME_CONFIG.drop.maxCascadeSteps;
  const stopAfterCreatedSpecials = options.stopAfterCreatedSpecials ?? Number.POSITIVE_INFINITY;
  const resolveVisibleMatchesAfterStop = options.resolveVisibleMatchesAfterStop ?? false;
  const refillOptions = options.refill ?? {};
  const stopRefillOptions = options.stopRefill ?? { ...refillOptions, avoidImmediateMatches: true };

  for (let cascade = 0; cascade < maxCascadeSteps; cascade++) {
    const beforeCascade = cloneBoard(board);
    const components = findMatchComponents(board);
    if (components.length === 0) {
      break;
    }

    result.cascades++;
    const cellsToClear = new Set();
    const specialsToCreate = [];
    const matchedCells = new Set();

    for (const component of components) {
      const summary = summarizeComponent(component);
      const specialIndex = summary.special ? chooseSpecialIndex(component, triggerIndex) : -1;

      for (const cell of component.cells) {
        matchedCells.add(cell);
        if (cell !== specialIndex) {
          cellsToClear.add(cell);
        }
      }

      if (summary.special) {
        specialsToCreate.push({ ...summary, index: specialIndex });
        result.damageCharge += summary.damageBonus;
        result.obstacleCharge += summary.obstacleBonus;
        result.createdSpecials.push(summary.special);
      }
    }

    const clearedCells = [];
    for (const cell of cellsToClear) {
      if (board[cell]?.type === "gem") {
        board[cell] = null;
        result.cleared++;
        result.damageCharge += GAME_CONFIG.match.damageChargePerClearedGem;
        result.obstacleCharge += GAME_CONFIG.match.obstacleChargePerClearedGem;
        clearedCells.push(cell);
      }
    }

    damageAdjacentCrates(board, clearedCells);
    const afterClear = cloneBoard(board);

    for (const special of specialsToCreate) {
      if (special.special === "rocket") {
        board[special.index] = createRocket(special.direction);
      } else if (special.special === "propeller") {
        board[special.index] = createPropeller();
      } else if (special.special === "bomb") {
        board[special.index] = createBomb();
      } else {
        board[special.index] = createColorBall();
      }
    }

    const afterCreate = cloneBoard(board);
    const shouldStopAfterGravity = result.createdSpecials.length >= stopAfterCreatedSpecials;
    applyGravity(board, true, shouldStopAfterGravity ? stopRefillOptions : refillOptions);
    const afterGravity = cloneBoard(board);
    result.steps.push({
      type: "cascade",
      cascade,
      before: beforeCascade,
      matchedCells: [...matchedCells],
      clearedCells,
      createdSpecials: specialsToCreate.map((special) => ({
        index: special.index,
        special: special.special,
        direction: special.direction ?? null,
      })),
      afterClear,
      afterCreate,
      afterGravity,
    });

    if (shouldStopAfterGravity && (!resolveVisibleMatchesAfterStop || findMatchComponents(board).length === 0)) {
      break;
    }
  }

  return result;
}

function rocketTargets(index, direction) {
  const row = rowOf(index);
  const col = colOf(index);
  const targets = [];

  if (direction === "row") {
    for (let c = 0; c < BOARD_SIZE; c++) {
      targets.push(indexOf(row, c));
    }
  } else {
    for (let r = 0; r < BOARD_SIZE; r++) {
      targets.push(indexOf(r, col));
    }
  }

  return targets;
}

function areaTargets(index, radius) {
  const row = rowOf(index);
  const col = colOf(index);
  const targets = [];

  for (let r = row - radius; r <= row + radius; r++) {
    for (let c = col - radius; c <= col + radius; c++) {
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        targets.push(indexOf(r, c));
      }
    }
  }

  return targets;
}

function bombTargets(index) {
  return areaTargets(index, 2);
}

function doubleBombTargets(index) {
  return areaTargets(index, 4);
}

function crossTargets(index, radius = 0) {
  const row = rowOf(index);
  const col = colOf(index);
  const targets = new Set();

  for (let r = Math.max(0, row - radius); r <= Math.min(BOARD_SIZE - 1, row + radius); r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      targets.add(indexOf(r, c));
    }
  }

  for (let c = Math.max(0, col - radius); c <= Math.min(BOARD_SIZE - 1, col + radius); c++) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      targets.add(indexOf(r, c));
    }
  }

  return [...targets];
}

function propellerBlastTargets(index) {
  const row = rowOf(index);
  const col = colOf(index);
  const targets = [index];
  const neighbors = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];

  for (const [targetRow, targetCol] of neighbors) {
    if (targetRow >= 0 && targetRow < BOARD_SIZE && targetCol >= 0 && targetCol < BOARD_SIZE) {
      targets.push(indexOf(targetRow, targetCol));
    }
  }

  return targets;
}

function mostCommonGemColor(board) {
  const counts = new Map();

  for (const piece of board) {
    if (piece?.type === "gem") {
      counts.set(piece.color, (counts.get(piece.color) || 0) + 1);
    }
  }

  let bestColor = null;
  let bestCount = -1;
  for (const [color, count] of counts) {
    if (count > bestCount) {
      bestColor = color;
      bestCount = count;
    }
  }

  return bestColor;
}

function colorBallTargets(board, targetColor) {
  const color = targetColor || mostCommonGemColor(board);
  if (!color) {
    return [];
  }

  const targets = [];
  for (let index = 0; index < board.length; index++) {
    if (board[index]?.type === "gem" && board[index].color === color) {
      targets.push(index);
    }
  }

  return targets;
}

function specialObstacleCharge(type) {
  return GAME_CONFIG.specials[type]?.activate.obstacleCharge || 0;
}

function isSpecialPiece(piece) {
  return piece && ["propeller", "rocket", "bomb", "colorBall"].includes(piece.type);
}

function createSpecialActivationResult(obstacleCharge = 0) {
  return {
    accepted: true,
    cleared: 0,
    damageCharge: 0,
    obstacleCharge,
    createdSpecials: [],
    cascades: 0,
    targets: [],
    steps: [],
  };
}

function applyColumnGravity(board, fill = true, refillOptions = {}) {
  for (let col = 0; col < BOARD_SIZE; col++) {
    let row = BOARD_SIZE - 1;

    while (row >= 0) {
      if (board[indexOf(row, col)]?.type === "crate") {
        row--;
        continue;
      }

      const segmentEnd = row;
      while (row >= 0 && board[indexOf(row, col)]?.type !== "crate") {
        row--;
      }

      const segmentStart = row + 1;
      const pieces = [];

      for (let scan = segmentStart; scan <= segmentEnd; scan++) {
        const piece = board[indexOf(scan, col)];
        if (piece) {
          pieces.push(piece);
        }
      }

      const blanks = segmentEnd - segmentStart + 1 - pieces.length;
      for (let write = segmentStart; write <= segmentEnd; write++) {
        board[indexOf(write, col)] = write < segmentStart + blanks ? null : pieces.shift();
      }

      const canRefillSegment = !refillOptions.refillOnlyFromTop || segmentStart === 0;
      if (fill && canRefillSegment) {
        for (let write = segmentStart; write < segmentStart + blanks; write++) {
          const target = indexOf(write, col);
          board[target] = createRefillGem(board, target, refillOptions);
        }
      }
    }
  }
}

function canFall(piece) {
  return piece && piece.type !== "crate";
}

function applyVerticalFallPass(board) {
  let moved = false;
  for (let row = BOARD_SIZE - 2; row >= 0; row--) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const index = indexOf(row, col);
      const target = indexOf(row + 1, col);
      if (canFall(board[index]) && board[target] === null) {
        board[target] = board[index];
        board[index] = null;
        moved = true;
      }
    }
  }
  return moved;
}

function applyDiagonalFallPass(board) {
  let moved = false;
  for (let row = BOARD_SIZE - 2; row >= 0; row--) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const index = indexOf(row, col);
      const piece = board[index];
      if (!canFall(piece) || board[indexOf(row + 1, col)] === null) {
        continue;
      }

      const directions = (row + col) % 2 === 0 ? [-1, 1] : [1, -1];
      for (const direction of directions) {
        const nextCol = col + direction;
        if (nextCol < 0 || nextCol >= BOARD_SIZE) {
          continue;
        }

        const target = indexOf(row + 1, nextCol);
        if (board[target] === null) {
          board[target] = piece;
          board[index] = null;
          moved = true;
          break;
        }
      }
    }
  }
  return moved;
}

function refillGravitySources(board, fill, refillOptions) {
  if (!fill) {
    return false;
  }

  let filled = false;
  if (refillOptions.refillOnlyFromTop) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const target = indexOf(0, col);
      if (board[target] === null) {
        board[target] = createRefillGem(board, target, refillOptions);
        filled = true;
      }
    }
    return filled;
  }

  for (let index = 0; index < board.length; index++) {
    if (board[index] === null) {
      board[index] = createRefillGem(board, index, refillOptions);
      filled = true;
    }
  }
  return filled;
}

function applyDiagonalGravity(board, fill = true, refillOptions = {}) {
  for (let settle = 0; settle < CELL_COUNT * 8; settle++) {
    let moved = false;
    for (let pass = 0; pass < CELL_COUNT * 2; pass++) {
      const verticalMoved = applyVerticalFallPass(board);
      const diagonalMoved = applyDiagonalFallPass(board);
      if (!verticalMoved && !diagonalMoved) {
        break;
      }
      moved = true;
    }

    const filled = refillGravitySources(board, fill, refillOptions);
    if (!moved && !filled) {
      break;
    }
  }
}

function applyGravity(board, fill = true, refillOptions = {}) {
  if (refillOptions.diagonalFall) {
    applyDiagonalGravity(board, fill, refillOptions);
    return;
  }

  applyColumnGravity(board, fill, refillOptions);
}

function scoreImmediateDropMatch(board, index) {
  const testBoard = cloneBoard(board);
  testBoard[index] = null;
  applyGravity(testBoard, false);
  const components = findMatchComponents(testBoard);
  let score = 0;

  for (const component of components) {
    score += component.cells.size * GAME_CONFIG.specials.propeller.targetScore.immediateMatchCell;
    if (summarizeComponent(component).special) {
      score += GAME_CONFIG.specials.propeller.targetScore.createsSpecial;
    }
  }

  return score;
}

function choosePropellerTarget(board, sourceIndex, excludedTargets) {
  let bestCrate = null;
  let bestGem = null;
  const gems = [];

  for (let index = 0; index < board.length; index++) {
    if (excludedTargets.has(index)) {
      continue;
    }

    const piece = board[index];
    if (!piece) {
      continue;
    }

    if (piece.swimDuck) {
      continue;
    }

    if (piece.type === "crate") {
      const score = GAME_CONFIG.specials.propeller.targetScore.crate - Math.abs(rowOf(index) - rowOf(sourceIndex)) - Math.abs(colOf(index) - colOf(sourceIndex));
      if (!bestCrate || score > bestCrate.score) {
        bestCrate = { index, score };
      }
      continue;
    }

    if (piece.type !== "gem") {
      continue;
    }

    gems.push(index);
    const score = scoreImmediateDropMatch(board, index);
    if (score > 0 && (!bestGem || score > bestGem.score)) {
      bestGem = { index, score };
    }
  }

  if (bestCrate) {
    return bestCrate.index;
  }

  if (bestGem) {
    return bestGem.index;
  }

  return gems.length ? randomChoice(gems) : null;
}

function addPropellerFlightTarget(board, sourceIndex, targetSet, excludedTargets = targetSet) {
  const target = choosePropellerTarget(board, sourceIndex, excludedTargets);
  if (target !== null) {
    targetSet.add(target);
    excludedTargets.add(target);
  }
  return target;
}

function damageTargetSet(board, targetSet, result, stepMeta = {}) {
  result.targets = [...targetSet];
  const before = cloneBoard(board);

  for (const target of targetSet) {
    const targetPiece = board[target];
    if (!targetPiece) {
      continue;
    }

    if (targetPiece.swimDuck) {
      continue;
    }

    if (targetPiece.type === "crate") {
      damageCrate(board, target, 1);
      continue;
    }

    board[target] = null;
    if (targetPiece.type === "gem") {
      result.cleared++;
      result.damageCharge += GAME_CONFIG.match.damageChargePerClearedGem;
      result.obstacleCharge += GAME_CONFIG.match.obstacleChargePerClearedGem;
    }
  }

  result.steps.push({
    type: "specialActivation",
    before,
    targets: [...targetSet],
    afterDamage: cloneBoard(board),
    ...stepMeta,
  });
}

function finishSpecialResult(board, originIndex, result, resolveOptions = {}) {
  const beforeGravity = cloneBoard(board);
  applyGravity(board, true, resolveOptions.refill ?? {});
  const afterGravity = cloneBoard(board);
  const lastStep = result.steps[result.steps.length - 1];
  if (lastStep?.type === "specialActivation") {
    lastStep.beforeGravity = beforeGravity;
    lastStep.afterGravity = afterGravity;
  }
  const cascadeResult = resolveBoard(board, originIndex, resolveOptions);
  result.cleared += cascadeResult.cleared;
  result.damageCharge += cascadeResult.damageCharge;
  result.obstacleCharge += cascadeResult.obstacleCharge;
  result.createdSpecials.push(...cascadeResult.createdSpecials);
  result.cascades += cascadeResult.cascades;
  result.steps.push(...cascadeResult.steps);

  return result;
}

export function activateSpecial(board, index, targetColor = null, resolveOptions = {}) {
  const piece = board[index];
  if (!isSpecialPiece(piece)) {
    return { accepted: false, reason: "not-special" };
  }

  const targets =
    piece.type === "propeller"
      ? propellerBlastTargets(index)
      : piece.type === "rocket"
        ? rocketTargets(index, piece.direction)
        : piece.type === "bomb"
          ? bombTargets(index)
          : colorBallTargets(board, targetColor);
  const targetSet =
    piece.type === "propeller"
      ? new Set(targets)
      : new Set([index, ...targets]);

  if (piece.type === "propeller") {
    addPropellerFlightTarget(board, index, targetSet);
  }

  const result = createSpecialActivationResult(specialObstacleCharge(piece.type));
  result.activatedSpecial = piece.type;
  damageTargetSet(board, targetSet, result, {
    originIndex: index,
    activatedSpecial: piece.type,
  });
  return finishSpecialResult(board, index, result, resolveOptions);
}

function comboDisplayKey(typeA, typeB) {
  return [typeA, typeB].sort().join("+");
}

function comboPrimarySound(typeA, typeB) {
  if (typeA === "colorBall" || typeB === "colorBall") {
    return "colorBall";
  }

  if (typeA === "bomb" || typeB === "bomb") {
    return "bomb";
  }

  if (typeA === "rocket" || typeB === "rocket") {
    return "rocket";
  }

  return "propeller";
}

function colorTransformTargets(board) {
  const color = mostCommonGemColor(board);
  if (!color) {
    return [];
  }

  return colorBallTargets(board, color);
}

function addTransformedSpecialTargets(board, targetSet, sourceType, comboIndex) {
  const transformTargets = colorTransformTargets(board);
  const excluded = new Set(targetSet);
  const direction = sourceType === "rocket" ? board[comboIndex]?.direction || "row" : null;
  const flightTargets = [];

  for (const target of transformTargets) {
    targetSet.add(target);
    excluded.add(target);

    if (sourceType === "rocket") {
      rocketTargets(target, direction).forEach((cell) => targetSet.add(cell));
    } else if (sourceType === "bomb") {
      bombTargets(target).forEach((cell) => targetSet.add(cell));
    } else if (sourceType === "propeller") {
      const flightTarget = addPropellerFlightTarget(board, target, targetSet, excluded);
      if (flightTarget !== null) {
        flightTargets.push(flightTarget);
      }
    }
  }

  return {
    type: "colorTransform",
    special: sourceType,
    centers: transformTargets,
    direction,
    flightTargets,
  };
}

function activateSpecialCombo(board, a, b, resolveOptions = {}) {
  const pieceA = board[a];
  const pieceB = board[b];
  if (!isSpecialPiece(pieceA) || !isSpecialPiece(pieceB)) {
    return { accepted: false, reason: "not-special-combo" };
  }

  const typeA = pieceA.type;
  const typeB = pieceB.type;
  const comboIndex = b;
  const targetSet = new Set([a, b]);
  const result = createSpecialActivationResult(specialObstacleCharge(typeA) + specialObstacleCharge(typeB));
  result.comboSpecials = [typeA, typeB];
  result.comboKey = comboDisplayKey(typeA, typeB);
  result.comboIndex = comboIndex;
  result.activatedSpecial = comboPrimarySound(typeA, typeB);

  const has = (type) => typeA === type || typeB === type;

  if (has("colorBall") && typeA === "colorBall" && typeB === "colorBall") {
    for (let index = 0; index < board.length; index++) {
      targetSet.add(index);
    }
    result.comboTransform = {
      type: "fullBoard",
      special: "colorBall",
      centers: Array.from({ length: board.length }, (_, index) => index),
    };
  } else if (has("colorBall")) {
    const partner = typeA === "colorBall" ? typeB : typeA;
    const partnerIndex = typeA === "colorBall" ? b : a;
    result.comboTransform = addTransformedSpecialTargets(board, targetSet, partner, partnerIndex);
  } else if (has("propeller") && typeA === "propeller" && typeB === "propeller") {
    propellerBlastTargets(comboIndex).forEach((cell) => targetSet.add(cell));
    const excluded = new Set(targetSet);
    for (let i = 0; i < 3; i++) {
      addPropellerFlightTarget(board, comboIndex, targetSet, excluded);
    }
  } else if (has("propeller")) {
    propellerBlastTargets(comboIndex).forEach((cell) => targetSet.add(cell));
    const carriedType = typeA === "propeller" ? typeB : typeA;
    const carriedPiece = typeA === "propeller" ? pieceB : pieceA;
    const flightTarget = addPropellerFlightTarget(board, comboIndex, targetSet, new Set(targetSet));

    if (flightTarget !== null) {
      if (carriedType === "rocket") {
        rocketTargets(flightTarget, carriedPiece.direction).forEach((cell) => targetSet.add(cell));
      } else if (carriedType === "bomb") {
        bombTargets(flightTarget).forEach((cell) => targetSet.add(cell));
      }
    }
  } else if (typeA === "rocket" && typeB === "rocket") {
    crossTargets(comboIndex).forEach((cell) => targetSet.add(cell));
  } else if (has("rocket") && has("bomb")) {
    crossTargets(comboIndex, 1).forEach((cell) => targetSet.add(cell));
  } else if (typeA === "bomb" && typeB === "bomb") {
    doubleBombTargets(comboIndex).forEach((cell) => targetSet.add(cell));
  }

  damageTargetSet(board, targetSet, result, {
    originIndex: comboIndex,
    activatedSpecial: result.activatedSpecial,
    comboKey: result.comboKey,
    comboSpecials: result.comboSpecials,
    comboTransform: result.comboTransform ?? null,
  });
  return finishSpecialResult(board, comboIndex, result, resolveOptions);
}

function swap(board, a, b) {
  const piece = board[a];
  board[a] = board[b];
  board[b] = piece;
}

export function trySwap(board, a, b, resolveOptions = {}) {
  if (!isAdjacent(a, b) || !board[a] || !board[b]) {
    return { accepted: false, reason: "not-adjacent" };
  }

  if (board[a].type === "crate" || board[b].type === "crate") {
    return { accepted: false, reason: "blocked" };
  }

  if (isSpecialPiece(board[a]) && isSpecialPiece(board[b])) {
    return activateSpecialCombo(board, a, b, resolveOptions);
  }

  if (board[a].type !== "gem" || board[b].type !== "gem") {
    const specialIndex = board[a].type === "gem" ? b : a;
    const gemIndex = specialIndex === a ? b : a;
    const specialType = board[specialIndex].type;
    const targetColor =
      board[a].type === "colorBall" && board[b].type === "gem"
        ? board[b].color
        : board[b].type === "colorBall" && board[a].type === "gem"
          ? board[a].color
          : null;
    swap(board, a, b);
    const result = activateSpecial(board, gemIndex, targetColor, resolveOptions);
    if (result.accepted) {
      result.activatedSpecial = specialType;
    }
    return result;
  }

  swap(board, a, b);

  if (findMatchComponents(board).length === 0) {
    swap(board, a, b);
    return { accepted: false, reason: "no-match" };
  }

  return {
    accepted: true,
    ...resolveBoard(board, b, resolveOptions),
  };
}

export function addCrateRow(board) {
  const topHadCrate = board.slice(0, BOARD_SIZE).some((piece) => piece?.type === "crate");

  for (let row = 0; row < BOARD_SIZE - 1; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      board[indexOf(row, col)] = board[indexOf(row + 1, col)];
    }
  }

  for (let col = 0; col < BOARD_SIZE; col++) {
    board[indexOf(BOARD_SIZE - 1, col)] = createCrate(GAME_CONFIG.obstacles.crateHp);
  }

  return topHadCrate;
}

export function createBattleState() {
  return {
    status: "playing",
    winner: null,
    turn: 0,
    players: {
      player: createCompetitor("Player"),
      ai: createCompetitor("AI"),
    },
    log: ["对局开始。"],
  };
}

function createCompetitor(name) {
  return {
    name,
    hp: MAX_HP,
    damageCharge: 0,
    obstacleCharge: 0,
    board: createBoard(),
  };
}

function opponentOf(side) {
  return side === "player" ? "ai" : "player";
}

function displayName(side) {
  return side === "player" ? "玩家" : "AI";
}

function appendLog(state, message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 8);
}

function chargeMultiplier(side) {
  return GAME_CONFIG.battle.sideChargeMultiplier[side] || GAME_CONFIG.battle.sideChargeMultiplier.player;
}

function checkWinner(state) {
  const player = state.players.player;
  const ai = state.players.ai;

  if (player.hp <= 0 && ai.hp <= 0) {
    state.status = "ended";
    state.winner = "draw";
  } else if (player.hp <= 0) {
    state.status = "ended";
    state.winner = "ai";
  } else if (ai.hp <= 0) {
    state.status = "ended";
    state.winner = "player";
  }
}

export function applyResultToBattle(state, side, result) {
  if (!result.accepted) {
    return;
  }

  result.battleEvents = result.battleEvents || [];
  const actor = state.players[side];
  const targetSide = opponentOf(side);
  const target = state.players[targetSide];

  const multiplier = chargeMultiplier(side);
  actor.damageCharge += result.damageCharge * multiplier.damage;
  actor.obstacleCharge += result.obstacleCharge * multiplier.obstacle;

  if (result.cleared > 0) {
    appendLog(state, `${displayName(side)}消除了 ${result.cleared} 个棋子。`);
  }

  while (actor.damageCharge >= DAMAGE_CHARGE_MAX) {
    actor.damageCharge -= DAMAGE_CHARGE_MAX;
    target.hp = Math.max(0, target.hp - DAMAGE_PER_ATTACK);
    result.battleEvents.push({ type: "attack", side, target: targetSide, amount: DAMAGE_PER_ATTACK });
    appendLog(state, `${displayName(side)}造成 ${DAMAGE_PER_ATTACK} 点伤害。`);
  }

  while (actor.obstacleCharge >= OBSTACLE_CHARGE_MAX) {
    actor.obstacleCharge -= OBSTACLE_CHARGE_MAX;
    const overflow = addCrateRow(target.board);
    result.battleEvents.push({ type: "crate", side, target: targetSide });
    appendLog(state, `${displayName(side)}给对手增加了一行木箱。`);
    if (overflow) {
      target.hp = 0;
      appendLog(state, `${displayName(targetSide)}的棋盘被堵满了。`);
      break;
    }
  }

  checkWinner(state);
}

export function applySwapAction(state, side, a, b, options = {}) {
  if (state.status !== "playing") {
    return { accepted: false, reason: "ended" };
  }

  const result = trySwap(state.players[side].board, a, b, options.resolveOptions);
  if (!result.accepted) {
    return result;
  }

  state.turn++;
  if (result.comboSpecials) {
    appendLog(state, `${displayName(side)}触发了${comboDisplayName(result.comboSpecials)}。`);
  }
  if (!options.deferBattle) {
    applyResultToBattle(state, side, result);
  }
  return result;
}

export function applySpecialAction(state, side, index, options = {}) {
  if (state.status !== "playing") {
    return { accepted: false, reason: "ended" };
  }

  const specialType = state.players[side].board[index]?.type;
  const result = activateSpecial(state.players[side].board, index, null, options.resolveOptions);
  if (!result.accepted) {
    return result;
  }

  result.activatedSpecial = specialType;
  state.turn++;
  appendLog(state, `${displayName(side)}触发了${specialDisplayName(specialType)}。`);
  if (!options.deferBattle) {
    applyResultToBattle(state, side, result);
  }
  return result;
}

function specialDisplayName(type) {
  if (type === "propeller") {
    return "陀螺";
  }

  if (type === "rocket") {
    return "火箭";
  }

  if (type === "bomb") {
    return "炸弹";
  }

  if (type === "colorBall") {
    return "彩球";
  }

  return "特效";
}

function comboDisplayName(types) {
  return types.map(specialDisplayName).join("+");
}

function specialScore(type) {
  if (type === "colorBall") {
    return 42;
  }

  if (type === "bomb") {
    return 30;
  }

  if (type === "rocket") {
    return 22;
  }

  if (type === "propeller") {
    return 18;
  }

  return 0;
}

function comboScore(result) {
  if (!result.comboSpecials?.length) {
    return 0;
  }

  const types = new Set(result.comboSpecials);
  if (types.has("colorBall") && result.comboSpecials.every((type) => type === "colorBall")) {
    return 155;
  }

  if (types.has("colorBall") && types.has("bomb")) {
    return 125;
  }

  if (types.has("colorBall") && types.has("rocket")) {
    return 108;
  }

  if (types.has("colorBall") && types.has("propeller")) {
    return 96;
  }

  if (types.has("bomb") && result.comboSpecials.every((type) => type === "bomb")) {
    return 86;
  }

  if (types.has("bomb") && types.has("rocket")) {
    return 76;
  }

  if (types.has("bomb") && types.has("propeller")) {
    return 68;
  }

  if (types.has("rocket") && result.comboSpecials.every((type) => type === "rocket")) {
    return 58;
  }

  return 48;
}

function thresholdScore(currentValue = 0, gain = 0, maxValue = 1, value = 0) {
  const before = Math.floor(currentValue / maxValue);
  const after = Math.floor((currentValue + gain) / maxValue);
  return Math.max(0, after - before) * value;
}

function scoreActionResult(result, actor = null) {
  if (!result?.accepted || result.reshuffled) {
    return 0;
  }

  let score = 0;
  score += result.cleared * 2.1;
  score += (result.targets?.length || 0) * 0.55;
  score += result.damageCharge * 1.35;
  score += result.obstacleCharge * 1.1;
  score += result.cascades * 3.5;
  score += comboScore(result);

  for (const special of result.createdSpecials ?? []) {
    score += specialScore(special);
  }

  if (result.activatedSpecial) {
    score += specialScore(result.activatedSpecial) * 0.42;
  }

  if (result.comboTransform?.centers?.length) {
    score += Math.min(result.comboTransform.centers.length, 24) * 1.2;
  }

  if (actor) {
    score += thresholdScore(actor.damageCharge, result.damageCharge, DAMAGE_CHARGE_MAX, 64);
    score += thresholdScore(actor.obstacleCharge, result.obstacleCharge, OBSTACLE_CHARGE_MAX, 48);
  }

  return score;
}

export function findBestMove(board, actor = null) {
  let best = null;

  const consider = (move, result) => {
    const score = scoreActionResult(result, actor);
    if (score <= 0) {
      return;
    }

    if (!best || score > best.score) {
      best = { ...move, score };
    }
  };

  for (let index = 0; index < CELL_COUNT; index++) {
    const piece = board[index];
    if (!piece || piece.type === "crate") {
      continue;
    }

    if (isSpecialPiece(piece)) {
      const testBoard = cloneBoard(board);
      consider({ type: "special", index }, activateSpecial(testBoard, index));
    }

    const row = rowOf(index);
    const col = colOf(index);
    const neighbors = [
      col < BOARD_SIZE - 1 ? index + 1 : -1,
      row < BOARD_SIZE - 1 ? index + BOARD_SIZE : -1,
    ];

    for (const neighbor of neighbors) {
      if (neighbor < 0) {
        continue;
      }
      const target = board[neighbor];
      if (!target || target.type === "crate") {
        continue;
      }

      const testBoard = cloneBoard(board);
      consider({ type: "swap", from: index, to: neighbor }, trySwap(testBoard, index, neighbor));
    }
  }

  return best;
}

export function takeAiTurn(state) {
  if (state.status !== "playing") {
    return { accepted: false, reason: "ended" };
  }

  const board = state.players.ai.board;
  const move = findBestMove(board, state.players.ai);
  if (!move) {
    state.players.ai.board = createBoard();
    appendLog(state, "AI 重排了棋盘。");
    return { accepted: true, reshuffled: true };
  }

  if (move.type === "special") {
    return applySpecialAction(state, "ai", move.index);
  }

  return applySwapAction(state, "ai", move.from, move.to);
}

export function getCellLabel(piece) {
  if (!piece) {
    return "";
  }

  if (piece.swimDuck) {
    return "游泳鸭";
  }

  if (piece.type === "crate") {
    return `木箱 ${piece.hp}`;
  }

  if (piece.type === "propeller") {
    return "陀螺";
  }

  if (piece.type === "rocket") {
    return piece.direction === "row" ? "横向火箭" : "竖向火箭";
  }

  if (piece.type === "bomb") {
    return "炸弹";
  }

  if (piece.type === "colorBall") {
    return "彩球";
  }

  return `${piece.color} 棋子`;
}
