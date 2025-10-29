package ws

import (
	"encoding/json"
	"log"
	"sync"
)

type Hub struct {
	clients    map[*Client]bool
	rooms      map[string]map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
	mu         sync.RWMutex
}

type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			if h.rooms[client.room] == nil {
				h.rooms[client.room] = make(map[*Client]bool)
			}
			h.rooms[client.room][client] = true
			h.mu.Unlock()
			log.Printf("Client connected to room: %s", client.room)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				if room, exists := h.rooms[client.room]; exists {
					delete(room, client)
					if len(room) == 0 {
						delete(h.rooms, client.room)
					}
				}
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("Client disconnected from room: %s", client.room)

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) BroadcastToRoom(room string, message Message) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	h.mu.RLock()
	if roomClients, exists := h.rooms[room]; exists {
		for client := range roomClients {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
	h.mu.RUnlock()
}

func (h *Hub) GetRoomClients(room string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	
	var clients []*Client
	if roomClients, exists := h.rooms[room]; exists {
		for client := range roomClients {
			clients = append(clients, client)
		}
	}
	return clients
}

func (h *Hub) MoveClientToRoom(client *Client, newRoom string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	
	// 古いルームから削除
	if oldRoom, exists := h.rooms[client.room]; exists {
		delete(oldRoom, client)
		if len(oldRoom) == 0 {
			delete(h.rooms, client.room)
		}
	}
	
	// 新しいルームに追加
	client.room = newRoom
	if h.rooms[newRoom] == nil {
		h.rooms[newRoom] = make(map[*Client]bool)
	}
	h.rooms[newRoom][client] = true
}

func (h *Hub) BroadcastToAll(message Message) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	h.mu.RLock()
	for client := range h.clients {
		select {
		case client.send <- data:
		default:
			close(client.send)
			delete(h.clients, client)
		}
	}
	h.mu.RUnlock()
}
