// Package migrations carries the schema as files, embedded into the binary so a
// deployed container never depends on anything outside itself.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
