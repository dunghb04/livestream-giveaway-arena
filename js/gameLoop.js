// Fixed-timestep simulation shared by all mini-games.
// Game physics were tuned at 60 updates per second; stepping the simulation at exactly that rate
// keeps match length identical on 30 FPS (OBS browser source), 60 Hz and 144 Hz screens.
// Match time is counted in simulated time, so pausing (or a hidden tab) freezes the match clock too.
const SIM_STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 8;

function resetSimClock(game) {
  game.simTimeMs = 0;
  game.lastFrameTime = null;
  game.stepAccumulator = 0;
}

function runFixedSteps(game) {
  const now = performance.now();
  const last = game.lastFrameTime === null || game.lastFrameTime === undefined ? now : game.lastFrameTime;
  game.lastFrameTime = now;

  // Cap the backlog (e.g. after the tab was hidden) so the match resumes instead of fast-forwarding
  game.stepAccumulator = Math.min((game.stepAccumulator || 0) + (now - last), SIM_STEP_MS * MAX_STEPS_PER_FRAME);

  while (game.stepAccumulator >= SIM_STEP_MS) {
    game.stepAccumulator -= SIM_STEP_MS;
    if (!game.isRunning) break;
    if (!game.isPaused) game.simTimeMs += SIM_STEP_MS;
    game.update();
  }
}

window.SIM_STEP_MS = SIM_STEP_MS;
window.resetSimClock = resetSimClock;
window.runFixedSteps = runFixedSteps;
