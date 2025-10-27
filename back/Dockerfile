FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY back/go.mod back/go.sum ./
RUN go mod download

COPY back/ .
RUN go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/main .

# フロントエンドファイルをコピー
COPY front ./front
COPY display ./display

# uploadsディレクトリを作成
RUN mkdir -p uploads

EXPOSE 8080
CMD ["./main"]
