package web

import (
	"net/url"
	"regexp"
	"strings"
)

// VideoEmbed is how a pasted video link should be rendered, or the zero value
// when the link is not one we will render at all.
type VideoEmbed struct {
	// Kind is "iframe" for a player we frame, "file" for media we play
	// ourselves, and "" when nothing should be rendered.
	Kind string
	Src  string
}

// OK reports whether there is anything to render.
func (v VideoEmbed) OK() bool { return v.Kind != "" }

var videoFileExt = regexp.MustCompile(`(?i)\.(mp4|webm|ogg|ogv|mov)(\?.*)?$`)

// Video turns the link an officer pasted into something renderable.
//
// Two reasons this cannot be the raw value in a src attribute. A watch page is
// not an embed: a host refuses to be framed outside its player path, so
// youtube.com/watch?v=… renders an error panel rather than the walkthrough,
// which is what the officer will see after saving and conclude is broken.
//
// The second is the important one. Anything not recognised is rejected rather
// than framed. A notice is a public page, the link comes from a form, and
// "put whatever address this field holds inside an iframe on our domain" is
// not a thing to offer. An unknown host yields no player at all.
func Video(raw string) VideoEmbed {
	value := strings.TrimSpace(raw)
	if value == "" {
		return VideoEmbed{}
	}
	u, err := url.Parse(value)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") {
		return VideoEmbed{}
	}

	host := strings.ToLower(strings.TrimPrefix(u.Hostname(), "www."))
	seg := strings.FieldsFunc(u.Path, func(r rune) bool { return r == '/' })

	switch host {
	case "youtu.be":
		if len(seg) > 0 && seg[0] != "" {
			return VideoEmbed{"iframe", "https://www.youtube.com/embed/" + url.PathEscape(seg[0])}
		}
		return VideoEmbed{}

	case "youtube.com", "m.youtube.com", "youtube-nocookie.com":
		id := u.Query().Get("v")
		if id == "" && len(seg) >= 2 && (seg[0] == "shorts" || seg[0] == "embed" || seg[0] == "live") {
			id = seg[1]
		}
		if id != "" {
			return VideoEmbed{"iframe", "https://www.youtube.com/embed/" + url.PathEscape(id)}
		}
		return VideoEmbed{}

	case "vimeo.com", "player.vimeo.com":
		if len(seg) > 0 {
			last := seg[len(seg)-1]
			if last != "" && strings.IndexFunc(last, func(r rune) bool { return r < '0' || r > '9' }) < 0 {
				return VideoEmbed{"iframe", "https://player.vimeo.com/video/" + last}
			}
		}
		return VideoEmbed{}
	}

	// A file we can play ourselves, which needs no third party at all.
	if videoFileExt.MatchString(u.Path) {
		return VideoEmbed{"file", u.String()}
	}
	return VideoEmbed{}
}

// Video resolves the property's pasted link for the template.
func (p Property) Video() VideoEmbed { return Video(p.VideoURL) }
