export type Lang = "en" | "ne";

const en = {
  nav: {
    auctions: "Auctions",
    howItWorks: "How it works",
    staffSignIn: "Staff sign in",
  },
  common: {
    statuses: {
      draft: "Draft",
      upcoming: "Upcoming",
      open: "Open for Bids",
      closed: "Bidding Closed",
      sold: "Sold",
      cancelled: "Cancelled",
    },
    types: {
      land: "Land",
      house: "House",
      apartment: "Apartment",
      commercial: "Commercial",
    },
    minimumBid: "Minimum bid",
    npr: "NPR",
    rs: "Rs",
    crore: "Cr",
    lakh: "Lakh",
    aana: "Aana",
    countdown: {
      days: "days",
      hrs: "hrs",
      min: "min",
      sec: "sec",
      passed: "Deadline passed",
      leftDH: (d: number, h: number) => `${d}d ${h}h left`,
      leftHM: (h: number, m: number) => `${h}h ${m}m left`,
    },
    soldDot: "Sold",
  },
  home: {
    badge: "Official auction notices",
    title1: "Institution-held properties,",
    title2: "openly auctioned.",
    sub: "Browse collateral properties offered for sale by participating banks and financial institutions — complete with appraised values, minimum bids, terms, and deadlines. Transparent recovery, fair opportunity.",
    ctaBrowse: "Browse auctions",
    ctaHow: "How bidding works",
    statOpen: "Open auctions",
    statValue: "Combined minimum bids (NPR)",
    statSecurity: "Bid security",
    featured: "Featured · Closing soonest",
    kicker: "Current notices",
    underAuction: "Properties under auction",
    viewAll: "View all →",
    processKicker: "The process",
    processTitle: "Bidding, in four steps",
    processSub:
      "Bids are submitted in sealed form at the institution as per each auction notice. This portal keeps every notice, valuation, and deadline in one place.",
    steps: [
      {
        title: "Review the notice",
        body: "Every property carries a published auction notice with the minimum bid, bid security, deadline, and opening date.",
      },
      {
        title: "Inspect the property",
        body: "Visit the property and verify ownership documents with the institution's recovery department before you decide to bid.",
      },
      {
        title: "Deposit bid security",
        body: "Deposit 10% of your quoted amount to the institution's designated account and keep the voucher.",
      },
      {
        title: "Submit your sealed bid",
        body: "Deliver the sealed bid form with your voucher and documents to the stated office before the deadline.",
      },
    ],
    assurance1: "Every sale follows a published notice.",
    assurance2: " No exceptions.",
    assuranceSub:
      "Auctions are conducted by each institution's recovery department under prevailing law, with valuations by licensed appraisers and bids opened publicly at the stated venue.",
    assuranceCta: "See current notices",
  },
  listing: {
    kicker: "Auction notices",
    title: "All properties",
    sub: "Collateral properties currently offered for sale by participating institutions. Filter by type, district, institution, or auction status.",
    searchPlaceholder: "Search title or place…",
    allTypes: "All types",
    allDistricts: "All districts",
    allOrgs: "All institutions",
    anyStatus: "Any status",
    apply: "Apply",
    clear: "Clear",
    count: (n: number) => `${n} propert${n === 1 ? "y" : "ies"}`,
    emptyTitle: "No properties match those filters.",
    emptySub:
      "Try clearing a filter or check back soon — new notices are published regularly.",
  },
  detail: {
    breadcrumb: "Auctions",
    notice: "Notice",
    about: "About this property",
    details: "Property details",
    facts: {
      type: "Property type",
      offeredBy: "Offered by",
      location: "Location",
      address: "Address",
      landArea: "Land area",
      floors: "Floors",
      builtYear: "Built year",
      bedrooms: "Bedrooms",
      bathrooms: "Bathrooms",
      roadAccess: "Road access",
      facing: "Facing",
      loanRef: "Loan reference",
    },
    terms: "Terms of sale",
    docs: "Documents required with your bid",
    appraised: "Appraised value",
    security: (pct: string) => `Bid security (${pct}%)`,
    noticeNo: "Notice number",
    round: "Auction round",
    roundN: (n: number) => `Round ${n}`,
    published: "Notice published",
    deadline: "Bid submission deadline",
    opening: "Bid opening",
    venue: "Opening venue",
    closesIn: "Submission closes in",
    soldAt: "Sold at",
    howToBid: "How to bid",
    howToBidBody:
      "Bids are submitted in sealed form at the institution's recovery department with your bid-security voucher — this portal does not accept online bids.",
    contact: "Contact the institution",
    enquiry: "Enquiry",
  },
  how: {
    kicker: "The process",
    title: "How recovery auctions work",
    sub: "When a loan is not repaid, the lending institution recovers it by auctioning the property pledged as collateral — openly, at a published minimum price, following a fixed legal process. Here is that process, end to end.",
    steps: [
      {
        title: "The institution publishes an auction notice",
        body: "When a borrower defaults, the collateral property is appraised by a licensed valuer and an auction notice is published in national newspapers and on this portal. The notice states the minimum bid, the bid-security amount, the submission deadline, and the date, time, and venue of the bid opening.",
      },
      {
        title: "You inspect the property and documents",
        body: "Every listing on this portal carries the property's key details, photographs, and loan reference. We strongly advise visiting the property in person and reviewing the ownership documents (lalpurja), blueprints, and tax clearances at the institution's recovery department before deciding to bid. Properties are sold on an “as is, where is” basis.",
      },
      {
        title: "You deposit the bid security",
        body: "Deposit 10% of the amount you intend to quote into the institution's designated account, using the account details stated in the notice. Keep the deposit voucher — it must be enclosed with your bid. Unsuccessful bidders are refunded in full after the bid opening.",
      },
      {
        title: "You submit a sealed bid before the deadline",
        body: "Complete the institution's bid form, enclose your deposit voucher, a copy of your citizenship certificate (or company registration and board resolution for firms), and your PAN certificate. Seal the envelope and deliver it to the office stated in the notice before the deadline. Late bids are not accepted.",
      },
      {
        title: "Bids are opened publicly",
        body: "At the stated date and venue, bids are opened in the presence of the bidders who choose to attend. The highest bid at or above the minimum is provisionally accepted, subject to the institution's approval.",
      },
      {
        title: "The winning bidder completes payment",
        body: "The successful bidder must deposit the remaining amount within 35 days of acceptance. Once payment completes, the institution executes the transfer deed and the property is registered in the buyer's name. Registration fees and applicable taxes are borne as per prevailing law.",
      },
    ],
    faqTitle: "Common questions",
    faqs: [
      {
        q: "Can I bid online through this portal?",
        a: "Not yet. This portal publishes notices and property details; bids are submitted in sealed form at the institution as required by the notice. Online sealed bidding is planned for a future release.",
      },
      {
        q: "What happens if the auction fails?",
        a: "If no valid bid meets the minimum, the institution may re-auction the property in a subsequent round, often with a revised minimum bid. Each round appears as a fresh notice on this portal.",
      },
      {
        q: "Is the minimum bid negotiable?",
        a: "No. The minimum bid is fixed by the institution based on the appraised value and outstanding dues, and is stated in the published notice.",
      },
      {
        q: "When is my bid security refunded?",
        a: "Unsuccessful bidders are refunded after the bid opening, typically within 7 working days, to the account named in the bid form.",
      },
      {
        q: "Can the borrower settle before the auction?",
        a: "Yes. If the borrower clears the outstanding dues before the bid opening, the institution may withdraw the auction. Withdrawn notices are marked as cancelled on this portal.",
      },
    ],
    ctaTitle: "Ready to look at what's on offer?",
    ctaSub: "New notices are published regularly. Open auctions show a live countdown to their submission deadline.",
    ctaButton: "Browse current auctions",
  },
  footer: {
    tagline:
      "The official portal for collateral properties offered for sale by participating institutions under prevailing recovery laws. All sales are conducted through published auction notices.",
    browse: "Browse",
    allAuctions: "All auctions",
    openForBids: "Open for bids",
    howItWorks: "How it works",
    platform: "Platform",
    platformLines: ["Nilami Auction Platform", "recovery@nilami.app", "Sun–Fri, 10:00–17:00"],
    noticeTitle: "Notice",
    noticeBody:
      "Properties are sold on an “as is, where is” basis. Bidders must inspect properties and verify documents with the offering institution before bidding.",
    rights: "A multi-institution auction platform (demo).",
  },
};

