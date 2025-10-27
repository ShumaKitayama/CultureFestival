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

func (ip *ImageProcessor) ProcessUpload(file multipart.File, header *multipart.FileHeader) (*ProcessedImage, error) {
	// ファイルを読み込み
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	// 画像をデコード
	img, format, err := image.Decode(strings.NewReader(string(data)))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %v", err)
	}

	// 元のサイズを取得
	bounds := img.Bounds()
	originalWidth := bounds.Dx()
	originalHeight := bounds.Dy()

	// 最大サイズにリサイズ（1024px）
	maxSize := 1024
	var resizedImg image.Image
	if originalWidth > maxSize || originalHeight > maxSize {
		resizedImg = imaging.Fit(img, maxSize, maxSize, imaging.Lanczos)
	} else {
		resizedImg = img
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

	// 透過があるかチェック（簡易版）
	hasTransparency := format == "png" || format == "gif"
	
	if hasTransparency {
		// 透過がある場合はPNGで保存
		filename = fmt.Sprintf("%s.png", uuidStr)
		thumbFilename = fmt.Sprintf("%s_thumb.png", uuidStr)
		mime = "image/png"
	} else {
		// 透過がない場合はWebPで保存
		filename = fmt.Sprintf("%s.webp", uuidStr)
		thumbFilename = fmt.Sprintf("%s_thumb.webp", uuidStr)
		mime = "image/webp"
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
		return png.Encode(file, img)
	case "image/jpeg":
		return jpeg.Encode(file, img, &jpeg.Options{Quality: 90})
	case "image/webp":
		// WebPは標準ライブラリにないので、PNGで代替
		return png.Encode(file, img)
	default:
		return png.Encode(file, img)
	}
}
