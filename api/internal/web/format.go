package web

import (
	"strconv"
	"strings"
	"time"

	"github.com/UjjwolKayastha/nilami/api/locales"
)

// Kathmandu is the only timezone these dates mean anything in: a deadline is
// 5pm in Kathmandu whoever is reading.
var Kathmandu = mustLoad("Asia/Kathmandu")

func mustLoad(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		// Falling back rather than refusing to start: a wrong timezone shows a
		// shifted hour, a dead process shows nothing at all.
		return time.FixedZone("+0545", 5*3600+45*60)
	}
	return loc
}

var monthsEN = []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}

// Date is a date as the notices write it: 12 Oct 2026.
func (p Page) Date(t time.Time) string {
	if t.IsZero() {
		return "—"
	}
	t = t.In(Kathmandu)
	return strconv.Itoa(t.Day()) + " " + monthsEN[int(t.Month())-1] + " " + strconv.Itoa(t.Year())
}

// DateTime adds the hour, which a submission deadline needs.
func (p Page) DateTime(t time.Time) string {
	if t.IsZero() {
		return "—"
	}
	local := t.In(Kathmandu)
	hour := local.Hour() % 12
	if hour == 0 {
		hour = 12
	}
	suffix := "am"
	if local.Hour() >= 12 {
		suffix = "pm"
	}
	return p.Date(t) + ", " + strconv.Itoa(hour) + ":" +
		pad2(local.Minute()) + " " + suffix
}

func pad2(n int) string {
	if n < 10 {
		return "0" + strconv.Itoa(n)
	}
	return strconv.Itoa(n)
}

// NPR is the full figure, grouped the way readers here expect.
func (p Page) NPR(amount float64) string {
	return p.S("common.rs") + " " + locales.Group(int64(amount))
}

// NPRCompact is the figure a card shows: crore and lakh, because a column of
// nine-digit numbers is unreadable at a glance.
func (p Page) NPRCompact(amount float64) string {
	switch {
	case amount >= 1e7:
		return trimFloat(amount/1e7, 2) + " " + p.S("common.crore")
	case amount >= 1e5:
		return trimFloat(amount/1e5, 1) + " " + p.S("common.lakh")
	}
	return locales.Group(int64(amount))
}

// trimFloat writes at most places decimals, and none when the value is whole —
// "5 Cr" rather than "5.00 Cr".
func trimFloat(f float64, places int) string {
	s := strconv.FormatFloat(f, 'f', places, 64)
	if strings.Contains(s, ".") {
		s = strings.TrimRight(s, "0")
		s = strings.TrimRight(s, ".")
	}
	return s
}

// TypeLabel and StatusLabel read the translated names out of the dictionary.
func (p Page) TypeLabel(t string) string   { return p.S("common.types." + t) }
func (p Page) StatusLabel(s string) string { return p.S("common.statuses." + s) }

// Countdown is what the card used to compute in the browser every second.
//
// Rendered once, on the server: a page that is otherwise static does not earn
// a JavaScript runtime for a clock, and the figure is only ever read to the
// nearest hour anyway.
func (p Page) Countdown(deadline time.Time) string {
	left := time.Until(deadline)
	if left <= 0 {
		return ""
	}
	days := int(left.Hours()) / 24
	hours := int(left.Hours()) % 24
	if days > 0 {
		return p.T("common.countdown.leftDH", "d", days, "h", hours)
	}
	return p.T("common.countdown.leftHM", "h", hours, "m", int(left.Minutes())%60)
}

// StatusTone is the badge's colour, kept here so one status looks alike on
// every page that shows it.
func (p Page) StatusTone(status string) string {
	switch status {
	case "open":
		return "bg-evergreen-100 text-evergreen-900"
	case "upcoming":
		return "bg-brass-100 text-brass-600"
	case "sold":
		return "bg-brass-500 text-evergreen-950"
	case "cancelled":
		return "bg-danger-soft text-danger"
	default:
		return "bg-cream text-ink-soft"
	}
}
