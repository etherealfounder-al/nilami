package web

import "testing"

func TestVideoOnlyRendersLinksItRecognises(t *testing.T) {
	for _, c := range []struct{ in, kind, src string }{
		// A watch page is the link an officer actually copies.
		{"https://www.youtube.com/watch?v=aqz-KE-bpKQ", "iframe", "https://www.youtube.com/embed/aqz-KE-bpKQ"},
		{"https://youtu.be/aqz-KE-bpKQ", "iframe", "https://www.youtube.com/embed/aqz-KE-bpKQ"},
		{"https://m.youtube.com/watch?v=abc123", "iframe", "https://www.youtube.com/embed/abc123"},
		{"https://www.youtube.com/shorts/xyz789", "iframe", "https://www.youtube.com/embed/xyz789"},
		{"https://www.youtube.com/embed/already", "iframe", "https://www.youtube.com/embed/already"},
		{"https://vimeo.com/123456789", "iframe", "https://player.vimeo.com/video/123456789"},
		{"https://cdn.example.np/walkthrough.mp4", "file", "https://cdn.example.np/walkthrough.mp4"},

		// Everything else renders nothing rather than being framed.
		{"https://example.com/anything", "", ""},
		{"https://vimeo.com/channels/staffpicks", "", ""},
		{"javascript:alert(1)", "", ""},
		{"data:text/html;base64,PHNjcmlwdD4=", "", ""},
		{"", "", ""},
		{"   ", "", ""},
		{"not a url at all", "", ""},
	} {
		got := Video(c.in)
		if got.Kind != c.kind || got.Src != c.src {
			t.Errorf("Video(%q) = {%q %q}, want {%q %q}", c.in, got.Kind, got.Src, c.kind, c.src)
		}
	}
}
