class OpsSystem {
  constructor() {
    this.artworks = [];
    this.systemStatus = "正常動作中";
    this.activeEntities = 0;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSystemStatus();
  }

  setupEventListeners() {
    // アートワーク読み込み
    document
      .getElementById("load-artworks-btn")
      .addEventListener("click", () => {
        this.loadArtworks();
      });

    // 状態更新
    document
      .getElementById("refresh-status-btn")
      .addEventListener("click", () => {
        this.loadSystemStatus();
      });

    // 全リセット
    document.getElementById("reset-all-btn").addEventListener("click", () => {
      this.resetAll();
    });
  }

  async loadArtworks() {
    try {
      const response = await fetch("/api/artworks", {
        headers: {
          "X-API-Key": "ops_dev_key_12345",
        },
      });

      if (response.ok) {
        this.artworks = await response.json();
        this.renderArtworks();
        this.showStatus("アートワーク一覧を読み込みました", "success");
      } else {
        throw new Error("Failed to load artworks");
      }
    } catch (error) {
      console.error("Artworks load failed:", error);
      this.showStatus("アートワークの読み込みに失敗しました", "error");
    }
  }

  renderArtworks() {
    const container = document.getElementById("artworks-container");

    if (this.artworks.length === 0) {
      container.innerHTML = "<p>アートワークがありません</p>";
      return;
    }

    container.innerHTML = this.artworks
      .map((artwork) => {
        const tags = artwork.tags ? JSON.parse(artwork.tags) : [];
        const tagsText = Array.isArray(tags) ? tags.join(", ") : "";

        return `
          <div class="artwork-item">
            <img src="/download/${artwork.qr_token}?thumb=true" alt="${
          artwork.title || "無題"
        }" />
            <h3>${artwork.title || "無題"}</h3>
            <p><strong>ID:</strong> ${artwork.id}</p>
            <p><strong>タグ:</strong> ${tagsText}</p>
            <p><strong>作成日:</strong> ${new Date(
              artwork.created_at
            ).toLocaleString()}</p>
            <div class="form-group">
              <label>アニメーション:</label>
              <select class="animation-select" data-artwork-id="${artwork.id}">
                <option value="pulsate" ${
                  this.getCurrentAnimation(artwork.id) === "pulsate"
                    ? "selected"
                    : ""
                }>脈動 (pulsate)</option>
                <option value="disperse" ${
                  this.getCurrentAnimation(artwork.id) === "disperse"
                    ? "selected"
                    : ""
                }>分散 (disperse)</option>
                <option value="explode" ${
                  this.getCurrentAnimation(artwork.id) === "explode"
                    ? "selected"
                    : ""
                }>爆発 (explode)</option>
                <option value="spin_fight" ${
                  this.getCurrentAnimation(artwork.id) === "spin_fight"
                    ? "selected"
                    : ""
                }>回転戦闘 (spin_fight)</option>
                <option value="stream_in" ${
                  this.getCurrentAnimation(artwork.id) === "stream_in"
                    ? "selected"
                    : ""
                }>流れ込み (stream_in)</option>
              </select>
            </div>
            <button class="update-animation-btn" data-artwork-id="${
              artwork.id
            }">
              アニメーション更新
            </button>
            <button class="remove-artwork-btn danger" data-artwork-id="${
              artwork.id
            }">
              削除
            </button>
          </div>
        `;
      })
      .join("");

    // イベントリスナーを追加
    container.querySelectorAll(".update-animation-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const artworkId = e.target.dataset.artworkId;
        const select = container.querySelector(
          `select[data-artwork-id="${artworkId}"]`
        );
        this.updateArtworkAnimation(artworkId, select.value);
      });
    });

    container.querySelectorAll(".remove-artwork-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const artworkId = e.target.dataset.artworkId;
        this.removeArtwork(artworkId);
      });
    });
  }

  getCurrentAnimation(artworkId) {
    // ローカルストレージから取得（実際の実装ではAPIから取得）
    return localStorage.getItem(`animation_${artworkId}`) || "pulsate";
  }

  async updateArtworkAnimation(artworkId, animation) {
    try {
      // アニメーション設定を保存
      localStorage.setItem(`animation_${artworkId}`, animation);

      // 実際のAPI呼び出し（エンティティのアニメーション更新）
      const response = await fetch(
        `/api/scenes/1/entities/${artworkId}/animation`,
        {
          method: "PUT",
          headers: {
            "X-API-Key": "ops_dev_key_12345",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ animation_kind: animation }),
        }
      );

      if (response.ok) {
        this.showStatus(
          `アートワーク ${artworkId} のアニメーションを「${animation}」に更新しました`,
          "success"
        );
      } else {
        // APIが未実装でもローカル保存は成功
        this.showStatus(
          `アートワーク ${artworkId} のアニメーションを「${animation}」に設定しました`,
          "info"
        );
      }
    } catch (error) {
      console.error("Animation update failed:", error);
      this.showStatus("アニメーションの更新に失敗しました", "error");
    }
  }

  async removeArtwork(artworkId) {
    if (!confirm(`アートワーク ${artworkId} を削除しますか？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/artworks/${artworkId}`, {
        method: "DELETE",
        headers: {
          "X-API-Key": "ops_dev_key_12345",
        },
      });

      if (response.ok) {
        this.showStatus(`アートワーク ${artworkId} を削除しました`, "success");
        this.loadArtworks(); // 一覧を再読み込み
      } else {
        throw new Error("Delete failed");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      this.showStatus("アートワークの削除に失敗しました", "error");
    }
  }

  async loadSystemStatus() {
    try {
      // システム状態を取得
      const response = await fetch("/api/scenes", {
        headers: {
          "X-API-Key": "ops_dev_key_12345",
        },
      });

      if (response.ok) {
        const scenes = await response.json();
        const mainScene = scenes.find((scene) => scene.id === 1) || scenes[0];

        if (mainScene) {
          document.getElementById(
            "current-scene"
          ).textContent = `${mainScene.name} (${mainScene.width}x${mainScene.height})`;
        }
      }

      // エンティティ数を取得（簡易版）
      this.activeEntities = this.artworks.length;
      document.getElementById("active-entities").textContent =
        this.activeEntities;

      this.showStatus("システム状態を更新しました", "info");
    } catch (error) {
      console.error("Status load failed:", error);
      this.showStatus("システム状態の取得に失敗しました", "error");
    }
  }

  async resetAll() {
    if (
      !confirm(
        "本当に全リセットを実行しますか？すべてのエンティティが削除されます。"
      )
    ) {
      return;
    }

    try {
      // シーンリセット
      const response = await fetch("/api/scenes/1/reset", {
        method: "POST",
        headers: {
          "X-API-Key": "ops_dev_key_12345",
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        this.showStatus("全リセットが完了しました", "success");
        this.loadSystemStatus();
        this.loadArtworks();
      } else {
        throw new Error("Reset failed");
      }
    } catch (error) {
      console.error("Reset failed:", error);
      this.showStatus("リセットに失敗しました", "error");
    }
  }

  showStatus(message, type) {
    const statusDiv = document.getElementById("status");
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove("hidden");

    // 3秒後に非表示
    setTimeout(() => {
      statusDiv.classList.add("hidden");
    }, 3000);
  }
}

// ページ読み込み時に初期化
document.addEventListener("DOMContentLoaded", () => {
  new OpsSystem();
});
