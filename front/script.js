console.log("=== スクリプト読み込み開始 ===");

const canvasWrapper = document.querySelector(".canvas-wrapper");
const guideCanvas = document.getElementById("guide-canvas");
const guideCtx = guideCanvas.getContext("2d");
const drawCanvas = document.getElementById("mandala-canvas");

// 重要: アルファチャンネルを有効にしてコンテキストを取得
// しかし、この設定はキャンバスサイズ変更でリセットされる
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

// --- 透過PNG保存用：初期状態の保存 ---
let initialCanvasState = null;

function createTransparentExportCanvas() {
  console.log("=== エクスポート処理開始 ===");

  // ★★★ 最もシンプルで確実な方法 ★★★
  // drawCanvasをそのままコピーするのではなく、
  // 完全に新しい透明キャンバスを作成し、描画部分だけを抽出

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = drawCanvas.width;
  exportCanvas.height = drawCanvas.height;

  // アルファチャンネルを明示的に有効化
  const exportCtx = exportCanvas.getContext("2d", {
    alpha: true,
    willReadFrequently: false
  });

  // 何も描画しない（デフォルトで完全に透明）
  // exportCtx.clearRect() も不要

  // 現在の描画キャンバスのImageDataを取得
  const sourceImageData = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
  const sourceData = sourceImageData.data;

  // エクスポート用の新しいImageDataを作成（デフォルトで全て透明）
  const destImageData = exportCtx.createImageData(drawCanvas.width, drawCanvas.height);
  const destData = destImageData.data;

  let copiedPixels = 0;
  let transparentPixels = 0;
  let semiTransparentPixels = 0;

  // 初期状態との差分を取る
  if (initialCanvasState && initialCanvasState.data) {
    const initialData = initialCanvasState.data;

    console.log("=== 初期状態との差分抽出 ===");
    console.log("初期状態の先頭10ピクセル:");
    for (let i = 0; i < 40; i += 4) {
      if (i < 40) {
        console.log(`  [${i / 4}] RGBA(${initialData[i]}, ${initialData[i + 1]}, ${initialData[i + 2]}, ${initialData[i + 3]})`);
      }
    }

    console.log("現在の状態の先頭10ピクセル:");
    for (let i = 0; i < 40; i += 4) {
      if (i < 40) {
        console.log(`  [${i / 4}] RGBA(${sourceData[i]}, ${sourceData[i + 1]}, ${sourceData[i + 2]}, ${sourceData[i + 3]})`);
      }
    }

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

    console.log("差分検出結果:");
    console.log("  - 完全不透明ピクセル:", copiedPixels);
    console.log("  - 半透明ピクセル:", semiTransparentPixels);
    console.log("  - 透明ピクセル:", transparentPixels);
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

  // 最終検証
  const finalCheck = exportCtx.getImageData(0, 0, Math.min(10, exportCanvas.width), 1);
  console.log("=== エクスポート用キャンバスの最初の10ピクセル ===");
  for (let i = 0; i < Math.min(40, finalCheck.data.length); i += 4) {
    console.log(`  [${i / 4}] RGBA(${finalCheck.data[i]}, ${finalCheck.data[i + 1]}, ${finalCheck.data[i + 2]}, ${finalCheck.data[i + 3]})`);
  }

  console.log("=== エクスポート処理完了 ===");
  console.log("総ピクセル数:", sourceData.length / 4);
  console.log("描画ピクセル数:", copiedPixels + semiTransparentPixels);
  console.log("透明ピクセル数:", transparentPixels);

  return exportCanvas;
}/**
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

  // 描画レイヤーには何も描画しない(完全に透明のまま)
}

function setupCanvas(ratioKey) {
  const newSize = RATIOS[ratioKey];

  // 両方のキャンバスを同じサイズに設定
  guideCanvas.width = newSize.width;
  guideCanvas.height = newSize.height;
  drawCanvas.width = newSize.width;
  drawCanvas.height = newSize.height;

  // ★★★ 重要 ★★★
  // キャンバスのwidth/heightを設定すると、コンテキストが完全にリセットされる
  // この時点で描画コンテキストは不透明な黒背景(rgba(0,0,0,255))になっている

  // 解決策: コンテキストを再取得してアルファチャンネルを有効化
  // (ただし、既存のコンテキストは再取得できないので、clearRectで透明化する)

  // 方法1: clearRect() で全体をクリア（これは透明にする）
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

  // 方法2: さらに確実にするため、透明なImageDataで上書き
  const transparentImageData = drawCtx.createImageData(drawCanvas.width, drawCanvas.height);
  // createImageDataはデフォルトで全ピクセルがrgba(0,0,0,0)
  drawCtx.putImageData(transparentImageData, 0, 0);

  // CSSスタイルも透明に設定
  drawCanvas.style.backgroundColor = "transparent";

  if (canvasWrapper) {
    canvasWrapper.style.aspectRatio = `${newSize.width} / ${newSize.height}`;
  }

  centerX = drawCanvas.width / 2;
  centerY = drawCanvas.height / 2;

  // 第一層：ガイド線を描画（白い背景付き）
  drawGuidelines();

  // 初期状態を保存（透過PNG生成時に使用）
  initialCanvasState = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);

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

  // 実際のピクセルデータを確認
  const testData = drawCtx.getImageData(0, 0, 1, 1);
  console.log("初期ピクセルのアルファ値:", testData.data[3], "(0なら完全透明)");

  // 初期状態のアルファ値も確認
  console.log("初期状態保存完了。最初のピクセルRGBA:",
    initialCanvasState.data[0],
    initialCanvasState.data[1],
    initialCanvasState.data[2],
    initialCanvasState.data[3]
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
  console.log("=== 保存ボタンクリック ===");

  // 描画レイヤーのImageDataを確認
  const drawImageData = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
  let transparentPixels = 0;
  let opaquePixels = 0;

  for (let i = 3; i < drawImageData.data.length; i += 4) {
    if (drawImageData.data[i] === 0) {
      transparentPixels++;
    } else if (drawImageData.data[i] === 255) {
      opaquePixels++;
    }
  }

  console.log("=== 描画キャンバスのピクセル分析 ===");
  console.log("透明ピクセル:", transparentPixels);
  console.log("不透明ピクセル:", opaquePixels);
  console.log("総ピクセル:", drawImageData.data.length / 4);

  // 描画レイヤーのみを透過PNGとして保存
  const exportCanvas = createTransparentExportCanvas();

  // エクスポート用キャンバスのImageDataを確認
  const exportCtx = exportCanvas.getContext("2d");
  const exportImageData = exportCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
  let exportTransparentPixels = 0;
  let exportOpaquePixels = 0;

  for (let i = 3; i < exportImageData.data.length; i += 4) {
    if (exportImageData.data[i] === 0) {
      exportTransparentPixels++;
    } else if (exportImageData.data[i] === 255) {
      exportOpaquePixels++;
    }
  }

  console.log("=== エクスポート用キャンバスのピクセル分析 ===");
  console.log("透明ピクセル:", exportTransparentPixels);
  console.log("不透明ピクセル:", exportOpaquePixels);
  console.log("総ピクセル:", exportImageData.data.length / 4);
  console.log(
    "エクスポート用キャンバスサイズ:",
    exportCanvas.width,
    "x",
    exportCanvas.height
  );

  const link = document.createElement("a");
  link.href = exportCanvas.toDataURL("image/png");
  link.download = "mandala-art.png";
  link.click();

  console.log("保存完了");
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
  try {
    console.log("=== 透過性デバッグ情報 ===");
    console.log("描画キャンバス背景色:", drawCanvas.style.backgroundColor);
    console.log("ガイドキャンバス背景色:", guideCanvas.style.backgroundColor);
    console.log(
      "キャンバスラッパー背景色:",
      canvasWrapper.style.backgroundColor
    );

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

    // 実際の描画レイヤーの透過性をチェック
    const drawImageData = drawCtx.getImageData(
      0,
      0,
      drawCanvas.width,
      drawCanvas.height
    );
    const drawHasTransparency = Array.from(drawImageData.data).some(
      (value, index) => index % 4 === 3 && value < 255
    );
    console.log("描画レイヤー透過性:", drawHasTransparency);

    // エクスポート用キャンバスの透過性をチェック
    const exportCanvas = createTransparentExportCanvas();
    const exportCtx = exportCanvas.getContext("2d");
    const exportImageData = exportCtx.getImageData(
      0,
      0,
      exportCanvas.width,
      exportCanvas.height
    );
    const exportHasTransparency = Array.from(exportImageData.data).some(
      (value, index) => index % 4 === 3 && value < 255
    );
    console.log("エクスポート用キャンバス透過性:", exportHasTransparency);

    console.log("=========================");
  } catch (error) {
    console.error("デバッグ関数でエラーが発生:", error);
  }
}

// --- 初期化 ---
window.addEventListener("DOMContentLoaded", () => {
  console.log("=== アプリケーション開始 ===");
  setupCanvas("landscape");
  console.log("キャンバス初期化完了");
  // デバッグ情報を表示
  setTimeout(() => {
    console.log("デバッグ関数実行開始");
    debugTransparency();
  }, 1000);
});
