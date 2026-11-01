package web

import (
	"net/http"
	"net/url"
	"strconv"

	"github.com/UjjwolKayastha/nilami/api/internal/db"
)

// PageSizes are the rows-per-page choices offered. Multiples of 2 and 3, so
// the last row of a grid is never left with a single card in it.
var PageSizes = []int{6, 12, 24, 48}

const defaultPageSize = 12

// IndexParams is the listing page's query string, read once and then used for
// the query, the filter controls and every link the page builds.
type IndexParams struct {
	Status   string
	Type     string
	District string
	Org      string
	Query    string
	Size     int
	Page     int
}

// ReadParams takes only what it recognises. Anything else in the query string
// is dropped rather than carried along, so a stray parameter cannot be
// reflected back into the links this page writes.
func ReadParams(r *http.Request) IndexParams {
	q := r.URL.Query()
	p := IndexParams{
		Status:   q.Get("status"),
		Type:     q.Get("type"),
		District: q.Get("district"),
		Org:      q.Get("org"),
		Query:    q.Get("q"),
		Size:     clampSize(q.Get("size")),
		Page:     atLeastOne(q.Get("page")),
	}
	return p
}

func clampSize(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return defaultPageSize
	}
	for _, allowed := range PageSizes {
		if n == allowed {
			return n
		}
	}
	return defaultPageSize
}

func atLeastOne(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 {
		return 1
	}
	return n
}

func (p IndexParams) toDB() db.AuctionsIndexParams {
	return db.AuctionsIndexParams{
		Status:   p.Status,
		Type:     p.Type,
		District: p.District,
		Org:      p.Org,
		Query:    p.Query,
		Limit:    p.Size,
		Offset:   (p.Page - 1) * p.Size,
	}
}

// Values rebuilds the query string, optionally overriding one key.
//
// Every link on the page goes through this so a filter that is set stays set
// when you page, and a filter that is cleared leaves no empty parameter behind.
func (p IndexParams) Values(override ...string) url.Values {
	v := url.Values{}
	set := func(k, val string) {
		if val != "" {
			v.Set(k, val)
		}
	}
	set("status", p.Status)
	set("type", p.Type)
	set("district", p.District)
	set("org", p.Org)
	set("q", p.Query)
	if p.Size != defaultPageSize {
		v.Set("size", strconv.Itoa(p.Size))
	}
	if p.Page > 1 {
		v.Set("page", strconv.Itoa(p.Page))
	}
	for i := 0; i+1 < len(override); i += 2 {
		key, val := override[i], override[i+1]
		if val == "" {
			v.Del(key)
		} else {
			v.Set(key, val)
		}
		// Changing a filter or the page size returns to the first page: the
		// old page number points somewhere else once the pages are re-cut.
		if key != "page" {
			v.Del("page")
		}
	}
	return v
}

// Href is Values as a link.
func (p IndexParams) Href(override ...string) string {
	v := p.Values(override...)
	if len(v) == 0 {
		return "/auctions"
	}
	return "/auctions?" + v.Encode()
}

// Pages is how many pages the current total divides into.
func (p IndexParams) Pages(total int) int {
	if total <= 0 {
		return 1
	}
	n := total / p.Size
	if total%p.Size != 0 {
		n++
	}
	return n
}

// From and To are the range being shown, for "Showing 1–12 of 240".
func (p IndexParams) From() int { return (p.Page-1)*p.Size + 1 }

func (p IndexParams) To(total int) int {
	to := p.Page * p.Size
	if to > total {
		return total
	}
	return to
}
