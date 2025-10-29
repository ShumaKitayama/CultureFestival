console.log("=== スクリプト読み込み開始 ===");

const canvasWrapper = document.querySelector(".canvas-wrapper");
const guideCanvas = document.getElementById("guide-canvas");
const guideCtx = guideCanvas.getContext("2d");
const drawCanvas = document.getElementById("mandala-canvas");

// 重要: アルファチャンネルを有効にしてコンテキストを取得
let drawCtx = drawCanvas.getContext("2d", { alpha: true, willReadFrequently: true });

console.log("=== 要素取得完了 ===");
const colorPicker = document.getElementById("pen-color");
const widthSlider = document.getElementById("pen-width");
const clearButton = document.getElementById("clear-button");
const saveButton = document.getElementById("save-button");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const bodyEl = document.body;

// --- 比率関連の要素 ---
// const ratioLandscapeBtn = document.getElementById("ratio-landscape"); // 削除
// const ratioPortraitBtn = document.getElementById("ratio-portrait"); // 削除
const ratioSquareBtn = document.getElementById("ratio-square");
const ratioButtons = [ratioSquareBtn]; // 正方形のみに

const RATIOS = {
  // landscape: { width: 800, height: 600 }, // 削除
  // portrait: { width: 600, height: 800 }, // 削除
  square: { width: 700, height: 700 },
};

// --- 状態管理の変数 ---
let isDrawing = false;
let lastPoints = [];
let centerX, centerY;
let isFreestyleMode = false; // ★機能：フリースタイルモード
let isRandomColor = true; // ★機能：ランダムカラーモード

// --- 履歴管理の変数 ---
let history = [];
let historyIndex = -1;

// --- 透過PNG保存用：初期状態の保存 ---
let initialCanvasState = null;

function createTransparentExportCanvas() {
  console.log("=== エクスポート処理開始 ===");

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = drawCanvas.width;
  exportCanvas.height = drawCanvas.height;

  const exportCtx = exportCanvas.getContext("2d", {
    alpha: true,
    willReadFrequently: false
  });

  const sourceImageData = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
  const sourceData = sourceImageData.data;

  const destImageData = exportCtx.createImageData(drawCanvas.width, drawCanvas.height);
  const destData = destImageData.data;

  let copiedPixels = 0;
  let semiTransparentPixels = 0;
  let transparentPixels = 0;

  // 初期状態との差分を取る
  if (initialCanvasState && initialCanvasState.data) {
    const initialData = initialCanvasState.data;

    // すべてのピクセルを比較
    for (let i = 0; i < sourceData.length; i += 4) {
      const currentR = sourceData[i];
      const currentG = sourceData[i + 1];
      const currentB = sourceData[i + 2];
      const currentA = sourceData[i + 3];

      const initR = initialData[i];
      const initG = initialData[i + 1];
      const initB = initialData[i + 2];
      const initA = initialData[i + 3];

      // 初期状態と異なるピクセルのみをコピー（これが描画された部分）
      const isDifferent = (currentR !== initR || currentG !== initG ||
        currentB !== initB || currentA !== initA);

      if (isDifferent) {
        destData[i] = currentR;
        destData[i + 1] = currentG;
        destData[i + 2] = currentB;
        destData[i + 3] = currentA;

        if (currentA === 255) {
          copiedPixels++;
        } else if (currentA > 0) {
          semiTransparentPixels++;
        }
      } else {
        // 初期状態と同じ = 背景 = 透明のまま
        transparentPixels++;
      }
    }
  } else {
    console.warn("⚠️ 初期状態が保存されていません！フォールバックモードで動作します。");
    // フォールバック: アルファ値が0のピクセルを透明として扱う
    for (let i = 0; i < sourceData.length; i += 4) {
      const a = sourceData[i + 3];
      if (a > 0) {
        destData[i] = sourceData[i];
        destData[i + 1] = sourceData[i + 1];
        destData[i + 2] = sourceData[i + 2];
        destData[i + 3] = a;
        copiedPixels++;
      } else {
        transparentPixels++;
      }
    }
  }

  // 処理済みのImageDataをエクスポート用キャンバスに描画
  exportCtx.putImageData(destImageData, 0, 0);

  console.log("=== エクスポート処理完了 ===");
  console.log("描画ピクセル数:", copiedPixels + semiTransparentPixels);
  console.log("透明ピクセル数:", transparentPixels);

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

// --- 修正箇所 ---
function setupCanvas(ratioKey) {
  const newSize = RATIOS[ratioKey];

  // 両方のキャンバスを同じサイズに設定
  guideCanvas.width = newSize.width;
  guideCanvas.height = newSize.height;
  drawCanvas.width = newSize.width;
  drawCanvas.height = newSize.height;

  // 描画コンテキストを透明で初期化
  const transparentImageData = drawCtx.createImageData(drawCanvas.width, drawCanvas.height);
  drawCtx.putImageData(transparentImageData, 0, 0);

  // CSSスタイルも透明に設定
  drawCanvas.style.backgroundColor = "transparent";

  if (canvasWrapper) {
    // ★★★ ここのタイプミスを修正 ★★★
    canvasWrapper.style.aspectRatio = `${newSize.width} / ${newSize.height}`;
  }

  centerX = drawCanvas.width / 2;
  centerY = drawCanvas.height / 2;

  // 第一層：ガイド線を描画（白い背景付き）
  drawGuidelines();

  // 初期状態を保存（透過PNG生成時に使用）
  initialCanvasState = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);

  // 履歴をリセット（第二層のみ）
  history = [initialCanvasState];
  historyIndex = 0;
  updateUndoRedoButtons();

  // ボタンの状態を更新
  ratioButtons.forEach((btn) => btn.classList.remove("active"));
  ratioSquareBtn.classList.add("active"); // 正方形をアクティブに

  console.log(
    "キャンバス初期化完了 - 描画レイヤー透過性:",
    drawCanvas.style.backgroundColor
  );
}
// --- 修正ここまで ---

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

  // ★機能：対角線ガイドの追加
  guideCtx.moveTo(0, 0);
  guideCtx.lineTo(guideCanvas.width, guideCanvas.height);
  guideCtx.moveTo(guideCanvas.width, 0);
  guideCtx.lineTo(0, guideCanvas.height);

  guideCtx.stroke();
  guideCtx.setLineDash([]);
}

