class DisplaySystem {
  constructor() {
    this.canvas = document.getElementById("display-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.entities = new Map();
    this.particles = new Map(); // パーティクルシステム
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

  // パーティクルクラス
  createParticle(x, y, vx, vy, life, color, size) {
    return {
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      life: life,
      maxLife: life,
      color: color,
      size: size,
      alpha: 1.0,
    };
  }

  // パーティクルを追加
  addParticles(entityId, count, type) {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    const particles = [];
    for (let i = 0; i < count; i++) {
      let vx, vy, life, color, size;

      switch (type) {
        case "disperse":
          const angle = (Math.PI * 2 * i) / count;
          const speed = 2 + Math.random() * 3;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          life = 2000 + Math.random() * 1000;
          color = `hsl(${Math.random() * 360}, 70%, 60%)`;
          size = 2 + Math.random() * 4;
          break;
        case "explode":
          const angle2 = Math.random() * Math.PI * 2;
          const speed2 = 3 + Math.random() * 5;
          vx = Math.cos(angle2) * speed2;
          vy = Math.sin(angle2) * speed2;
          life = 1000 + Math.random() * 500;
          color = `hsl(${20 + Math.random() * 40}, 90%, 60%)`;
          size = 3 + Math.random() * 6;
          break;
        default:
          vx = (Math.random() - 0.5) * 2;
          vy = (Math.random() - 0.5) * 2;
          life = 1000;
          color = "#ffffff";
          size = 2;
      }

      particles.push(
        this.createParticle(
          entity.x + (Math.random() - 0.5) * entity.width * entity.scale,
          entity.y + (Math.random() - 0.5) * entity.height * entity.scale,
          vx,
          vy,
          life,
          color,
          size
        )
      );
    }

    this.particles.set(entityId, particles);
  }

  // パーティクルを更新
  updateParticles(deltaTime) {
    this.particles.forEach((particles, entityId) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];

        // 位置更新
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;

        // 寿命減少
        particle.life -= deltaTime;
        particle.alpha = particle.life / particle.maxLife;

        // 重力効果
        particle.vy += 0.1 * deltaTime;

        // 寿命切れで削除
        if (particle.life <= 0) {
          particles.splice(i, 1);
        }
      }

      // パーティクルがなくなったら削除
      if (particles.length === 0) {
        this.particles.delete(entityId);
      }
    });
  }

  // パーティクルを描画
  renderParticles() {
    this.particles.forEach((particles) => {
      particles.forEach((particle) => {
        this.ctx.save();
        this.ctx.globalAlpha = particle.alpha;
        this.ctx.fillStyle = particle.color;
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      });
    });
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
      case "entity.delete":
        this.removeEntityByArtworkId(message.data.artwork_id);
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
      artworkId: data.artwork_id, // 作品IDを追加
      artworkUrl: data.artwork_url,
      x: data.init.x,
      y: data.init.y,
      vx: data.init.vx,
      vy: data.init.vy,
      angle: data.init.angle,
      scale: data.init.scale,
      initScale: data.init.scale,
      animationKind: data.animation_kind,
      seed: data.seed,
      element: null,
      image: null,
      width: 100,
      height: 100,
      lastUpdate: Date.now(),
    };

    // 画像を読み込み
    this.loadEntityImage(entity);

    this.entities.set(entity.id, entity);
    this.updateEntityCount();

    console.log("Entity added:", entity.id);
  }

  loadEntityImage(entity) {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      entity.image = img;
      entity.width = img.width;
      entity.height = img.height;
      console.log("Image loaded for entity:", entity.id);
    };

    img.onerror = (e) => {
      console.error("Failed to load image for entity:", entity.id, e);
      // エラー時はプレースホルダー画像を作成
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#666";
      ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = "#fff";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("?", 50, 50);
      entity.image = canvas;
      entity.width = 100;
      entity.height = 100;
    };

    img.src = entity.artworkUrl;
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

    // 画像読み込みエラーハンドリング
    img.onerror = (e) => {
      console.error("Failed to load image:", entity.artworkUrl, e);
      // エラー時はプレースホルダーを表示
      img.style.display = "none";
      const placeholder = document.createElement("div");
      placeholder.style.width = "100%";
      placeholder.style.height = "100%";
      placeholder.style.border = "2px solid #fff";
      placeholder.style.display = "flex";
      placeholder.style.alignItems = "center";
      placeholder.style.justifyContent = "center";
      placeholder.style.backgroundColor = "rgba(0,0,0,0.1)";
      placeholder.innerHTML = "?";
      placeholder.style.color = "#fff";
      placeholder.style.fontSize = "24px";
      div.appendChild(placeholder);
    };

    img.onload = () => {
      console.log("Image loaded successfully:", entity.artworkUrl);
    };

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

  removeEntityByArtworkId(artworkId) {
    // 作品IDに基づいてエンティティを削除
    const entitiesToRemove = [];

    this.entities.forEach((entity, entityId) => {
      if (entity.artworkId === artworkId) {
        entitiesToRemove.push(entityId);
      }
    });

    entitiesToRemove.forEach((entityId) => {
      this.removeEntity(entityId);
    });

    console.log("Entities removed by artwork ID:", artworkId);
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

    // パーティクルを更新
    this.updateParticles(deltaTime);
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
    const entityId = entity.id;

    // アニメーション状態を初期化（初回のみ）
    if (!entity.animationState) {
      entity.animationState = {
        phase: 0,
        lastParticleTime: 0,
        fightTarget: null,
        fightPhase: 0,
        streamStartTime: time,
      };
    }

    const state = entity.animationState;

    switch (entity.animationKind) {
      case "pulsate":
        // より自然な脈動効果
        const pulseIntensity = 0.3 + Math.sin(time * 1.5) * 0.2;
        entity.scale = entity.initScale * (1 + pulseIntensity);

        // 色の変化も追加
        entity.tint = `hsl(${200 + Math.sin(time * 2) * 30}, 70%, 60%)`;
        break;

      case "disperse":
        // 定期的にパーティクルを生成
        if (time - state.lastParticleTime > 0.1) {
          this.addParticles(entityId, 3, "disperse");
          state.lastParticleTime = time;
        }

        // 本体はゆっくり回転
        entity.angle += deltaTime * 0.05;

        // 軽やかな動き
        entity.x += Math.sin(time * 0.5) * 0.5;
        entity.y += Math.cos(time * 0.7) * 0.3;
        break;

      case "explode":
        // 爆発パーティクルを生成
        if (state.phase === 0) {
          this.addParticles(entityId, 20, "explode");
          state.phase = 1;
          state.lastParticleTime = time;
        }

        // 爆発後の振動効果
        if (state.phase === 1) {
          const shakeIntensity = Math.max(
            0,
            1 - (time - state.lastParticleTime) * 0.001
          );
          entity.x += (Math.random() - 0.5) * shakeIntensity * 10;
          entity.y += (Math.random() - 0.5) * shakeIntensity * 10;

          if (time - state.lastParticleTime > 2) {
            state.phase = 0; // リセット
          }
        }

        // スケール変化
        entity.scale = entity.initScale * (1 + Math.sin(time * 8) * 0.2);
        break;

      case "spin_fight":
        // ベイブレード的な戦闘システム
        if (!state.fightTarget) {
          // 戦闘相手を探す
          this.entities.forEach((otherEntity, otherId) => {
            if (
              otherId !== entityId &&
              otherEntity.animationKind === "spin_fight" &&
              !otherEntity.animationState.fightTarget
            ) {
              const distance = Math.sqrt(
                Math.pow(entity.x - otherEntity.x, 2) +
                  Math.pow(entity.y - otherEntity.y, 2)
              );

              if (distance < 200) {
                state.fightTarget = otherId;
                otherEntity.animationState.fightTarget = entityId;
              }
            }
          });
        }

        if (state.fightTarget) {
          const target = this.entities.get(state.fightTarget);
          if (target) {
            // 相手に向かって移動
            const dx = target.x - entity.x;
            const dy = target.y - entity.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 50) {
              entity.vx += (dx / distance) * 0.5;
              entity.vy += (dy / distance) * 0.5;
            }

            // 高速回転
            entity.angle += deltaTime * 2;

            // 衝突判定
            if (distance < 60) {
              state.fightPhase = 1;
              // 衝突時のパーティクル効果
              if (time - state.lastParticleTime > 0.05) {
                this.addParticles(entityId, 5, "explode");
                state.lastParticleTime = time;
              }
            }
          } else {
            // 相手が消えた場合
            state.fightTarget = null;
          }
        } else {
          // 通常の高速回転
          entity.angle += deltaTime * 1.5;
        }
        break;

      case "stream_in":
        // 画面端からの流れ込み効果
        const streamProgress = (time - state.streamStartTime) * 0.5;

        if (state.phase === 0) {
          // 画面外から開始
          entity.x = -entity.width;
          entity.y =
            this.viewport.height * 0.3 + Math.sin(streamProgress) * 100;
          state.phase = 1;
        }

        if (state.phase === 1) {
          // 画面内に流れ込む
          entity.x += deltaTime * 200;

          // 波打つような動き
          entity.y += Math.sin(streamProgress * 2) * 2;

          // 画面内に入ったら通常状態に
          if (entity.x > this.viewport.width * 0.1) {
            state.phase = 2;
          }
        }

        // 流れ込み時のスケール変化
        if (state.phase < 2) {
          entity.scale = entity.initScale * (0.5 + streamProgress * 0.5);
        }
        break;
    }
  }

  render() {
    // キャンバスをクリア
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // エンティティを描画
    this.entities.forEach((entity) => {
      this.renderEntity(entity);
    });

    // パーティクルを描画
    this.renderParticles();

    if (this.debugMode) {
      this.renderDebugInfo();
    }
  }

  renderEntity(entity) {
    if (!entity.image) return;

    this.ctx.save();

    // 位置と回転、スケールを適用
    this.ctx.translate(entity.x, entity.y);
    this.ctx.rotate(entity.angle);
    this.ctx.scale(entity.scale, entity.scale);

    // 色の変化を適用（tintがある場合）
    if (entity.tint) {
      this.ctx.globalCompositeOperation = "multiply";
      this.ctx.fillStyle = entity.tint;
      this.ctx.fillRect(
        -entity.width / 2,
        -entity.height / 2,
        entity.width,
        entity.height
      );
      this.ctx.globalCompositeOperation = "source-over";
    }

    // 画像を描画
    this.ctx.drawImage(
      entity.image,
      -entity.width / 2,
      -entity.height / 2,
      entity.width,
      entity.height
    );

    this.ctx.restore();
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
