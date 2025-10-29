const canvasWrapper = document.querySelector(".canvas-wrapper");
const guideCanvas = document.getElementById("guide-canvas");
const guideCtx = guideCanvas.getContext("2d");
const drawCanvas = document.getElementById("mandala-canvas");
const drawCtx = drawCanvas.getContext("2d");
const colorPicker = document.getElementById("pen-color");
const widthSlider = document.getElementById("pen-width");
const clearButton = document.getElementById("clear-button");
const saveButton = document.getElementById("save-button");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const bodyEl = document.body;

// --- 比率関連の要素 ---
const ratioLandscapeBtn = document.getElementById("ratio-landscape");
const ratioPortraitBtn = document.getElementById("ratio-portrait");
const ratioSquareBtn = document.getElementById("ratio-square");
const ratioButtons = [ratioLandscapeBtn, ratioPortraitBtn, ratioSquareBtn];

const RATIOS = {
  landscape: { width: 800, height: 600 },
  portrait: { width: 600, height: 800 },
  square: { width: 700, height: 700 },
};

// --- 状態管理の変数 ---
let isDrawing = false;
let lastPoints = [];
let centerX, centerY;

// --- 履歴管理の変数 ---
let history = [];
let historyIndex = -1;

function createExportCanvas() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = drawCanvas.width;
  exportCanvas.height = drawCanvas.height;
  const exportCtx = exportCanvas.getContext("2d");

  // エクスポート用キャンバスを透明に初期化
  exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

  // 白い背景を描画（透過PNGとして保存するため）
  exportCtx.fillStyle = "#ffffff";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // 描画レイヤーのみを描画（ガイドレイヤーは除外）
  exportCtx.drawImage(drawCanvas, 0, 0);

  return exportCanvas;
}

function createTransparentExportCanvas() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = drawCanvas.width;
  exportCanvas.height = drawCanvas.height;
  const exportCtx = exportCanvas.getContext("2d");

  // エクスポート用キャンバスを透明に初期化
  exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

  // 描画レイヤーのみを描画（ガイドレイヤーは除外、背景は透明）
  exportCtx.drawImage(drawCanvas, 0, 0);

  return exportCanvas;
}

/**
 * 戻る/進むボタンの有効・無効を切り替える
 */
function updateUndoRedoButtons() {
  undoBtn.disabled = historyIndex <= 0;
  redoBtn.disabled = historyIndex >= history.length - 1;
}

/**
 * 現在のキャンバスの状態を履歴に追加する
 */
function addHistory() {
  // 戻る操作後に新しい描画をした場合、未来の履歴を削除
  if (historyIndex < history.length - 1) {
    history = history.slice(0, historyIndex + 1);
  }
  // ImageDataを履歴に追加
  history.push(drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height));
  historyIndex++;
  updateUndoRedoButtons();
}

function resetDrawingLayer() {
  // 第二層（描画レイヤー）を透明にクリア
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function initializeDrawingLayer() {
  // 描画レイヤーを完全に透明に初期化
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

  // 透過性を確実にするための設定
  drawCtx.globalCompositeOperation = "source-over";
  drawCtx.globalAlpha = 1.0;

  // キャンバス要素自体の背景を透明に設定
  drawCanvas.style.backgroundColor = "transparent";

  // 描画レイヤーが完全に透明であることを確認
  drawCtx.save();
  drawCtx.globalCompositeOperation = "source-over";
  drawCtx.globalAlpha = 1.0;
  drawCtx.restore();
}

function setupCanvas(ratioKey) {
  const newSize = RATIOS[ratioKey];

  // 両方のキャンバスを同じサイズに設定
  guideCanvas.width = newSize.width;
  guideCanvas.height = newSize.height;
  drawCanvas.width = newSize.width;
  drawCanvas.height = newSize.height;

  if (canvasWrapper) {
    canvasWrapper.style.aspectRatio = `${newSize.width} / ${newSize.height}`;
  }

  centerX = drawCanvas.width / 2;
  centerY = drawCanvas.height / 2;

  // 第一層：ガイド線を描画（白い背景付き）
  drawGuidelines();

  // 第二層：描画レイヤーを完全に透明に初期化
  initializeDrawingLayer();

  // 履歴をリセット（第二層のみ）
  history = [drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height)];
  historyIndex = 0;
  updateUndoRedoButtons();

  // ボタンの状態を更新
  ratioButtons.forEach((btn) => btn.classList.remove("active"));
  document.getElementById(`ratio-${ratioKey}`).classList.add("active");

  // 透過性の確認
  console.log(
    "キャンバス初期化完了 - 描画レイヤー透過性:",
    drawCanvas.style.backgroundColor
  );
}

