package main

import (
	"strings"
	"testing"
)

func TestReadPassword(t *testing.T) {
	cases := []struct {
		name  string
		in    string
		want  string
		valid bool
	}{
		{"a piped password loses its trailing newline", "a-long-enough-pw\n", "a-long-enough-pw", true},
		{"a CRLF heredoc is trimmed too", "a-long-enough-pw\r\n", "a-long-enough-pw", true},
		{"interior spaces survive", "correct horse battery", "correct horse battery", true},
		{"exactly the minimum is allowed", "123456789012", "123456789012", true},
		{"empty is refused", "", "", false},
		{"whitespace only is refused", "   \n", "", false},
		{"short is refused", "sh0rt\n", "", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := readPassword(strings.NewReader(c.in))
			if !c.valid {
				if err == nil {
					t.Fatalf("expected an error, got %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != c.want {
				t.Fatalf("got %q, want %q", got, c.want)
			}
		})
	}
}