const ne: typeof en = {
  nav: {
    auctions: "निलामीहरू",
    howItWorks: "प्रक्रिया",
    staffSignIn: "कर्मचारी लगइन",
  },
  common: {
    statuses: {
      draft: "मस्यौदा",
      upcoming: "आगामी",
      open: "बोलका लागि खुला",
      closed: "बोल बन्द",
      sold: "बिक्री भयो",
      cancelled: "रद्द",
    },
    types: {
      land: "जग्गा",
      house: "घर",
      apartment: "अपार्टमेन्ट",
      commercial: "व्यावसायिक",
    },
    minimumBid: "न्यूनतम बोल",
    npr: "रु",
    rs: "रु",
    crore: "करोड",
    lakh: "लाख",
    aana: "आना",
    countdown: {
      days: "दिन",
      hrs: "घण्टा",
      min: "मिनेट",
      sec: "सेकेन्ड",
      passed: "म्याद सकियो",
      leftDH: (d: number, h: number) => `${d} दिन ${h} घण्टा बाँकी`,
      leftHM: (h: number, m: number) => `${h} घण्टा ${m} मिनेट बाँकी`,
    },
    soldDot: "बिक्री",
  },
  home: {
    badge: "आधिकारिक निलामी सूचनाहरू",
    title1: "संस्थाहरूका धितो सम्पत्ति,",
    title2: "खुला निलामीमा।",
    sub: "सहभागी बैंक तथा वित्तीय संस्थाहरूले ऋण असुलीका लागि बिक्रीमा राखेका धितो सम्पत्तिहरू हेर्नुहोस् — मूल्याङ्कन, न्यूनतम बोल, शर्त र म्यादसहित। पारदर्शी असुली, समान अवसर।",
    ctaBrowse: "निलामीहरू हेर्नुहोस्",
    ctaHow: "बोल प्रक्रिया",
    statOpen: "खुला निलामी",
    statValue: "कुल न्यूनतम बोल (रु)",
    statSecurity: "बोल धरौटी",
    featured: "विशेष · चाँडै बन्द हुने",
    kicker: "हालका सूचनाहरू",
    underAuction: "निलामीमा रहेका सम्पत्तिहरू",
    viewAll: "सबै हेर्नुहोस् →",
    processKicker: "प्रक्रिया",
    processTitle: "चार चरणमा बोलकबोल",
    processSub:
      "प्रत्येक निलामी सूचनाबमोजिम बोलपत्र सम्बन्धित संस्थामा शिलबन्दी रूपमा बुझाइन्छ। यो पोर्टलले सबै सूचना, मूल्याङ्कन र म्याद एकै ठाउँमा राख्छ।",
    steps: [
      {
        title: "सूचना अध्ययन गर्नुहोस्",
        body: "प्रत्येक सम्पत्तिसँग न्यूनतम बोल, बोल धरौटी, म्याद र बोल खोलिने मिति उल्लेख भएको प्रकाशित निलामी सूचना हुन्छ।",
      },
      {
        title: "सम्पत्ति निरीक्षण गर्नुहोस्",
        body: "बोल गर्ने निर्णय गर्नुअघि सम्पत्ति स्थलगत निरीक्षण गर्नुहोस् र संस्थाको असुली विभागमा स्वामित्वका कागजात प्रमाणित गर्नुहोस्।",
      },
      {
        title: "बोल धरौटी जम्मा गर्नुहोस्",
        body: "आफूले कबोल गर्ने रकमको १०% संस्थाको तोकिएको खातामा जम्मा गरी भौचर सुरक्षित राख्नुहोस्।",
      },
      {
        title: "शिलबन्दी बोलपत्र बुझाउनुहोस्",
        body: "बोलपत्र फारम, धरौटी भौचर र आवश्यक कागजातसहित शिलबन्दी खाम म्यादभित्र तोकिएको कार्यालयमा बुझाउनुहोस्।",
      },
    ],
    assurance1: "हरेक बिक्री प्रकाशित सूचनाबमोजिम हुन्छ।",
    assurance2: " कुनै अपवाद छैन।",
    assuranceSub:
      "निलामी प्रत्येक संस्थाको असुली विभागले प्रचलित कानुनबमोजिम सञ्चालन गर्छ — मूल्याङ्कन इजाजतप्राप्त मूल्याङ्कनकर्ताबाट हुन्छ र बोलपत्र तोकिएको स्थानमा सार्वजनिक रूपमा खोलिन्छ।",
    assuranceCta: "हालका सूचनाहरू हेर्नुहोस्",
  },
  listing: {
    kicker: "निलामी सूचनाहरू",
    title: "सबै सम्पत्तिहरू",
    sub: "सहभागी संस्थाहरूले हाल बिक्रीमा राखेका धितो सम्पत्तिहरू। प्रकार, जिल्ला, संस्था वा स्थितिअनुसार छान्नुहोस्।",
    searchPlaceholder: "शीर्षक वा स्थान खोज्नुहोस्…",
    allTypes: "सबै प्रकार",
    allDistricts: "सबै जिल्ला",
    allOrgs: "सबै संस्था",
    anyStatus: "जुनसुकै स्थिति",
    apply: "लागू गर्नुहोस्",
    clear: "हटाउनुहोस्",
    count: (n: number) => `${n} वटा सम्पत्ति`,
    emptyTitle: "कुनै सम्पत्ति फेला परेन।",
    emptySub: "फिल्टर हटाएर हेर्नुहोस् वा पछि फेरि आउनुहोस् — नयाँ सूचनाहरू नियमित प्रकाशित हुन्छन्।",
  },
  detail: {
    breadcrumb: "निलामीहरू",
    notice: "सूचना",
    about: "यस सम्पत्तिबारे",
    details: "सम्पत्ति विवरण",
    facts: {
      type: "सम्पत्तिको प्रकार",
      offeredBy: "प्रस्तुत गर्ने संस्था",
      location: "स्थान",
      address: "ठेगाना",
      landArea: "जग्गा क्षेत्रफल",
      floors: "तला",
      builtYear: "निर्माण वर्ष",
      bedrooms: "शयनकक्ष",
      bathrooms: "बाथरूम",
      roadAccess: "बाटो पहुँच",
      facing: "मोहडा",
      loanRef: "ऋण सन्दर्भ",
    },
    terms: "बिक्री शर्तहरू",
    docs: "बोलसँग पेस गर्नुपर्ने कागजातहरू",
    appraised: "मूल्याङ्कित मूल्य",
    security: (pct: string) => `बोल धरौटी (${pct}%)`,
    noticeNo: "सूचना नं.",
    round: "निलामी चरण",
    roundN: (n: number) => `चरण ${n}`,
    published: "सूचना प्रकाशित",
    deadline: "बोल बुझाउने अन्तिम म्याद",
    opening: "बोल खोलिने समय",
    venue: "बोल खोलिने स्थान",
    closesIn: "बुझाउने म्याद बाँकी",
    soldAt: "बिक्री मूल्य",
    howToBid: "कसरी बोल गर्ने",
    howToBidBody:
      "बोलपत्र धरौटी भौचरसहित सम्बन्धित संस्थाको असुली विभागमा शिलबन्दी रूपमा बुझाउनुपर्छ — यस पोर्टलमा अनलाइन बोल स्वीकार गरिँदैन।",
    contact: "संस्थालाई सम्पर्क गर्नुहोस्",
    enquiry: "जिज्ञासा",
  },
  how: {
    kicker: "प्रक्रिया",
    title: "असुली निलामी कसरी चल्छ",
    sub: "ऋण नतिरिएमा ऋणदाता संस्थाले धितो राखिएको सम्पत्ति निलामी गरेर असुली गर्छ — खुला रूपमा, प्रकाशित न्यूनतम मूल्यमा, निश्चित कानुनी प्रक्रियाअनुसार। त्यो पूरा प्रक्रिया यहाँ छ।",
    steps: [
      {
        title: "संस्थाले निलामी सूचना प्रकाशित गर्छ",
        body: "ऋणी चुक्ता गर्न असफल भएपछि धितो सम्पत्तिको मूल्याङ्कन इजाजतप्राप्त मूल्याङ्कनकर्ताबाट गराइन्छ र राष्ट्रिय पत्रपत्रिका तथा यस पोर्टलमा निलामी सूचना प्रकाशित गरिन्छ। सूचनामा न्यूनतम बोल, धरौटी रकम, बुझाउने म्याद र बोल खोलिने मिति, समय र स्थान उल्लेख हुन्छ।",
      },
      {
        title: "सम्पत्ति र कागजात निरीक्षण गर्नुहोस्",
        body: "यस पोर्टलका प्रत्येक विवरणमा सम्पत्तिको मुख्य जानकारी, तस्बिर र ऋण सन्दर्भ हुन्छ। बोल गर्नुअघि सम्पत्ति स्थलगत निरीक्षण गर्न र संस्थाको असुली विभागमा लालपुर्जा, नक्सा र कर चुक्ता प्रमाण हेर्न जोड दिन्छौँ। सम्पत्ति “जस्तो छ, जहाँ छ” अवस्थामा बिक्री हुन्छ।",
      },
      {
        title: "बोल धरौटी जम्मा गर्नुहोस्",
        body: "आफूले कबोल गर्न चाहेको रकमको १०% सूचनामा तोकिएको संस्थाको खातामा जम्मा गर्नुहोस्। भौचर सुरक्षित राख्नुहोस् — यो बोलपत्रसँगै पेस गर्नुपर्छ। असफल बोलकर्ताहरूलाई बोल खोलिएपछि पूरै रकम फिर्ता हुन्छ।",
      },
      {
        title: "म्यादभित्र शिलबन्दी बोलपत्र बुझाउनुहोस्",
        body: "संस्थाको बोलपत्र फारम भरी धरौटी भौचर, नागरिकता प्रमाणपत्रको प्रतिलिपि (फर्मका हकमा कम्पनी दर्ता र सञ्चालक समितिको निर्णय) र प्यान प्रमाणपत्र संलग्न गर्नुहोस्। खाम शिलबन्दी गरी म्यादअघि तोकिएको कार्यालयमा बुझाउनुहोस्। म्याद नाघेका बोल स्वीकार गरिँदैन।",
      },
      {
        title: "बोलपत्र सार्वजनिक रूपमा खोलिन्छ",
        body: "तोकिएको मिति र स्थानमा उपस्थित बोलकर्ताहरूकै रोहबरमा बोलपत्र खोलिन्छ। न्यूनतम मूल्य वा सोभन्दा माथिको सबैभन्दा उच्च बोल संस्थाको स्वीकृतिको अधीनमा रही प्रारम्भिक रूपमा स्वीकार गरिन्छ।",
      },
      {
        title: "सफल बोलकर्ताले भुक्तानी पूरा गर्छ",
        body: "सफल बोलकर्ताले स्वीकृतिको ३५ दिनभित्र बाँकी रकम जम्मा गर्नुपर्छ। भुक्तानी पूरा भएपछि संस्थाले राजीनामा लिखत गरी सम्पत्ति खरिदकर्ताको नाममा दर्ता हुन्छ। रजिष्ट्रेशन दस्तुर र लाग्ने करहरू प्रचलित कानुनबमोजिम हुन्छन्।",
      },
    ],
    faqTitle: "बारम्बार सोधिने प्रश्नहरू",
    faqs: [
      {
        q: "के म यही पोर्टलबाट अनलाइन बोल गर्न सक्छु?",
        a: "अहिले सकिँदैन। यो पोर्टलले सूचना र सम्पत्ति विवरण प्रकाशित गर्छ; बोलपत्र सूचनामा तोकिएबमोजिम संस्थामै शिलबन्दी रूपमा बुझाउनुपर्छ। अनलाइन शिलबन्दी बोल भविष्यको योजना हो।",
      },
      {
        q: "निलामी असफल भए के हुन्छ?",
        a: "न्यूनतम मूल्य पुग्ने कुनै मान्य बोल नआए संस्थाले पछिल्लो चरणमा, प्रायः संशोधित न्यूनतम मूल्यसहित, पुनः निलामी गर्न सक्छ। प्रत्येक चरण यस पोर्टलमा नयाँ सूचनाका रूपमा देखिन्छ।",
      },
      {
        q: "के न्यूनतम बोलमा मोलमोलाइ हुन्छ?",
        a: "हुँदैन। न्यूनतम बोल मूल्याङ्कित मूल्य र बाँकी बक्यौताका आधारमा संस्थाले तोक्छ र प्रकाशित सूचनामा उल्लेख हुन्छ।",
      },
      {
        q: "मेरो बोल धरौटी कहिले फिर्ता हुन्छ?",
        a: "असफल बोलकर्ताहरूलाई बोल खोलिएपछि, सामान्यतया ७ कार्यदिनभित्र, बोलपत्रमा उल्लिखित खातामा फिर्ता गरिन्छ।",
      },
      {
        q: "के ऋणीले निलामीअघि नै फरफारक गर्न सक्छ?",
        a: "सक्छ। बोल खोलिनुअघि ऋणीले बाँकी बक्यौता चुक्ता गरे संस्थाले निलामी फिर्ता लिन सक्छ। फिर्ता लिइएका सूचनाहरू यस पोर्टलमा रद्द भनी चिह्नित हुन्छन्।",
      },
    ],
    ctaTitle: "के-के बिक्रीमा छ, हेर्न तयार हुनुहुन्छ?",
    ctaSub: "नयाँ सूचनाहरू नियमित प्रकाशित हुन्छन्। खुला निलामीहरूमा बुझाउने म्यादसम्मको प्रत्यक्ष उल्टो गणना देखिन्छ।",
    ctaButton: "हालका निलामीहरू हेर्नुहोस्",
  },
  footer: {
    tagline:
      "सहभागी संस्थाहरूले प्रचलित असुली कानुनबमोजिम बिक्रीमा राखेका धितो सम्पत्तिहरूको आधिकारिक पोर्टल। सबै बिक्री प्रकाशित निलामी सूचनामार्फत हुन्छ।",
    browse: "ब्राउज",
    allAuctions: "सबै निलामी",
    openForBids: "खुला निलामी",
    howItWorks: "प्रक्रिया",
    platform: "प्लेटफर्म",
    platformLines: ["निलामी अक्सन प्लेटफर्म", "recovery@nilami.app", "आइत–शुक्र, १०:००–१७:००"],
    noticeTitle: "सूचना",
    noticeBody:
      "सम्पत्तिहरू “जस्तो छ, जहाँ छ” अवस्थामा बिक्री गरिन्छ। बोल गर्नुअघि सम्बन्धित संस्थामा सम्पत्ति निरीक्षण र कागजात प्रमाणीकरण गर्नुहोस्।",
    rights: "बहु-संस्था निलामी प्लेटफर्म (डेमो)।",
  },
};

export const dictionaries = { en, ne };
export type Dict = typeof en;

export function orgName(
  org: { name: string; name_np?: string | null } | null | undefined,
  lang: Lang
): string {
  if (!org) return "—";
  return lang === "ne" && org.name_np ? org.name_np : org.name;
}
