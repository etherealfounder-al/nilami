package web

import (
	"encoding/json"
	"html/template"
	"math"
	"strconv"
	"strings"
)

// Fact is one row of the property details table.
type Fact struct {
	Label string
	Value string
}

// Facts builds that table, leaving out anything the row does not carry.
//
// A column with no value is omitted rather than rendered as a dash: a table of
// dashes reads as missing data about the property, when it usually means the
// field does not apply to that kind of property at all.
func (p Page) Facts() []Fact {
	l, ok := p.Data.(*Listing)
	if !ok {
		return nil
	}
	prop := l.Property
	facts := []Fact{
		{p.S("detail.facts.type"), p.TypeLabel(prop.Type)},
		{p.S("detail.facts.offeredBy"), prop.Organization.Display(p.Lang)},
		{p.S("detail.facts.location"), prop.Where()},
	}
	if prop.Address != "" {
		facts = append(facts, Fact{p.S("detail.facts.address"), prop.Address})
	}
	if area := p.area(prop); area != "" {
		facts = append(facts, Fact{p.S("detail.facts.landArea"), area})
	}
	if prop.RoadAccess != "" {
		facts = append(facts, Fact{p.S("detail.facts.roadAccess"), prop.RoadAccess})
	}
	if prop.BuiltYear != nil && *prop.BuiltYear > 0 {
		facts = append(facts, Fact{p.S("detail.facts.builtYear"), strconv.Itoa(*prop.BuiltYear)})
	}
	// What the building actually is.
	//
	// The editor has always collected these, the database has always stored
	// them and their labels have sat in both dictionaries unused: a notice
	// recorded as four storeys and south-facing told a bidder neither. Each
	// is omitted when absent rather than shown as a dash, because a plot of
	// land has no bedrooms — that is not missing data.
	if prop.Floors != nil && *prop.Floors > 0 {
		facts = append(facts, Fact{p.S("detail.facts.floors"), strconv.Itoa(*prop.Floors)})
	}
	if prop.Bedrooms != nil && *prop.Bedrooms > 0 {
		facts = append(facts, Fact{p.S("detail.facts.bedrooms"), strconv.Itoa(*prop.Bedrooms)})
	}
	if prop.Bathrooms != nil && *prop.Bathrooms > 0 {
		facts = append(facts, Fact{p.S("detail.facts.bathrooms"), strconv.Itoa(*prop.Bathrooms)})
	}
	if prop.Facing != "" {
		facts = append(facts, Fact{p.S("detail.facts.facing"), prop.Facing})
	}
	return facts
}

// area reads as the notices write it: aana first, since that is the unit the
// paperwork uses, with the metric figure beside it when both are recorded.
// Hill-region land measure: 1 ropani = 16 aana, 1 aana = 4 paisa,
// 1 paisa = 4 daam.
const (
	aanaPerRopani = 16
	paisaPerAana  = 4
	daamPerPaisa  = 4
)

// ropaniAana renders a decimal number of aana the way the paperwork writes it.
//
// Areas are stored as aana because that is the one unit every property has,
// but a Nepali notice prints ropani-aana-paisa-daam and a reader comparing
// this page against the newspaper needs the same figure in the same form.
// Rounded to whole daam first, so the parts always sum back to the stored
// value instead of drifting by a fraction nobody can see.
func ropaniAana(aana float64) string {
	totalDaam := int(math.Round(aana * paisaPerAana * daamPerPaisa))
	perRopani := aanaPerRopani * paisaPerAana * daamPerPaisa

	ropani := totalDaam / perRopani
	rest := totalDaam % perRopani
	a := rest / (paisaPerAana * daamPerPaisa)
	rest %= paisaPerAana * daamPerPaisa
	paisa := rest / daamPerPaisa
	daam := rest % daamPerPaisa

	return strconv.Itoa(ropani) + "-" + strconv.Itoa(a) + "-" +
		strconv.Itoa(paisa) + "-" + strconv.Itoa(daam)
}

func (p Page) area(prop Property) string {
	var parts []string
	if prop.LandAreaAana != nil && *prop.LandAreaAana > 0 {
		parts = append(parts, trimFloat(*prop.LandAreaAana, 2)+" "+p.S("common.aana")+
			" ("+ropaniAana(*prop.LandAreaAana)+")")
	}
	if prop.LandAreaSqm != nil && *prop.LandAreaSqm > 0 {
		parts = append(parts, trimFloat(*prop.LandAreaSqm, 2)+" m²")
	}
	return strings.Join(parts, " · ")
}

// JSONLD describes the listing to a search engine in the vocabulary it reads.
//
// Marshalled rather than written as a string: a title with a quote in it would
// otherwise produce a document that fails to parse, and the one thing worse
// than no structured data is structured data a crawler rejects.
func (p Page) JSONLD() template.JS {
	l, ok := p.Data.(*Listing)
	if !ok {
		return ""
	}
	prop := l.Property

	offer := map[string]any{
		"@type":         "Offer",
		"price":         strconv.FormatFloat(l.MinimumBid, 'f', -1, 64),
		"priceCurrency": "NPR",
		"availability":  "https://schema.org/InStock",
	}
	if !l.Open() {
		offer["availability"] = "https://schema.org/SoldOut"
	}
	if p.Canonical != "" {
		offer["url"] = p.Canonical
	}

	doc := map[string]any{
		"@context": "https://schema.org",
		"@type":    "Product",
		"name":     prop.Title,
		"offers":   offer,
		"seller": map[string]any{
			"@type": "Organization",
			"name":  prop.Organization.Display(p.Lang),
		},
	}
	if prop.Description != "" {
		doc["description"] = prop.Description
	}
	if images := imageURLs(prop); len(images) > 0 {
		doc["image"] = images
	}

	raw, err := json.Marshal(doc)
	if err != nil {
		return ""
	}
	return template.JS(raw)
}

func imageURLs(prop Property) []string {
	out := make([]string, 0, len(prop.Images))
	for _, img := range prop.Images {
		out = append(out, img.URL)
	}
	return out
}
