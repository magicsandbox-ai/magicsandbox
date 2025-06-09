interface FlappyBox {
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: number;
}

interface Obstacle {
  x: number;
  gapTop: number;
  gapBottom: number;
  passed?: boolean;
}

interface SnakeSegment {
  x: number;
  y: number;
}

interface Direction {
  x: number;
  y: number;
}

interface Food {
  x: number;
  y: number;
}

const flappyCanvas = document.getElementById(
  "flappy-canvas",
) as HTMLCanvasElement;
const scoreDisplay = document.getElementById("score") as HTMLElement;
const highScoreDisplay = document.getElementById("high-score") as HTMLElement;
const titleBar = document.getElementById("title-bar") as HTMLElement;

if (!flappyCanvas || !scoreDisplay || !highScoreDisplay || !titleBar) {
  throw new Error("Required DOM elements not found");
}

const flappyContext = flappyCanvas.getContext("2d") as CanvasRenderingContext2D;
const snakeCanvas = document.createElement("canvas");
const snakeContext = snakeCanvas.getContext("2d") as CanvasRenderingContext2D;

if (!flappyContext || !snakeContext) {
  throw new Error("Could not get 2D context for canvas");
}

let gameActive = false;
let score = 0;
let highScore = 0;
let frameCount = 0;
let flappyBox: FlappyBox;
let obstacles: Obstacle[];
let snakeFood: Food;
let snake: SnakeSegment[];
let snakeDirection: Direction;
let nextSnakeDirection: Direction;
let snakeFrameCount = 0;

let GRAVITY: number;
let JUMP_FORCE: number;
let OBSTACLE_WIDTH: number;
let OBSTACLE_GAP: number;
let OBSTACLE_SPEED: number;
let SNAKE_GRID_SIZE: number;
const OBSTACLE_FREQUENCY = 180; // frames
const SNAKE_SPEED = 10; // frames per move

async function init() {
  updateInstructionsForDevice();
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("pointerdown", handlePointerStart);
  document.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("resize", () => {
    if (gameActive) return;
    resetGame();
  });
  resetGame();
  flappyCanvas.focus();
  try {
    const savedHighScore = (await requestGetData("highScore")) as
      | number
      | undefined;
    if (savedHighScore !== undefined) {
      highScore = savedHighScore;
      updateHighScoreDisplay();
    }
  } catch (error) {
    console.error("Error loading high score:", error);
  }
}

function resetGame() {
  //subtract padding and other elements
  const flappyCanvasSize = Math.floor(
    Math.min(
      window.innerWidth - 32,
      window.innerHeight - (titleBar.offsetHeight + 36),
    ),
  );
  flappyCanvas.width = flappyCanvasSize;
  flappyCanvas.height = flappyCanvasSize;

  //this should be a multiple of 20 so that SNAKE_GRID_SIZE is an integer
  const snakeCanvasSize = Math.floor((0.3 * flappyCanvasSize) / 20) * 20;
  snakeCanvas.width = snakeCanvasSize;
  snakeCanvas.height = snakeCanvasSize;

  GRAVITY = 0.00015 * flappyCanvasSize;
  JUMP_FORCE = -0.004 * flappyCanvasSize;
  OBSTACLE_WIDTH = 0.1 * flappyCanvasSize;
  OBSTACLE_GAP = 2 * snakeCanvasSize;
  OBSTACLE_SPEED = 0.003 * flappyCanvasSize;
  SNAKE_GRID_SIZE = snakeCanvasSize / 20;

  gameActive = false;
  score = 0;
  frameCount = 0;
  flappyBox = {
    x: 0.15 * flappyCanvasSize,
    y: flappyCanvasSize / 2 - snakeCanvasSize / 2,
    width: snakeCanvasSize,
    height: snakeCanvasSize,
    velocity: 0,
  };
  obstacles = [];
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  generateSnakeFood();
  snakeDirection = { x: 1, y: 0 };
  nextSnakeDirection = { x: 1, y: 0 };
  snakeFrameCount = 0;

  updateScoreDisplay();
  updateHighScoreDisplay();
  drawFlappyCanvas();
}

function handleControl(action: "jump" | "up" | "down" | "left" | "right") {
  if (!gameActive) {
    startGame();
    return;
  }
  if (action === "jump") {
    jump();
    return;
  }
  switch (action) {
    case "up":
      if (snakeDirection.y !== 1) {
        nextSnakeDirection = { x: 0, y: -1 };
      }
      break;
    case "down":
      if (snakeDirection.y !== -1) {
        nextSnakeDirection = { x: 0, y: 1 };
      }
      break;
    case "left":
      if (snakeDirection.x !== 1) {
        nextSnakeDirection = { x: -1, y: 0 };
      }
      break;
    case "right":
      if (snakeDirection.x !== -1) {
        nextSnakeDirection = { x: 1, y: 0 };
      }
      break;
  }
}

