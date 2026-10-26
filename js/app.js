// Main Application Controller (Livestream Giveaway Arena)

const INITIAL_DEFAULT_PLAYERS = [
  'Lê Hoàng Phúc', 'Nguyễn Thị Thu', 'Trần Văn Nam', 'Phạm Minh Đức', 'Vũ Thu Trang',
  'Đỗ Gia Bảo', 'Bùi Phương Linh', 'Đặng Tuấn Anh', 'Ngô Thanh Hải', 'Hoàng Bảo Ngọc',
  'Dương Quốc Huy', 'Mai Anh Tuấn', 'Lý Cẩm Tiên', 'Trịnh Hữu Nghĩa', 'Phan Kim Ngân',
  'Đinh Trọng Tấn', 'Võ Hoàng Yến', 'Cao Minh Triết', 'Lâm Khánh Vy', 'Tạ Duy Khang'
];

const STORAGE_KEY = 'giveawayArena.v1';
const GAME_TYPES = ['duck', 'marble', 'snake', 'axe'];

// Uniform random integer in [0, max): uses the browser's cryptographic RNG when available
function randomInt(max) {
  if (window.crypto && window.crypto.getRandomValues) {
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    do {
      window.crypto.getRandomValues(buf);
    } while (buf[0] >= limit);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function fisherYatesShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeName(name) {
  return name.trim().toLowerCase();
}

class GiveawayApp {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.confetti = new ConfettiEffect('confettiCanvas');

    this.currentGameType = 'duck';
    this.currentGame = null;
    this.players = [...INITIAL_DEFAULT_PLAYERS];
    this.history = [];
    this.roundWinners = []; // Tracks winners of each round (up to 10 rounds max)
    this.maxRounds = 10;
    this.isMuted = false;
    this.timerInterval = null;
    this.countdownTimeout = null;
    this.pendingResize = false;
    // 'idle' (ready to start) | 'countdown' | 'running' | 'finished'
    this.phase = 'idle';
    this._lastRanks = [];

    this.loadState();
    this.initDOM();
    this.initGame(this.currentGameType);
    this.renderPlayerCount();
    this.updateTimerDisplay(0);
    this.renderFinalResultsPanel();
    this.renderHistory();
  }

  // ── Persistence: survive an accidental F5 in the middle of a live session ──
  loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return;
      if (Array.isArray(saved.players)) this.players = saved.players;
      if (Array.isArray(saved.roundWinners)) this.roundWinners = saved.roundWinners.slice(0, this.maxRounds);
      if (Array.isArray(saved.history)) this.history = saved.history;
      if (GAME_TYPES.includes(saved.gameType)) this.currentGameType = saved.gameType;
      if (saved.isMuted) {
        this.isMuted = true;
        window.soundFX.muted = true;
      }
    } catch (e) {
      // Storage unavailable or corrupted: start fresh
    }
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        players: this.players,
        roundWinners: this.roundWinners,
        history: this.history,
        gameType: this.currentGameType,
        isMuted: this.isMuted
      }));
    } catch (e) {
      // Private mode / storage full: the session still works, it just won't survive a reload
    }
  }

  initDOM() {
    // Canvas sizing. While a match is on, the canvas keeps its size (CSS letterboxes it) and the
    // new size is applied at the next setup, so resizing / fullscreen / rotating a phone never
    // shifts the arena under the players mid-match.
    this.resizeCanvas();
    window.addEventListener('resize', () => {
      if (this.phase === 'idle') {
        this.resizeCanvas();
        this.setupGame();
      } else {
        this.pendingResize = true;
      }
    });

    // Game Tile Selection
    document.querySelectorAll('.game-tile').forEach(tile => {
      tile.classList.toggle('active', tile.dataset.game === this.currentGameType);
      tile.addEventListener('click', () => {
        const gameType = tile.dataset.game;
        if (gameType === this.currentGameType) return;
        if (this.isMatchActive() && !confirm('Trận đấu đang diễn ra. Đổi game sẽ hủy trận này, bạn chắc chắn chứ?')) return;
        document.querySelectorAll('.game-tile').forEach(t => t.classList.remove('active'));
        tile.classList.add('active');
        this.switchGame(gameType);
      });
    });

    // Players Textarea
    const textarea = document.getElementById('playersTextarea');
    if (textarea) {
      textarea.value = this.players.join('\n');
      textarea.addEventListener('input', () => {
        this.updatePlayersFromTextarea();
      });
    }

    // Remove Winner Button: Xóa tên những người đã thắng để không tham gia nữa
    document.getElementById('btnRemoveWinners')?.addEventListener('click', () => {
      this.removeWinnersFromList();
    });

    // Deduplicate Names (case-insensitive, keeps the first spelling)
    document.getElementById('btnDeduplicate')?.addEventListener('click', () => {
      const originalCount = this.players.length;
      const seen = new Set();
      this.players = this.players.map(p => p.trim()).filter(p => {
        const key = normalizeName(p);
        if (!p || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      this.syncTextarea();
      this.updatePlayersList();
      const removed = originalCount - this.players.length;
      this.showToast(`Đã lọc bỏ ${removed} tên trùng lặp`);
    });

    // Shuffle Names
    document.getElementById('btnShuffle')?.addEventListener('click', () => {
      fisherYatesShuffle(this.players);
      this.syncTextarea();
      this.updatePlayersList();
      this.showToast('Đã xáo trộn ngẫu nhiên danh sách người chơi');
    });

    // Clear All Names
    document.getElementById('btnClearPlayers')?.addEventListener('click', () => {
      this.players = [];
      this.syncTextarea();
      this.updatePlayersList();
    });

    // Reset 10 Rounds in Post-Race Panel
    document.getElementById('btnResetRounds')?.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn làm mới danh sách 10 lượt tặng quà để bắt đầu phiên mới?')) {
        this.roundWinners = [];
        this.renderFinalResultsPanel();
        this.saveState();
        this.showToast('Đã làm mới 10 lượt tặng quà!');
      }
    });

    // Results panel: overlays the arena on desktop; on phones the game HUD needs the full width,
    // so the panel moves below the arena into the control column
    const resultsPanel = document.getElementById('postRacePanel');
    const mobileResultsSlot = document.getElementById('mobileResultsSlot');
    const arenaStage = document.querySelector('.arena-stage');
    const mobileQuery = window.matchMedia('(max-width: 900px)');
    const placeResultsPanel = () => {
      if (!resultsPanel || !mobileResultsSlot || !arenaStage) return;
      const target = mobileQuery.matches ? mobileResultsSlot : arenaStage;
      if (resultsPanel.parentElement !== target) target.appendChild(resultsPanel);
    };
    placeResultsPanel();
    if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', placeResultsPanel);
    else mobileQuery.addListener(placeResultsPanel);

    // Collapse / expand the results panel (it covers part of the arena on smaller screens)
    const toggleResultsBtn = document.getElementById('btnToggleResults');
    if (resultsPanel && toggleResultsBtn) {
      const syncToggle = () => {
        const collapsed = resultsPanel.classList.contains('collapsed');
        toggleResultsBtn.textContent = collapsed ? '▾' : '▴';
        toggleResultsBtn.setAttribute('aria-expanded', String(!collapsed));
      };
      syncToggle();
      toggleResultsBtn.addEventListener('click', () => {
        resultsPanel.classList.toggle('collapsed');
        syncToggle();
      });
    }

    // Main Control Buttons
    document.getElementById('btnStartRace')?.addEventListener('click', () => this.startCountdown());
    document.getElementById('btnPauseRace')?.addEventListener('click', () => {
      if (this.currentGame && this.phase === 'running') {
        this.currentGame.pause();
        this.updateControls();
        this.showToast(this.currentGame.isPaused ? 'Đã tạm dừng' : 'Tiếp tục');
      }
    });
    document.getElementById('btnResetRace')?.addEventListener('click', () => {
      if (this.phase === 'running' && !confirm('Trận đấu đang diễn ra. Đặt lại sẽ hủy trận này, bạn chắc chắn chứ?')) return;
      this.cancelCountdown();
      this.stopMatchTimer();
      this.updateTimerDisplay(0);
      this.phase = 'idle';
      this.setupGame();
      this.updateControls();
      this.showToast('Đã đặt lại đường đua');
    });

    // Top Controls
    const audioBtn = document.getElementById('btnToggleAudio');
    const renderAudioBtn = () => {
      if (!audioBtn) return;
      audioBtn.innerHTML = this.isMuted
        ? '<span class="nav-btn-icon">🔇</span><span class="nav-btn-label">Đã tắt tiếng</span>'
        : '<span class="nav-btn-icon">🔊</span><span class="nav-btn-label">Âm thanh</span>';
      audioBtn.classList.toggle('active', !this.isMuted);
    };
    renderAudioBtn();
    audioBtn?.addEventListener('click', () => {
      this.isMuted = window.soundFX.toggleMute();
      renderAudioBtn();
      this.saveState();
    });

    const fullscreenBtn = document.getElementById('btnToggleFullscreen');
    if (fullscreenBtn && !document.fullscreenEnabled) {
      // iPhone Safari has no Fullscreen API for pages
      fullscreenBtn.style.display = 'none';
    }
    fullscreenBtn?.addEventListener('click', () => {
      const request = !document.fullscreenElement
        ? document.documentElement.requestFullscreen()
        : document.exitFullscreen();
      Promise.resolve(request).catch(() => this.showToast('Trình duyệt không cho phép chế độ toàn màn hình'));
    });

    document.getElementById('btnOpenHistory')?.addEventListener('click', () => {
      document.getElementById('historyDrawer')?.classList.add('open');
    });
    document.getElementById('btnCloseHistory')?.addEventListener('click', () => {
      document.getElementById('historyDrawer')?.classList.remove('open');
    });
    document.getElementById('btnClearHistory')?.addEventListener('click', () => {
      this.history = [];
      this.renderHistory();
      this.saveState();
      this.showToast('Đã làm mới lịch sử trao giải');
    });

    // Winner Modal Actions
    document.getElementById('btnCloseWinnerModal')?.addEventListener('click', () => {
      this.closeWinnerModal();
    });
    document.getElementById('btnNextRound')?.addEventListener('click', () => {
      this.closeWinnerModal();
      if (this.roundWinners.length >= this.maxRounds) {
        this.showToast('Đã hoàn thành 10/10 lượt! Hãy bấm "Làm mới 10 lượt" để bắt đầu phiên mới.');
        return;
      }
      this.phase = 'idle';
      this.updateTimerDisplay(0);
      this.setupGame();
      this.updateControls();
    });
    document.getElementById('btnCopyResult')?.addEventListener('click', () => {
      this.copyCurrentWinner();
    });

    // View All Rankings button inside Winner Modal
    document.getElementById('btnViewAllRanksInModal')?.addEventListener('click', () => {
      this.toggleModalFullLeaderboard();
    });
  }

  isMatchActive() {
    return this.phase === 'countdown' || this.phase === 'running';
  }

  resizeCanvas() {
    const stage = document.querySelector('.arena-stage');
    if (stage && this.canvas) {
      this.canvas.width = stage.clientWidth || 1280;
      this.canvas.height = stage.clientHeight || 720;
    }
    this.pendingResize = false;
  }

  // Fresh field for the current roster, applying any resize that was held back during a match
  setupGame() {
    if (this.pendingResize) this.resizeCanvas();
    if (this.currentGame) this.currentGame.setup(this.players);
  }

  syncTextarea() {
    const textarea = document.getElementById('playersTextarea');
    if (textarea) textarea.value = this.players.join('\n');
  }

  updatePlayersFromTextarea() {
    const textarea = document.getElementById('playersTextarea');
    if (!textarea) return;
    this.players = textarea.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    this.updatePlayersList();
  }

  // Roster changed: edits made during a match apply from the next round
  updatePlayersList() {
    this.renderPlayerCount();
    this.saveState();
    if (this.phase === 'idle') {
      this.setupGame();
    }
  }

  renderPlayerCount() {
    const badge = document.getElementById('playerCountBadge');
    if (badge) badge.textContent = `${this.players.length} người`;
    this.updateControls();
  }

  // Start is locked during the countdown and the match, so a stray click can't restart a live race
  updateControls() {
    const startBtn = document.getElementById('btnStartRace');
    if (startBtn) startBtn.disabled = this.isMatchActive() || this.players.length < 2;

    const pauseBtn = document.getElementById('btnPauseRace');
    if (pauseBtn) {
      pauseBtn.disabled = this.phase !== 'running';
      const paused = this.phase === 'running' && this.currentGame && this.currentGame.isPaused;
      pauseBtn.textContent = paused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
    }
  }

  // Remove players who already won from the active roster
  removeWinnersFromList() {
    if (this.roundWinners.length === 0) {
      this.showToast('Chưa có người nào chiến thắng trong các lượt trước.');
      return;
    }
    const winnerNames = new Set(this.roundWinners.map(r => normalizeName(r.winner)));
    const initialCount = this.players.length;
    this.players = this.players.filter(p => !winnerNames.has(normalizeName(p)));
    const removedCount = initialCount - this.players.length;

    this.syncTextarea();
    this.updatePlayersList();

    if (removedCount > 0) {
      this.showToast(`Đã lọc bỏ ${removedCount} người đã từng chiến thắng khỏi danh sách!`);
    } else {
      this.showToast('Danh sách người chơi hiện tại không chứa người đã chiến thắng.');
    }
  }

  switchGame(type) {
    this.currentGameType = type;
    this.cancelCountdown();
    this.stopMatchTimer();
    this.updateTimerDisplay(0);
    this.phase = 'idle';
    this.saveState();
    this.initGame(type);
    this.updateControls();
  }

  initGame(type) {
    if (this.currentGame) {
      this.currentGame.stop();
    }

    // Callbacks only count while this instance is the active game, so a finish scheduled by a
    // game the host just switched away from can never record a winner
    let game = null;
    const onLeaderboard = (ranks) => {
      if (game === this.currentGame) this.updateLeaderboard(ranks);
    };
    const onFinish = (podium) => {
      if (game === this.currentGame) this.handleRaceFinish(podium);
    };

    if (type === 'duck') {
      game = new DuckRace(this.canvas, onLeaderboard, onFinish);
    } else if (type === 'marble') {
      game = new MarbleRace(this.canvas, onLeaderboard, onFinish);
    } else if (type === 'snake') {
      game = new SnakeBattle(this.canvas, onLeaderboard, onFinish);
    } else if (type === 'axe') {
      game = new AxeBattle(this.canvas, onLeaderboard, onFinish);
    }
    this.currentGame = game;

    if (this.currentGame) {
      if (this.currentGame.setPace) {
        this.currentGame.setPace('180s'); // Fixed standard 3 minutes
      }
      this.setupGame();
    }
  }

  cancelCountdown() {
    clearTimeout(this.countdownTimeout);
    this.countdownTimeout = null;
    const overlay = document.getElementById('countdownOverlay');
    if (overlay) {
      overlay.textContent = '';
      overlay.classList.remove('animate');
    }
  }

  startCountdown() {
    if (this.isMatchActive()) return;

    if (this.roundWinners.length >= this.maxRounds) {
      this.showToast('Đã hoàn thành đủ 10/10 lượt tặng quà! Hãy bấm "Làm mới 10 lượt" để bắt đầu phiên mới.');
      return;
    }

    // Auto-remove any player who already won from this.players before start
    if (this.roundWinners.length > 0) {
      const winnerNames = new Set(this.roundWinners.map(r => normalizeName(r.winner)));
      const initialCount = this.players.length;
      this.players = this.players.filter(p => !winnerNames.has(normalizeName(p)));
      if (this.players.length < initialCount) {
        this.syncTextarea();
        this.renderPlayerCount();
        this.saveState();
        this.showToast(`Đã tự động loại ${initialCount - this.players.length} người đã từng thắng khỏi danh sách.`);
      }
    }

    if (this.players.length < 2) {
      this.showToast('Cần ít nhất 2 người chơi hợp lệ để bắt đầu cuộc đua!');
      return;
    }

    // Hide any modals and reset timer
    this.closeWinnerModal();
    this.stopMatchTimer();
    this.updateTimerDisplay(0);

    // Fair-play RNG: cryptographically uniform Fisher-Yates shuffle of start positions before every match
    fisherYatesShuffle(this.players);

    this.phase = 'countdown';
    this.setupGame();
    this.updateControls();

    const overlay = document.getElementById('countdownOverlay');
    const steps = ['3', '2', '1', 'BẮT ĐẦU!'];
    let idx = 0;

    const runStep = () => {
      if (this.phase !== 'countdown') return;
      if (overlay && idx < steps.length) {
        overlay.textContent = steps[idx];
        overlay.classList.remove('animate');
        void overlay.offsetWidth; // trigger reflow
        overlay.classList.add('animate');

        const isLast = (idx === steps.length - 1);
        if (window.soundFX) window.soundFX.playBeep(isLast);

        idx++;
        this.countdownTimeout = setTimeout(runStep, 800);
      } else {
        this.cancelCountdown();
        this.phase = 'running';
        this.updateControls();
        if (this.currentGame) this.currentGame.start();
        this.startMatchTimer();
      }
    };

    runStep();
  }

  // The match clock shows elapsed match time read from the game's own simulation clock, so it
  // pauses with the game and always agrees with what happens on screen
  startMatchTimer() {
    this.stopMatchTimer();
    this.updateTimerDisplay(0);
    this.timerInterval = setInterval(() => {
      if (this.currentGame) this.updateTimerDisplay((this.currentGame.simTimeMs || 0) / 1000);
    }, 250);
  }

  stopMatchTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay(elapsedSec) {
    const el = document.getElementById('matchTimerText');
    if (!el) return;
    const total = Math.floor(elapsedSec);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  updateLeaderboard(ranks) {
    this._lastRanks = ranks;
  }

  // Render the persistent 10-round giveaway winners panel on the right side
  renderFinalResultsPanel() {
    const badgeEl = document.getElementById('postRaceRoundBadge');
    if (badgeEl) {
      badgeEl.textContent = `${this.roundWinners.length}/${this.maxRounds} Lượt`;
    }

    const listEl = document.getElementById('postRaceWinnersList');
    if (!listEl) return;

    if (this.roundWinners.length === 0) {
      listEl.innerHTML = `<div class="no-winners-hint">Chưa có người thắng cuộc.<br>Bắt đầu Lượt 1 để trao quà!</div>`;
      return;
    }

    listEl.innerHTML = this.roundWinners.map(item => `
      <div class="winner-round-row">
        <div class="round-pill">Lượt ${item.round}</div>
        <div class="winner-row-main">
          <span class="winner-medal-icon">🥇</span>
          <span class="winner-name-txt" title="${this.escapeHTML(item.winner)}">${this.escapeHTML(item.winner)}</span>
        </div>
        <div class="game-tag-pill">${this.escapeHTML(item.gameShort)}</div>
      </div>
    `).join('');
  }

  handleRaceFinish(podium) {
    if (!podium || podium.length === 0) return;
    this.stopMatchTimer();
    if (this.currentGame) this.updateTimerDisplay((this.currentGame.simTimeMs || 0) / 1000);
    this.phase = 'finished';
    this.updateControls();

    const winner = podium[0];
    const runner2 = podium[1] || null;
    const runner3 = podium[2] || null;

    // Trigger celebration effects
    this.confetti.start();
    if (window.soundFX) {
      window.soundFX.playFanfare();
      setTimeout(() => window.soundFX.playFirework(), 600);
      setTimeout(() => window.soundFX.playFirework(), 1200);
    }

    // Format timestamp
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
                    ' - ' + now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

    // Record round winner (up to max 10 rounds)
    let currentRoundNumber = this.roundWinners.length + 1;
    if (currentRoundNumber <= this.maxRounds) {
      const roundRecord = {
        round: currentRoundNumber,
        winner: winner.name,
        runner2: runner2 ? runner2.name : null,
        runner3: runner3 ? runner3.name : null,
        gameType: this.currentGameType,
        gameName: this.getGameName(this.currentGameType),
        gameShort: this.getGameNameShort(this.currentGameType),
        time: timeStr
      };
      this.roundWinners.push(roundRecord);
      this.renderFinalResultsPanel();

      // AUTO-REMOVE winner from active player roster so they only win once
      this.players = this.players.filter(p => normalizeName(p) !== normalizeName(winner.name));
      this.syncTextarea();
      this.renderPlayerCount();

      this.showToast(`🎉 ${winner.name} đã thắng Lượt ${currentRoundNumber}! Đã xóa khỏi danh sách để nhường cơ hội.`);
    }

    // Save to History drawer
    this.history.unshift({
      winner: winner.name,
      runner2: runner2 ? runner2.name : null,
      runner3: runner3 ? runner3.name : null,
      game: this.getGameName(this.currentGameType),
      time: timeStr
    });
    this.renderHistory();
    this.saveState();

    // Populate Winner Celebration Modal
    const roundBadge = document.getElementById('winnerRoundBadge');
    if (roundBadge) {
      roundBadge.textContent = `LƯỢT ${Math.min(currentRoundNumber, this.maxRounds)} / ${this.maxRounds}`;
    }

    const gameBadge = document.getElementById('winnerGameBadge');
    if (gameBadge) {
      gameBadge.textContent = this.getGameName(this.currentGameType);
    }

    document.getElementById('winnerNameDisplay').textContent = winner.name;
    document.getElementById('winnerTimestampDisplay').textContent = `⏰ Thời gian về đích: ${timeStr}`;

    const r2El = document.getElementById('runner2Name');
    const r3El = document.getElementById('runner3Name');
    if (r2El) r2El.textContent = runner2 ? runner2.name : '--';
    if (r3El) r3El.textContent = runner3 ? runner3.name : '--';

    // Populate full leaderboard inside modal for this round
    const allRanks = this._lastRanks && this._lastRanks.length > 0 ? this._lastRanks : podium.map(p => ({ name: p.name }));
    this.populateModalLeaderboard(allRanks);

    // Update next round button text in modal
    const btnNext = document.getElementById('btnNextRound');
    if (btnNext) {
      if (this.roundWinners.length >= this.maxRounds) {
        btnNext.textContent = '🏁 ĐÃ HOÀN THÀNH 10 LƯỢT';
      } else {
        btnNext.textContent = `🔄 Vòng đấu tiếp theo (Lượt ${this.roundWinners.length + 1}/${this.maxRounds})`;
      }
    }

    // Show winner modal after brief dramatic delay
    setTimeout(() => {
      if (this.phase === 'finished') document.getElementById('winnerModal').classList.add('show');
    }, 1000);
  }

  populateModalLeaderboard(allRanks) {
    const listEl = document.getElementById('modalLeaderboardList');
    if (!listEl) return;

    listEl.innerHTML = allRanks.map((r, i) => {
      let rankBadge = '';
      if (i === 0) rankBadge = '<span class="modal-rank-badge rank-1">🥇 Hạng 1</span>';
      else if (i === 1) rankBadge = '<span class="modal-rank-badge rank-2">🥈 Hạng 2</span>';
      else if (i === 2) rankBadge = '<span class="modal-rank-badge rank-3">🥉 Hạng 3</span>';
      else rankBadge = `<span class="modal-rank-badge rank-other">#${i + 1}</span>`;

      return `
        <div class="modal-rank-row ${i < 3 ? 'top-three' : ''}">
          ${rankBadge}
          <span class="modal-rank-name">${this.escapeHTML(r.name)}</span>
        </div>
      `;
    }).join('');

    // Reset accordion to collapsed state initially
    const section = document.getElementById('modalLeaderboardSection');
    const toggleBtn = document.getElementById('btnViewAllRanksInModal');
    if (section) section.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = '📋 Xem tất cả xếp hạng';
  }

  toggleModalFullLeaderboard() {
    const section = document.getElementById('modalLeaderboardSection');
    const toggleBtn = document.getElementById('btnViewAllRanksInModal');
    if (!section || !toggleBtn) return;

    const isVisible = section.style.display !== 'none';
    section.style.display = isVisible ? 'none' : 'block';
    toggleBtn.textContent = isVisible ? '📋 Xem tất cả xếp hạng' : '🔼 Thu gọn xếp hạng';
  }

  closeWinnerModal() {
    this.confetti.stop();
    document.getElementById('winnerModal')?.classList.remove('show');
  }

  copyCurrentWinner() {
    if (this.roundWinners.length === 0) return;
    const latest = this.roundWinners[this.roundWinners.length - 1];
    const text = `🎉 KẾT QUẢ TRAO QUÀ (LƯỢT ${latest.round}/${this.maxRounds}) 🎉\n` +
      `🥇 Quán quân: ${latest.winner}\n` +
      `🎮 Trò chơi: ${latest.gameName}\n` +
      `⏰ Thời gian: ${latest.time}`;

    const done = () => this.showToast('Đã sao chép kết quả trúng thưởng!');
    const fallback = () => {
      // Clipboard API needs HTTPS/localhost and page focus; fall back to a hidden textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      ta.remove();
      if (ok) done();
      else this.showToast('Không sao chép được, hãy chụp màn hình kết quả');
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  getGameName(type) {
    if (type === 'duck') return '🦆 Đua Vịt Vượt Thác';
    if (type === 'marble') return '🔴 Đua Bi Zíc-Zắc';
    if (type === 'snake') return '🐍 Đại Chiến Rắn Săn Mồi';
    if (type === 'axe') return '⚔️ Đấu Trường Tiến Hóa (EvoWars)';
    return 'Mini Game';
  }

  getGameNameShort(type) {
    if (type === 'duck') return '🦆 Đua Vịt';
    if (type === 'marble') return '🔴 Đua Bi';
    if (type === 'snake') return '🐍 Rắn Săn Mồi';
    if (type === 'axe') return '⚔️ Đấu Rìu';
    return 'Mini Game';
  }

  renderHistory() {
    const listEl = document.getElementById('historyList');
    if (!listEl) return;

    if (this.history.length === 0) {
      listEl.innerHTML = `<div class="history-empty">Chưa có vòng đấu nào trong phiên này.</div>`;
      return;
    }

    listEl.innerHTML = this.history.map(item => `
      <div class="history-item">
        <div class="history-item-top">
          <span class="history-winner">🥇 ${this.escapeHTML(item.winner)}</span>
          <span class="history-time">${this.escapeHTML(String(item.time).split(' - ')[0])}</span>
        </div>
        <div style="font-size: 0.8rem; color: #94a3b8;">
          🥈 ${this.escapeHTML(item.runner2 || '--')} | 🥉 ${this.escapeHTML(item.runner3 || '--')}
        </div>
        <span class="history-game-badge">${this.escapeHTML(item.game)}</span>
      </div>
    `).join('');
  }

  showToast(msg) {
    const toast = document.getElementById('toastMsg');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g,
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

// Start app on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new GiveawayApp();
});
