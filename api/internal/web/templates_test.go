package web

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/UjjwolKayastha/nilami/api/locales"
)

// A key nobody translated renders as its own path — visible, but visible to
// readers rather than to whoever wrote it. This finds them at build time
// instead, in both languages, because a key added to one file and forgotten in
// the other is the failure this arrangement is most prone to.
var keyRef = regexp.MustCompile(`\.(?:S|T)\s+"([a-zA-Z][a-zA-Z0-9_.]*)"`)

func TestEveryDictionaryKeyUsedByATemplateExists(t *testing.T) {
	files, err := filepath.Glob("templates/*.html")
	if err != nil || len(files) == 0 {
		t.Fatalf("no templates found: %v", err)
	}

	seen := map[string]string{}
	for _, file := range files {
		body, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range keyRef.FindAllStringSubmatch(string(body), -1) {
			seen[m[1]] = filepath.Base(file)
		}
	}
	if len(seen) == 0 {
		t.Fatal("no dictionary keys found in the templates; the pattern has stopped matching")
	}

	for _, lang := range []locales.Lang{locales.EN, locales.NE} {
		d := locales.For(lang)
		for key, file := range seen {
			// Get returns the path itself when nothing is there.
			if got := d.Get(key); got == key && !strings.HasPrefix(key, "common.types.") {
				t.Errorf("%s: %s has no %q", file, lang, key)
			}
		}
	}
	t.Logf("checked %d keys across %d templates in 2 languages", len(seen), len(files))
}