function handleKeyDown(event: KeyboardEvent) {
  switch (event.code) {
    case "Space":
      handleControl("jump");
      event.preventDefault();
      break;
    case "ArrowUp":
      handleControl("up");
      event.preventDefault();
      break;
    case "ArrowDown":
      handleControl("down");
      event.preventDefault();
      break;
    case "ArrowLeft":
      handleControl("left");
      event.preventDefault();
      break;
    case "ArrowRight":
      handleControl("right");
      event.preventDefault();
      break;
  }
}

let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 30; // minimum distance for a swipe

function handlePointerStart(event: PointerEvent) {
  if (event.pointerType === "mouse") return;
  touchStartX = event.clientX;
  touchStartY = event.clientY;
  event.preventDefault();
}

function handlePointerEnd(event: PointerEvent) {
  if (event.pointerType === "mouse") return;
  const deltaX = event.clientX - touchStartX;
  const deltaY = event.clientY - touchStartY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  // If the distance is too small, treat it as a tap (jump)
  if (distance < SWIPE_THRESHOLD) {
    handleControl("jump");
    return;
  }
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // Horizontal swipe
    handleControl(deltaX > 0 ? "right" : "left");
  } else {
    // Vertical swipe
    handleControl(deltaY > 0 ? "down" : "up");
  }

  event.preventDefault();
}

function startGame() {
  gameActive = true;
  const instructionsOverlay = document.getElementById("instructions-overlay");
  if (instructionsOverlay) {
    instructionsOverlay.style.display = "none";
  }
  requestAnimationFrame(gameLoop);
}

function jump() {
  flappyBox.velocity = JUMP_FORCE;
}

function updateFlappyBox() {
  flappyBox.velocity += GRAVITY;
  flappyBox.y += flappyBox.velocity;
  if (flappyBox.y < 0) {
    flappyBox.y = 0;
    flappyBox.velocity = 0;
  }
  if (flappyBox.y + flappyBox.height > flappyCanvas.height) {
    flappyBox.y = flappyCanvas.height - flappyBox.height;
    flappyBox.velocity = 0;
    endGame();
  }
}

function generateObstacle() {
  const gapTop =
    Math.floor(Math.random() * (flappyCanvas.height - OBSTACLE_GAP - 100)) + 50;
  obstacles.push({
    x: flappyCanvas.width,
    gapTop: gapTop,
    gapBottom: gapTop + OBSTACLE_GAP,
  });
}

function updateObstacles() {
  if (frameCount % OBSTACLE_FREQUENCY === 0) {
    generateObstacle();
  }
  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i];
    if (!obstacle) continue;
    obstacle.x -= OBSTACLE_SPEED;
    if (
      flappyBox.x + flappyBox.width > obstacle.x &&
      flappyBox.x < obstacle.x + OBSTACLE_WIDTH &&
      (flappyBox.y < obstacle.gapTop ||
        flappyBox.y + flappyBox.height > obstacle.gapBottom)
    ) {
      endGame();
    }
    if (obstacle.x + OBSTACLE_WIDTH < flappyBox.x && !obstacle.passed) {
      obstacle.passed = true;
      score++;
      updateScoreDisplay();
    }
  }
  obstacles = obstacles.filter((obstacle) => obstacle.x + OBSTACLE_WIDTH > 0);
}

function updateSnake() {
  snakeFrameCount++;
  if (snakeFrameCount >= SNAKE_SPEED) {
    snakeFrameCount = 0;
    snakeDirection = nextSnakeDirection;
    if (snake.length === 0 || !snake[0]) return;
    const firstSegment = snake[0];
    const head: SnakeSegment = {
      x: firstSegment.x + snakeDirection.x,
      y: firstSegment.y + snakeDirection.y,
    };
    if (
      head.x < 0 ||
      head.x >= snakeCanvas.width / SNAKE_GRID_SIZE ||
      head.y < 0 ||
      head.y >= snakeCanvas.height / SNAKE_GRID_SIZE ||
      snake.some((segment) => segment.x === head.x && segment.y === head.y)
    ) {
      endGame();
      return;
    }
    const atFood = head.x === snakeFood.x && head.y === snakeFood.y;
    snake.unshift(head);
    if (!atFood) {
      snake.pop();
    } else {
      generateSnakeFood();
      score += 5;
      updateScoreDisplay();
    }
  }
}

function generateSnakeFood() {
  const gridWidth = snakeCanvas.width / SNAKE_GRID_SIZE;
  const gridHeight = snakeCanvas.height / SNAKE_GRID_SIZE;
  let validPosition = false;
  while (!validPosition) {
    snakeFood = {
      x: Math.floor(Math.random() * gridWidth),
      y: Math.floor(Math.random() * gridHeight),
    };
    validPosition = !snake.some(
      (segment) => segment.x === snakeFood.x && segment.y === snakeFood.y,
    );
  }
}

