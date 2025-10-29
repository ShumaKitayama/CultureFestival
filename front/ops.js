class OpsSystem {
  constructor() {
    this.artworks = [];
    this.selectedArtwork = null;
    this.systemStatus = "正常動作中";
    this.activeEntities = 0;
    this.currentSceneId = 1;

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

    // アニメーション適用
    document
      .getElementById("apply-animation-btn")
      .addEventListener("click", () => {
        this.applyAnimation();
      });

    // シーンに追加
    document
      .getElementById("add-to-scene-btn")
      .addEventListener("click", () => {
        this.addToScene();
      });

    // シーンから削除
    document
      .getElementById("remove-from-scene-btn")
      .addEventListener("click", () => {
        this.removeFromScene();
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
        this.renderArtworksList();
        this.showStatus("作品一覧を読み込みました", "success");
      } else {
        throw new Error("Failed to load artworks");
      }
    } catch (error) {
      console.error("Artworks load failed:", error);
      this.showStatus("作品の読み込みに失敗しました", "error");
    }
  }

  renderArtworksList() {
    const container = document.getElementById("artworks-list");

    if (this.artworks.length === 0) {
      container.innerHTML = "<p>作品がありません</p>";
      return;
    }

    container.innerHTML = this.artworks
      .map((artwork) => {
        const title = artwork.title || "無題";
        const thumbUrl = artwork.thumb_path
          ? `/download/${artwork.qr_token}?thumb=true`
          : "";
        return `
          <div class="artwork-item" data-artwork-id="${artwork.id}">
            <div class="artwork-actions">
              <button class="danger" onclick="event.stopPropagation(); opsSystem.deleteArtwork(${
                artwork.id
              })">
                削除
              </button>
            </div>
            <div class="artwork-info">
              ${thumbUrl ? `<img src="${thumbUrl}" alt="${title}" />` : ""}
              <h3>${title}</h3>
              <p>ID: ${artwork.id}</p>
              <p>QR Token: ${artwork.qr_token}</p>
            </div>
          </div>
        `;
      })
      .join("");

    // クリックイベントを追加
    container.querySelectorAll(".artwork-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const artworkId = parseInt(e.currentTarget.dataset.artworkId);
        this.selectArtwork(artworkId);
      });
    });
  }

  selectArtwork(artworkId) {
    this.selectedArtwork = this.artworks.find((a) => a.id === artworkId);

    if (this.selectedArtwork) {
      // 選択状態を更新
      document.querySelectorAll(".artwork-item").forEach((item) => {
        item.classList.remove("selected");
      });
      document
        .querySelector(`[data-artwork-id="${artworkId}"]`)
        .classList.add("selected");

      // 選択された作品名を表示
      document.getElementById("selected-artwork-name").textContent =
        this.selectedArtwork.title || "無題";

      // アニメーション設定画面を表示
      document.getElementById("animation-settings").classList.remove("hidden");

      this.showStatus(
        `「${this.selectedArtwork.title || "無題"}」を選択しました`,
        "info"
      );
    }
  }

  async applyAnimation() {
    if (!this.selectedArtwork) {
      this.showStatus("作品を選択してください", "error");
      return;
    }

    const animation = document.getElementById("animation-select").value;
    const x = parseFloat(document.getElementById("position-x").value);
    const y = parseFloat(document.getElementById("position-y").value);
    const scale = parseFloat(document.getElementById("scale").value);

    try {
      // 既存のエンティティを検索
      const response = await fetch(`/api/scenes/${this.currentSceneId}`, {
        headers: {
          "X-API-Key": "ops_dev_key_12345",
        },
      });

      if (response.ok) {
        const scene = await response.json();
        const existingEntity = scene.entities.find(
          (e) => e.artwork_id === this.selectedArtwork.id
        );

        if (existingEntity) {
          // 既存のエンティティを更新
          await this.updateEntity(existingEntity.id, animation, x, y, scale);
        } else {
          // 新しいエンティティを追加
          await this.addEntity(animation, x, y, scale);
        }
      }
    } catch (error) {
      console.error("Apply animation failed:", error);
      this.showStatus("アニメーションの適用に失敗しました", "error");
    }
  }

  async addToScene() {
    if (!this.selectedArtwork) {
      this.showStatus("作品を選択してください", "error");
      return;
    }

    const animation = document.getElementById("animation-select").value;
    const x = parseFloat(document.getElementById("position-x").value);
    const y = parseFloat(document.getElementById("position-y").value);
    const scale = parseFloat(document.getElementById("scale").value);

    await this.addEntity(animation, x, y, scale);
  }

  async removeFromScene() {
    if (!this.selectedArtwork) {
      this.showStatus("作品を選択してください", "error");
      return;
    }

    try {
      // 既存のエンティティを検索
      const response = await fetch(`/api/scenes/${this.currentSceneId}`, {
        headers: {
          "X-API-Key": "ops_dev_key_12345",
        },
      });

      if (response.ok) {
        const scene = await response.json();
        const existingEntity = scene.entities.find(
          (e) => e.artwork_id === this.selectedArtwork.id
        );

        if (existingEntity) {
          await this.deleteEntity(existingEntity.id);
        } else {
          this.showStatus("この作品はシーンに存在しません", "error");
        }
      }
    } catch (error) {
      console.error("Remove from scene failed:", error);
      this.showStatus("シーンからの削除に失敗しました", "error");
    }
  }

  async addEntity(animation, x, y, scale) {
    try {
      const response = await fetch(
        `/api/scenes/${this.currentSceneId}/entities`,
        {
          method: "POST",
          headers: {
            "X-API-Key": "ops_dev_key_12345",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            artwork_id: this.selectedArtwork.id,
            init_x: x,
            init_y: y,
            init_vx: 0,
            init_vy: 0,
            init_angle: 0,
            init_scale: scale,
            animation_kind: animation,
          }),
        }
      );

      if (response.ok) {
        this.showStatus(
          `「${this.selectedArtwork.title || "無題"}」をシーンに追加しました`,
          "success"
        );
        this.loadSystemStatus(); // システム状態を更新
      } else {
        throw new Error("Failed to add entity");
      }
    } catch (error) {
      console.error("Add entity failed:", error);
      this.showStatus("シーンへの追加に失敗しました", "error");
    }
  }

  async updateEntity(entityId, animation, x, y, scale) {
    try {
      const response = await fetch(
        `/api/scenes/${this.currentSceneId}/entities/${entityId}`,
        {
          method: "PUT",
          headers: {
            "X-API-Key": "ops_dev_key_12345",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            animation_kind: animation,
            init_x: x,
            init_y: y,
            init_scale: scale,
          }),
        }
      );

      if (response.ok) {
        this.showStatus(
          `「${
            this.selectedArtwork.title || "無題"
          }」のアニメーションを更新しました`,
          "success"
        );
        this.loadSystemStatus(); // システム状態を更新
      } else {
        throw new Error("Failed to update entity");
      }
    } catch (error) {
      console.error("Update entity failed:", error);
      this.showStatus("アニメーションの更新に失敗しました", "error");
    }
  }

  async deleteEntity(entityId) {
    try {
      const response = await fetch(
        `/api/scenes/${this.currentSceneId}/entities/${entityId}`,
        {
          method: "DELETE",
          headers: {
            "X-API-Key": "ops_dev_key_12345",
          },
        }
      );

      if (response.ok) {
        this.showStatus(
          `「${this.selectedArtwork.title || "無題"}」をシーンから削除しました`,
          "success"
        );
        this.loadSystemStatus(); // システム状態を更新
      } else {
        throw new Error("Failed to delete entity");
      }
    } catch (error) {
      console.error("Delete entity failed:", error);
      this.showStatus("シーンからの削除に失敗しました", "error");
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
          this.activeEntities = mainScene.entities
            ? mainScene.entities.length
            : 0;
        }
      }

      // エンティティ数を表示
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
      const response = await fetch(`/api/scenes/${this.currentSceneId}/reset`, {
        method: "POST",
        headers: {
          "X-API-Key": "ops_dev_key_12345",
        },
      });

      if (response.ok) {
        this.showStatus("全リセットを実行しました", "success");
        this.loadSystemStatus();
      } else {
        throw new Error("Failed to reset");
      }
    } catch (error) {
      console.error("Reset failed:", error);
      this.showStatus("リセットに失敗しました", "error");
    }
  }

  async deleteArtwork(artworkId) {
    const artwork = this.artworks.find((a) => a.id === artworkId);
    const title = artwork ? artwork.title || "無題" : "作品";

    if (
      !confirm(
        `「${title}」を完全に削除しますか？\n\nこの操作は取り消せません。作品とシーンからも削除されます。`
      )
    ) {
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
        // 作品一覧から削除
        this.artworks = this.artworks.filter((a) => a.id !== artworkId);

        // 選択中の作品が削除された場合、選択を解除
        if (this.selectedArtwork && this.selectedArtwork.id === artworkId) {
          this.selectedArtwork = null;
          document.getElementById("animation-settings").classList.add("hidden");
          document.getElementById("selected-artwork-name").textContent = "-";
        }

        // 一覧を再描画
        this.renderArtworksList();

        this.showStatus(`「${title}」を削除しました`, "success");
        this.loadSystemStatus(); // システム状態を更新
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete artwork");
      }
    } catch (error) {
      console.error("Delete artwork failed:", error);
      this.showStatus(`作品の削除に失敗しました: ${error.message}`, "error");
    }
  }

  showStatus(message, type) {
    const status = document.getElementById("status");
    status.textContent = message;
    status.className = `status status-${type}`;
    status.classList.remove("hidden");

    // 3秒後に非表示
    setTimeout(() => {
      status.classList.add("hidden");
    }, 3000);
  }
}

// ページ読み込み時に初期化
let opsSystem;
document.addEventListener("DOMContentLoaded", () => {
  opsSystem = new OpsSystem();
});
