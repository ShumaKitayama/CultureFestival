class FlowerGarden {
  constructor() {
    this.grid = document.getElementById("garden-grid");
    this.connectionStatus = document.getElementById("connection-status");
    this.flowerCount = document.getElementById("flower-count");
    this.websocket = null;
    this.slots = new Map(); // slot_id -> slot element
    this.flowerCountValue = 0;
    this.slotPositions = [];

    this.init();
  }

  init() {
    this.createGrid();
    this.createWindParticles();
    this.connectWebSocket();
    this.loadInitialData();
  }

  // 7列×4行のグリッドを作成
  createGrid() {
    this.grid.innerHTML = "";

    const totalSlots = 7 * 4;
    this.slotPositions = this.generateSlotPositions(totalSlots);

    let slotIndex = 0;
    for (let y = 1; y <= 4; y++) {
      for (let x = 1; x <= 7; x++) {
        const slot = this.createSlot(x, y, slotIndex);
        this.grid.appendChild(slot);
        slotIndex++;
      }
    }
  }

  // 個別のスロット要素を作成
  createSlot(x, y, index) {
    const slot = document.createElement("div");
    slot.className = "flower-slot empty";
    slot.dataset.gridX = x;
    slot.dataset.gridY = y;
    slot.style.setProperty("--slot-delay", index);

    const organicPosition = this.slotPositions[index];
    if (organicPosition) {
      slot.style.left = `${organicPosition.left}%`;
      slot.style.top = `${organicPosition.top}%`;
      slot.style.setProperty("--slot-scale", organicPosition.scale);
      slot.style.setProperty(
        "--stem-height",
        `${organicPosition.stemHeight}px`
      );
      slot.style.setProperty(
        "--slot-sway-duration",
        `${organicPosition.swayDuration}s`
      );
      slot.style.setProperty("--slot-tilt", `${organicPosition.tilt}deg`);
      slot.style.zIndex = organicPosition.layer;
    }

    // 茎を追加
    const stem = document.createElement("div");
    stem.className = "stem";
    stem.style.setProperty("--slot-delay", index);
    slot.appendChild(stem);

    // 蕾を追加
    const bud = document.createElement("div");
    bud.className = "bud";
    bud.style.setProperty("--slot-delay", index);
    slot.appendChild(bud);

    // スロット番号を追加
    const slotNumber = document.createElement("div");
    slotNumber.className = "slot-number";
    slotNumber.textContent = `${x}-${y}`;
    slot.appendChild(slotNumber);

    return slot;
  }

  generateSlotPositions(count) {
    const positions = [];
    const meadowStart = 52;
    const meadowDepth = 38;
    const minDistance = 7;
    const maxAttempts = 80;

    for (let i = 0; i < count; i++) {
      let candidate = null;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const left = 8 + Math.random() * 84;
        const top = meadowStart + Math.random() * meadowDepth;
        const tooClose = positions.some(
          (pos) => Math.hypot(pos.left - left, pos.top - top) < minDistance
        );

        candidate = { left, top };

        if (!tooClose) {
          break;
        }

        attempts++;
      }

      if (!candidate) {
        candidate = {
          left: 8 + Math.random() * 84,
          top: meadowStart + Math.random() * meadowDepth,
        };
      }

      const depthRatio = (candidate.top - meadowStart) / meadowDepth;
      const scale = 0.85 + depthRatio * 0.45;
      const stemHeight = 90 + depthRatio * 90;
      const swayDuration = 7 + Math.random() * 6;
      const tilt = (Math.random() - 0.5) * 5;
      const layer = 100 + Math.round(depthRatio * 100);

      positions.push({
        left: Number(candidate.left.toFixed(2)),
        top: Number(candidate.top.toFixed(2)),
        scale: Number(scale.toFixed(2)),
        stemHeight: Math.round(stemHeight),
        swayDuration: Number(swayDuration.toFixed(1)),
        tilt: Number(tilt.toFixed(2)),
        layer,
      });
    }

    return positions;
  }

  // WebSocket接続
  connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.hostname}:8080/ws`;

    this.updateConnectionStatus("connecting");

    this.websocket = new WebSocket(wsUrl);

    this.websocket.onopen = () => {
      console.log("WebSocket接続成功");
      this.updateConnectionStatus("connected");
    };

    this.websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error("WebSocketメッセージ解析エラー:", error);
      }
    };

    this.websocket.onclose = () => {
      console.log("WebSocket接続終了");
      this.updateConnectionStatus("disconnected");

      // 5秒後に再接続を試行
      setTimeout(() => {
        this.connectWebSocket();
      }, 5000);
    };

    this.websocket.onerror = (error) => {
      console.error("WebSocketエラー:", error);
      this.updateConnectionStatus("disconnected");
    };
  }

  // WebSocketメッセージ処理
  handleWebSocketMessage(message) {
    console.log("WebSocketメッセージ受信:", message);

    if (message.type === "new_flower") {
      this.addFlower(message);
    } else if (message.type === "reset") {
      console.log("🔄 サーバーからリセット通知受信");
      this.resetGarden();
    }
  }

  // 新しい花を追加
  addFlower(message) {
    const { slot_id, grid_x, grid_y, image_url } = message;
    console.log("addFlower呼び出し:", { slot_id, grid_x, grid_y, image_url });

    // 該当するスロットを見つける
    const slot = this.findSlotByPosition(grid_x, grid_y);
    if (!slot) {
      console.error("スロットが見つかりません:", grid_x, grid_y);
      return;
    }

    console.log("スロット発見:", slot);

    // スロットの状態を更新
    slot.classList.remove("empty");
    slot.classList.add("occupied");

    // 既存の花を削除
    const existingFlower = slot.querySelector(".flower");
    if (existingFlower) {
      existingFlower.remove();
    }

    // 新しい花を作成
    const flower = document.createElement("div");
    flower.className = "flower";
    flower.style.backgroundImage = `url(${image_url})`;
    slot.appendChild(flower);

    console.log("花要素作成完了:", flower);

    // アニメーション開始
    setTimeout(() => {
      flower.classList.add("bloom");
      console.log("花開花アニメーション開始");
    }, 100);

    // 花の数を更新
    this.flowerCountValue++;
    this.updateFlowerCount();

    // 成功エフェクト
    this.showSuccessEffect(slot);
  }

  // 位置でスロットを検索
  findSlotByPosition(x, y) {
    return this.grid.querySelector(`[data-grid-x="${x}"][data-grid-y="${y}"]`);
  }

  // 成功エフェクトを表示
  showSuccessEffect(slot) {
    // パーティクルエフェクト
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        this.createParticle(slot);
      }, i * 50);
    }
  }

  // パーティクルを作成
  createParticle(slot) {
    const particle = document.createElement("div");
    particle.style.cssText = `
            position: absolute;
            width: 6px;
            height: 6px;
            background: linear-gradient(45deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
        `;

    const rect = slot.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    particle.style.left = x + "px";
    particle.style.top = y + "px";

    document.body.appendChild(particle);

    // アニメーション
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 100;
    const endX = x + Math.cos(angle) * distance;
    const endY = y + Math.sin(angle) * distance;

    particle.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        {
          transform: `translate(${endX - x}px, ${endY - y}px) scale(0)`,
          opacity: 0,
        },
      ],
      {
        duration: 1000,
        easing: "ease-out",
      }
    ).onfinish = () => {
      particle.remove();
    };
  }

  // 初期データを読み込み
  async loadInitialData() {
    try {
      const response = await fetch("http://localhost:8080/api/slots");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const slots = await response.json();
      console.log("初期スロットデータ:", slots);

      // 既存の花を表示
      slots.forEach((slot) => {
        if (slot.is_used && slot.image_url) {
          console.log("花を追加中:", slot);
          this.addFlower({
            slot_id: slot.slot_id,
            grid_x: slot.grid_x,
            grid_y: slot.grid_y,
            image_url: slot.image_url,
          });
        }
      });
    } catch (error) {
      console.error("初期データ読み込みエラー:", error);
    }
  }

  // 接続状態を更新
  updateConnectionStatus(status) {
    if (!this.connectionStatus) {
      return;
    }

    this.connectionStatus.className = status;

    switch (status) {
      case "connected":
        this.connectionStatus.textContent = "🟢 接続中";
        break;
      case "disconnected":
        this.connectionStatus.textContent = "🔴 切断";
        break;
      case "connecting":
        this.connectionStatus.textContent = "🟡 接続中...";
        break;
    }
  }

  // 花の数を更新
  updateFlowerCount() {
    if (this.flowerCount) {
      this.flowerCount.textContent = `花の数: ${this.flowerCountValue}/28`;
    }

    // 28枚全て埋まったら散るアニメーション
    if (this.flowerCountValue >= 28) {
      setTimeout(() => {
        this.startFlowerScatterAnimation();
      }, 2000); // 2秒後に散るアニメーション開始
    }
  }

  // 風の粒子エフェクトを作成
  createWindParticles() {
    const windContainer = document.createElement("div");
    windContainer.className = "wind-particles";
    document.body.appendChild(windContainer);

    // 定期的に粒子を追加
    setInterval(() => {
      this.createWindParticle(windContainer);
    }, 800);
  }

  // 個別の風の粒子を作成
  createWindParticle(container) {
    const particle = document.createElement("div");
    particle.className = "wind-particle";

    // ランダムな位置から開始
    particle.style.left = Math.random() * window.innerWidth + "px";
    particle.style.top = window.innerHeight + "px";

    // ランダムなサイズ
    const size = 2 + Math.random() * 4;
    particle.style.width = size + "px";
    particle.style.height = size + "px";

    // ランダムな色
    const colors = [
      "rgba(255, 255, 255, 0.6)",
      "rgba(255, 182, 193, 0.5)",
      "rgba(221, 160, 221, 0.5)",
      "rgba(255, 218, 185, 0.5)",
    ];
    particle.style.background =
      colors[Math.floor(Math.random() * colors.length)];

    container.appendChild(particle);

    // アニメーション完了後に削除
    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, 15000);
  }

  // 花が散るアニメーション
  async startFlowerScatterAnimation() {
    console.log("🌸 花が散るアニメーション開始 🌸");

    // 花散るメッセージ表示
    this.showScatterMessage();

    // 全ての花を散らす
    const flowers = this.grid.querySelectorAll(".flower");
    flowers.forEach((flower, index) => {
      setTimeout(() => {
        this.scatterFlower(flower);
      }, index * 100); // 0.1秒ずつ散らす
    });

    // 散るアニメーション完了後にリセット
    setTimeout(() => {
      this.resetGarden();
    }, flowers.length * 100 + 3000);
  }

  // 散るメッセージ表示
  showScatterMessage() {
    const message = document.createElement("div");
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.95);
      padding: 30px 50px;
      border-radius: 20px;
      font-size: 2em;
      font-weight: bold;
      color: #ff69b4;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      animation: messageFloat 2s ease-in-out;
    `;

    message.innerHTML = `
      <div>🌸 満開！ 🌸</div>
      <div style="font-size: 0.6em; margin-top: 10px; color: #666;">花びらが風に舞います...</div>
    `;

    document.body.appendChild(message);

    // メッセージを削除
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 5000);
  }

  // 個別の花を散らす
  scatterFlower(flower) {
    if (!flower.parentNode) return;

    const slot = flower.parentNode;
    const rect = slot.getBoundingClientRect();

    // 花びらパーティクルを作成
    for (let i = 0; i < 8; i++) {
      const petal = document.createElement("div");
      petal.style.cssText = `
        position: fixed;
        width: 15px;
        height: 15px;
        background: linear-gradient(45deg, #ff69b4, #ffb6c1);
        border-radius: 50% 10px 50% 10px;
        pointer-events: none;
        z-index: 5000;
        left: ${rect.left + rect.width / 2}px;
        top: ${rect.top + rect.height / 2}px;
      `;

      document.body.appendChild(petal);

      // 花びらの散るアニメーション
      const angle = (i / 8) * Math.PI * 2;
      const distance = 100 + Math.random() * 200;
      const endX = rect.left + rect.width / 2 + Math.cos(angle) * distance;
      const endY = rect.top + rect.height / 2 + Math.sin(angle) * distance;

      petal.animate(
        [
          {
            transform: "translate(0, 0) rotate(0deg) scale(1)",
            opacity: 1,
          },
          {
            transform: `translate(${endX - rect.left - rect.width / 2}px, ${
              endY - rect.top - rect.height / 2
            }px) rotate(720deg) scale(0)`,
            opacity: 0,
          },
        ],
        {
          duration: 2000,
          easing: "ease-out",
        }
      ).onfinish = () => {
        if (petal.parentNode) {
          petal.parentNode.removeChild(petal);
        }
      };
    }

    // 花をフェードアウト
    flower.style.transition = "opacity 1s ease-out";
    flower.style.opacity = "0";

    setTimeout(() => {
      if (flower.parentNode) {
        flower.parentNode.removeChild(flower);
      }
    }, 1000);
  }

  // 庭をリセット
  async resetGarden() {
    console.log("🔄 庭をリセット中...");

    try {
      // サーバーにリセット要求を送信
      const response = await fetch("http://localhost:8080/api/reset", {
        method: "POST",
      });

      if (response.ok) {
        console.log("✅ サーバーリセット完了");
      }
    } catch (error) {
      console.error("❌ サーバーリセットエラー:", error);
    }

    // フロントエンドをリセット
    this.flowerCountValue = 0;
    this.updateFlowerCount();

    // 全てのスロットを初期状態に戻す
    const slots = this.grid.querySelectorAll(".flower-slot");
    slots.forEach((slot) => {
      slot.classList.remove("occupied");
      slot.classList.add("empty");

      // 花を削除
      const flower = slot.querySelector(".flower");
      if (flower) {
        flower.remove();
      }
    });

    // リセット完了メッセージ
    this.showResetMessage();
  }

  // リセット完了メッセージ
  showResetMessage() {
    const message = document.createElement("div");
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.95);
      padding: 20px 40px;
      border-radius: 15px;
      font-size: 1.5em;
      font-weight: bold;
      color: #32cd32;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      animation: messageFloat 2s ease-in-out;
    `;

    message.innerHTML = "🌱 新しい花畑が準備できました 🌱";

    document.body.appendChild(message);

    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }
}

// ページ読み込み完了時に初期化
document.addEventListener("DOMContentLoaded", () => {
  new FlowerGarden();
});

// ページ離脱時にWebSocket接続を閉じる
window.addEventListener("beforeunload", () => {
  if (window.flowerGarden && window.flowerGarden.websocket) {
    window.flowerGarden.websocket.close();
  }
});
