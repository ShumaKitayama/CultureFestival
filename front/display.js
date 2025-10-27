class DisplaySystem {
  constructor() {
    this.canvas = document.getElementById("display-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.entities = new Map();
    this.ws = null;
    this.isConnected = false;
    this.debugMode = false;
    this.fps = 0;
    this.lastTime = 0;
    this.frameCount = 0;

    // 設定
    this.sceneId = 1; // デフォルトシーン
    this.deviceKey = "display_dev_key_12345";
    this.viewport = {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      scale: 1,
    };

    this.init();
  }

  init() {
    this.setupCanvas();
    this.setupWebSocket();
    this.setupEventListeners();
    this.startAnimationLoop();
  }

  setupCanvas() {
    this.canvas.width = this.viewport.width;
    this.canvas.height = this.viewport.height;

    // リサイズ対応
    window.addEventListener("resize", () => {
      this.viewport.width = window.innerWidth;
      this.viewport.height = window.innerHeight;
      this.canvas.width = this.viewport.width;
      this.canvas.height = this.viewport.height;
    });
  }

  setupWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.isConnected = true;
      this.updateConnectionStatus("接続済み");
      this.sendHello();
      this.loadExistingEntities();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
      this.isConnected = false;
      this.updateConnectionStatus("切断");
      // 5秒後に再接続を試行
      setTimeout(() => this.setupWebSocket(), 5000);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.updateConnectionStatus("エラー");
    };
  }

  sendHello() {
    const message = {
      type: "display.hello",
      data: {
        display_key: this.deviceKey,
        scene_id: this.sceneId,
        caps: {
          w: this.viewport.width,
          h: this.viewport.height,
          px_ratio: window.devicePixelRatio || 1,
        },
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  handleMessage(message) {
    switch (message.type) {
      case "entity.add":
        this.addEntity(message.data);
        break;
      case "entity.remove":
        this.removeEntity(message.data.entity_id);
        break;
      case "scene.reset":
        this.resetScene();
        break;
      case "display.config":
        this.updateViewport(message.data.viewport);
        break;
      case "clock.sync":
        this.syncClock(message.data);
        break;
    }
  }

  addEntity(data) {
    const entity = {
      id: data.entity_id,
      artworkUrl: data.artwork_url,
      x: data.init.x,
      y: data.init.y,
      vx: data.init.vx,
      vy: data.init.vy,
      angle: data.init.angle,
      scale: data.init.scale,
      animationKind: data.animation_kind,
      seed: data.seed,
      element: null,
      lastUpdate: Date.now(),
    };

    // DOM要素を作成
    entity.element = this.createEntityElement(entity);
    document.body.appendChild(entity.element);

    this.entities.set(entity.id, entity);
    this.updateEntityCount();

    console.log("Entity added:", entity.id);
  }

  loadExistingEntities() {
    fetch(`/api/scenes/${this.sceneId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load scene: ${response.status}`);
        }
        return response.json();
      })
      .then((scene) => {
        if (!scene.entities || !Array.isArray(scene.entities)) {
          return;
        }

        scene.entities.forEach((entity) => {
          if (this.entities.has(entity.id) || !entity.artwork) {
            return;
          }

          this.addEntity({
            entity_id: entity.id,
            artwork_url: `/download/${entity.artwork.qr_token}`,
            init: {
              x: entity.init_x,
              y: entity.init_y,
              vx: entity.init_vx,
              vy: entity.init_vy,
              angle: entity.init_angle,
              scale:
                typeof entity.init_scale === "number" ? entity.init_scale : 1,
            },
            animation_kind: entity.animation_kind,
            seed: entity.rng_seed,
          });
        });
      })
      .catch((error) => {
        console.error("Failed to load existing entities:", error);
        this.updateConnectionStatus("初期データ取得失敗");
      });
  }

  createEntityElement(entity) {
    const div = document.createElement("div");
    div.className = "entity";
    div.style.position = "absolute";
    div.style.left = entity.x + "px";
    div.style.top = entity.y + "px";
    div.style.transform = `rotate(${entity.angle}deg) scale(${entity.scale})`;
    div.style.width = "100px";
    div.style.height = "100px";

    const img = document.createElement("img");
    img.src = entity.artworkUrl;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";

    div.appendChild(img);
    return div;
  }

  removeEntity(entityId) {
    const entity = this.entities.get(entityId);
    if (entity && entity.element) {
      entity.element.remove();
    }
    this.entities.delete(entityId);
    this.updateEntityCount();

    console.log("Entity removed:", entityId);
  }

  resetScene() {
    this.entities.forEach((entity) => {
      if (entity.element) {
        entity.element.remove();
      }
    });
    this.entities.clear();
    this.updateEntityCount();

    console.log("Scene reset");
  }

  updateViewport(viewport) {
    this.viewport = { ...this.viewport, ...viewport };
    this.canvas.width = this.viewport.width;
    this.canvas.height = this.viewport.height;
  }

  syncClock(data) {
    // 時計同期（将来の実装）
    console.log("Clock sync:", data);
  }

  startAnimationLoop() {
    const animate = (currentTime) => {
      // FPS計算
      this.frameCount++;
      if (currentTime - this.lastTime >= 1000) {
        this.fps = Math.round(
          (this.frameCount * 1000) / (currentTime - this.lastTime)
        );
        this.updateFPS();
        this.frameCount = 0;
        this.lastTime = currentTime;
      }

      this.updateEntities();
      this.render();

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  updateEntities() {
    const now = Date.now();
    const deltaTime = 16; // 約60FPS想定

    this.entities.forEach((entity) => {
      // 物理演算
      this.updatePhysics(entity, deltaTime);

      // アニメーション
      this.updateAnimation(entity, deltaTime);

      // DOM要素の更新
      if (entity.element) {
        entity.element.style.left = entity.x + "px";
        entity.element.style.top = entity.y + "px";
        entity.element.style.transform = `rotate(${entity.angle}deg) scale(${entity.scale})`;
      }
    });
  }

  updatePhysics(entity, deltaTime) {
    // 速度を更新
    entity.x += (entity.vx * deltaTime) / 16;
    entity.y += (entity.vy * deltaTime) / 16;

    // 壁反射
    const margin = 50;
    if (entity.x < margin || entity.x > this.viewport.width - margin) {
      entity.vx *= -0.9;
      entity.x = Math.max(
        margin,
        Math.min(this.viewport.width - margin, entity.x)
      );
    }
    if (entity.y < margin || entity.y > this.viewport.height - margin) {
      entity.vy *= -0.9;
      entity.y = Math.max(
        margin,
        Math.min(this.viewport.height - margin, entity.y)
      );
    }

    // 減衰
    entity.vx *= 0.999;
    entity.vy *= 0.999;

    // ランダムな揺らぎ
    const noise = 0.01;
    entity.vx += (Math.random() - 0.5) * noise;
    entity.vy += (Math.random() - 0.5) * noise;
  }

  updateAnimation(entity, deltaTime) {
    const time = Date.now() * 0.001;

    switch (entity.animationKind) {
      case "pulsate":
        entity.scale = 1 + Math.sin(time * 2) * 0.2;
        break;
      case "disperse":
        // パーティクル効果（簡易版）
        entity.angle += deltaTime * 0.1;
        break;
      case "explode":
        // 爆散効果（簡易版）
        entity.scale = 1 + Math.sin(time * 5) * 0.3;
        break;
      case "spin_fight":
        // 高速回転
        entity.angle += deltaTime * 0.5;
        break;
      case "stream_in":
        // 画面端から流入（簡易版）
        if (entity.x < 0) {
          entity.x = this.viewport.width;
        }
        break;
    }
  }

  render() {
    // キャンバスをクリア
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.debugMode) {
      this.renderDebugInfo();
    }
  }

  renderDebugInfo() {
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    this.ctx.font = "12px monospace";

    let y = 20;
    this.entities.forEach((entity) => {
      this.ctx.fillText(
        `Entity ${entity.id}: (${Math.round(entity.x)}, ${Math.round(
          entity.y
        )}) v(${entity.vx.toFixed(2)}, ${entity.vy.toFixed(2)})`,
        10,
        y
      );
      y += 15;
    });
  }

  updateConnectionStatus(status) {
    document.getElementById("connection-status").textContent = status;
  }

  updateEntityCount() {
    document.getElementById("entity-count").textContent = this.entities.size;
  }

  updateFPS() {
    document.getElementById("fps").textContent = this.fps;
  }

  setupEventListeners() {
    document.getElementById("connect-btn").addEventListener("click", () => {
      this.setupWebSocket();
    });

    document.getElementById("reset-btn").addEventListener("click", () => {
      this.resetScene();
    });

    document.getElementById("toggle-debug").addEventListener("click", () => {
      this.debugMode = !this.debugMode;
    });
  }
}

// アプリケーション開始
document.addEventListener("DOMContentLoaded", () => {
  new DisplaySystem();
});
