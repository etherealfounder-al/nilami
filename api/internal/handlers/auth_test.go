package handlers

import (
	"testing"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
)

// The constant exists to make a missing account cost the same time as a wrong
// password. A hash that does not parse fails instantly, which would restore
// exactly the timing difference it is there to remove — and nothing else in
// the sign-in path would look wrong.
func TestAbsentAccountHashIsVerifiable(t *testing.T) {
	ok, err := auth.VerifyPassword("anything at all", absentAccountHash)
	if err != nil {
		t.Fatalf("the placeholder hash does not parse, so it costs no time: %v", err)
	}
	if ok {
		t.Fatal("the placeholder hash matched a password")
	}
}
