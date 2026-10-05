// Package storage issues presigned URLs for Cloudflare R2.
//
// Signing is done here rather than through the AWS SDK. A presigned PUT is the
// simplest case SigV4 has — one canonical request, an unsigned payload, no
// retries, no credential chain — and the SDK would add tens of megabytes and a
// large dependency tree to a binary whose entire point is a small footprint.
// The signature is covered by tests against the published AWS example and
// exercised against the real bucket.
package storage

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

type Config struct {
	AccountID     string
	AccessKeyID   string
	SecretKey     string
	Bucket        string
	PublicBaseURL string
}

type Client struct {
	cfg      Config
	endpoint string
}

// R2 presents one region to the signer regardless of where the bucket lives.
const region = "auto"

func New(cfg Config) *Client {
	return &Client{
		cfg:      cfg,
		endpoint: fmt.Sprintf("%s.r2.cloudflarestorage.com", cfg.AccountID),
	}
}

func (c *Client) Configured() bool {
	return c.cfg.AccountID != "" && c.cfg.AccessKeyID != "" &&
		c.cfg.SecretKey != "" && c.cfg.Bucket != ""
}

// PublicURL is where an object will be readable once uploaded.
func (c *Client) PublicURL(key string) string {
	return strings.TrimSuffix(c.cfg.PublicBaseURL, "/") + "/" + key
}

var ErrNotConfigured = errors.New("storage is not configured")

// PresignPut returns a URL the browser may PUT one object to, and nothing else.
//
// contentType is signed, not merely suggested. Leaving it out of the signature
// would let a caller upload a script or an HTML document to a key we chose for
// an image, and have it served from our own domain — stored XSS by way of the
// upload form.
func (c *Client) PresignPut(key, contentType string, expires time.Duration, now time.Time) (string, error) {
	if !c.Configured() {
		return "", ErrNotConfigured
	}

	now = now.UTC()
	stamp := now.Format("20060102T150405Z")
	day := now.Format("20060102")
	credentialScope := strings.Join([]string{day, region, "s3", "aws4_request"}, "/")

	// Path-style: the bucket is the first path segment.
	canonicalURI := "/" + c.cfg.Bucket + "/" + encodePath(key)

	q := url.Values{}
	q.Set("X-Amz-Algorithm", "AWS4-HMAC-SHA256")
	q.Set("X-Amz-Credential", c.cfg.AccessKeyID+"/"+credentialScope)
	q.Set("X-Amz-Date", stamp)
	q.Set("X-Amz-Expires", fmt.Sprintf("%d", int(expires.Seconds())))
	q.Set("X-Amz-SignedHeaders", "content-type;host")

	canonicalHeaders := "content-type:" + contentType + "\n" + "host:" + c.endpoint + "\n"

	canonicalRequest := strings.Join([]string{
		"PUT",
		canonicalURI,
		encodeQuery(q),
		canonicalHeaders,
		"content-type;host",
		// The body is not signed: the browser holds it and we never see it.
		"UNSIGNED-PAYLOAD",
	}, "\n")

	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		stamp,
		credentialScope,
		sha256Hex(canonicalRequest),
	}, "\n")

	signature := hex.EncodeToString(hmacSHA256(signingKey(c.cfg.SecretKey, day), stringToSign))
	q.Set("X-Amz-Signature", signature)

	return "https://" + c.endpoint + canonicalURI + "?" + encodeQuery(q), nil
}

func signingKey(secret, day string) []byte {
	k := hmacSHA256([]byte("AWS4"+secret), day)
	k = hmacSHA256(k, region)
	k = hmacSHA256(k, "s3")
	return hmacSHA256(k, "aws4_request")
}

func hmacSHA256(key []byte, data string) []byte {
	m := hmac.New(sha256.New, key)
	m.Write([]byte(data))
	return m.Sum(nil)
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

// encodeQuery sorts and encodes exactly as SigV4 requires. url.Values.Encode
// happens to sort by key, but it is specified to produce a form encoding rather
// than this one, so the rules are applied here instead of relied upon there.
func encodeQuery(q url.Values) string {
	keys := make([]string, 0, len(q))
	for k := range q {
		keys = append(keys, k)
	}
	sortStrings(keys)
	var b strings.Builder
	for i, k := range keys {
		if i > 0 {
			b.WriteByte('&')
		}
		b.WriteString(encodeRFC3986(k))
		b.WriteByte('=')
		b.WriteString(encodeRFC3986(q.Get(k)))
	}
	return b.String()
}

// encodePath encodes each segment but keeps the separators, so a key with
// slashes stays a path rather than becoming one escaped segment.
func encodePath(key string) string {
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = encodeRFC3986(p)
	}
	return strings.Join(parts, "/")
}

// encodeRFC3986 is AWS's required escaping: unreserved characters pass through,
// everything else is percent-encoded uppercase. net/url is close but encodes a
// space as '+' in queries and leaves some sub-delimiters alone, either of which
// produces a signature mismatch that is tedious to diagnose.
func encodeRFC3986(s string) string {
	const unreserved = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~"
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if strings.IndexByte(unreserved, ch) >= 0 {
			b.WriteByte(ch)
		} else {
			fmt.Fprintf(&b, "%%%02X", ch)
		}
	}
	return b.String()
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}
