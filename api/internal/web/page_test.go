package web

import "testing"

// The language switch carries where to return to in a query parameter, which
// is the classic shape of an open redirect: a reader follows a link on this
// site and lands on another one. Only a path is honoured.
func TestSafePathRefusesAnythingOffSite(t *testing.T) {
	for _, c := range []struct {
		in, want string
	}{
		{"/auctions", "/auctions"},
		{"/auctions?status=open", "/auctions?status=open"},
		{"/", "/"},

		// A protocol-relative URL: the browser reads //evil.example as a host,
		// and it starts with a slash, so a naive check passes it.
		{"//evil.example", "/"},
		{"//evil.example/path", "/"},

		// A backslash in the authority position: a browser reads this as
		// //evil.example and leaves the site. Checking only for two slashes
		// let it through.
		{`/\evil.example`, "/"},
		{`/\/evil.example`, "/"},
		{`/\\evil.example`, "/"},

		// Control characters, which a Location header must never carry.
		{"/auctions\r\nSet-Cookie: a=b", "/"},
		{"/auctions\n", "/"},

		{"https://evil.example", "/"},
		{"http://evil.example", "/"},
		{"evil.example", "/"},
		{"", "/"},
	} {
		if got := safePath(c.in); got != c.want {
			t.Errorf("safePath(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
