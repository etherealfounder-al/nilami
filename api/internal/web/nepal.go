package web

import "math"

// Representative point for each of Nepal's 77 districts — the area centroid of
// the district's largest polygon, from the district boundaries in
// https://github.com/mesaugat/geoJSON-Nepal (nepal-districts-new.geojson).
//
// Ported from the Next.js app, where these fed a Leaflet map. That map needed
// a JavaScript runtime, so the move to this server dropped it. The data was
// the expensive part and it is good — every entry was cross-checked against
// the province the boundary file assigns it, so the two Nawalparasi and two
// Rukum successor districts are not transposed — so it is kept, and the map is
// drawn as an SVG here instead.
type districtPoint struct {
	Name     string
	Lat, Lng float64
}

var districtPoints = []districtPoint{
	{"Acham", 29.1126, 81.2971},
	{"Arghakhanchi", 27.9085, 83.0793},
	{"Baglung", 28.3475, 83.2505},
	{"Baitadi", 29.5075, 80.5715},
	{"Bajhang", 29.7082, 81.1787},
	{"Bajura", 29.5613, 81.5632},
	{"Banke", 28.0872, 81.8223},
	{"Bara", 27.108, 85.0706},
	{"Bardiya", 28.3837, 81.4015},
	{"Bhaktapur", 27.6777, 85.4408},
	{"Bhojpur", 27.1818, 87.0679},
	{"Chitwan", 27.5849, 84.4345},
	{"Dadeldhura", 29.2231, 80.4891},
	{"Dailekh", 28.8814, 81.6789},
	{"Dang", 27.9641, 82.4104},
	{"Darchula", 29.8919, 80.7919},
	{"Dhading", 27.9547, 84.9602},
	{"Dhankuta", 26.9909, 87.331},
	{"Dhanusha", 26.8287, 86.0339},
	{"Dolakha", 27.7857, 86.1986},
	{"Dolpa", 29.1707, 83.0522},
	{"Doti", 29.1696, 80.8946},
	{"Eastern Rukum", 28.674, 82.8109},
	{"Gorkha", 28.3188, 84.7902},
	{"Gulmi", 28.0939, 83.307},
	{"Humla", 30.0323, 81.8799},
	{"Ilam", 26.8812, 87.9016},
	{"Jajarkot", 28.8654, 82.1679},
	{"Jhapa", 26.5845, 87.9132},
	{"Jumla", 29.2717, 82.2173},
	{"Kailali", 28.7416, 80.8792},
	{"Kalikot", 29.1951, 81.752},
	{"Kanchanpur", 28.8618, 80.3218},
	{"Kapilvastu", 27.6278, 82.9815},
	{"Kaski", 28.3549, 83.9973},
	{"Kathmandu", 27.7282, 85.3474},
	{"Kavrepalanchok", 27.5354, 85.6195},
	{"Khotang", 27.1681, 86.787},
	{"Lalitpur", 27.5397, 85.3427},
	{"Lamjung", 28.2893, 84.4301},
	{"Mahottari", 26.8791, 85.8199},
	{"Makwanpur", 27.47, 85.0792},
	{"Manang", 28.6729, 84.2245},
	{"Morang", 26.6175, 87.4702},
	{"Mugu", 29.6181, 82.3706},
	{"Mustang", 28.9813, 83.8579},
	{"Myagdi", 28.5531, 83.46},
	{"Nawalpur", 27.6874, 84.0622},
	{"Nuwakot", 27.9151, 85.2354},
	{"Okhaldhunga", 27.3295, 86.4187},
	{"Pachthar", 27.115, 87.7758},
	{"Palpa", 27.8174, 83.6237},
	{"Parasi", 27.5283, 83.7387},
	{"Parsa", 27.2397, 84.7802},
	{"Parwat", 28.2113, 83.6789},
	{"Pyuthan", 28.1155, 82.865},
	{"Ramechap", 27.5136, 86.1774},
	{"Rasuwa", 28.1832, 85.4159},
	{"Rautahat", 27.0016, 85.3023},
	{"Rolpa", 28.3442, 82.6281},
	{"Rupandehi", 27.5767, 83.3896},
	{"Salyan", 28.3965, 82.1387},
	{"Sankhuwasabha", 27.5821, 87.2782},
	{"Saptari", 26.5981, 86.7461},
	{"Sarlahi", 26.9862, 85.5653},
	{"Sindhuli", 27.2015, 85.9438},
	{"Sindhupalchok", 27.915, 85.7396},
	{"Siraha", 26.7465, 86.3424},
	{"Solukhumbu", 27.7105, 86.7205},
	{"Sunsari", 26.6506, 87.17},
	{"Surkhet", 28.6412, 81.5864},
	{"Syangja", 28.0211, 83.8032},
	{"Tanahun", 27.9554, 84.2512},
	{"Taplejung", 27.5821, 87.8218},
	{"Terhathum", 27.1544, 87.549},
	{"Udayapur", 26.9031, 86.6813},
	{"Western Rukum", 28.7388, 82.4605},
}

// Nepal's extent, from the points themselves.
const (
	minLat, maxLat = 26.584, 30.032
	minLng, maxLng = 80.322, 87.913
)

// MapPoint is one district, projected into the SVG's coordinate space.
type MapPoint struct {
	District string
	Count    int
	X, Y     float64
	R        float64
	Active   bool
}

// MapViewBox is the SVG's coordinate space.
//
// The height follows from the width by Nepal's true proportions at this
// latitude: a degree of longitude is about 98km here against 111km for a
// degree of latitude, and ignoring that draws a country noticeably too tall.
const (
	MapWidth  = 1000.0
	MapHeight = MapWidth * ((maxLat - minLat) * 111.0) / ((maxLng - minLng) * 98.0)
)

// MapWidth and MapHeight expose the plate's coordinate space to the template,
// which needs both for the SVG's viewBox.
func (p Page) MapWidth() float64  { return MapWidth }
func (p Page) MapHeight() float64 { return MapHeight }

// NepalMap projects every district onto the plate, marking the ones that hold
// notices.
//
// All seventy-seven are plotted, not just the ones with properties: together
// they trace the country's shape, which is what makes the plate legible
// without any boundary data to draw an outline from. The ones holding notices
// are inked and sized by how many.
func (p Page) NepalMap(counts []DistrictCount) []MapPoint {
	held := make(map[string]int, len(counts))
	for _, c := range counts {
		held[c.District] = c.Count
	}

	pts := make([]MapPoint, 0, len(districtPoints))
	for _, d := range districtPoints {
		n := held[d.Name]
		r := 4.5
		if n > 0 {
			// Area, not radius, carries the count, so two notices look twice
			// one rather than four times it.
			r = 7.0 + math.Sqrt(float64(n))*5.0
		}
		pts = append(pts, MapPoint{
			District: d.Name,
			Count:    n,
			X:        (d.Lng - minLng) / (maxLng - minLng) * MapWidth,
			Y:        (maxLat - d.Lat) / (maxLat - minLat) * MapHeight,
			R:        r,
			Active:   n > 0,
		})
	}
	return pts
}
