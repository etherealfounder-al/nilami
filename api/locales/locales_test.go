package locales

import "testing"

// The strings these produce must be identical to the ones the TypeScript side
// produces from the same files, because for now both render pages of the same
// site. The expected values below were captured from that implementation, so a
// change to either formatter that drifts from the other fails here.
func TestFormattingMatchesTheTypeScriptImplementation(t *testing.T) {
	cases := []struct {
		lang Lang
		path string
		args []any
		want string
	}{
		{"en", "common.countdown.leftDH", []any{"d", 3, "h", 7}, "3d 7h left"},
		{"en", "common.countdown.leftDH", []any{"d", 1, "h", 1}, "1d 1h left"},
		{"en", "common.countdown.leftHM", []any{"h", 5, "m", 30}, "5h 30m left"},
		{"en", "common.closedOn", []any{"d", "12 Oct 2026"}, "Closed 12 Oct 2026"},
		{"en", "common.goToPhoto", []any{"n", 4}, "Go to photo 4"},
		{"en", "common.photoOf", []any{"n", 2, "total", 9}, "Photo 2 of 9"},
		{"en", "home.mapCount", []any{"n", 1}, "1 property"},
		{"en", "home.mapCount", []any{"n", 7}, "7 properties"},
		{"en", "listing.count", []any{"n", 1}, "1 property"},
		{"en", "listing.count", []any{"n", 12}, "12 properties"},
		{"en", "listing.showing", []any{"from", 1, "to", 10, "total", 240}, "Showing 1–10 of 240"},
		{"en", "listing.gotoPage", []any{"n", 3}, "Go to page 3"},
		{"en", "listing.pageOf", []any{"n", 2, "total", 15}, "Page 2 of 15"},
		{"en", "detail.views", []any{"n", 1}, "1 view"},
		{"en", "detail.views", []any{"n", 12345}, "12,345 views"},
		{"en", "detail.views", []any{"n", 1234567}, "12,34,567 views"},
		{"en", "detail.security", []any{"pct", "10"}, "Bid security (10%)"},
		{"en", "detail.roundN", []any{"n", 2}, "Round 2"},
		{"en", "detail.share.message", []any{"title", "Land at Thapathali"}, "Auction notice — Land at Thapathali"},
		{"ne", "common.countdown.leftDH", []any{"d", 3, "h", 7}, "3 दिन 7 घण्टा बाँकी"},
		{"ne", "common.countdown.leftDH", []any{"d", 1, "h", 1}, "1 दिन 1 घण्टा बाँकी"},
		{"ne", "common.countdown.leftHM", []any{"h", 5, "m", 30}, "5 घण्टा 30 मिनेट बाँकी"},
		{"ne", "common.closedOn", []any{"d", "12 Oct 2026"}, "12 Oct 2026 मा बन्द"},
		{"ne", "common.goToPhoto", []any{"n", 4}, "तस्बिर 4 मा जानुहोस्"},
		{"ne", "common.photoOf", []any{"n", 2, "total", 9}, "9 मध्ये तस्बिर 2"},
		{"ne", "home.mapCount", []any{"n", 1}, "1 सम्पत्ति"},
		{"ne", "home.mapCount", []any{"n", 7}, "7 सम्पत्ति"},
		{"ne", "listing.count", []any{"n", 1}, "1 वटा सम्पत्ति"},
		{"ne", "listing.count", []any{"n", 12}, "12 वटा सम्पत्ति"},
		{"ne", "listing.showing", []any{"from", 1, "to", 10, "total", 240}, "240 मध्ये 1–10 देखाइँदै"},
		{"ne", "listing.gotoPage", []any{"n", 3}, "पृष्ठ 3 मा जानुहोस्"},
		{"ne", "listing.pageOf", []any{"n", 2, "total", 15}, "15 मध्ये पृष्ठ 2"},
		{"ne", "detail.views", []any{"n", 1}, "1 पटक हेरिएको"},
		{"ne", "detail.views", []any{"n", 12345}, "12,345 पटक हेरिएको"},
		{"ne", "detail.views", []any{"n", 1234567}, "12,34,567 पटक हेरिएको"},
		{"ne", "detail.security", []any{"pct", "10"}, "बोल धरौटी (10%)"},
		{"ne", "detail.roundN", []any{"n", 2}, "चरण 2"},
		{"ne", "detail.share.message", []any{"title", "Land at Thapathali"}, "निलामी सूचना — Land at Thapathali"},
	}
	for _, c := range cases {
		got := For(c.lang).T(c.path, c.args...)
		if got != c.want {
			t.Errorf("%s %s%v = %q, want %q", c.lang, c.path, c.args, got, c.want)
		}
	}
}

// Indian grouping, which is what the old views entry did with toLocaleString
// and what a reader here expects.
func TestGroup(t *testing.T) {
	for _, c := range []struct {
		in   int64
		want string
	}{
		{0, "0"}, {7, "7"}, {999, "999"}, {1000, "1,000"},
		{12345, "12,345"}, {100000, "1,00,000"}, {1234567, "12,34,567"},
		{250000000, "25,00,00,000"}, {-12345, "-12,345"},
	} {
		if got := Group(c.in); got != c.want {
			t.Errorf("Group(%d) = %q, want %q", c.in, got, c.want)
		}
	}
}

// A key nobody translated must be visible in the page rather than blank, so
// that whoever looks at it can see what is missing.
func TestMissingKeyIsVisible(t *testing.T) {
	if got := For(EN).Get("nothing.here"); got != "nothing.here" {
		t.Errorf("missing key rendered %q", got)
	}
}
