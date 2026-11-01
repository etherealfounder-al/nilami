// Package locales holds the translations the public pages render, and the
// Next.js app imports the same two files directly.
//
// They live inside this module because go:embed cannot reach outside it, and
// one copy is the whole point: a second set of strings on the other side
// drifts, and the drift shows up as one language quietly falling behind.
//
// The files are data only. That is why the fourteen strings which interpolate
// are format strings with {placeholders} rather than the functions they used
// to be — a function is not something JSON can carry, and both readers format
// them the same way.
package locales

import (
	"embed"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

//go:embed *.json
var files embed.FS

// Lang is a language the site is published in.
type Lang string

const (
	EN Lang = "en"
	NE Lang = "ne"
)

// Parse turns the value of the lang cookie into a language, defaulting to
// English for anything it does not recognise.
func Parse(s string) Lang {
	if s == string(NE) {
		return NE
	}
	return EN
}

// Dict is one language's strings, kept as the nested shape the file has so a
// template can walk it: Get("listing.title").
type Dict struct {
	lang Lang
	tree map[string]any
}

var dicts = map[Lang]*Dict{}

func init() {
	for _, lang := range []Lang{EN, NE} {
		raw, err := files.ReadFile(string(lang) + ".json")
		if err != nil {
			panic("locales: " + err.Error())
		}
		var tree map[string]any
		if err := json.Unmarshal(raw, &tree); err != nil {
			panic("locales: " + string(lang) + ": " + err.Error())
		}
		dicts[lang] = &Dict{lang: lang, tree: tree}
	}
}

// For returns the dictionary for a language. Every language is loaded at
// start-up, so a missing one is a programming error rather than a request
// failure.
func For(lang Lang) *Dict {
	if d, ok := dicts[lang]; ok {
		return d
	}
	return dicts[EN]
}

// Lang reports which language this dictionary is, for building hreflang links
// and the language switcher.
func (d *Dict) Lang() Lang { return d.lang }

// Get reads a dotted path. A missing key returns the path itself, which is
// visible in the page rather than silently blank — a missing translation
// should be obvious to whoever looks at the page, not invisible.
func (d *Dict) Get(path string) string {
	v := d.lookup(path)
	if s, ok := v.(string); ok {
		return s
	}
	return path
}

// List reads a dotted path that holds an array of strings, such as the steps
// on the how-it-works page.
func (d *Dict) List(path string) []string {
	v, ok := d.lookup(path).([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(v))
	for _, item := range v {
		if s, ok := item.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

// Items reads a dotted path holding an array of objects, such as the steps
// that carry a title and a body.
func (d *Dict) Items(path string) []map[string]string {
	v, ok := d.lookup(path).([]any)
	if !ok {
		return nil
	}
	out := make([]map[string]string, 0, len(v))
	for _, item := range v {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		row := make(map[string]string, len(m))
		for k, val := range m {
			if s, ok := val.(string); ok {
				row[k] = s
			}
		}
		out = append(out, row)
	}
	return out
}

// T fills a format string's {placeholders}.
//
// Arguments are key, value pairs. Numbers are grouped Indian-style, which is
// what a Nepali reader expects; below a thousand it changes nothing, so it is
// applied everywhere rather than at the one call site that used to do it.
//
// Where the language distinguishes plural forms the entry is an object, and
// the form is chosen on n — the only count any of these carry.
func (d *Dict) T(path string, args ...any) string {
	vars := map[string]string{}
	var n int64
	haveN := false
	for i := 0; i+1 < len(args); i += 2 {
		key, _ := args[i].(string)
		value := args[i+1]
		vars[key] = render(value)
		if key == "n" {
			if parsed, ok := asInt(value); ok {
				n, haveN = parsed, true
			}
		}
	}

	var template string
	switch v := d.lookup(path).(type) {
	case string:
		template = v
	case map[string]any:
		form := "other"
		if haveN && n == 1 {
			form = "one"
		}
		s, ok := v[form].(string)
		if !ok {
			s, _ = v["other"].(string)
		}
		template = s
	default:
		return path
	}

	var b strings.Builder
	for {
		open := strings.IndexByte(template, '{')
		if open < 0 {
			b.WriteString(template)
			break
		}
		close := strings.IndexByte(template[open:], '}')
		if close < 0 {
			b.WriteString(template)
			break
		}
		close += open
		b.WriteString(template[:open])
		b.WriteString(vars[template[open+1:close]])
		template = template[close+1:]
	}
	return b.String()
}

func (d *Dict) lookup(path string) any {
	var node any = d.tree
	for _, part := range strings.Split(path, ".") {
		m, ok := node.(map[string]any)
		if !ok {
			return nil
		}
		node, ok = m[part]
		if !ok {
			return nil
		}
	}
	return node
}

func asInt(v any) (int64, bool) {
	switch n := v.(type) {
	case int:
		return int64(n), true
	case int64:
		return n, true
	case float64:
		return int64(n), true
	}
	return 0, false
}

func render(v any) string {
	if n, ok := asInt(v); ok {
		return Group(n)
	}
	switch s := v.(type) {
	case string:
		return s
	case float64:
		return strconv.FormatFloat(s, 'f', -1, 64)
	}
	return fmt.Sprint(v)
}

// Group writes a number the way readers here expect: the last three digits,
// then pairs. 1234567 is 12,34,567, not 1,234,567.
func Group(n int64) string {
	neg := n < 0
	if neg {
		n = -n
	}
	s := strconv.FormatInt(n, 10)
	if len(s) <= 3 {
		if neg {
			return "-" + s
		}
		return s
	}
	head, tail := s[:len(s)-3], s[len(s)-3:]
	var parts []string
	for len(head) > 2 {
		parts = append([]string{head[len(head)-2:]}, parts...)
		head = head[:len(head)-2]
	}
	if head != "" {
		parts = append([]string{head}, parts...)
	}
	out := strings.Join(parts, ",") + "," + tail
	if neg {
		return "-" + out
	}
	return out
}
