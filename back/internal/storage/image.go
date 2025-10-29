package storage

import (
	"crypto/sha256"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/google/uuid"
)

type ImageProcessor struct {
	AssetDir string
}

func NewImageProcessor(assetDir string) *ImageProcessor {
	// アセットディレクトリを作成
	os.MkdirAll(assetDir, 0755)
	return &ImageProcessor{AssetDir: assetDir}
}

type ProcessedImage struct {
	Path      string
	ThumbPath string
	Mime      string
	Width     int
	Height    int
	Bytes     int
	SHA256    string
}

// ensureNRGBA converts an image to *image.NRGBA format to preserve alpha channel
func ensureNRGBA(img image.Image) *image.NRGBA {
	// 既にNRGBA形式の場合はそのまま返す
	if nrgba, ok := img.(*image.NRGBA); ok {
		return nrgba
	}

	// 新しいNRGBA画像を作成
	bounds := img.Bounds()
	nrgba := image.NewNRGBA(bounds)

	// ピクセルをコピー
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			nrgba.Set(x, y, img.At(x, y))
		}
	}

	return nrgba
}

// checkImageHasTransparency checks if the image has any transparent pixels
func checkImageHasTransparency(img image.Image) bool {
	bounds := img.Bounds()

	// サンプリング: 全ピクセルをチェックすると遅いので、一定間隔でチェック
	step := 10
	for y := bounds.Min.Y; y < bounds.Max.Y; y += step {
		for x := bounds.Min.X; x < bounds.Max.X; x += step {
			_, _, _, a := img.At(x, y).RGBA()
			// RGBAメソッドは0-65535の範囲で返すので、65535未満なら透過あり
			if a < 65535 {
				return true
			}
		}
	}

	// 最後の行と列も念のためチェック
	for x := bounds.Min.X; x < bounds.Max.X; x++ {
		_, _, _, a := img.At(x, bounds.Max.Y-1).RGBA()
		if a < 65535 {
			return true
		}
	}
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		_, _, _, a := img.At(bounds.Max.X-1, y).RGBA()
		if a < 65535 {
			return true
		}
	}

	return false
}

func (ip *ImageProcessor) ProcessUpload(file multipart.File, header *multipart.FileHeader) (*ProcessedImage, error) {
	// ファイルを読み込み
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	// 画像をデコード
	img, _, err := image.Decode(strings.NewReader(string(data)))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %v", err)
	}

	// 元のサイズを取得
	bounds := img.Bounds()
	originalWidth := bounds.Dx()
	originalHeight := bounds.Dy()

	// アルファチャンネルの有無を実際の画像から判定
	hasAlpha := false
	switch img.(type) {
	case *image.NRGBA, *image.RGBA, *image.NRGBA64, *image.RGBA64:
		// アルファチャンネルを持つ可能性がある画像形式
		// 実際にアルファチャンネルに透過ピクセルがあるか確認
		hasAlpha = checkImageHasTransparency(img)
	default:
		hasAlpha = false
	}

	// 最大サイズにリサイズ（1024px）
	maxSize := 1024
	var resizedImg image.Image
	if originalWidth > maxSize || originalHeight > maxSize {
		// リサイズ時にアルファチャンネルを保持
		if hasAlpha {
			// 透過がある場合は、imaging.Fitを使用してリサイズ
			// imaging.Fitは元の画像形式を保持するので、NRGBAならNRGBAのまま
			resizedImg = imaging.Fit(img, maxSize, maxSize, imaging.Lanczos)

			// さらに確実にするため、NRGBA形式に変換
			resizedImg = ensureNRGBA(resizedImg)
		} else {
			resizedImg = imaging.Fit(img, maxSize, maxSize, imaging.Lanczos)
		}
	} else {
		if hasAlpha {
			// リサイズしない場合もNRGBA形式を保証
			resizedImg = ensureNRGBA(img)
		} else {
			resizedImg = img
		}
	}

	// 新しいサイズを取得
	newBounds := resizedImg.Bounds()
	width := newBounds.Dx()
	height := newBounds.Dy()

	// ファイルパスを生成
	now := time.Now()
	year := now.Format("2006")
	month := now.Format("01")
	day := now.Format("02")
	uuidStr := uuid.New().String()

	// ディレクトリを作成
	dir := filepath.Join(ip.AssetDir, year, month, day)
	os.MkdirAll(dir, 0755)

	// ファイル名を生成
	var filename, thumbFilename string
	var mime string

	// 透過があるかチェック（実際の画像内容をチェック）
	hasTransparency := hasAlpha

	if hasTransparency {
		// 透過がある場合はPNGで保存
		filename = fmt.Sprintf("%s.png", uuidStr)
		thumbFilename = fmt.Sprintf("%s_thumb.png", uuidStr)
		mime = "image/png"
	} else {
		// 透過がない場合もPNGで保存（WebPは一旦保留）
		filename = fmt.Sprintf("%s.png", uuidStr)
		thumbFilename = fmt.Sprintf("%s_thumb.png", uuidStr)
		mime = "image/png"
	}

	// メインファイルのパス
	filePath := filepath.Join(dir, filename)
	thumbPath := filepath.Join(dir, thumbFilename)

	// ファイルを保存
	if err := ip.saveImage(resizedImg, filePath, mime); err != nil {
		return nil, err
	}

	// サムネイルを生成（512x512）
	thumbImg := imaging.Fit(resizedImg, 512, 512, imaging.Lanczos)
	// サムネイルもアルファチャンネルを保持
	if hasAlpha {
		thumbImg = ensureNRGBA(thumbImg)
	}
	if err := ip.saveImage(thumbImg, thumbPath, mime); err != nil {
		return nil, err
	}

	// ファイルサイズを取得
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}

	// SHA256ハッシュを計算
	hash := sha256.Sum256(data)

	return &ProcessedImage{
		Path:      filePath,
		ThumbPath: thumbPath,
		Mime:      mime,
		Width:     width,
		Height:    height,
		Bytes:     int(fileInfo.Size()),
		SHA256:    fmt.Sprintf("%x", hash),
	}, nil
}

func (ip *ImageProcessor) saveImage(img image.Image, filePath, mime string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	switch mime {
	case "image/png":
		// PNGエンコーダーの設定
		encoder := png.Encoder{
			CompressionLevel: png.BestCompression,
		}
		return encoder.Encode(file, img)
	case "image/jpeg":
		return jpeg.Encode(file, img, &jpeg.Options{Quality: 90})
	case "image/webp":
		// WebPは標準ライブラリにないので、PNGで代替
		encoder := png.Encoder{
			CompressionLevel: png.BestCompression,
		}
		return encoder.Encode(file, img)
	default:
		encoder := png.Encoder{
			CompressionLevel: png.BestCompression,
		}
		return encoder.Encode(file, img)
	}
}
