// Package httpx holds the small HTTP conveniences every handler shares.
package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// RawJSON writes a document Postgres already serialised, without decoding and
// re-encoding it in Go.
func RawJSON(w http.ResponseWriter, status int, body []byte, cache string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if cache != "" {
		w.Header().Set("Cache-Control", cache)
	}
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("encode response", "err", err)
	}
}

// Error returns a message safe to show a caller. Causes are logged, never sent:
// a database error can name tables and columns.
func Error(w http.ResponseWriter, status int, message string, cause error) {
	if cause != nil {
		slog.Error("request failed", "status", status, "message", message, "err", cause)
	}
	JSON(w, status, map[string]string{"error": message})
}