// ★機能：8点対称
function getSymmetricPoints(x, y) {
  const relX = x - centerX;
  const relY = y - centerY;

  return [
    { x: relX + centerX, y: relY + centerY },
    { x: -relY + centerX, y: relX + centerY },
    { x: -relX + centerX, y: -relY + centerY },
    { x: relY + centerX, y: -relX + centerY },
    { x: relY + centerX, y: relX + centerY },
    { x: -relX + centerX, y: relY + centerY },
    { x: -relY + centerX, y: -relX + centerY },
    { x: relX + centerX, y: -relY + centerY },
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

// ★機能：ランダム色 + フリースタイル
function startDrawing(e) {
  // ランダムカラーモードの場合のみランダムな色を生成
  if (isRandomColor) {
    const randomHex = Math.floor(Math.random() * 16777215).toString(16);
    const randomColor = `#${randomHex.padStart(6, '0')}`;
    colorPicker.value = randomColor;
  }

  isDrawing = true;
  const coords = getCanvasCoordinates(e);

  if (isFreestyleMode) {
    lastPoints = [coords]; // 自由描画モード：座標1点のみ
  } else {
    lastPoints = getSymmetricPoints(coords.x, coords.y); // シンメトリー：8点
  }
}

// ★機能：フリースタイル
function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const coords = getCanvasCoordinates(e);

  let currentPoints;
  if (isFreestyleMode) {
    currentPoints = [coords]; // 自由描画モード：座標1点
  } else {
    currentPoints = getSymmetricPoints(coords.x, coords.y); // シンメトリー：8点
  }

  // 描画レイヤーの設定
  drawCtx.save();
  drawCtx.globalCompositeOperation = "source-over";
  drawCtx.globalAlpha = 1.0;
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";
  drawCtx.strokeStyle = colorPicker.value;
  drawCtx.lineWidth = widthSlider.value;

  // 描画処理（lastPointsの数だけループ）
  for (let i = 0; i < lastPoints.length; i++) {
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
  setupCanvas("square"); // 正方形でリセット
});

saveButton.addEventListener("click", () => {
  console.log("=== 保存ボタンクリック ===");
  // 描画レイヤーのみを透過PNGとして保存
  const exportCanvas = createTransparentExportCanvas();

  const link = document.createElement("a");
  link.href = exportCanvas.toDataURL("image/png");
  link.download = "mandala-art.png";
  link.click();
  console.log("保存完了");
});

// ★機能：フリースタイルモードのボタン ---
const freestyleBtn = document.createElement("button");
freestyleBtn.textContent = "自由に書く 🎨";
freestyleBtn.id = "freestyle-btn";
freestyleBtn.style.backgroundColor = "#ffc107"; // 目立つ色
freestyleBtn.style.color = "#212529";
freestyleBtn.style.marginLeft = "10px";

const actionControls = document.querySelector(".action-controls");
clearButton.insertAdjacentElement('afterend', freestyleBtn);

freestyleBtn.addEventListener("click", () => {
  isFreestyleMode = !isFreestyleMode; // モードをトグル

  if (isFreestyleMode) {
    freestyleBtn.textContent = "シンメトリー 💠";
    freestyleBtn.style.backgroundColor = "#17a2b8"; // アクティブ時の色
    freestyleBtn.style.color = "white";
    freestyleBtn.classList.add("active");
  } else {
    freestyleBtn.textContent = "自由に書く 🎨";
    freestyleBtn.style.backgroundColor = "#ffc107"; // 非アクティブ時の色
    freestyleBtn.style.color = "#212529";
    freestyleBtn.classList.remove("active");
  }
});

// ★機能：カラーモード切り替えボタン ---
const colorModeBtn = document.createElement("button");
colorModeBtn.textContent = "🎨 ランダム色";
colorModeBtn.id = "color-mode-btn";
colorModeBtn.style.backgroundColor = "#e91e63";
colorModeBtn.style.color = "white";
colorModeBtn.style.marginLeft = "10px";

freestyleBtn.insertAdjacentElement('afterend', colorModeBtn);

colorModeBtn.addEventListener("click", () => {
  isRandomColor = !isRandomColor; // モードをトグル

  if (isRandomColor) {
    colorModeBtn.textContent = "🎨 ランダム色";
    colorModeBtn.style.backgroundColor = "#e91e63";
    colorPicker.disabled = true; // カラーピッカーを無効化
  } else {
    colorModeBtn.textContent = "🎨 手動設定";
    colorModeBtn.style.backgroundColor = "#9c27b0";
    colorPicker.disabled = false; // カラーピッカーを有効化
  }
});

// 初期状態ではカラーピッカーを無効化
colorPicker.disabled = true;


// アップロード機能
const uploadButton = document.createElement("button");
uploadButton.textContent = "アップロード";
uploadButton.id = "upload-button";
uploadButton.style.backgroundColor = "#28a745";
uploadButton.style.marginLeft = "10px";

actionControls.appendChild(uploadButton);

uploadButton.addEventListener("click", async () => {
  // 作品名入力モーダルを表示
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
    <h2 style="margin-bottom: 20px;">作品名を入力してください</h2>
    <input 
      type="text" 
      id="artwork-title" 
      placeholder="作品名（任意）"
      style="
        width: 100%;
        padding: 10px;
        margin-bottom: 20px;
        border: 2px solid #ddd;
        border-radius: 5px;
        font-size: 16px;
      "
    />
    <div style="display: flex; gap: 10px; justify-content: center;">
      <button id="upload-confirm" style="
        background: #28a745;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
      ">アップロード</button>
      <button id="upload-cancel" style="
        background: #6c757d;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
      ">キャンセル</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // キャンセルボタン
  document.getElementById("upload-cancel").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  // アップロード確定
  document.getElementById("upload-confirm").addEventListener("click", async () => {
    const title = document.getElementById("artwork-title").value || "";
    document.body.removeChild(modal);

    try {
      // 描画レイヤーのみを透過PNGとしてアップロード
      const exportCanvas = createTransparentExportCanvas();
      const blob = await new Promise((resolve) => {
        exportCanvas.toBlob(resolve, "image/png", 0.9);
      });

      const formData = new FormData();
      formData.append("image", blob, "flower.png");
      if (title) {
        formData.append("title", title);
      }

      uploadButton.disabled = true;
      uploadButton.textContent = "アップロード中...";

      const response = await fetch("http://localhost:8080/api/artworks", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`アップロードエラー: ${response.status}`);
      }

      const result = await response.json();

      // 成功メッセージを表示
      alert(`アップロード成功！\nアートワークID: ${result.artwork_id}`);

      // 成功したらキャンバスをクリア
      setupCanvas("square");

    } catch (error) {
      console.error("アップロードエラー:", error);
      alert("アップロードに失敗しました: " + error.message);
    } finally {
      uploadButton.disabled = false;
      uploadButton.textContent = "アップロード";
    }
  });
});

// ratioLandscapeBtn.addEventListener("click", () => setupCanvas("landscape"));
// ratioPortraitBtn.addEventListener("click", () => setupCanvas("portrait"));
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

// --- 初期化 ---
window.addEventListener("DOMContentLoaded", () => {
  console.log("=== アプリケーション開始 ===");
  setupCanvas("square"); // 正方形で開始
  console.log("キャンバス初期化完了");
});