package auth

import (
	"strings"
	"testing"
)

func TestPasswordRoundTrip(t *testing.T) {
	const pw = "correct horse battery staple"
	hash, err := HashPassword(pw)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("not a PHC argon2id string: %q", hash)
	}
	ok, err := VerifyPassword(pw, hash)
	if err != nil || !ok {
		t.Fatalf("verify correct password: ok=%v err=%v", ok, err)
	}
	ok, err = VerifyPassword(pw+"!", hash)
	if err != nil {
		t.Fatalf("verify wrong password errored: %v", err)
	}
	if ok {
		t.Fatal("wrong password verified")
	}
}

// Two hashes of the same password must differ, or the salt is not doing its
// job and identical passwords would be visible as identical rows.
func TestPasswordIsSalted(t *testing.T) {
	a, err := HashPassword("same")
	if err != nil {
		t.Fatal(err)
	}
	b, err := HashPassword("same")
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("two hashes of one password are identical: no salt")
	}
}

// A stored hash carries its own cost parameters, so raising the constants
// later must not lock out the passwords already in the table.
func TestVerifyUsesTheStoredParameters(t *testing.T) {
	// m=16384,t=1,p=1 is weaker than this package now produces.
	const old = "$argon2id$v=19$m=16384,t=1,p=1$Gse3cHIR7L7oyT1FDaRpYg$5KKQK9pBJZmUSDU4VnE4rWJRGKlcKhCSVfpPLTCbLBo"
	if _, err := VerifyPassword("whatever", old); err != nil {
		t.Fatalf("a hash with older parameters must still parse: %v", err)
	}
}

func TestVerifyRejectsMalformedHashes(t *testing.T) {
	for _, bad := range []string{
		"",
		"plaintext",
		"$argon2i$v=19$m=65536,t=3,p=2$c2FsdA$aGFzaA",
		"$argon2id$v=19$m=65536,t=3,p=2$c2FsdA",
	} {
		if ok, err := VerifyPassword("x", bad); ok || err == nil {
			t.Errorf("%q: expected an error and no match, got ok=%v err=%v", bad, ok, err)
		}
	}
}

func TestSessionTokenIsRandomAndHashStable(t *testing.T) {
	a, err := NewSessionToken()
	if err != nil {
		t.Fatal(err)
	}
	b, err := NewSessionToken()
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("two session tokens are identical")
	}
	if len(a) < 40 {
		t.Fatalf("token is too short to be 32 random bytes: %q", a)
	}
	if HashSessionToken(a) != HashSessionToken(a) {
		t.Fatal("hashing is not stable")
	}
	if HashSessionToken(a) == HashSessionToken(b) {
		t.Fatal("different tokens hash alike")
	}
	if strings.Contains(HashSessionToken(a), a) {
		t.Fatal("the hash contains the token")
	}
}
