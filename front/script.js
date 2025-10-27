const canvas = document.getElementById("mandala-canvas");
const ctx = canvas.getContext("2d");
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
  history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  historyIndex++;
  updateUndoRedoButtons();
}

function setupCanvas(ratioKey) {
  const newSize = RATIOS[ratioKey];
  canvas.width = newSize.width;
  canvas.height = newSize.height;
  canvas.style.aspectRatio = `${newSize.width} / ${newSize.height}`;
  centerX = canvas.width / 2;
  centerY = canvas.height / 2;

  drawGuidelines();

  // 履歴をリセット
  history = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  historyIndex = 0;
  updateUndoRedoButtons();

  ratioButtons.forEach((btn) => btn.classList.remove("active"));
  document.getElementById(`ratio-${ratioKey}`).classList.add("active");
}

function drawGuidelines() {
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, canvas.height);
  ctx.moveTo(0, centerY);
  ctx.lineTo(canvas.width, centerY);
  ctx.stroke();
  ctx.setLineDash([]);
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
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
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

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = colorPicker.value;
  ctx.lineWidth = widthSlider.value;

  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(lastPoints[i].x, lastPoints[i].y);
    ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
    ctx.stroke();
  }
  lastPoints = currentPoints;
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  addHistory(); // 描画完了時に履歴を追加
}

// --- イベントリスナー ---
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);
canvas.addEventListener("touchstart", startDrawing, { passive: false });
canvas.addEventListener("touchmove", draw, { passive: false });
canvas.addEventListener("touchend", stopDrawing);

clearButton.addEventListener("click", () => {
  const currentRatio = document
    .querySelector(".ratio-controls button.active")
    .id.replace("ratio-", "");
  setupCanvas(currentRatio);
});

saveButton.addEventListener("click", () => {
  // 履歴からガイド線がない最初の状態を取得
  const initialImageData = history[0];
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");

  // 一時キャンバスに最初の状態（ガイド線なし）を書き込む
  tempCtx.putImageData(initialImageData, 0, 0);
  // その上に現在の描画内容を重ねる
  tempCtx.drawImage(canvas, 0, 0);

  const link = document.createElement("a");
  link.href = tempCanvas.toDataURL("image/png");
  link.download = "mandala-art.png";
  link.click();
});

// アップロード機能
const uploadButton = document.createElement("button");
uploadButton.textContent = "アップロード";
uploadButton.id = "upload-button";
uploadButton.style.backgroundColor = "#28a745";
uploadButton.style.marginLeft = "10px";

// アップロードボタンをアクションコントロールに追加
const actionControls = document.querySelector(".action-controls");
actionControls.appendChild(uploadButton);

// アップロード処理
uploadButton.addEventListener("click", async () => {
  try {
    // ガイド線なしの画像を取得
    const initialImageData = history[0];
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");

    tempCtx.putImageData(initialImageData, 0, 0);
    tempCtx.drawImage(canvas, 0, 0);

    // 画像をBlobに変換
    const blob = await new Promise((resolve) => {
      tempCanvas.toBlob(resolve, "image/png", 0.9);
    });

    // FormDataを作成
    const formData = new FormData();
    formData.append("image", blob, "flower.png");

    // アップロード実行
    uploadButton.disabled = true;
    uploadButton.textContent = "アップロード中...";

    const response = await fetch("http://localhost:8080/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`アップロードエラー: ${response.status}`);
    }

    const result = await response.json();

    // 成功メッセージとQRコード表示
    showUploadSuccess(result);
  } catch (error) {
    console.error("アップロードエラー:", error);
    alert("アップロードに失敗しました: " + error.message);
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = "アップロード";
  }
});

// アップロード成功時の処理
function showUploadSuccess(result) {
  // モーダル表示
  const modal = document.createElement("div");
  modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

  const content = document.createElement("div");
  content.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        text-align: center;
        max-width: 400px;
        width: 90%;
    `;

  content.innerHTML = `
        <h2 style="color: #28a745; margin-bottom: 20px;">🎉 アップロード完了！</h2>
        <p>あなたの絵が花として展示されました！</p>
        <p><strong>位置:</strong> ${result.grid_x}列目, ${result.grid_y}行目</p>
        <div style="margin: 20px 0;">
            <p><strong>QRコードを読み取って画像を保存できます:</strong></p>
            <div id="qrcode" style="margin: 15px 0;"></div>
        </div>
        <button id="close-modal" style="
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        ">閉じる</button>
    `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // QRコード生成（簡易版）
  const qrDiv = document.getElementById("qrcode");
  const qrUrl = `http://localhost:8080${result.qr_code_url}`;
  qrDiv.innerHTML = `
        <div style="
            border: 2px solid #ddd;
            padding: 20px;
            margin: 10px 0;
            background: #f8f9fa;
            border-radius: 8px;
        ">
            <p><strong>ダウンロードURL:</strong></p>
            <p style="word-break: break-all; font-size: 12px; color: #666;">${qrUrl}</p>
            <p style="margin-top: 10px; font-size: 14px;">このURLを別の端末で開いて画像をダウンロードできます</p>
        </div>
    `;

  // モーダル閉じる
  document.getElementById("close-modal").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  // 背景クリックで閉じる
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

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
    ctx.putImageData(history[historyIndex], 0, 0);
    updateUndoRedoButtons();
  }
});
redoBtn.addEventListener("click", () => {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    ctx.putImageData(history[historyIndex], 0, 0);
    updateUndoRedoButtons();
  }
});

// --- 初期化 ---
window.addEventListener("DOMContentLoaded", () => {
  setupCanvas("landscape");
});