function endGame() {
  gameActive = false;
  if (score > highScore) {
    highScore = score;
    requestPutData("highScore", highScore).catch((error) => {
      console.error("Error saving high score:", error);
    });
  }
  updateHighScoreDisplay();
  resetGame();
}

function updateScoreDisplay() {
  scoreDisplay.textContent = score.toString();
}

function updateHighScoreDisplay() {
  highScoreDisplay.textContent = highScore.toString();
}

function drawFlappyCanvas() {
  flappyContext.clearRect(0, 0, flappyCanvas.width, flappyCanvas.height);

  flappyContext.fillStyle = "#87CEEB";
  flappyContext.fillRect(0, 0, flappyCanvas.width, flappyCanvas.height);

  flappyContext.fillStyle = "#7BC043";
  obstacles.forEach((obstacle) => {
    flappyContext.fillRect(obstacle.x, 0, OBSTACLE_WIDTH, obstacle.gapTop);

    flappyContext.fillRect(
      obstacle.x,
      obstacle.gapBottom,
      OBSTACLE_WIDTH,
      flappyCanvas.height - obstacle.gapBottom,
    );
  });

  flappyContext.fillStyle = "#FFFFFF";
  flappyContext.fillRect(
    flappyBox.x,
    flappyBox.y,
    flappyBox.width,
    flappyBox.height,
  );

  drawSnakeCanvas();
  flappyContext.drawImage(
    snakeCanvas,
    flappyBox.x,
    flappyBox.y,
    flappyBox.width,
    flappyBox.height,
  );
}

function drawSnakeCanvas() {
  snakeContext.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  snakeContext.fillStyle = "#333333";
  snakeContext.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);

  snakeContext.fillStyle = "#00FF00";
  snake.forEach((segment, index) => {
    snakeContext.fillRect(
      segment.x * SNAKE_GRID_SIZE,
      segment.y * SNAKE_GRID_SIZE,
      SNAKE_GRID_SIZE,
      SNAKE_GRID_SIZE,
    );
    if (index === 0) {
      snakeContext.fillStyle = "#000000";
      if (SNAKE_GRID_SIZE >= 9) {
        // Draw two eyes for larger grid sizes
        snakeContext.fillRect(
          segment.x * SNAKE_GRID_SIZE + 2,
          segment.y * SNAKE_GRID_SIZE + 2,
          2,
          2,
        );
        snakeContext.fillRect(
          segment.x * SNAKE_GRID_SIZE + SNAKE_GRID_SIZE - 4,
          segment.y * SNAKE_GRID_SIZE + 2,
          2,
          2,
        );
      } else {
        // Draw one eye for smaller grid sizes
        const eyeSize = Math.max(1, Math.floor(SNAKE_GRID_SIZE / 4));
        const eyeOffset =
          Math.floor(SNAKE_GRID_SIZE / 2) - Math.ceil(eyeSize / 2);
        snakeContext.fillRect(
          segment.x * SNAKE_GRID_SIZE + eyeOffset,
          segment.y * SNAKE_GRID_SIZE + eyeOffset,
          eyeSize,
          eyeSize,
        );
      }
      snakeContext.fillStyle = "#00FF00";
    }
  });

  snakeContext.fillStyle = "#FF0000";
  snakeContext.fillRect(
    snakeFood.x * SNAKE_GRID_SIZE,
    snakeFood.y * SNAKE_GRID_SIZE,
    SNAKE_GRID_SIZE,
    SNAKE_GRID_SIZE,
  );
}

function gameLoop() {
  if (!gameActive) return;
  frameCount++;
  updateFlappyBox();
  updateObstacles();
  updateSnake();
  drawFlappyCanvas();
  if (gameActive) {
    requestAnimationFrame(gameLoop);
  }
}

function updateInstructionsForDevice() {
  const jumpInstruction = document.getElementById("jump-instruction");
  const snakeInstruction = document.getElementById("snake-instruction");
  const startInstruction = document.getElementById("start-instruction");

  if (!jumpInstruction || !snakeInstruction || !startInstruction) return;

  if (window.innerWidth < 1024) {
    jumpInstruction.textContent = "TAP TO JUMP";
    snakeInstruction.textContent = "SWIPE TO CONTROL SNAKE";
    startInstruction.textContent = "TAP TO START";
  } else {
    jumpInstruction.textContent = "SPACE TO JUMP";
    snakeInstruction.textContent = "ARROW KEYS TO CONTROL SNAKE";
    startInstruction.textContent = "PRESS ANY CONTROL TO START";
  }
}

function context() {
  return `# magicsandbox.FlappySnake

This is a simple, fun, and challenging game that's a cross between Flappy Bird and Snake. Like Flappy Bird, the user must fly through a series of obstacles. However, rather than a bird, the user flies a box, inside of which the user must simulatenously play a game of Snake.

- The user can jump by pressing space or by tapping the screen.
- The user can control the snake by using the arrow keys or by swiping the screen.
- The user can start the game by pressing any control.
`;
}

export { init, context };