function drawGuidelines() {
  // ガイドレイヤーをクリア
  guideCtx.clearRect(0, 0, guideCanvas.width, guideCanvas.height);

  // 白い背景を描画
  guideCtx.fillStyle = "#ffffff";
  guideCtx.fillRect(0, 0, guideCanvas.width, guideCanvas.height);

  // ガイド線を描画
  guideCtx.strokeStyle = "#e0e0e0";
  guideCtx.lineWidth = 1;
  guideCtx.setLineDash([5, 3]);
  guideCtx.beginPath();
  guideCtx.moveTo(centerX, 0);
  guideCtx.lineTo(centerX, guideCanvas.height);
  guideCtx.moveTo(0, centerY);
  guideCtx.lineTo(guideCanvas.width, centerY);
  guideCtx.stroke();
  guideCtx.setLineDash([]);
}

function getSymmetricPoints(x, y) {
  const relX = x - centerX,
    relY = y - centerY;
  return [
    { x: relX + centerX, y: relY + centerY },
    { x: -relY + centerX, y: relX + centerY },
    { x: -relX + centerX, y: -relY + centerY },
    { x: relY + centerX, y: -relX + centerY },
  ];
}

function getCanvasCoordinates(e) {
  const rect = drawCanvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  const scaleX = drawCanvas.width / rect.width;
  const scaleY = drawCanvas.height / rect.height;
  const canvasX = (touch.clientX - rect.left) * scaleX;
  const canvasY = (touch.clientY - rect.top) * scaleY;
  return { x: canvasX, y: canvasY };
}

function startDrawing(e) {
  isDrawing = true;
  const coords = getCanvasCoordinates(e);
  lastPoints = getSymmetricPoints(coords.x, coords.y);
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const coords = getCanvasCoordinates(e);
  const currentPoints = getSymmetricPoints(coords.x, coords.y);

  // 描画レイヤーの設定（透過性を維持）
  drawCtx.save();
  drawCtx.globalCompositeOperation = "source-over";
  drawCtx.globalAlpha = 1.0;
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";
  drawCtx.strokeStyle = colorPicker.value;
  drawCtx.lineWidth = widthSlider.value;

  // 描画処理（背景はクリアしない）
  for (let i = 0; i < 4; i++) {
    drawCtx.beginPath();
    drawCtx.moveTo(lastPoints[i].x, lastPoints[i].y);
    drawCtx.lineTo(currentPoints[i].x, currentPoints[i].y);
    drawCtx.stroke();
  }

  drawCtx.restore();
  lastPoints = currentPoints;
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  addHistory(); // 描画完了時に履歴を追加
}

// --- イベントリスナー ---
drawCanvas.addEventListener("mousedown", startDrawing);
drawCanvas.addEventListener("mousemove", draw);
drawCanvas.addEventListener("mouseup", stopDrawing);
drawCanvas.addEventListener("mouseout", stopDrawing);
drawCanvas.addEventListener("touchstart", startDrawing, { passive: false });
drawCanvas.addEventListener("touchmove", draw, { passive: false });
drawCanvas.addEventListener("touchend", stopDrawing);

clearButton.addEventListener("click", () => {
  const currentRatio = document
    .querySelector(".ratio-controls button.active")
    .id.replace("ratio-", "");
  setupCanvas(currentRatio);
});

saveButton.addEventListener("click", () => {
  // 描画レイヤーのみを透過PNGとして保存
  const exportCanvas = createTransparentExportCanvas();
  const link = document.createElement("a");
  link.href = exportCanvas.toDataURL("image/png");
  link.download = "mandala-art.png";
  link.click();
});

