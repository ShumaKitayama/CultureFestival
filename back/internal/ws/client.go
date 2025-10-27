package ws

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // 開発環境では全て許可
	},
}

type Client struct {
	hub       *Hub
	conn      *websocket.Conn
	send      chan []byte
	room      string
	deviceKey string
}

type ClientMessage struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	DeviceKey string      `json:"device_key,omitempty"`
}

type DisplayHelloData struct {
	DisplayKey string `json:"display_key"`
	SceneID    uint   `json:"scene_id"`
	Caps       struct {
		W       int     `json:"w"`
		H       int     `json:"h"`
		PxRatio float64 `json:"px_ratio"`
	} `json:"caps"`
}

type StateReportData struct {
	EntityID uint    `json:"entity_id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	VX       float64 `json:"vx"`
	VY       float64 `json:"vy"`
	Angle    float64 `json:"angle"`
	Scale    float64 `json:"scale"`
	TS       int64   `json:"ts"`
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		var msg ClientMessage
		err := c.conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		c.handleMessage(msg)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg ClientMessage) {
	switch msg.Type {
	case "display.hello":
		var data DisplayHelloData
		if jsonData, err := json.Marshal(msg.Data); err == nil {
			json.Unmarshal(jsonData, &data)
			c.deviceKey = data.DisplayKey
			room := fmt.Sprintf("scene:%d", data.SceneID)
			c.hub.MoveClientToRoom(c, room)
			log.Printf("Display node connected: %s to scene %d", data.DisplayKey, data.SceneID)
		}
	case "state.report":
		// 状態報告は現在は無視（将来の同期機能で使用）
		var data StateReportData
		if jsonData, err := json.Marshal(msg.Data); err == nil {
			json.Unmarshal(jsonData, &data)
			log.Printf("State report from %s: entity %d at (%.2f, %.2f)", c.deviceKey, data.EntityID, data.X, data.Y)
		}
	}
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
		room: "default",
	}

	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}
