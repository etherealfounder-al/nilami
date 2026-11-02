package web

import "testing"

// The parts must sum back to the stored figure, because the notice prints one
// and the database holds the other: a reader comparing this page against the
// newspaper is comparing two renderings of the same number.
func TestRopaniAanaRoundTrips(t *testing.T) {
	cases := []struct {
		aana float64
		want string
	}{
		{16, "1-0-0-0"},
		{8.5, "0-8-2-0"},
		{24.5, "1-8-2-0"},
		{40, "2-8-0-0"},
		{0.0625, "0-0-0-1"}, // one daam, the smallest unit
		{1, "0-1-0-0"},
		{4.25, "0-4-1-0"},
	}
	for _, c := range cases {
		if got := ropaniAana(c.aana); got != c.want {
			t.Errorf("ropaniAana(%v) = %q, want %q", c.aana, got, c.want)
		}
	}
}