// アップロード機能を追加
const uploadButton = document.createElement("button");
uploadButton.textContent = "アップロード";
uploadButton.id = "upload-button";
uploadButton.style.backgroundColor = "#28a745";
uploadButton.style.marginLeft = "10px";

// アップロードボタンをアクションコントロールに追加
document.querySelector(".action-controls").appendChild(uploadButton);

uploadButton.addEventListener("click", async () => {
  try {
    // 描画レイヤーのみを透過PNGとしてアップロード（ガイドレイヤーは除外）
    const exportCanvas = createTransparentExportCanvas();
    const blob = await new Promise((resolve) => {
      exportCanvas.toBlob(resolve, "image/png");
    });

    // FormDataを作成
    const formData = new FormData();
    formData.append("image", blob, "artwork.png");

    // タイトルを取得（プロンプトで入力）
    const title = prompt("作品のタイトルを入力してください（任意）:") || "";
    formData.append("title", title);

    // タグを取得（プロンプトで入力）
    const tags = prompt("タグを入力してください（任意、カンマ区切り）:") || "";
    formData.append("tags", tags);

    // アップロード
    uploadButton.disabled = true;
    uploadButton.textContent = "アップロード中...";

    const response = await fetch("/api/artworks", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      alert(
        `アップロード成功！\n作品ID: ${result.artwork_id}\nQRトークン: ${result.qr_token}`
      );

      // キャンバスをクリア
      const currentRatio = document
        .querySelector(".ratio-controls button.active")
        .id.replace("ratio-", "");
      setupCanvas(currentRatio);
    } else {
      const error = await response.json();
      alert(`アップロード失敗: ${error.error}`);
    }
  } catch (error) {
    alert(`エラー: ${error.message}`);
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = "アップロード";
  }
});

ratioLandscapeBtn.addEventListener("click", () => setupCanvas("landscape"));
ratioPortraitBtn.addEventListener("click", () => setupCanvas("portrait"));
ratioSquareBtn.addEventListener("click", () => setupCanvas("square"));

const uiToggleBtn = document.getElementById("ui-toggle-btn");
const controlsPanel = document.querySelector(".controls");
uiToggleBtn.addEventListener("click", () => {
  controlsPanel.classList.toggle("hidden");
  bodyEl.classList.toggle("ui-hidden");
});

undoBtn.addEventListener("click", () => {
  if (historyIndex > 0) {
    historyIndex--;
    drawCtx.putImageData(history[historyIndex], 0, 0);
    updateUndoRedoButtons();
  }
});
redoBtn.addEventListener("click", () => {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    drawCtx.putImageData(history[historyIndex], 0, 0);
    updateUndoRedoButtons();
  }
});

// デバッグ用：透過性の確認
function debugTransparency() {
  console.log("=== 透過性デバッグ情報 ===");
  console.log("描画キャンバス背景色:", drawCanvas.style.backgroundColor);
  console.log("ガイドキャンバス背景色:", guideCanvas.style.backgroundColor);
  console.log("キャンバスラッパー背景色:", canvasWrapper.style.backgroundColor);

  // 描画レイヤーの透過性をテスト
  const testCanvas = document.createElement("canvas");
  testCanvas.width = 100;
  testCanvas.height = 100;
  const testCtx = testCanvas.getContext("2d");
  testCtx.clearRect(0, 0, 100, 100);
  testCtx.fillStyle = "red";
  testCtx.fillRect(10, 10, 20, 20);

  const imageData = testCtx.getImageData(0, 0, 100, 100);
  const hasTransparency = Array.from(imageData.data).some(
    (value, index) => index % 4 === 3 && value < 255 // アルファチャンネルが255未満
  );
  console.log("透過性サポート:", hasTransparency);
  console.log("=========================");
}

// --- 初期化 ---
window.addEventListener("DOMContentLoaded", () => {
  setupCanvas("landscape");
  // デバッグ情報を表示
  setTimeout(debugTransparency, 1000);
});
