package repo

import (
	"context"
	"log"

	"github.com/go-redis/redis/v8"
)

type RedisClient struct {
	Client *redis.Client
}

func NewRedisClient(redisURL string) (*RedisClient, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr: redisURL,
	})

	// 接続テスト
	ctx := context.Background()
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		return nil, err
	}

	log.Println("Redis connected successfully")
	return &RedisClient{Client: rdb}, nil
}
