package storage

import (
	"net/url"
	"strings"
	"testing"
	"time"
)

func fixedClient() *Client {
	return New(Config{
		AccountID:     "acct",
		AccessKeyID:   "AKIAIOSFODNN7EXAMPLE",
		SecretKey:     "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
		Bucket:        "bucket",
		PublicBaseURL: "https://cdn.example.test",
	})
}

// The signature must not move unless the algorithm changes. A drifting
// signature is the failure that presents as "uploads stopped working" long
// after the commit that caused it.
func TestPresignIsStable(t *testing.T) {
	c := fixedClient()
	at := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	got, err := c.PresignPut("properties/abc.jpg", "image/jpeg", 10*time.Minute, at)
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	for k, v := range map[string]string{
		"X-Amz-Algorithm":     "AWS4-HMAC-SHA256",
		"X-Amz-Credential":    "AKIAIOSFODNN7EXAMPLE/20261005/auto/s3/aws4_request",
		"X-Amz-Date":          "20261005T120000Z",
		"X-Amz-Expires":       "600",
		"X-Amz-SignedHeaders": "content-type;host",
	} {
		if q.Get(k) != v {
			t.Errorf("%s = %q, want %q", k, q.Get(k), v)
		}
	}
	if len(q.Get("X-Amz-Signature")) != 64 {
		t.Errorf("signature is not 64 hex characters: %q", q.Get("X-Amz-Signature"))
	}
	if u.Path != "/bucket/properties/abc.jpg" {
		t.Errorf("path = %q", u.Path)
	}
	// Same inputs, same output.
	again, _ := c.PresignPut("properties/abc.jpg", "image/jpeg", 10*time.Minute, at)
	if again != got {
		t.Error("presigning is not deterministic")
	}
	// Different content type, different signature — proving it is signed and
	// not merely passed along.
	other, _ := c.PresignPut("properties/abc.jpg", "text/html", 10*time.Minute, at)
	if other == got {
		t.Error("content type is not part of the signature")
	}
}

func TestEncodingFollowsAWSRules(t *testing.T) {
	// A space must be %20, never '+', or the signature will not match.
	if got := encodeRFC3986("a b"); got != "a%20b" {
		t.Errorf("space encoded as %q", got)
	}
	// Unreserved characters pass through untouched.
	if got := encodeRFC3986("Aa0-_.~"); got != "Aa0-_.~" {
		t.Errorf("unreserved characters were escaped: %q", got)
	}
	// Slashes survive in a key path but are escaped inside a segment.
	if got := encodePath("a/b c/d.jpg"); got != "a/b%20c/d.jpg" {
		t.Errorf("path encoded as %q", got)
	}
	if !strings.Contains(encodeQuery(url.Values{"b": {"2"}, "a": {"1"}}), "a=1&b=2") {
		t.Error("query parameters are not sorted")
	}
}

func TestUnconfiguredClientRefuses(t *testing.T) {
	c := New(Config{})
	if _, err := c.PresignPut("k", "image/jpeg", time.Minute, time.Now()); err != ErrNotConfigured {
		t.Fatalf("expected ErrNotConfigured, got %v", err)
	}
}
