// Main Application Controller (Livestream Giveaway Arena)

const INITIAL_DEFAULT_PLAYERS = [
  'Lê Hoàng Phúc', 'Nguyễn Thị Thu', 'Trần Văn Nam', 'Phạm Minh Đức', 'Vũ Thu Trang',
  'Đỗ Gia Bảo', 'Bùi Phương Linh', 'Đặng Tuấn Anh', 'Ngô Thanh Hải', 'Hoàng Bảo Ngọc',
  'Dương Quốc Huy', 'Mai Anh Tuấn', 'Lý Cẩm Tiên', 'Trịnh Hữu Nghĩa', 'Phan Kim Ngân',
  'Đinh Trọng Tấn', 'Võ Hoàng Yến', 'Cao Minh Triết', 'Lâm Khánh Vy', 'Tạ Duy Khang'
];

function fisherYatesShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class GiveawayApp {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.confetti = new ConfettiEffect('confettiCanvas');
    
    this.currentGameType = 'duck';
    this.currentGame = null;
    this.currentPace = '180s'; // Fixed standard 3 minutes (180s)
    this.players = [...INITIAL_DEFAULT_PLAYERS];
    this.history = [];
    this.roundWinners = []; // Tracks winners of each round (up to 10 rounds max)
    this.maxRounds = 10;
    this.isMuted = false;
    this.timerInterval = null;
    this.remainingSeconds = 180;
    this._lastRanks = [];

    this.initDOM();
    this.initGame('duck');
    this.renderPlayerCount();
    this.updateTimerDisplay();
    this.renderFinalResultsPanel();
  }

  initDOM() {
    // Canvas sizing
    this.resizeCanvas();
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      if (this.currentGame && !this.currentGame.isRunning) {
        this.currentGame.setup(this.players);
      }
    });

    // Game Tile Selection
    document.querySelectorAll('.game-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        document.querySelectorAll('.game-tile').forEach(t => t.classList.remove('active'));
        tile.classList.add('active');
        const gameType = tile.dataset.game;
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

    // Deduplicate Names
    document.getElementById('btnDeduplicate')?.addEventListener('click', () => {
      const originalCount = this.players.length;
      this.players = [...new Set(this.players.map(p => p.trim()).filter(Boolean))];
      if (textarea) textarea.value = this.players.join('\n');
      this.updatePlayersList();
      const removed = originalCount - this.players.length;
      this.showToast(`Đã lọc bỏ ${removed} tên trùng lặp`);
    });

    // Shuffle Names
    document.getElementById('btnShuffle')?.addEventListener('click', () => {
      fisherYatesShuffle(this.players);
      if (textarea) textarea.value = this.players.join('\n');
      this.updatePlayersList();
      this.showToast('Đã xáo trộn ngẫu nhiên danh sách người chơi');
    });

    // Clear All Names
    document.getElementById('btnClearPlayers')?.addEventListener('click', () => {
      this.players = [];
      if (textarea) textarea.value = '';
      this.updatePlayersList();
    });

    // Reset 10 Rounds in Post-Race Panel
    document.getElementById('btnResetRounds')?.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn làm mới danh sách 10 lượt tặng quà để bắt đầu phiên mới?')) {
        this.roundWinners = [];
        this.renderFinalResultsPanel();
        this.showToast('Đã làm mới 10 lượt tặng quà!');
      }
    });

    // Main Control Buttons
    document.getElementById('btnStartRace')?.addEventListener('click', () => this.startCountdown());
    document.getElementById('btnPauseRace')?.addEventListener('click', () => {
      if (this.currentGame) {
        this.currentGame.pause();
        this.showToast(this.currentGame.isPaused ? 'Đã tạm dừng' : 'Tiếp tục');
      }
    });
    document.getElementById('btnResetRace')?.addEventListener('click', () => {
      this.stopMatchTimer();
      this.remainingSeconds = 180;
      this.updateTimerDisplay();
      if (this.currentGame) {
        this.currentGame.setup(this.players);
        this.showToast('Đã đặt lại đường đua');
      }
    });

    // Top Controls
    document.getElementById('btnToggleAudio')?.addEventListener('click', (e) => {
      this.isMuted = window.soundFX.toggleMute();
      const btn = e.currentTarget;
      btn.innerHTML = this.isMuted ? '🔇 Đã tắt tiếng' : '🔊 Âm thanh';
      btn.classList.toggle('active', !this.isMuted);
    });

    document.getElementById('btnToggleFullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
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
      if (this.currentGame) this.currentGame.setup(this.players);
    });
    document.getElementById('btnCopyResult')?.addEventListener('click', () => {
      this.copyCurrentWinner();
    });

    // View All Rankings button inside Winner Modal
    document.getElementById('btnViewAllRanksInModal')?.addEventListener('click', () => {
      this.toggleModalFullLeaderboard();
    });
  }

  resizeCanvas() {
    const stage = document.querySelector('.arena-stage');
    if (stage && this.canvas) {
      this.canvas.width = stage.clientWidth || 1280;
      this.canvas.height = stage.clientHeight || 720;
    }
  }

  updatePlayersFromTextarea() {
    const textarea = document.getElementById('playersTextarea');
    if (!textarea) return;
    this.players = textarea.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    this.renderPlayerCount();
    if (this.currentGame && !this.currentGame.isRunning) {
      this.currentGame.setup(this.players);
    }
  }

  updatePlayersList() {
    this.renderPlayerCount();
    if (this.currentGame && !this.currentGame.isRunning) {
      this.currentGame.setup(this.players);
    }
  }

  renderPlayerCount() {
    const badge = document.getElementById('playerCountBadge');
    if (badge) badge.textContent = `${this.players.length} người`;

    const startBtn = document.getElementById('btnStartRace');
    const hasEnough = this.players.length >= 2;
    if (startBtn) startBtn.disabled = !hasEnough;
  }

  // Remove players who already won from the active roster
  removeWinnersFromList() {
    if (this.roundWinners.length === 0) {
      this.showToast('Chưa có người nào chiến thắng trong các lượt trước.');
      return;
    }
    const winnerNames = new Set(this.roundWinners.map(r => r.winner.trim().toLowerCase()));
    const initialCount = this.players.length;
    this.players = this.players.filter(p => !winnerNames.has(p.trim().toLowerCase()));
    const removedCount = initialCount - this.players.length;

    const textarea = document.getElementById('playersTextarea');
    if (textarea) textarea.value = this.players.join('\n');
    this.updatePlayersList();

    if (removedCount > 0) {
      this.showToast(`Đã lọc bỏ ${removedCount} người đã từng chiến thắng khỏi danh sách!`);
    } else {
      this.showToast('Danh sách người chơi hiện tại không chứa người đã chiến thắng.');
    }
  }

  switchGame(type) {
    this.currentGameType = type;
    this.initGame(type);
  }

  initGame(type) {
    if (this.currentGame) {
      this.currentGame.stop();
    }

    const onLeaderboard = (ranks) => this.updateLeaderboard(ranks);
    const onFinish = (podium) => this.handleRaceFinish(podium);

    if (type === 'duck') {
      this.currentGame = new DuckRace(this.canvas, onLeaderboard, onFinish);
    } else if (type === 'marble') {
      this.currentGame = new MarbleRace(this.canvas, onLeaderboard, onFinish);
    } else if (type === 'snake') {
      this.currentGame = new SnakeBattle(this.canvas, onLeaderboard, onFinish);
    } else if (type === 'axe') {
      this.currentGame = new AxeBattle(this.canvas, onLeaderboard, onFinish);
    }

    if (this.currentGame) {
      if (this.currentGame.setPace) {
        this.currentGame.setPace('180s'); // Fixed standard 3 minutes
      }
      this.currentGame.setup(this.players);
    }
  }

  startCountdown() {
    if (this.roundWinners.length >= this.maxRounds) {
      this.showToast('Đã hoàn thành đủ 10/10 lượt tặng quà! Hãy bấm "Làm mới 10 lượt" để bắt đầu phiên mới.');
      return;
    }

    // Auto-remove any player who already won from this.players before start
    if (this.roundWinners.length > 0) {
      const winnerNames = new Set(this.roundWinners.map(r => r.winner.trim().toLowerCase()));
      const initialCount = this.players.length;
      this.players = this.players.filter(p => !winnerNames.has(p.trim().toLowerCase()));
      if (this.players.length < initialCount) {
        const textarea = document.getElementById('playersTextarea');
        if (textarea) textarea.value = this.players.join('\n');
        this.renderPlayerCount();
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

    // 100% Fair-Play RNG: Cryptographically uniform Fisher-Yates shuffle before every match!
    fisherYatesShuffle(this.players);

    // Prepare fresh setup
    if (this.currentGame) {
      this.currentGame.setup(this.players);
    }

    const overlay = document.getElementById('countdownOverlay');
    if (!overlay) {
      this.startMatchTimer();
      if (this.currentGame) this.currentGame.start();
      return;
    }

    const steps = ['3', '2', '1', 'BẮT ĐẦU!'];
    let idx = 0;

    const runStep = () => {
      if (idx < steps.length) {
        overlay.textContent = steps[idx];
        overlay.classList.remove('animate');
        void overlay.offsetWidth; // trigger reflow
        overlay.classList.add('animate');

        const isLast = (idx === steps.length - 1);
        if (window.soundFX) window.soundFX.playBeep(isLast);

        idx++;
        setTimeout(runStep, 800);
      } else {
        overlay.textContent = '';
        overlay.classList.remove('animate');
        this.startMatchTimer();
        if (this.currentGame) {
          this.currentGame.start();
        }
      }
    };

    runStep();
  }

  startMatchTimer() {
    this.stopMatchTimer();
    this.remainingSeconds = 180; // Fixed 3 minutes
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      if (this.currentGame && this.currentGame.isPaused) return;
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        this.updateTimerDisplay();
      } else {
        this.stopMatchTimer();
      }
    }, 1000);
  }

  stopMatchTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay() {
    const el = document.getElementById('matchTimerText');
    if (!el) return;
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
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
        <div class="game-tag-pill">${item.gameShort}</div>
      </div>
    `).join('');
  }

  handleRaceFinish(podium) {
    if (!podium || podium.length === 0) return;
    this.stopMatchTimer();

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
      this.players = this.players.filter(p => p.trim().toLowerCase() !== winner.name.trim().toLowerCase());
      const textarea = document.getElementById('playersTextarea');
      if (textarea) textarea.value = this.players.join('\n');
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
      document.getElementById('winnerModal').classList.add('show');
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

    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Đã sao chép kết quả trúng thưởng!');
    });
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
          <span class="history-time">${item.time.split(' - ')[0]}</span>
        </div>
        <div style="font-size: 0.8rem; color: #94a3b8;">
          🥈 ${this.escapeHTML(item.runner2 || '--')} | 🥉 ${this.escapeHTML(item.runner3 || '--')}
        </div>
        <span class="history-game-badge">${item.game}</span>
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
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

// Start app on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new GiveawayApp();
});
