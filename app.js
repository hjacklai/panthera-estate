/* ─────────────────────────────────────────────
   PANTHERA BERTAM, site script
   i18n + WhatsApp lead form
   ───────────────────────────────────────────── */

const I18N = {
  en: {
    "nav.estate": "The Estate",
    "nav.homes":  "Homes",
    "nav.site":   "Site Plan",
    "nav.location": "Location",
    "nav.register": "Register",
    "nav.cta": "Register Interest",

    "hero.h1.a": "19 exclusive freehold,",
    "hero.h1.b": "park-facing homes.",
    "hero.lede": "16 semi-Ds and 3 bungalows in Bertam, Penang. Every home faces a shared green, and Penang Technology Park is five minutes away.",
    "hero.f1.v": "RM 726k",  "hero.f1.k": "from",
    "hero.f1b.v": "Price", "hero.f1b.k": "on request",
    "home.pill.label": "Choose a home type", "home.pill.semid": "Semi-D", "home.pill.bungalow": "Bungalow",
    "hero.f2.v": "Freehold", "hero.f2.k": "tenure",
    "hero.f3.v": "19",       "hero.f3.k": "homes",
    "hero.f4.v": "5 min",    "hero.f4.k": "to Tech Park",
    "hero.cta.primary": "Register your interest",
    "hero.cta.wa": "WhatsApp Sales",

    "idea.quote.a": "Houses, ",
    "idea.quote.b": "facing the park.",
    "idea.quote.tail": " A neighbourhood, by design.",
    "idea.p1.h": "01 · Courtyard plan",
    "idea.p1.t": "Every home faces the central green.",
    "idea.p1.b": "All nineteen sit around a shared green of over 700 m², a short walk from every front gate.",
    "idea.p2.h": "02 · Right-sized",
    "idea.p2.t": "Generous, not wasteful: 2,006 to 2,642 sq ft.",
    "idea.p3.h": "03 · A known quantity",
    "idea.p3.t": "Tech jobs 5 minutes away, town within 15.",

    "glance.eyebrow": "At a glance",
    "glance.title": "What you're buying into.",
    "glance.lede": "Not just a house. A freehold address in a township quietly on the rise, bought while it is still quiet enough to call home.",
    "g1.k": "Green-facing",     "g1.v": "100%",  "g1.u": "Every home opens to the shared park",
    "g2.k": "The enclave",          "g2.v": "Just 19",     "g2.u": "3 bungalow · 16 semi-D",
    "g3.k": "From",           "g3.v": "RM 726k","g3.u": "Pre-launch 2026 · register early",
    "g5.k": "Central Green",  "g5.v": "700+",    "g5.u": "m²", "g5.s": "Shared open space, never built over",

    "site.note1.h": "Central green",
    "site.note1.t": "Over 700 m² of shared open space.",
    "site.note2.h": "Inner ring road",
    "site.note2.t": "40-foot access roads, dual entry to the taman.",
    "site.note3.h": "Freehold title",
    "site.note3.t": "Individual titles.",
    "site.note4.h": "Flood-free zone",
    "site.note4.t": "Engineered to stay dry.",

    "h.semid.name": "The Semi-D",
    "h.semid.pitch": "A big open-plan kitchen, living and dining, with high ceilings and floor-to-ceiling glass to the garden. Three bedrooms upstairs, one on the ground floor.",
    "h.semid.price.l": "From",
    "h.semid.price.v": "RM 726,000 onwards",
    "h.semid.s1.k": "Built-up", "h.semid.s1.v": "2,006", "h.semid.s1.u": "sq ft",
    "h.semid.s2.k": "Land Size", "h.semid.s2.v": "210–318 m²", "h.semid.s2.u": "2,260–3,423 ft²",
    "h.semid.s3.k": "Bedrooms", "h.semid.s3.v": "4",
    "h.semid.s4.k": "Bathrooms", "h.semid.s4.v": "4",
    "h.semid.s5.k": "Ceilings", "h.semid.s5.v": "2.85–3.5 m",
    "h.semid.s6.k": "Tenure", "h.semid.s6.v": "Freehold",

    "h.bungalow.name": "The Bungalow",
    "h.bungalow.pitch": "The estate's biggest homes, with room for three generations. A ground-floor bedroom and bathroom mean parents or guests skip the stairs, with the rest upstairs.",
    "h.bungalow.price.v": "Price on request",
    "h.bungalow.s1.k": "Built-up", "h.bungalow.s1.v": "2,642", "h.bungalow.s1.u": "sq ft",
    "h.bungalow.s2.k": "Land Size", "h.bungalow.s2.v": "356–493 m²", "h.bungalow.s2.u": "3,832–5,308 ft²",
    "h.bungalow.s3.k": "Bedrooms", "h.bungalow.s3.v": "5",
    "h.bungalow.s4.k": "Bathrooms", "h.bungalow.s4.v": "5",
    "h.bungalow.s5.k": "Ceilings", "h.bungalow.s5.v": "2.85–3.5 m",
    "h.bungalow.s6.k": "Tenure", "h.bungalow.s6.v": "Freehold",

    "pricing.eyebrow": "Pricing",
    "pricing.title": "Honest pricing.",
    "pricing.lede": "Two freehold house types, both facing the central green.",
    "pricing.lede.sd": "The Semi-D: 16 freehold homes facing the central green.",
    "pricing.lede.bg": "The bungalow: 3 freehold homes facing the central green. Price on request.",
    "pricing.frame.bg": "These are pre-launch terms. Bungalow pricing is shared on request while the list is still open before public launch.",
    "pricing.frame": "These are pre-launch prices. From RM 726k for a freehold home that faces its own green, while the list is still open before public launch.",
    "pricing.cta.title": "Want the full lot-by-lot list?",
    "pricing.cta.body": "Reach our sales team on WhatsApp, we'll send the live list with availability and Bumi-lot status the same day.",
    "pricing.cta.btn": "WhatsApp sales →",
    "pricing.leg.bumi": "Bumi lot, 5% discount applied",
    "pricing.leg.note": "All prices subject to SPA · E. & O.E.",
    "calc.eyebrow": "Affordability",
    "calc.title": "What it takes to own one.",
    "calc.lede": "Drag the sliders and the monthly figure updates live. Indicative only; final approval rests with your bank.",

    "loc.eyebrow": "Location",
    "loc.title": "Where you are.",
    "loc.human": "The school is a walk across the road, the surau a few minutes on foot, and the tech park where the work is sits six minutes from your door.",
    "loc.lede": "Just off Jalan Bertam, ten minutes from the expressway. Schools, mall, hospital and mosque all inside a quarter-hour drive.",
    "loc.open": "Open in Google Maps ↗",
    "loc.g1.h": "Daily life",
    "loc.g2.h": "Schools & education",
    "loc.g3.h": "Connectivity",
    "loc.g4.h": "Jobs & industry",
    "loc.g5.h": "Play & lifestyle",
    "loc.amen.heading": "Amenity overview · click a row to fly the map there",

    "faq.eyebrow": "Plain answers",
    "faq.title": "Things buyers ask.",
    "faq.aside.h": "Couldn't find your answer?",
    "faq.aside.b": "Our sales team is on WhatsApp Mon–Sat, 9am to 6pm. Most questions get a reply within the hour.",
    "faq.aside.cta": "Ask on WhatsApp →",
    "faq.q1": "Is the title freehold or leasehold?",
    "faq.q2": "Are foreigners allowed to buy?",
    "faq.q3": "What is a Bumi lot?",
    "faq.q4": "When is handover?",
    "faq.q5": "What's included in the price?",
    "faq.q6": "Can I choose my lot?",
    "faq.q7": "What's the maintenance arrangement?",
    "faq.q8": "Can I extend or modify the house later?",
    "faq.q9": "Do you assist with bank loans?",
    "faq.q10": "What if I'm not ready to buy yet?",
    "faq.a1": "Freehold. The land is Lot 24480, individual titles will be issued at handover. No 99-year clock.",
    "faq.a2": "The mainland threshold is RM 1.8 million per unit, so only bungalow lots may qualify (subject to state consent). Semi-Ds are not eligible. Ask sales for the current rule.",
    "faq.a3": "Six lots are Bumiputera-reserved with a 5% discount, and transfer only to Bumi owners. The other thirteen are unrestricted.",
    "faq.a4": "Estimated Q4 2028, 24 months from SPA signing. The date is fixed in your SPA with an LAD clause, so you're compensated if we run late.",
    "faq.a5": "The full inclusions schedule is being finalised and will be published with the Sale & Purchase Agreement. Registered buyers receive it first.",
    "faq.a6": "Yes, first-come from the published price list. Corner lots (04 and 19) carry a premium; bungalow lots (01–03) are priced by land size.",
    "faq.a7": "A Residents' Association maintains the green, roads, drains and pond from handover, around RM 180 per home a month. Not gated; the layout keeps traffic out.",
    "faq.a8": "Yes, within the approved envelope. Porch enclosure and rear-kitchen extension are pre-approved; streetscape changes need RA & MPSP sign-off. Guideline given at handover.",
    "faq.a9": "Yes. It's a freehold home, so any major bank can finance it, and our team will help with the application. Approval and terms depend on your profile.",
    "faq.a10": "Register anyway. It is free, with no deposit and no obligation, and it holds today's pre-launch price and first pick of the lots you like, for when you are ready.",
    "bertam.eyebrow": "Why Bertam, now",
    "bertam.title": "Bertam is developing.",
    "map.twofinger": "Use two fingers to move the map",
    "hx.scroll": "Scroll",
    "hx.tour.line": "Scroll to walk through every room.",
    "room.walls": "Walls",
    "room.the-house": "The house",
    "room.the-pair": "The pair",
    "room.porch": "Porch",
    "room.entrance-hall": "Entrance hall",
    "room.living": "Living",
    "room.patio": "Patio",
    "room.stair": "Stair",
    "room.master-bedroom": "Master bedroom",
    "room.balcony": "Balcony",
    "room.the-street": "The street",
    "room.the-estate": "The estate",
    "room.bathroom": "Bathroom",
    "room.bathroom-1": "Bathroom 1",
    "room.bathroom-2": "Bathroom 2",
    "room.bedroom-1": "Bedroom 1",
    "room.bedroom-2": "Bedroom 2",
    "room.corridor": "Corridor",
    "room.dining-room": "Dining room",
    "room.dry-kitchen": "Dry kitchen",
    "room.wet-kitchen": "Wet kitchen",
    "room.guest-bathroom": "Guest bathroom",
    "room.guest-bedroom": "Guest bedroom",
    "room.maid-s-room": "Maid's room",
    "room.master-bathroom": "Master bathroom",
    "room.powder-room": "Powder room",
    "room.utility-room": "Utility room",
    "bertam.lede": "Penang Technology Park is about five minutes away. Kulim Hi-Tech Park and Sungai Petani are a short drive. New factories are already running here, and the people who work in them need homes close by.",
    "bertam.thesis": "A freehold home,<br>five minutes from<br>the <span class=\"accent\">new jobs</span>.",
    "bertam.s1u": "Battery-separator plant, open since June 2025, about 6 min away",
    "bertam.s2u": "Electronics, battery and precision manufacturing, launched 2023",
    "bertam.s3u": "Expansion set to be the world's largest 200mm SiC chip fab, phase 1 open since 2024",
    "bertam.s4k": "Setia Fontaines",
    "bertam.s4u": "New industrial park in Bertam, ground broken June 2026",
    "bertam.s5u": "Approved manufacturing investment, up 29% on 2024",
    "bertam.s6u": "Expected from Penang's 2025 approved projects",
    "bertam.close": "Register now and you lock in pre-launch pricing on a freehold home.",
    "cat0.l": "Town",
    "cat0.h": "Bertam becomes a proper town.",
    "cat0.b": "Malls, two hospitals, USM and UiTM campuses and more than a dozen schools. Daily life here is already sorted.",
    "cat1.l": "Tech park",
    "cat1.h": "Penang Technology Park opens in Bertam.",
    "cat1.b": "880 acres of industrial land next to Bertam Indah. The same year, INV commits RM 6.4 billion to a battery-separator plant inside it.",
    "cat2.l": "Running",
    "cat2.h": "INV's first plant opens.",
    "cat2.b": "Phase 1 started in June 2025. Full operation is planned for 2027.",
    "cat2.tag": "Confirmed",
    "cat3.l": "Now",
    "cat3.h": "Panthera opens for registration.",
    "cat3.b": "Setia Fontaines breaks ground on a 509-acre industrial park, and land here still costs far less than on the island.",
    "cat3.tag": "Pre-launch",
    "cat4.l": "Next",
    "cat4.h": "INV aims for full operation.",
    "cat4.b": "More people working minutes away, and more of them looking for a home nearby.",
    "cat5.l": "Your keys",
    "cat5.h": "You move in.",
    "cat5.b": "Bertam keeps filling in around you.",
    "reg.eyebrow": "Register your interest",
    "reg.title": "Be first in line.",
    "reg.lede": "Register and we'll WhatsApp you the full price list, floor plans and brochure, plus first pick of lots before public launch. Claim the home that opens to the green while all nineteen are still on the table. No deposit, no obligation.",
    "trust.1": "Only 19 homes",
    "trust.2": "Freehold title",
    "trust.3": "6 Bumi lots · 5% off",
    "reg.f.name": "Your name",
    "reg.f.phone": "Phone / WhatsApp",
    "reg.f.interest": "Interested in",
    "reg.opt.both": "Both, show me what's available",
    "reg.opt.semid": "Semi-Detached (16 units)",
    "reg.opt.bungalow": "Bungalow (3 units)",
    "reg.submit": "Send via WhatsApp",
    "reg.contact.wa.h": "Faster, chat now",
    "reg.contact.wa.n": "+60 17-598 1858",
    "reg.contact.wa.cta": "Open WhatsApp ↗",
    "reg.contact.dev.h": "Developer",
    "reg.contact.dev.n": "Panthera Development Sdn. Bhd.",
    "reg.contact.dev.b": "Sales enquiries Mon–Sat, 9am–6pm.",
    "reg.contact.fin.h": "Mortgage help",
    "reg.contact.fin.n": "Any major bank",
    "reg.contact.fin.b": "Freehold title, so it's financeable like any home. We help with the application, terms depend on your profile.",

    "footer.tag": "A boutique, thoughtful development in Bertam, Penang.",
    "footer.h.explore": "Explore",
    "footer.h.legal": "Legal",
    "footer.h.contact": "Contact",
    "footer.legal.disclaimer": "Disclaimer",
    "footer.legal.privacy": "Privacy",
    "footer.legal.spa": "SPA terms",
    "footer.copy": "© 2026 Panthera Development Sdn. Bhd.",

    "sketches.b.left":  "Bungalow · Left side",
    "sketches.b.right": "Bungalow · Right side",
    "sketches.s.left":  "Semi-D · Left side",
    "sketches.s.right": "Semi-D · Right side",

    "plans.foot": "Artist's impressions and indicative layouts only. Furniture, finishes, fixtures and final dimensions may vary.",
    "plans.p1": "Bungalow · Ground Floor",
    "plans.p2": "Bungalow · First Floor",
    "plans.p3": "Semi-D · Ground Floor",
    "plans.p4": "Semi-D · First Floor",

    // Keys added Nov 2026 (all-languages pass). nav.* and hx.prev: the 3D app menu and caption
    // (hero-boot.js merges the rest of the EN hx.* set; BM and ZH carry the full set below)
    "nav.pricing": "Pricing",
    "nav.faq": "FAQ",
    "nav.menu": "Site menu",
    "hx.prev": "Previous",
    "hx.next": "Next",
    "hx.close": "Close",
    "hx.stage.role": "3D estate view",
    // pricing cards and mortgage calculator
    "prc.sd.tag": "Semi-Detached", "prc.sd.units": "16 units", "prc.sd.h": "Semi-D",
    "prc.sd.foot": "2,006 ft² built-up · 210–318 m² land · 4 bed · 4 bath",
    "prc.bg.tag": "Bungalow", "prc.bg.units": "3 units", "prc.bg.h": "Bungalow",
    "prc.bg.foot": "2,642 ft² built-up · 356–493 m² land · 5 bed · 5 bath",
    "calc.preset.sd": "Semi-D · RM 726k",
    "calc.price": "Property price", "calc.down": "Downpayment", "calc.down.aria": "Downpayment percent",
    "calc.years": "Loan tenure", "calc.years.u": "years", "calc.years.aria": "Loan tenure years",
    "calc.rate": "Interest rate", "calc.rate.u": "% p.a.",
    "calc.monthly": "Estimated monthly", "calc.per": "per month · principal + interest",
    "calc.principal": "Principal", "calc.interest": "Interest",
    "calc.loan": "Loan amount", "calc.totint": "Total interest", "calc.tottot": "Total repayment",
    "calc.note": "Indicative · MRTA + legal not included · subject to bank assessment",
    "calc.pre.eyebrow": "Take the next step", "calc.pre.title": "Get pre-approved on WhatsApp",
    "calc.pre.sub": "We'll relay your figures to any major bank and come back with an indicative approval within the day.",
    // location map controls and notes
    "map.t.streets": "Map", "map.t.satellite": "Satellite", "map.t.terrain": "Terrain",
    "map.f.all": "All", "map.f.daily": "Daily", "map.f.schools": "Schools", "map.f.lifestyle": "Play & Lifestyle", "map.f.connect": "Connect", "map.f.future": "Jobs & Industry",
    "map.note": "Pinned at the exact site. Drag, zoom or two-finger zoom on mobile. Tap any numbered pin for details. Use the filter chips to show only what matters to you, or hit a row in the list below to fly the map to that amenity.",
    "loc.em.walk": "walkable", "loc.em.across": "across the road", "loc.em.gp": "(GP clinic)", "loc.em.amdi": "(medical / dental institute)",
    // aria-label (data-i18n-aria) and alt text (data-i18n-alt); the alt values are the current alts
    "aria.lang": "Language", "aria.primary": "Primary", "aria.glance": "At a glance", "aria.hometype": "Home type", "aria.why": "Why register now", "aria.wa": "WhatsApp sales", "aria.filter": "Filter amenities",
    "alt.hero": "Aerial view of Panthera Bertam at golden hour: 19 homes around the shared central green, with the neighbourhood around it. 3D render, artist's impression",
    "alt.sd.hero": "Semi-Detached homes at Panthera Bertam at golden hour, artist's impression",
    "alt.sd.wc.front": "Semi-Detached watercolour, front pair, artist's impression",
    "alt.sd.wc.left": "Semi-Detached watercolour, left perspective", "alt.sd.wc.right": "Semi-Detached watercolour, right perspective",
    "alt.sd.gf": "Semi-Detached Ground Floor plan", "alt.sd.ff": "Semi-Detached First Floor plan",
    "alt.bg.hero": "A Panthera Bertam bungalow, front elevation and driveway, artist's impression",
    "alt.bg.wc.front": "Bungalow watercolour, front facade, artist's impression",
    "alt.bg.wc.left": "Bungalow watercolour, left perspective", "alt.bg.wc.right": "Bungalow watercolour, right perspective",
    "alt.bg.gf": "Bungalow Ground Floor plan", "alt.bg.ff": "Bungalow First Floor plan",
    // dock, skip link, top-bar sales label, Bertam stat labels
    "a11y.skip": "Skip to content", "topbar.sales": "Sales · +60 17-598 1858",
    "dock.estate": "Estate", "dock.homes": "Homes", "dock.site": "Site", "dock.location": "Location", "dock.register": "Register ↗",
    "bertam.s1k": "INV New Material", "bertam.s2k": "Penang Tech Park", "bertam.s3k": "Infineon · Kulim", "bertam.s5k": "Penang, 2025", "bertam.s6k": "New jobs"
  },

  bm: {
    "nav.estate": "Kediaman",
    "nav.homes":  "Rumah",
    "nav.site":   "Pelan Tapak",
    "nav.location": "Lokasi",
    "nav.pricing": "Harga",
    "nav.faq": "FAQ",
    "nav.register": "Daftar Minat",
    "nav.cta": "Daftar Minat",

    "hero.h1.a": "19 rumah eksklusif pegangan bebas,",
    "hero.h1.b": "semuanya menghadap taman.",
    "hero.lede": "16 rumah berkembar dan 3 banglo di Bertam, Pulau Pinang. Setiap rumah menghadap taman bersama, dan Penang Technology Park hanya lima minit dari sini.",
    "hero.f1.v": "RM 726k",       "hero.f1.k": "bermula",
    "hero.f1b.v": "Harga", "hero.f1b.k": "atas permintaan",
    "home.pill.label": "Pilih jenis rumah", "home.pill.semid": "Berkembar", "home.pill.bungalow": "Banglo",
    "hero.f2.v": "Pegangan bebas", "hero.f2.k": "milikan",
    "hero.f3.v": "19",            "hero.f3.k": "rumah",
    "hero.f4.v": "5 minit",       "hero.f4.k": "ke Tech Park",
    "hero.cta.primary": "Daftar minat anda",
    "hero.cta.wa": "WhatsApp Jualan",

    "idea.quote.a": "Rumah ",
    "idea.quote.b": "menghadap taman.",
    "idea.quote.tail": " Sebuah kejiranan, terancang.",
    "idea.p1.h": "01 · Pelan halaman",
    "idea.p1.t": "Setiap rumah menghadap taman pusat.",
    "idea.p1.b": "Kesemua sembilan belas rumah mengelilingi taman dikongsi seluas lebih 700 m², dekat sahaja dari setiap pintu pagar.",
    "idea.p2.h": "02 · Saiz yang sesuai",
    "idea.p2.t": "Selesa, tanpa berlebihan: 2,006 hingga 2,642 kaki persegi.",
    "idea.p3.h": "03 · Lokasi yang dikenali",
    "idea.p3.t": "Kerja teknologi 5 minit, bandar dalam 15.",

    "glance.eyebrow": "Ringkasan",
    "glance.title": "Apa yang anda miliki.",
    "glance.lede": "Bukan sekadar rumah. Alamat pegangan bebas dalam sebuah bandar yang sedang bangkit perlahan, dimiliki ketika ia masih cukup tenang untuk dipanggil rumah.",
    "g1.k": "Menghadap taman",  "g1.v": "100%",  "g1.u": "Setiap rumah terbuka ke taman dikongsi",
    "g2.k": "Enklaf",         "g2.v": "Hanya 19",     "g2.u": "3 banglo · 16 berkembar",
    "g3.k": "Bermula",       "g3.v": "RM 726k","g3.u": "Pra-pelancaran 2026 · daftar awal",
    "g5.k": "Kawasan Lapang", "g5.v": "700+",   "g5.u": "m²", "g5.s": "Ruang lapang dikongsi, tidak akan dibina",

    "site.note1.h": "Kawasan lapang",
    "site.note1.t": "Lebih 700 m² ruang terbuka dikongsi.",
    "site.note2.h": "Jalan cincin dalaman",
    "site.note2.t": "Jalan akses 40 kaki, dua pintu masuk ke taman.",
    "site.note3.h": "Pegangan bebas",
    "site.note3.t": "Hak milik individu.",
    "site.note4.h": "Zon bebas banjir",
    "site.note4.t": "Direka untuk kekal kering.",

    "h.semid.name": "Rumah Berkembar",
    "h.semid.pitch": "Dapur, ruang tamu dan ruang makan konsep terbuka yang luas, dengan siling tinggi dan kaca dari lantai ke siling ke taman. Tiga bilik tidur di tingkat atas, satu di tingkat bawah.",
    "h.semid.price.l": "Bermula",
    "h.semid.price.v": "RM 726,000",
    "h.semid.s1.k": "Keluasan binaan", "h.semid.s1.v": "2,006", "h.semid.s1.u": "kp",
    "h.semid.s2.k": "Saiz tanah", "h.semid.s2.v": "210–318 m²", "h.semid.s2.u": "2,260–3,423 kp",
    "h.semid.s3.k": "Bilik tidur", "h.semid.s3.v": "4",
    "h.semid.s4.k": "Bilik air", "h.semid.s4.v": "4",
    "h.semid.s5.k": "Tinggi siling", "h.semid.s5.v": "2.85–3.5 m",
    "h.semid.s6.k": "Pegangan", "h.semid.s6.v": "Bebas",

    "h.bungalow.name": "Banglo",
    "h.bungalow.pitch": "Rumah terbesar di taman ini, cukup ruang untuk tiga generasi. Bilik tidur dan bilik air di tingkat bawah bermakna ibu bapa atau tetamu tidak perlu naik tangga, selebihnya di tingkat atas.",
    "h.bungalow.price.v": "Harga atas permintaan",
    "h.bungalow.s1.k": "Keluasan binaan", "h.bungalow.s1.v": "2,642", "h.bungalow.s1.u": "kp",
    "h.bungalow.s2.k": "Saiz tanah", "h.bungalow.s2.v": "356–493 m²", "h.bungalow.s2.u": "3,832–5,308 kp",
    "h.bungalow.s3.k": "Bilik tidur", "h.bungalow.s3.v": "5",
    "h.bungalow.s4.k": "Bilik air", "h.bungalow.s4.v": "5",
    "h.bungalow.s5.k": "Tinggi siling", "h.bungalow.s5.v": "2.85–3.5 m",
    "h.bungalow.s6.k": "Pegangan", "h.bungalow.s6.v": "Bebas",

    "pricing.eyebrow": "Harga",
    "pricing.title": "Harga yang jujur.",
    "pricing.lede": "Dua jenis rumah pegangan bebas, kedua-duanya menghadap taman pusat.",
    "pricing.lede.sd": "Berkembar: 16 rumah pegangan bebas menghadap taman pusat.",
    "pricing.lede.bg": "Banglo: 3 rumah pegangan bebas menghadap taman pusat. Harga atas permintaan.",
    "pricing.frame.bg": "Ini terma pra-pelancaran. Harga banglo diberikan atas permintaan, selagi senarai masih terbuka sebelum pelancaran umum.",
    "pricing.frame": "Ini harga pra-pelancaran. Dari RM 726k untuk rumah pegangan bebas yang menghadap kehijauannya sendiri, selagi senarai masih terbuka sebelum pelancaran umum.",
    "pricing.cta.title": "Mahukan senarai harga lot-demi-lot?",
    "pricing.cta.body": "Hubungi pasukan jualan kami di WhatsApp, kami hantar senarai terkini dengan status ketersediaan & lot Bumi pada hari yang sama.",
    "pricing.cta.btn": "WhatsApp jualan →",
    "pricing.leg.bumi": "Lot Bumi, diskaun 5% diterapkan",
    "pricing.leg.note": "Semua harga tertakluk kepada SPA · E. & O.E.",
    "calc.eyebrow": "Kemampuan",
    "calc.title": "Apa yang diperlukan untuk memiliki satu.",
    "calc.lede": "Tarik penggelongsor dan angka bulanan dikemas kini secara langsung. Anggaran sahaja; kelulusan akhir terletak pada bank anda.",

    "loc.eyebrow": "Lokasi",
    "loc.title": "Di mana anda berada.",
    "loc.human": "Sekolah hanya seberang jalan, surau beberapa minit berjalan kaki, dan taman teknologi tempat kerja berada enam minit dari pintu rumah anda.",
    "loc.lede": "Di tepi Jalan Bertam, sepuluh minit dari lebuhraya. Sekolah, mal, hospital dan masjid dalam pemanduan suku jam.",
    "loc.open": "Buka di Google Maps ↗",
    "loc.g1.h": "Kehidupan harian",
    "loc.g2.h": "Sekolah & pendidikan",
    "loc.g3.h": "Sambungan",
    "loc.g4.h": "Pekerjaan & industri",
    "loc.g5.h": "Riadah & gaya hidup",
    "loc.amen.heading": "Ringkasan kemudahan · klik satu baris untuk melihatnya di peta",

    "faq.eyebrow": "Jawapan jelas",
    "faq.title": "Soalan lazim pembeli.",
    "faq.aside.h": "Tak jumpa jawapan anda?",
    "faq.aside.b": "Pasukan jualan kami di WhatsApp Isnin–Sabtu, 9 pagi hingga 6 petang. Kebanyakan soalan dijawab dalam sejam.",
    "faq.aside.cta": "Tanya di WhatsApp →",
    "faq.q1": "Pegangan bebas atau pajakan?",
    "faq.q2": "Bolehkah warga asing membeli?",
    "faq.q3": "Apa itu lot Bumi?",
    "faq.q4": "Bila penyerahan?",
    "faq.q5": "Apa yang termasuk dalam harga?",
    "faq.q6": "Bolehkah saya pilih lot?",
    "faq.q7": "Bagaimana pengurusan penyelenggaraan?",
    "faq.q8": "Bolehkah saya ubah suai rumah kemudian?",
    "faq.q9": "Adakah anda membantu pinjaman bank?",
    "faq.q10": "Bagaimana jika saya belum bersedia membeli?",
    "faq.a1": "Pegangan bebas. Tanah ialah Lot 24480, hak milik individu dikeluarkan semasa penyerahan. Tiada kiraan 99 tahun.",
    "faq.a2": "Had tanah besar ialah RM 1.8 juta seunit, jadi hanya lot banglo mungkin layak (tertakluk kebenaran negeri). Berkembar tidak layak. Tanya jualan untuk peraturan terkini.",
    "faq.a3": "Enam lot dikhaskan untuk Bumiputera dengan diskaun 5%, dan hanya boleh dipindah milik kepada pemilik Bumi. Tiga belas yang lain tiada sekatan.",
    "faq.a4": "Dianggarkan S4 2028, 24 bulan dari tandatangan SPA. Tarikh ditetapkan dalam SPA anda dengan klausa LAD, jadi anda diberi pampasan jika kami lewat.",
    "faq.a5": "Senarai penuh perkara yang termasuk sedang dimuktamadkan dan akan diterbitkan bersama Perjanjian Jual Beli. Pembeli berdaftar menerimanya terlebih dahulu.",
    "faq.a6": "Ya, mengikut giliran daripada senarai harga. Lot penjuru (04 dan 19) ada premium; lot banglo (01–03) dihargai mengikut saiz tanah.",
    "faq.a7": "Persatuan Penduduk menyelenggara taman, jalan, longkang dan kolam dari penyerahan, sekitar RM 180 sebulan setiap rumah. Tidak berpagar; susun atur menghalang lalu lintas.",
    "faq.a8": "Ya, dalam lingkungan yang diluluskan. Penutup porch dan sambungan dapur belakang telah pra-lulus; perubahan fasad perlu kelulusan PP & MPSP. Garis panduan diberi semasa penyerahan.",
    "faq.a9": "Ya. Ia rumah pegangan bebas, jadi mana-mana bank utama boleh membiayainya, dan pasukan kami akan bantu dengan permohonan. Kelulusan dan terma bergantung pada profil anda.",
    "faq.a10": "Daftar juga. Ia percuma, tanpa deposit dan tanpa obligasi, dan ia menyimpan harga pra-pelancaran hari ini serta pilihan utama lot yang anda suka, untuk bila anda bersedia.",
    "bertam.eyebrow": "Mengapa Bertam, sekarang",
    "bertam.title": "Bertam sedang membangun.",
    "map.twofinger": "Guna dua jari untuk menggerakkan peta",
    "hx.scroll": "Tatal",
    "hx.tour.line": "Tatal untuk melawat setiap bilik.",
    "room.walls": "Dinding",
    "room.the-house": "Rumah",
    "room.the-pair": "Pasangan berkembar",
    "room.porch": "Anjung",
    "room.entrance-hall": "Ruang masuk",
    "room.living": "Ruang tamu",
    "room.patio": "Patio",
    "room.stair": "Tangga",
    "room.master-bedroom": "Bilik tidur utama",
    "room.balcony": "Balkoni",
    "room.the-street": "Jalan",
    "room.the-estate": "Taman perumahan",
    "room.bathroom": "Bilik air",
    "room.bathroom-1": "Bilik air 1",
    "room.bathroom-2": "Bilik air 2",
    "room.bedroom-1": "Bilik tidur 1",
    "room.bedroom-2": "Bilik tidur 2",
    "room.corridor": "Koridor",
    "room.dining-room": "Ruang makan",
    "room.dry-kitchen": "Dapur kering",
    "room.wet-kitchen": "Dapur basah",
    "room.guest-bathroom": "Bilik air tetamu",
    "room.guest-bedroom": "Bilik tidur tetamu",
    "room.maid-s-room": "Bilik pembantu",
    "room.master-bathroom": "Bilik air utama",
    "room.powder-room": "Tandas tetamu",
    "room.utility-room": "Bilik utiliti",
    "bertam.lede": "Penang Technology Park kira-kira lima minit dari sini. Kulim Hi-Tech Park dan Sungai Petani pun dekat sahaja. Kilang-kilang baharu sudah beroperasi, dan pekerjanya perlukan rumah berdekatan.",
    "bertam.thesis": "Rumah pegangan bebas,<br>lima minit dari<br><span class=\"accent\">peluang kerja baharu</span>.",
    "bertam.s1u": "Kilang pemisah bateri, beroperasi sejak Jun 2025, kira-kira 6 minit dari sini",
    "bertam.s2u": "Pembuatan elektronik, bateri dan kejuruteraan jitu, dilancarkan 2023",
    "bertam.s3u": "Pembesaran bakal menjadi kilang cip SiC 200mm terbesar dunia, fasa 1 dibuka sejak 2024",
    "bertam.s4k": "Setia Fontaines",
    "bertam.s4u": "Taman perindustrian baharu di Bertam, pecah tanah Jun 2026",
    "bertam.s5u": "Pelaburan pembuatan diluluskan, naik 29% berbanding 2024",
    "bertam.s6u": "Dijangka daripada projek diluluskan Pulau Pinang 2025",
    "bertam.close": "Daftar sekarang untuk mengunci harga pra-pelancaran rumah pegangan bebas.",
    "cat0.l": "Bandar",
    "cat0.h": "Bertam menjadi bandar yang lengkap.",
    "cat0.b": "Pusat beli-belah, dua hospital, kampus USM dan UiTM serta lebih sedozen sekolah. Keperluan harian sudah tersedia.",
    "cat1.l": "Taman teknologi",
    "cat1.h": "Penang Technology Park dibuka di Bertam.",
    "cat1.b": "880 ekar tanah industri bersebelahan Bertam Indah. Pada tahun yang sama, INV melabur RM 6.4 bilion untuk kilang pemisah bateri di dalamnya.",
    "cat2.l": "Beroperasi",
    "cat2.h": "Kilang pertama INV dibuka.",
    "cat2.b": "Fasa 1 bermula Jun 2025. Operasi penuh disasarkan pada 2027.",
    "cat2.tag": "Disahkan",
    "cat3.l": "Sekarang",
    "cat3.h": "Panthera dibuka untuk pendaftaran.",
    "cat3.b": "Setia Fontaines memulakan taman perindustrian 509 ekar, dan harga tanah di sini masih jauh lebih rendah daripada di pulau.",
    "cat3.tag": "Pra-pelancaran",
    "cat4.l": "Seterusnya",
    "cat4.h": "INV menyasarkan operasi penuh.",
    "cat4.b": "Lebih ramai bekerja beberapa minit dari sini, dan lebih ramai mencari rumah berdekatan.",
    "cat5.l": "Kunci rumah",
    "cat5.h": "Anda berpindah masuk.",
    "cat5.b": "Bertam terus berkembang di sekeliling anda.",
    "reg.eyebrow": "Daftar minat anda",
    "reg.title": "Jadilah yang pertama.",
    "reg.lede": "Daftar dan kami akan WhatsApp anda senarai harga penuh, pelan lantai dan brosur, serta pilihan lot terdahulu sebelum pelancaran umum. Pilih rumah yang menghadap kehijauan selagi kesemua sembilan belas masih ada. Tiada deposit, tiada obligasi.",
    "trust.1": "Hanya 19 rumah",
    "trust.2": "Pegangan bebas",
    "trust.3": "6 lot Bumi · diskaun 5%",
    "reg.f.name": "Nama anda",
    "reg.f.phone": "Telefon / WhatsApp",
    "reg.f.interest": "Berminat dengan",
    "reg.opt.both": "Kedua-duanya, tunjukkan yang tersedia",
    "reg.opt.semid": "Rumah Berkembar (16 unit)",
    "reg.opt.bungalow": "Banglo (3 unit)",
    "reg.submit": "Hantar melalui WhatsApp",
    "reg.contact.wa.h": "Lebih cepat, borak sekarang",
    "reg.contact.wa.n": "+60 17-598 1858",
    "reg.contact.wa.cta": "Buka WhatsApp ↗",
    "reg.contact.dev.h": "Pemaju",
    "reg.contact.dev.n": "Panthera Development Sdn. Bhd.",
    "reg.contact.dev.b": "Pertanyaan jualan Isnin–Sabtu, 9pg–6ptg.",
    "reg.contact.fin.h": "Bantuan pinjaman",
    "reg.contact.fin.n": "Mana-mana bank utama",
    "reg.contact.fin.b": "Hak milik pegangan bebas, jadi boleh dibiayai seperti rumah biasa. Kami bantu permohonan, terma bergantung pada profil anda.",

    "footer.tag": "Pembangunan butik yang dirancang dengan teliti di Bertam, Pulau Pinang.",
    "footer.h.explore": "Layari",
    "footer.h.legal": "Undang-undang",
    "footer.h.contact": "Hubungi",
    "footer.legal.disclaimer": "Penafian",
    "footer.legal.privacy": "Privasi",
    "footer.legal.spa": "Terma SPA",
    "footer.copy": "© 2026 Panthera Development Sdn. Bhd.",

    "sketches.b.left":  "Banglo · Sisi kiri",
    "sketches.b.right": "Banglo · Sisi kanan",
    "sketches.s.left":  "Berkembar · Sisi kiri",
    "sketches.s.right": "Berkembar · Sisi kanan",

    "plans.foot": "Tafsiran artis dan susun atur indikatif sahaja. Perabot, kemasan, lekapan dan dimensi akhir mungkin berbeza.",
    "plans.p1": "Banglo · Tingkat Bawah",
    "plans.p2": "Banglo · Tingkat Atas",
    "plans.p3": "Berkembar · Tingkat Bawah",
    "plans.p4": "Berkembar · Tingkat Atas",

    // Keys added Nov 2026 (all-languages pass): the 3D app (hx.*), pricing cards, calculator,
    // map controls, aria-label / alt text, dock and stat labels
    "nav.menu": "Menu laman",
    "hx.optin": "Lihat kediaman dalam 3D",
    "hx.optin.note": "kira-kira 1.6 MB",
    "hx.loading": "Memuatkan kediaman",
    "hx.stage": "Paparan 3D kediaman",
    "hx.stage.role": "Paparan 3D kediaman",
    "hx.l1": "16 rumah berkembar dan 3 banglo.",
    "hx.l2": "Taman permainan kanak-kanak di taman pusat.",
    "hx.l3": "Tatal ke bawah, kemudian jelajah dalam mana-mana rumah.",
    "hx.l3app": "Seret untuk melihat sekeliling, kemudian jelajah dalam mana-mana rumah.",
    "hx.pins": "Tempat dalam kediaman",
    "hx.pin.semid": "Berkembar",
    "hx.pin.bungalow": "Banglo",
    "hx.pin.features": "Ciri-ciri tapak",
    "hx.pin.location": "Lokasi",
    "hx.next": "Seterusnya",
    "hx.prev": "Sebelumnya",
    "hx.sound": "Bunyi suasana desa",
    "hx.walk": "Jelajah dalam rumah",
    "hx.walk.sd": "Jelajah dalam rumah Berkembar →",
    "hx.walk.bg": "Jelajah dalam Banglo →",
    "hx.close": "Tutup",
    "hx.tod": "Waktu",
    "hx.tod.day": "Siang",
    "hx.tod.golden": "Senja",
    "hx.tod.night": "Malam",
    "hx.choose": "Pilih rumah",
    "hx.tour": "Lawatan maya 3D",
    "hx.back": "Kembali ke kediaman",
    "hx.prep": "Menyediakan bilik",
    "hx.other.semid": "Jelajah rumah Berkembar",
    "hx.other.bungalow": "Jelajah Banglo",
    "hx.loc.back": "Kembali ke kediaman 3D",
    "hx.gallery": "Galeri",
    "prc.sd.tag": "Berkembar", "prc.sd.units": "16 unit", "prc.sd.h": "Berkembar",
    "prc.sd.foot": "Binaan 2,006 ft² · tanah 210–318 m² · 4 bilik tidur · 4 bilik air",
    "prc.bg.tag": "Banglo", "prc.bg.units": "3 unit", "prc.bg.h": "Banglo",
    "prc.bg.foot": "Binaan 2,642 ft² · tanah 356–493 m² · 5 bilik tidur · 5 bilik air",
    "calc.preset.sd": "Berkembar · RM 726k",
    "calc.price": "Harga hartanah", "calc.down": "Wang pendahuluan", "calc.down.aria": "Peratus wang pendahuluan",
    "calc.years": "Tempoh pinjaman", "calc.years.u": "tahun", "calc.years.aria": "Tempoh pinjaman dalam tahun",
    "calc.rate": "Kadar faedah", "calc.rate.u": "% setahun",
    "calc.monthly": "Anggaran ansuran bulanan", "calc.per": "sebulan · prinsipal + faedah",
    "calc.principal": "Prinsipal", "calc.interest": "Faedah",
    "calc.loan": "Jumlah pinjaman", "calc.totint": "Jumlah faedah", "calc.tottot": "Jumlah bayaran balik",
    "calc.note": "Anggaran sahaja · tidak termasuk MRTA dan kos guaman · tertakluk kepada penilaian bank",
    "calc.pre.eyebrow": "Langkah seterusnya", "calc.pre.title": "Dapatkan pra-kelulusan pinjaman melalui WhatsApp",
    "calc.pre.sub": "Kami akan hantar angka anda kepada mana-mana bank utama dan maklumkan anggaran kelulusan pada hari yang sama.",
    "map.t.streets": "Peta", "map.t.satellite": "Satelit", "map.t.terrain": "Rupa bumi",
    "map.f.all": "Semua", "map.f.daily": "Harian", "map.f.schools": "Sekolah", "map.f.lifestyle": "Riadah & Gaya Hidup", "map.f.connect": "Perhubungan", "map.f.future": "Pekerjaan & Industri",
    "map.note": "Ditanda di lokasi tapak sebenar. Seret, zum, atau zum dengan dua jari di telefon. Ketik mana-mana pin bernombor untuk butiran. Guna cip penapis untuk memaparkan perkara yang penting bagi anda, atau ketik satu baris dalam senarai di bawah untuk terus ke kemudahan itu di peta.",
    "loc.em.walk": "boleh berjalan kaki", "loc.em.across": "di seberang jalan", "loc.em.gp": "(klinik am)", "loc.em.amdi": "(institut perubatan / pergigian)",
    "aria.lang": "Bahasa", "aria.primary": "Navigasi utama", "aria.glance": "Sekilas pandang", "aria.hometype": "Jenis rumah", "aria.why": "Kenapa daftar sekarang", "aria.wa": "WhatsApp jualan", "aria.filter": "Tapis kemudahan",
    "alt.hero": "Pandangan udara Panthera Bertam pada waktu senja: 19 rumah mengelilingi taman pusat yang dikongsi, bersama kejiranan di sekitarnya. Paparan 3D, gambaran artis",
    "alt.sd.hero": "Rumah berkembar di Panthera Bertam pada waktu senja, gambaran artis",
    "alt.sd.wc.front": "Lukisan cat air rumah berkembar, pasangan hadapan, gambaran artis",
    "alt.sd.wc.left": "Lukisan cat air rumah berkembar, perspektif kiri", "alt.sd.wc.right": "Lukisan cat air rumah berkembar, perspektif kanan",
    "alt.sd.gf": "Pelan tingkat bawah rumah berkembar", "alt.sd.ff": "Pelan tingkat atas rumah berkembar",
    "alt.bg.hero": "Banglo Panthera Bertam, pandangan hadapan dan laluan masuk kereta, gambaran artis",
    "alt.bg.wc.front": "Lukisan cat air banglo, fasad hadapan, gambaran artis",
    "alt.bg.wc.left": "Lukisan cat air banglo, perspektif kiri", "alt.bg.wc.right": "Lukisan cat air banglo, perspektif kanan",
    "alt.bg.gf": "Pelan tingkat bawah banglo", "alt.bg.ff": "Pelan tingkat atas banglo",
    "a11y.skip": "Langkau ke kandungan", "topbar.sales": "Jualan · +60 17-598 1858",
    "dock.estate": "Kediaman", "dock.homes": "Rumah", "dock.site": "Tapak", "dock.location": "Lokasi", "dock.register": "Daftar ↗",
    "bertam.s1k": "INV New Material", "bertam.s2k": "Penang Tech Park", "bertam.s3k": "Infineon · Kulim", "bertam.s5k": "Pulau Pinang, 2025", "bertam.s6k": "Pekerjaan baharu"
  },

  zh: {
    "nav.estate": "项目概览",
    "nav.homes":  "房屋",
    "nav.site":   "总平面",
    "nav.location": "位置",
    "nav.pricing": "价格",
    "nav.faq": "常见问题",
    "nav.register": "登记意向",
    "nav.cta": "登记意向",

    "hero.h1.a": "仅此 19 间永久地契住宅，",
    "hero.h1.b": "全部面向公园。",
    "hero.lede": "位于槟城 Bertam 的 16 间半独立式与 3 间独立式洋房。每间都面向共享绿地，距槟城科技园仅五分钟车程。",
    "hero.f1.v": "RM 726k",  "hero.f1.k": "起",
    "hero.f1b.v": "价格", "hero.f1b.k": "面议",
    "home.pill.label": "选择房型", "home.pill.semid": "半独立式", "home.pill.bungalow": "独立式",
    "hero.f2.v": "永久地契",  "hero.f2.k": "产权",
    "hero.f3.v": "19",       "hero.f3.k": "户",
    "hero.f4.v": "5 分钟",    "hero.f4.k": "至科技园",
    "hero.cta.primary": "登记您的意向",
    "hero.cta.wa": "WhatsApp 销售",

    "idea.quote.a": "房屋，",
    "idea.quote.b": "面向公园。",
    "idea.quote.tail": " 用心设计的社区。",
    "idea.p1.h": "01 · 庭院式布局",
    "idea.p1.t": "每户均面向中央绿地。",
    "idea.p1.b": "十九户围绕逾 700 平方米的共享绿地，每家出门走几步就到。",
    "idea.p2.h": "02 · 合适的尺度",
    "idea.p2.t": "宽敞而不浪费：2,006 至 2,642 平方英尺。",
    "idea.p3.h": "03 · 熟悉的好地段",
    "idea.p3.t": "科技工作 5 分钟，市镇 15 分钟内。",

    "glance.eyebrow": "一目了然",
    "glance.title": "您所购买的一切。",
    "glance.lede": "不只是一栋房子。这是一个永久地契的门牌，落在一座正静静崛起的市镇，而您在它仍然宁静、仍能称之为家的时候入手。",
    "g1.k": "面向绿地", "g1.v": "100%",  "g1.u": "每户都向共享公园敞开",
    "g2.k": "私密社区",        "g2.v": "仅 19 户",     "g2.u": "3 独立 · 16 半独立",
    "g3.k": "起价",        "g3.v": "RM 726k","g3.u": "2026 预发布 · 提早登记",
    "g5.k": "中央绿地",     "g5.v": "700+",    "g5.u": "m²", "g5.s": "永久共享开放空间，永不建房",

    "site.note1.h": "中央绿地",
    "site.note1.t": "逾 700 m² 的共享开放空间。",
    "site.note2.h": "内部环道",
    "site.note2.t": "40 英尺宽的进出道路，双入口通往园区。",
    "site.note3.h": "永久地契",
    "site.note3.t": "个别地契。",
    "site.note4.h": "无水患区",
    "site.note4.t": "工程排水，保持干爽。",

    "h.semid.name": "半独立式",
    "h.semid.pitch": "开放式厨房、客厅与餐厅连成一片，楼底挑高，落地玻璃直通花园。楼上三间睡房，楼下一间。",
    "h.semid.price.l": "起价",
    "h.semid.price.v": "RM 726,000",
    "h.semid.s1.k": "建筑面积", "h.semid.s1.v": "2,006", "h.semid.s1.u": "平方英尺",
    "h.semid.s2.k": "土地面积", "h.semid.s2.v": "210–318 m²", "h.semid.s2.u": "2,260–3,423 平方英尺",
    "h.semid.s3.k": "卧室", "h.semid.s3.v": "4",
    "h.semid.s4.k": "浴室", "h.semid.s4.v": "4",
    "h.semid.s5.k": "净高", "h.semid.s5.v": "2.85–3.5 米",
    "h.semid.s6.k": "地契", "h.semid.s6.v": "永久",

    "h.bungalow.name": "独立式",
    "h.bungalow.pitch": "本项目最大的住宅，足以容纳三代同堂。楼下设有睡房和浴室，长辈或访客无需上下楼梯，其余在楼上。",
    "h.bungalow.price.v": "价格面议",
    "h.bungalow.s1.k": "建筑面积", "h.bungalow.s1.v": "2,642", "h.bungalow.s1.u": "平方英尺",
    "h.bungalow.s2.k": "土地面积", "h.bungalow.s2.v": "356–493 m²", "h.bungalow.s2.u": "3,832–5,308 平方英尺",
    "h.bungalow.s3.k": "卧室", "h.bungalow.s3.v": "5",
    "h.bungalow.s4.k": "浴室", "h.bungalow.s4.v": "5",
    "h.bungalow.s5.k": "净高", "h.bungalow.s5.v": "2.85–3.5 米",
    "h.bungalow.s6.k": "地契", "h.bungalow.s6.v": "永久",

    "pricing.eyebrow": "价格",
    "pricing.title": "坦诚定价。",
    "pricing.lede": "两种永久地契户型，皆面向中央花园。",
    "pricing.lede.sd": "半独立式：16 间永久地契住宅，面向中央花园。",
    "pricing.lede.bg": "独立式：3 间永久地契住宅，面向中央花园。价格面议。",
    "pricing.frame.bg": "这是预发布条款。独立式价格面议，趁名单在公开发布前仍然开放。",
    "pricing.frame": "这是预发布价格。永久地契、面向自家绿地的家，RM 726k 起，趁名单在公开发布前仍然开放。",
    "pricing.cta.title": "需要完整逐栋价目表?",
    "pricing.cta.body": "WhatsApp 联系销售，我们当天发送实时价目表、库存与土著保留地信息。",
    "pricing.cta.btn": "WhatsApp 销售 →",
    "pricing.leg.bumi": "土著保留地，已计入 5% 折扣",
    "pricing.leg.note": "所有价格以 SPA 为准 · E. & O.E.",
    "calc.eyebrow": "负担能力",
    "calc.title": "拥有一间，需要多少。",
    "calc.lede": "拖动滑块，每月数字即时更新。仅供参考，最终批核由银行决定。",

    "loc.eyebrow": "位置",
    "loc.title": "您身处何方。",
    "loc.human": "学校就在马路对面，surau 步行几分钟即达，上班的科技园距家门仅六分钟车程。",
    "loc.lede": "就在 Bertam 路旁，距大道交汇口十分钟。学校、商场、医院、清真寺，皆在一刻钟车程内。",
    "loc.open": "在 Google Maps 中打开 ↗",
    "loc.g1.h": "日常生活",
    "loc.g2.h": "学校与教育",
    "loc.g3.h": "交通连接",
    "loc.g4.h": "工作机会与产业",
    "loc.g5.h": "休闲与生活方式",
    "loc.amen.heading": "周边设施一览 · 点击任意一行即可在地图上查看",

    "faq.eyebrow": "直接解答",
    "faq.title": "买家常问。",
    "faq.aside.h": "没找到答案?",
    "faq.aside.b": "销售团队周一至周六 9am–6pm 在 WhatsApp，多数问题一小时内回复。",
    "faq.aside.cta": "WhatsApp 提问 →",
    "faq.q1": "地契是永久还是租赁?",
    "faq.q2": "外国人可以购买吗?",
    "faq.q3": "什么是土著保留单位?",
    "faq.q4": "何时交屋?",
    "faq.q5": "价格包含什么?",
    "faq.q6": "我可以选择单位吗?",
    "faq.q7": "维护安排如何?",
    "faq.q8": "日后可以扩建或改装吗?",
    "faq.q9": "你们协助银行贷款吗?",
    "faq.q10": "如果我还没准备好购买呢?",
    "faq.a1": "永久地契。土地为 Lot 24480，交屋时发出个别地契。没有 99 年期限。",
    "faq.a2": "威省 (槟城本土) 有地住宅的外国人门槛为每单位 RM 180 万，因此仅独立式单位可能符合 (须州政府批准)。半独立式不符合。详情请询销售。",
    "faq.a3": "六个单位为土著保留，享 5% 折扣，只能转让予土著业主。其余十三个不受限制。",
    "faq.a4": "预计 2028 年第四季，自签署 SPA 起 24 个月。日期载于 SPA 并附 LAD 条款，逾期将获赔偿。",
    "faq.a5": "价格所含项目的完整清单正在敲定中，将随买卖合约一并公布。已登记买家将率先收到。",
    "faq.a6": "可以，按价目表先到先得。角头单位(04 与 19)有溢价；独立式单位(01–03)按地段面积定价。",
    "faq.a7": "业主委员会自交屋起维护绿地、道路、排水与水池，每户每月约 RM 180。非封闭式；布局本身阻挡过境车辆。",
    "faq.a8": "可以，在批准范围内。车廊封闭与后厨扩建已预先批准；影响外观的改动须经业委会与 MPSP 批准。交屋时提供指南。",
    "faq.a9": "可以。这是永久地契住宅，任何大型银行皆可融资，我们的团队会协助办理申请。批准与条款视您的个人状况而定。",
    "faq.a10": "也请先登记。完全免费，无需订金、绝无义务，并为您锁定今天的预发布价格，以及您心仪地段的优先选择权，待您准备好时再决定。",
    "bertam.eyebrow": "为何选 Bertam，趁现在",
    "bertam.title": "Bertam 正在发展。",
    "map.twofinger": "请用两指移动地图",
    "hx.scroll": "向下滑动",
    "hx.tour.line": "向下滑动，逐间参观每个空间。",
    "room.walls": "墙体",
    "room.the-house": "房屋",
    "room.the-pair": "双拼组合",
    "room.porch": "门廊",
    "room.entrance-hall": "玄关",
    "room.living": "客厅",
    "room.patio": "庭院露台",
    "room.stair": "楼梯",
    "room.master-bedroom": "主卧室",
    "room.balcony": "阳台",
    "room.the-street": "街道",
    "room.the-estate": "社区全景",
    "room.bathroom": "浴室",
    "room.bathroom-1": "浴室 1",
    "room.bathroom-2": "浴室 2",
    "room.bedroom-1": "卧室 1",
    "room.bedroom-2": "卧室 2",
    "room.corridor": "走廊",
    "room.dining-room": "餐厅",
    "room.dry-kitchen": "干厨房",
    "room.wet-kitchen": "湿厨房",
    "room.guest-bathroom": "客用浴室",
    "room.guest-bedroom": "客房",
    "room.maid-s-room": "佣人房",
    "room.master-bathroom": "主浴室",
    "room.powder-room": "化妆间",
    "room.utility-room": "杂物间",
    "bertam.lede": "槟城科技园约五分钟车程，居林高科技园与双溪大年也不远。新工厂已经投产，在那里工作的人需要住在附近。",
    "bertam.thesis": "一间永久地契的家，<br>离<span class=\"accent\">新的工作机会</span><br>只有五分钟。",
    "bertam.s1u": "电池隔膜厂，2025 年 6 月起投产，距此约 6 分钟",
    "bertam.s2u": "电子、电池与精密制造，2023 年启动",
    "bertam.s3u": "扩建后将成为全球最大的 200mm 碳化硅晶圆厂，第一期 2024 年启用",
    "bertam.s4k": "Setia Fontaines",
    "bertam.s4u": "Bertam 新工业园，2026 年 6 月动土",
    "bertam.s5u": "获批制造业投资，较 2024 年增长 29%",
    "bertam.s6u": "槟城 2025 年获批项目预计创造的职位",
    "bertam.close": "现在登记，就能锁定永久地契住宅的预发布价格。",
    "cat0.l": "成镇",
    "cat0.h": "Bertam 已是一个完整的小镇。",
    "cat0.b": "商场、两间医院、USM 与 UiTM 校区，还有十多所学校。日常所需一应俱全。",
    "cat1.l": "科技园",
    "cat1.h": "槟城科技园在 Bertam 启动。",
    "cat1.b": "880 英亩工业用地，毗邻 Bertam Indah。同年，INV 承诺在园内投资 RM 64 亿兴建电池隔膜厂。",
    "cat2.l": "投产",
    "cat2.h": "INV 第一座工厂启用。",
    "cat2.b": "第一期于 2025 年 6 月投产，计划 2027 年全面运营。",
    "cat2.tag": "已确认",
    "cat3.l": "现在",
    "cat3.h": "Panthera 开放登记。",
    "cat3.b": "Setia Fontaines 动土兴建 509 英亩工业园，而这里的地价仍远低于槟岛。",
    "cat3.tag": "预发布",
    "cat4.l": "下一步",
    "cat4.h": "INV 目标全面运营。",
    "cat4.b": "更多人在几分钟车程外上班，也有更多人在附近找房子。",
    "cat5.l": "交屋",
    "cat5.h": "您搬进新家。",
    "cat5.b": "Bertam 在您身边继续发展。",
    "reg.eyebrow": "登记您的意向",
    "reg.title": "抢占先机。",
    "reg.lede": "登记后，我们会通过 WhatsApp 发送完整价目表、平面图与宣传册，并让您在公开发布前优先选购地段。趁十九户尚在，选下那间推窗见绿的家。无需订金，绝无义务。",
    "trust.1": "仅 19 户",
    "trust.2": "永久地契",
    "trust.3": "6 个土著保留单位 · 减 5%",
    "reg.f.name": "您的姓名",
    "reg.f.phone": "电话 / WhatsApp",
    "reg.f.interest": "感兴趣的户型",
    "reg.opt.both": "两者皆可，请告知可选单位",
    "reg.opt.semid": "半独立式(16 单位)",
    "reg.opt.bungalow": "独立式洋房(3 单位)",
    "reg.submit": "通过 WhatsApp 发送",
    "reg.contact.wa.h": "更快捷，立即对话",
    "reg.contact.wa.n": "+60 17-598 1858",
    "reg.contact.wa.cta": "打开 WhatsApp ↗",
    "reg.contact.dev.h": "发展商",
    "reg.contact.dev.n": "Panthera Development Sdn. Bhd.",
    "reg.contact.dev.b": "销售咨询 周一至周六，上午 9 时至下午 6 时。",
    "reg.contact.fin.h": "贷款协助",
    "reg.contact.fin.n": "任何大型银行",
    "reg.contact.fin.b": "永久地契，如一般住宅般可融资。我们协助办理申请，条款视个人状况而定。",

    "footer.tag": "位于槟城 Bertam 的一个精品、用心规划的住宅项目。",
    "footer.h.explore": "浏览",
    "footer.h.legal": "法律",
    "footer.h.contact": "联系",
    "footer.legal.disclaimer": "免责声明",
    "footer.legal.privacy": "隐私",
    "footer.legal.spa": "SPA 条款",
    "footer.copy": "© 2026 Panthera Development Sdn. Bhd.",

    "sketches.b.left":  "独立式 · 左侧",
    "sketches.b.right": "独立式 · 右侧",
    "sketches.s.left":  "半独立 · 左侧",
    "sketches.s.right": "半独立 · 右侧",

    "plans.foot": "艺术家示意图，仅供参考。家具、饰面、配件与最终尺寸可能略有不同。",
    "plans.p1": "独立式 · 一楼",
    "plans.p2": "独立式 · 二楼",
    "plans.p3": "半独立式 · 一楼",
    "plans.p4": "半独立式 · 二楼",

    // Keys added Nov 2026 (all-languages pass): the 3D app (hx.*), pricing cards, calculator,
    // map controls, aria-label / alt text, dock and stat labels
    "nav.menu": "网站菜单",
    "hx.optin": "以 3D 浏览整个项目",
    "hx.optin.note": "约 1.6 MB",
    "hx.loading": "正在载入项目",
    "hx.stage": "项目 3D 视图",
    "hx.stage.role": "项目 3D 视图",
    "hx.l1": "16 间半独立式与 3 间独立式洋房。",
    "hx.l2": "中央绿地设有儿童游乐场。",
    "hx.l3": "继续向下滚动，然后走进任一户型参观。",
    "hx.l3app": "拖动即可环视四周，然后走进任一户型参观。",
    "hx.pins": "项目内地点",
    "hx.pin.semid": "半独立式",
    "hx.pin.bungalow": "独立式",
    "hx.pin.features": "园区特色",
    "hx.pin.location": "位置",
    "hx.next": "下一个",
    "hx.prev": "上一个",
    "hx.sound": "乡间环境音",
    "hx.walk": "入内参观",
    "hx.walk.sd": "入内参观半独立式 →",
    "hx.walk.bg": "入内参观独立式 →",
    "hx.close": "关闭",
    "hx.tod": "时段",
    "hx.tod.day": "白天",
    "hx.tod.golden": "黄昏",
    "hx.tod.night": "夜晚",
    "hx.choose": "选择户型",
    "hx.tour": "3D 实景漫游",
    "hx.back": "返回项目",
    "hx.prep": "正在准备房间",
    "hx.other.semid": "参观半独立式",
    "hx.other.bungalow": "参观独立式",
    "hx.loc.back": "返回 3D 项目",
    "hx.gallery": "图库",
    "prc.sd.tag": "半独立式", "prc.sd.units": "16 间", "prc.sd.h": "半独立式",
    "prc.sd.foot": "建筑面积 2,006 ft² · 土地 210–318 m² · 4 卧 · 4 浴",
    "prc.bg.tag": "独立式洋房", "prc.bg.units": "3 间", "prc.bg.h": "独立式",
    "prc.bg.foot": "建筑面积 2,642 ft² · 土地 356–493 m² · 5 卧 · 5 浴",
    "calc.preset.sd": "半独立式 · RM 726k",
    "calc.price": "房产价格", "calc.down": "首付", "calc.down.aria": "首付比例",
    "calc.years": "贷款年限", "calc.years.u": "年", "calc.years.aria": "贷款年限（年）",
    "calc.rate": "利率", "calc.rate.u": "% 年利率",
    "calc.monthly": "预估月供", "calc.per": "每月 · 本金 + 利息",
    "calc.principal": "本金", "calc.interest": "利息",
    "calc.loan": "贷款额", "calc.totint": "总利息", "calc.tottot": "总还款额",
    "calc.note": "仅供参考 · 不含 MRTA 与律师费 · 以银行审核为准",
    "calc.pre.eyebrow": "下一步", "calc.pre.title": "通过 WhatsApp 申请贷款预批",
    "calc.pre.sub": "我们会把您的数据转交任何一家主要银行，并在当天回复初步批核结果。",
    "map.t.streets": "地图", "map.t.satellite": "卫星", "map.t.terrain": "地形",
    "map.f.all": "全部", "map.f.daily": "日常", "map.f.schools": "学校", "map.f.lifestyle": "休闲与生活", "map.f.connect": "交通", "map.f.future": "就业与产业",
    "map.note": "已标注于项目确切位置。可拖动、缩放，手机上可用双指缩放。点击任一编号标记查看详情。使用筛选标签只显示您关心的类别，或点击下方列表中的任一行，地图即飞至该设施。",
    "loc.em.walk": "步行可达", "loc.em.across": "就在马路对面", "loc.em.gp": "（普通科诊所）", "loc.em.amdi": "（医学 / 牙科研究院）",
    "aria.lang": "语言", "aria.primary": "主导航", "aria.glance": "概览", "aria.hometype": "房型", "aria.why": "为何现在登记", "aria.wa": "WhatsApp 销售", "aria.filter": "筛选周边设施",
    "alt.hero": "黄昏时分的 Panthera Bertam 鸟瞰图：19 户围绕共享中央绿地，周边社区一并呈现。3D 渲染图，艺术家构想",
    "alt.sd.hero": "黄昏时分的 Panthera Bertam 半独立式住宅，艺术家构想",
    "alt.sd.wc.front": "半独立式水彩画，正面双拼，艺术家构想",
    "alt.sd.wc.left": "半独立式水彩画，左侧透视", "alt.sd.wc.right": "半独立式水彩画，右侧透视",
    "alt.sd.gf": "半独立式一楼平面图", "alt.sd.ff": "半独立式二楼平面图",
    "alt.bg.hero": "Panthera Bertam 独立式洋房，正立面与车道，艺术家构想",
    "alt.bg.wc.front": "独立式水彩画，正立面，艺术家构想",
    "alt.bg.wc.left": "独立式水彩画，左侧透视", "alt.bg.wc.right": "独立式水彩画，右侧透视",
    "alt.bg.gf": "独立式一楼平面图", "alt.bg.ff": "独立式二楼平面图",
    "a11y.skip": "跳至主要内容", "topbar.sales": "销售 · +60 17-598 1858",
    "dock.estate": "项目", "dock.homes": "房屋", "dock.site": "总平面", "dock.location": "位置", "dock.register": "登记 ↗",
    "bertam.s1k": "INV New Material", "bertam.s2k": "槟城科技园", "bertam.s3k": "英飞凌 · 居林", "bertam.s5k": "槟城，2025", "bertam.s6k": "新增就业"
  }
};

/* ── i18n engine ─────────────────────────────── */
const LS_KEY = "panthera.lang";
// Storage can throw (blocked site data, some in-app or sandboxed browsers): fall back to EN
// instead of stopping the whole script (translations, form, map, calculator).
let currentLang = "en";
try { currentLang = localStorage.getItem(LS_KEY) || "en"; } catch (e) {}

function applyI18n(lang){
  const dict = I18N[lang] || I18N.en;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : (lang === "bm" ? "ms" : "en");
  // Toggle a body class so .zh-only elements only render in Mandarin
  document.body.classList.toggle("lang-zh", lang === "zh");
  // Only write when the text differs: on an EN load the HTML already holds it, and each
  // write would dirty style and layout right as the hero renders.
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] != null && el.textContent !== dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (dict[key] != null && el.innerHTML !== dict[key]) el.innerHTML = dict[key];
  });
  // aria-label and alt text follow the language too (screen readers, image search)
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    const key = el.getAttribute("data-i18n-aria");
    if (dict[key] != null) el.setAttribute("aria-label", dict[key]);
  });
  document.querySelectorAll("[data-i18n-alt]").forEach(el => {
    const key = el.getAttribute("data-i18n-alt");
    if (dict[key] != null) el.setAttribute("alt", dict[key]);
  });
  document.querySelectorAll(".lang button").forEach(b => {
    b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  });
  currentLang = lang;
  try { localStorage.setItem(LS_KEY, lang); } catch (e) {}
  // The <head> hides the hero copy (html.i18n-wait) for a saved BM / ZH visitor until
  // the text is in their language, so it never flashes English first.
  document.documentElement.classList.remove("i18n-wait");
  // Refresh any Leaflet popups so cached HTML picks up new language strings
  if (typeof leafletMarkers === "object" && leafletMarkers){
    Object.entries(leafletMarkers).forEach(([id, marker]) => {
      const data = PIN_DATA[id];
      if (data && marker.getPopup) marker.setPopupContent(popupHtml(id, data));
    });
  }
}

/* ── WhatsApp form submit ────────────────────── */
const WA_NUMBER = "60175981858"; // 0175981858 in MY format

function buildWhatsAppLink(data){
  const lines = [
    `Hi Panthera Bertam Sales,`,
    ``,
    `*Name:* ${data.name || "-"}`,
    `*Phone:* ${data.phone || "-"}`,
    `*Interested in:* ${data.interest || "-"}`,
    ``,
    `Sent from pantheraestate.com`
  ];
  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${WA_NUMBER}?text=${text}`;
}

function handleSubmit(e){
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  const url = buildWhatsAppLink(data);
  window.open(url, "_blank", "noopener");
}

/* ── Floor-plan lightbox ─────────────────────── */
const PLAN_LABELS = {
  en: { 1: "Bungalow · Ground Floor", 2: "Bungalow · First Floor", 3: "Semi-D · Ground Floor", 4: "Semi-D · First Floor" },
  bm: { 1: "Banglo · Tingkat Bawah",  2: "Banglo · Tingkat Atas",   3: "Berkembar · Tingkat Bawah", 4: "Berkembar · Tingkat Atas" },
  zh: { 1: "独立式 · 一楼",             2: "独立式 · 二楼",             3: "半独立式 · 一楼",            4: "半独立式 · 二楼" }
};

function initPlanLightbox(){
  const lb = document.getElementById('plan-lightbox');
  if (!lb) return;
  const lbImg = document.getElementById('lb-img');
  const lbNum = document.getElementById('lb-num');
  const lbLbl = document.getElementById('lb-lbl');
  let current = 1;
  const max = 4;

  function show(n){
    current = ((n - 1 + max) % max) + 1;
    // Same URL as the plan cards' WebP, so the open is served from cache (the JPEG was 311-361 KB more)
    lbImg.src = `assets/floor-plan-p${current}.webp?v=7`;
    lbNum.textContent = String(current).padStart(2, '0');
    lbLbl.textContent = (PLAN_LABELS[currentLang] || PLAN_LABELS.en)[current];
    lbImg.alt = lbLbl.textContent + ' · Panthera Bertam';
  }
  function open(n){
    show(n);
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function close(){
    lb.hidden = true;
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', () => open(parseInt(card.dataset.plan, 10)));
  });
  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.querySelector('.lb-prev').addEventListener('click', () => show(current - 1));
  lb.querySelector('.lb-next').addEventListener('click', () => show(current + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(current + 1);
    if (e.key === 'ArrowLeft')  show(current - 1);
  });
}


/* ── Init ────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  applyI18n(currentLang);

  document.querySelectorAll(".lang button").forEach(b => {
    // one button (owner, Nov 2026): it shows the current language, and a tap moves on to the next (EN, BM, 中)
    b.addEventListener("click", () => {
      const all = [...b.parentNode.querySelectorAll("button[data-lang]")];
      const next = b.getAttribute("aria-pressed") === "true" ? all[(all.indexOf(b) + 1) % all.length] : b;
      applyI18n(next.dataset.lang);
      const shown = b.parentNode.querySelector('button[aria-pressed="true"]');
      if (shown && document.activeElement === b) shown.focus();
    });
  });

  const form = document.getElementById("reg-form");
  if (form) form.addEventListener("submit", handleSubmit);

  initPlanLightbox();
  initAmenityAccordion();

  // ── Calm reveal-on-scroll, made bulletproof ──────────
  // The CSS hides [data-reveal] (opacity:0) only while <html> carries the
  // js-reveal class, so if this script ever fails the content is never
  // invisible. A sweep reveals anything already in/above the viewport
  // (covering deep-links and instant jumps the observer can miss), and the
  // observer handles the gentle reveal for everything below the fold.
  (function initReveal(){
    const els = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    if (!els.length) return;
    document.documentElement.classList.add("js-reveal");
    if (!("IntersectionObserver" in window)){
      els.forEach(el => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting){
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -4% 0px" });
    els.forEach(el => io.observe(el));
    // Reveal anything already at/above the fold immediately, then guarantee
    // nothing stays hidden after load.
    function sweep(){
      const vh = window.innerHeight;
      els.forEach(el => {
        if (el.classList.contains("in")) return;
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.96){ el.classList.add("in"); io.unobserve(el); }
      });
    }
    sweep();
    window.addEventListener("load", () => setTimeout(sweep, 250));
    let st;
    window.addEventListener("scroll", () => { clearTimeout(st); st = setTimeout(sweep, 120); }, { passive: true });
  })();

  initCalculator();
  initLocationMapWhenVisible();
  initDockSpy();
  initScrollProgress();
  // initTopoParallax() removed (Nov 2026): it wrote --scroll-parallax on <html> every scroll
  // event and nothing reads that property, so each scroll re-styled the page for nothing.
});

/* ── Scroll progress indicator ──────────────────
   Drives --spk on .scroll-progress reflecting how
   far down the page the reader is. */
function initScrollProgress(){
  const el = document.querySelector('.scroll-progress');
  if (!el) return;
  let raf = 0;
  function update(){
    raf = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    // --spk is a 0-1 scale factor: the bar grows with transform: scaleX (compositor only)
    el.style.setProperty('--spk', (pct / 100).toFixed(4));
  }
  function onScroll(){ if (!raf) raf = requestAnimationFrame(update); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

/* ── Mortgage calculator ─────────────────────── */
function initCalculator(){
  const price  = document.getElementById("calc-price");
  if (!price) return;
  const down   = document.getElementById("calc-down");
  const years  = document.getElementById("calc-years");
  const rate   = document.getElementById("calc-rate");
  const presets = document.querySelectorAll(".calc-preset");

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString("en-MY");

  function compute(){
    const P = +price.value;
    const dPct = +down.value;
    const yrs = +years.value;
    const r = +rate.value;
    const loan = P * (1 - dPct/100);
    const n = yrs * 12;
    const i = r / 100 / 12;
    const monthly = i === 0 ? loan / n : loan * i / (1 - Math.pow(1+i, -n));
    const total = monthly * n;
    const totInt = total - loan;

    $("calc-price-v").textContent = "RM " + fmt(P);
    $("calc-down-v").textContent = dPct;
    $("calc-down-rm").textContent = "RM " + fmt(P * dPct/100);
    $("calc-years-v").textContent = yrs;
    $("calc-rate-v").textContent = r.toFixed(2);
    $("calc-monthly").textContent = fmt(monthly);
    $("calc-loan").textContent = fmt(loan);
    $("calc-totint").textContent = fmt(totInt);
    $("calc-tottot").textContent = fmt(total);

    const pPct = Math.round(loan / total * 100);
    const iPct = 100 - pPct;
    $("calc-pct-p").textContent = pPct + "%";
    $("calc-pct-i").textContent = iPct + "%";
    $("calc-bar-fill").style.width = pPct + "%";

    // Pre-approval WhatsApp link, carries the live figures
    const preapprove = $("calc-preapprove");
    if (preapprove){
      const activePreset = [...presets].find(p => +p.dataset.price === P);
      const homeLabel = activePreset ? activePreset.textContent.trim() : `RM ${fmt(P)} home`;
      const msg =
        `Hi Panthera Bertam, I'd like a bank pre-approval check.\n\n` +
        `• Home: ${homeLabel}\n` +
        `• Price: RM ${fmt(P)}\n` +
        `• Downpayment: ${dPct}% (RM ${fmt(P * dPct/100)})\n` +
        `• Loan: RM ${fmt(loan)} over ${yrs} years @ ${r.toFixed(2)}%\n` +
        `• Indicative monthly: RM ${fmt(monthly)}\n\n` +
        `Please send the next steps.`;
      preapprove.href = `https://wa.me/60175981858?text=${encodeURIComponent(msg)}`;
    }

    // sync preset active state by price match
    presets.forEach(p => {
      const match = +p.dataset.price === P;
      p.classList.toggle("active", match);
    });
  }

  [price, down, years, rate].forEach(el => el.addEventListener("input", compute));

  presets.forEach(p => {
    p.addEventListener("click", () => {
      const v = +p.dataset.price;
      price.value = v;
      // widen slider range if needed
      if (v < +price.min) price.min = v;
      if (v > +price.max) price.max = v;
      compute();
    });
  });

  compute();
}

/* ── Live Leaflet map with 19 amenity pins ───────
   Replaces the old Google iframe + SVG custom map.
   Uses OpenStreetMap / Carto / Esri tiles, all free.
   Pins are CSS-styled divIcons matching site brand.
   Filter chips toggle marker visibility. Amenity-list
   rows fly the map to that pin. */
const SITE_COORD = [5.530658873884109, 100.46554921250969];

const TILE_LAYERS = {
  // Esri World Topo (Nov 2026): CARTO's free basemaps now answer every request with an "API KEY REQUIRED" tile
  streets: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri, sources: Esri, HERE, Garmin, USGS, OpenStreetMap contributors and the GIS user community",
    maxZoom: 19
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 19
  },
  terrain: {
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17
  }
};

let leafletMap = null;
let leafletMarkers = {};  // id -> L.Marker
let leafletTileLayer = null;
let leafletPopupOpen = null;

// Leaflet (~150KB JS+CSS) and its map tiles are only pulled in when the map
// scrolls near the viewport, so the initial page load stays light. The map is
// well below the fold, so most visitors trigger this only after engaging.
let leafletLoading = false;
// Leaflet lives at window.L, but so does Lenis's class (its build leaks a global "L"), so check it is really Leaflet
function leafletReady(){ return typeof L !== "undefined" && !!L && typeof L.map === "function"; }
function loadLeaflet(cb){
  if (leafletReady()){ cb(); return; }
  if (leafletLoading){ document.addEventListener("leaflet:ready", cb, { once: true }); return; }
  leafletLoading = true;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
  css.crossOrigin = "";
  document.head.appendChild(css);
  const js = document.createElement("script");
  js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  js.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
  js.crossOrigin = "";
  js.onload = () => { document.dispatchEvent(new Event("leaflet:ready")); cb(); };
  // blocked or offline: say so (the 3D hero's Location move gives up instead of waiting), and let a later call try again
  js.onerror = () => { leafletLoading = false; css.remove(); js.remove(); document.dispatchEvent(new Event("leaflet:error")); };
  document.head.appendChild(js);
}

function initLocationMapWhenVisible(){
  const el = document.getElementById("loc-leaflet");
  if (!el) return;

  let done = false, io = null;
  const cleanup = () => {
    window.removeEventListener("scroll", onScroll);
    if (io) io.disconnect();
  };
  const start = () => { if (done) return; done = true; cleanup(); loadLeaflet(initLocationMap); };

  // Within ~600px of the viewport counts as "near". Fall back to a sane viewport
  // height if the browser reports 0 (some embedded/headless renderers do).
  const near = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight || 800;
    return el.getBoundingClientRect().top < vh + 600;
  };
  const onScroll = () => { if (near()) start(); };

  // Primary: IntersectionObserver loads the map as it approaches the viewport.
  if ("IntersectionObserver" in window){
    io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) start();
    }, { rootMargin: "600px 0px" });
    io.observe(el);
  }
  // Safety net for environments where IO doesn't fire: a passive scroll check,
  // removed the moment the map loads.
  window.addEventListener("scroll", onScroll, { passive: true });
  // Already near the viewport on load (short pages, deep links)? Load now.
  if (near()) start();
}

function initLocationMap(){
  const el = document.getElementById("loc-leaflet");
  if (!el) return;
  if (!leafletReady()){
    // Leaflet script still downloading, wait for our loader to finish.
    setTimeout(initLocationMap, 120);
    return;
  }

  // Touch screens: one finger scrolls the page past the map, two fingers move and pinch it (Leaflet's pinch also pans),
  // as embedded maps do (owner, Nov 2026: "if i scroll till the map, my finger will be scrolling in the map")
  const touchMap = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);
  leafletMap = L.map(el, {
    center: SITE_COORD,
    zoom: 14,
    scrollWheelZoom: false,        // Ctrl+scroll to zoom, friendly on long pages
    zoomControl: true,
    attributionControl: true,
    dragging: !touchMap,
    tap: true                      // touch support
  });
  leafletMap.on("focus", () => leafletMap.scrollWheelZoom.enable());
  leafletMap.on("blur",  () => leafletMap.scrollWheelZoom.disable());
  if (touchMap) {   // a one-finger swipe on the map: a short hint, the page scrolls on
    const hint = document.createElement("div"); hint.className = "map-2f-hint"; hint.setAttribute("aria-hidden", "true");
    hint.setAttribute("data-i18n", "map.twofinger"); hint.textContent = (I18N[currentLang] || I18N.en)["map.twofinger"] || I18N.en["map.twofinger"];
    el.appendChild(hint);
    let hideT = 0;
    el.addEventListener("touchmove", e => {
      if (e.touches.length !== 1) { hint.classList.remove("on"); return; }
      hint.classList.add("on"); clearTimeout(hideT); hideT = setTimeout(() => hint.classList.remove("on"), 1300);
    }, { passive: true });
  }

  // Initial tiles
  setTileLayer("streets");

  // ── Site marker, uses the exact e-mark.png image as the brand mark ──
  const siteIcon = L.divIcon({
    className: "pin-site-wrap",
    html:
      '<div class="pin-site">' +
        '<img src="assets/e-mark-square.png?v=4" alt="" aria-hidden="true" class="pin-site-img">' +
      '</div>' +
      '<div class="pin-site-label">PANTHERA <span>· BERTAM</span></div>',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
  L.marker(SITE_COORD, { icon: siteIcon, zIndexOffset: 2000, riseOnHover: true })
    .addTo(leafletMap)
    .bindPopup(
      '<div class="pop-card">' +
        '<div class="cat-row"><span class="cat-num" style="background:var(--terra-2)">●</span><span>Panthera Site</span></div>' +
        '<div class="pop-h">Panthera Bertam</div>' +
        '<div class="pop-meta"><span>19 homes</span><span><span class="v">2 ac</span> freehold</span></div>' +
        '<a class="pop-go" href="https://www.google.com/maps?q=' + SITE_COORD[0] + ',' + SITE_COORD[1] + '" target="_blank" rel="noopener">Open in Google Maps ↗</a>' +
      '</div>',
      { className: "loc-pop", maxWidth: 280 }
    );

  // ── Drive-time rings with floating labels ──
  const ringSpecs = [
    { r: 1000, label: "1 KM · 12 min walk" },
    { r: 3000, label: "3 KM · 5 min drive" },
    { r: 5000, label: "5 KM · 8 min drive" }
  ];
  ringSpecs.forEach(spec => {
    L.circle(SITE_COORD, {
      radius: spec.r,
      color: "rgba(138,70,56,0.30)",
      weight: 1,
      dashArray: "3 5",
      fill: false,
      interactive: false
    }).addTo(leafletMap);
    // Label sits at the top of the ring (due north of the site)
    const labelLatOffset = spec.r / 111320; // metres -> degrees (lat)
    const labelLat = SITE_COORD[0] + labelLatOffset;
    L.marker([labelLat, SITE_COORD[1]], {
      icon: L.divIcon({
        className: "ring-label-wrap",
        html: '<span class="ring-label">' + spec.label + '</span>',
        iconSize: [120, 18],
        iconAnchor: [60, 9]
      }),
      interactive: false,
      keyboard: false
    }).addTo(leafletMap);
  });

  // ── Amenity markers with hover tooltip + sequential drop-in ──
  const sortedIds = Object.keys(PIN_DATA).sort((a, b) => Number(a) - Number(b));
  sortedIds.forEach((id, i) => {
    const data = PIN_DATA[id];
    const [lat, lng] = data.gmaps.split(",").map(parseFloat);
    const icon = L.divIcon({
      className: "pin-chip-wrap pin-prep",
      html: '<div class="pin-chip ' + data.cat + '" data-pin="' + id + '">' + id + '</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    const marker = L.marker([lat, lng], { icon, riseOnHover: true })
      .addTo(leafletMap)
      .bindTooltip(data.name, {
        direction: "top",
        offset: [0, -10],
        className: "pin-tooltip",
        opacity: 1
      })
      .bindPopup(popupHtml(id, data), { className: "loc-pop", maxWidth: 280 });
    marker.on("popupopen", () => {
      document.querySelectorAll('.amen [data-pin="' + id + '"]').forEach(li => li.classList.add("is-active"));
      leafletPopupOpen = id;
    });
    marker.on("popupclose", () => {
      document.querySelectorAll('.amen [data-pin="' + id + '"]').forEach(li => li.classList.remove("is-active"));
      if (leafletPopupOpen === id) leafletPopupOpen = null;
    });
    leafletMarkers[id] = marker;
  });

  initLeafletTileToggle();
  initLeafletFilters();
  initLeafletListSync();
  initLeafletRecenter();
  initLeafletPinDropIn();

  // Fix size after Leaflet renders into a hidden container (mobile/tab cases)
  setTimeout(() => leafletMap.invalidateSize(), 250);
  window.addEventListener("resize", () => leafletMap.invalidateSize());
}

/* ── Custom "Back to site" recenter control ── */
function initLeafletRecenter(){
  if (!leafletMap) return;
  const Recenter = L.Control.extend({
    options: { position: "topright" },
    onAdd: function(){
      const btn = L.DomUtil.create("button", "leaflet-bar leaflet-control loc-recenter");
      btn.type = "button";
      btn.title = "Back to Panthera site";
      btn.setAttribute("aria-label", "Recenter on Panthera Bertam");
      btn.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 0 L8 3 M8 13 L8 16 M0 8 L3 8 M13 8 L16 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, "click", function(){
        leafletMap.flyTo(SITE_COORD, 14, { duration: 0.7 });
      });
      return btn;
    }
  });
  leafletMap.addControl(new Recenter());
}

/* ── Sequential pin drop-in on first scroll-into-view ── */
function initLeafletPinDropIn(){
  const container = document.getElementById("loc-leaflet");
  if (!container) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      // Stagger by id order so they land 1 -> 19
      Object.keys(PIN_DATA).sort((a, b) => Number(a) - Number(b)).forEach((id, i) => {
        const marker = leafletMarkers[id];
        const el = marker && marker.getElement();
        if (!el) return;
        setTimeout(() => {
          el.classList.remove("pin-prep");
          el.classList.add("pin-in");
        }, 100 + i * 55);
      });
      obs.disconnect();
    });
  }, { threshold: 0.2 });
  obs.observe(container);
}

function popupHtml(id, data){
  const swatch = (
    data.cat === "daily"     ? "var(--terra)" :
    data.cat === "schools"   ? "var(--green)" :
    data.cat === "connect"   ? "var(--ink)"   :
    data.cat === "lifestyle" ? "var(--gold)"  :
                               "var(--clay)"
  );
  const timeLabel = /walk/i.test(data.time) ? data.time : (data.time + " drive");
  // Append Chinese alternate name only when ZH is the active language.
  const nameDisplay = (currentLang === 'zh' && data.zhAlt)
    ? data.name + ' <span class="zh-only-inline">(' + data.zhAlt + ')</span>'
    : data.name;
  return (
    '<div class="pop-card">' +
      '<div class="cat-row"><span class="cat-num" style="background:' + swatch + '">' + id + '</span><span>' + data.catLabel + '</span></div>' +
      '<div class="pop-h">' + nameDisplay + '</div>' +
      '<div class="pop-meta">' +
        '<span><span class="v">' + timeLabel + '</span></span>' +
        '<span><span class="v">' + data.dist + '</span></span>' +
      '</div>' +
      '<a class="pop-go" href="https://www.google.com/maps?q=' + data.gmaps + '" target="_blank" rel="noopener">Open in Google Maps ↗</a>' +
    '</div>'
  );
}

function setTileLayer(key){
  const cfg = TILE_LAYERS[key];
  if (!cfg || !leafletMap) return;
  if (leafletTileLayer) leafletMap.removeLayer(leafletTileLayer);
  const opts = { attribution: cfg.attribution, maxZoom: cfg.maxZoom };
  if (cfg.subdomains) opts.subdomains = cfg.subdomains;
  // detectRetina only on tiles with a retina variant ({r}); Esri/OpenTopo return 404 at +1 zoom.
  if (cfg.url.indexOf('{r}') >= 0) opts.detectRetina = true;
  leafletTileLayer = L.tileLayer(cfg.url, opts).addTo(leafletMap);
}

function initLeafletTileToggle(){
  const buttons = document.querySelectorAll(".loc-livemap-actions button[data-tile]");
  buttons.forEach(b => {
    b.addEventListener("click", () => {
      const key = b.dataset.tile;
      buttons.forEach(x => {
        const on = x === b;
        x.classList.toggle("active", on);
        x.setAttribute("aria-pressed", on ? "true" : "false");
      });
      setTileLayer(key);
    });
  });
}

function initLeafletFilters(){
  const buttons = document.querySelectorAll(".map-filters button[data-filter]");
  const rows = document.querySelectorAll(".amen .amen-grp");
  buttons.forEach(b => {
    b.addEventListener("click", () => {
      const f = b.dataset.filter;
      buttons.forEach(x => x.classList.toggle("active", x === b));
      // Toggle markers
      const visibleLatLngs = [];
      Object.entries(leafletMarkers).forEach(([id, marker]) => {
        const cat = PIN_DATA[id].cat;
        const match = f === "all" || cat === f;
        const elIcon = marker.getElement();
        if (elIcon) elIcon.classList.toggle("pin-hidden", !match);
        if (match) visibleLatLngs.push(marker.getLatLng());
      });
      // Dim the matching amenity list groups
      rows.forEach(g => {
        const cat = g.classList.contains("schools")   ? "schools"
                  : g.classList.contains("connect")   ? "connect"
                  : g.classList.contains("future")    ? "future"
                  : g.classList.contains("lifestyle") ? "lifestyle"
                  : "daily";
        const match = f === "all" || cat === f;
        g.style.opacity = match ? "1" : "0.32";
        g.style.transition = "opacity .25s ease";
      });
      // Auto-fit bounds to show the active subset, always include the site
      visibleLatLngs.push(L.latLng(SITE_COORD));
      if (visibleLatLngs.length >= 2 && leafletMap){
        leafletMap.flyToBounds(L.latLngBounds(visibleLatLngs), {
          padding: [60, 60],
          maxZoom: 15,
          duration: 0.9
        });
      } else if (leafletMap){
        leafletMap.flyTo(SITE_COORD, 14, { duration: 0.7 });
      }
    });
  });
}

function initLeafletListSync(){
  const rows = document.querySelectorAll(".amen [data-pin]");
  rows.forEach(r => {
    const id = r.dataset.pin;
    r.addEventListener("mouseenter", () => {
      const m = leafletMarkers[id];
      const el = m && m.getElement();
      const chip = el && el.querySelector(".pin-chip");
      if (chip) chip.classList.add("is-active");
    });
    r.addEventListener("mouseleave", () => {
      const m = leafletMarkers[id];
      const el = m && m.getElement();
      const chip = el && el.querySelector(".pin-chip");
      if (chip) chip.classList.remove("is-active");
    });
    r.addEventListener("click", () => {
      const m = leafletMarkers[id];
      if (!m || !leafletMap) return;
      leafletMap.flyTo(m.getLatLng(), Math.max(15, leafletMap.getZoom()), { duration: 0.8 });
      setTimeout(() => m.openPopup(), 350);
    });
  });
}

// Collapsible amenity categories. Runs on DOMContentLoaded (independent of
// the Leaflet map init) so it always applies. Chevron is a CSS ::after so it
// survives i18n textContent updates.
function initAmenityAccordion(){
  document.querySelectorAll(".amen .amen-grp").forEach((grp, i) => {
    const h = grp.querySelector(".h");
    const ul = grp.querySelector("ul");
    if (!h || !ul || grp.dataset.acc) return;
    grp.dataset.acc = "1";
    grp.classList.add("acc");
    h.setAttribute("role", "button");
    h.setAttribute("tabindex", "0");
    // All categories start collapsed; clicking one opens it and closes the rest.
    h.setAttribute("aria-expanded", "false");
    const toggle = () => {
      const willOpen = !grp.classList.contains("acc-open");
      document.querySelectorAll(".amen .amen-grp.acc").forEach(g => {
        g.classList.remove("acc-open");
        const gh = g.querySelector(".h");
        if (gh) gh.setAttribute("aria-expanded", "false");
      });
      if (willOpen){
        grp.classList.add("acc-open");
        h.setAttribute("aria-expanded", "true");
      }
    };
    h.addEventListener("click", toggle);
    h.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });
}

/* ── Pin detail popup ────────────────────────── */
/* All coordinates verified against OpenStreetMap (Nominatim + Overpass)
   as of May 2026 unless noted. Distances/drive times calculated from the
   site coord 5.530659°N 100.466549°E. */
const PIN_DATA = {
  /* Daily life, groceries, medical, prayer, services */
  "1":  { name: "Sunshine Bertam Shopping Mall",   cat: "daily",   catLabel: "Daily life",     time: "5 min",  dist: "2.4 km SW",  gmaps: "5.5161017,100.4503648" },
  "2":  { name: "Lotus's Kepala Batas",            cat: "daily",   catLabel: "Daily life",     time: "8 min",  dist: "3.1 km SW",  gmaps: "5.5169232,100.4424866" },
  "3":  { name: "Mydin Bertam Hypermarket", zhAlt: "迈汀",  cat: "daily",   catLabel: "Daily life",     time: "5 min",  dist: "1.9 km SE",  gmaps: "5.5189118,100.4783364" },
  "4":  { name: "Hospital Kepala Batas", zhAlt: "甲抛峇底医院", cat: "daily", catLabel: "Daily life",  time: "9 min",  dist: "3.8 km SW",  gmaps: "5.5113324,100.4380547" },
  "5":  { name: "Bertam Resort & Water Park",      cat: "daily",   catLabel: "Daily life",     time: "5 min",  dist: "1.9 km SW",  gmaps: "5.5208274,100.4526307" },
  "6":  { name: "Masjid At-Taqwa Bertam Indah",    cat: "daily",   catLabel: "Daily life",     time: "8 min",  dist: "3.5 km SW",  gmaps: "5.5215854,100.4359896" },
  /* Schools */
  "7":  { name: "SMK Sains Kepala Batas",          cat: "schools", catLabel: "Schools",        time: "5 min",  dist: "1.7 km S",   gmaps: "5.5193397,100.4685862" },
  "8":  { name: "Kolej Matrikulasi Pulau Pinang",  cat: "schools", catLabel: "Schools",        time: "12 min", dist: "5.6 km SW",  gmaps: "5.4911848,100.4355294" },
  "9":  { name: "AMDI USM (Advanced Medical & Dental Institute)", cat: "schools", catLabel: "Schools", time: "4 min", dist: "1.3 km SE", gmaps: "5.5257168,100.4775056" },
  "10": { name: "UiTM Cawangan Pulau Pinang Kampus Bertam", cat: "schools", catLabel: "Schools", time: "3 min", dist: "0.9 km E",   gmaps: "5.5292220,100.4742930" },
  /* Pin 11 (Allianze) removed, OSM marks the campus as abandoned;
     cannot confirm operational status. */
  /* Connectivity */
  "12": { name: "NSE Bertam Interchange (Exit 166)", cat: "connect", catLabel: "Connectivity", time: "7 min",  dist: "3.2 km SW",  gmaps: "5.5209366,100.4391366" },
  "13": { name: "Butterworth Town",                cat: "connect", catLabel: "Connectivity",   time: "25 min", dist: "16 km S",    gmaps: "5.3980,100.3630" },
  "14": { name: "Penang Sentral",                  cat: "connect", catLabel: "Connectivity",   time: "28 min", dist: "16 km S",    gmaps: "5.3944867,100.3657620" },
  "15": { name: "Penang Bridge",                   cat: "connect", catLabel: "Connectivity",   time: "30 min", dist: "17 km S",    gmaps: "5.3820,100.3980" },
  "16": { name: "Penang International Airport",    cat: "connect", catLabel: "Connectivity",   time: "45 min", dist: "30 km SW",   gmaps: "5.2971,100.2769" },
  /* Future jobs */
  "17": { name: "Penang Technology Park @ Bertam", cat: "future",  catLabel: "Jobs & Industry",    time: "6 min",  dist: "2.9 km E",   gmaps: "5.5339619,100.4924177" },
  "18": { name: "INV Battery-Separator Plant", cat: "future", catLabel: "Jobs & Industry", time: "6 min", dist: "≈3 km E", gmaps: "5.5360,100.4920" },
  "19": { name: "Setia Fontaines Township",        cat: "future",  catLabel: "Jobs & Industry",    time: "6 min",  dist: "2.6 km SE",  gmaps: "5.5151210,100.4837305" },
  /* Walk-to amenities, right across the street */
  "20": { name: "SK Bertam Perdana (primary school)",      cat: "schools", catLabel: "Schools",    time: "2 min walk",  dist: "200 m E",   gmaps: "5.5306414,100.4681606" },
  "21": { name: "Surau Bertam Perdana",                    cat: "daily",   catLabel: "Daily life", time: "3 min walk",  dist: "0.9 km SW", gmaps: "5.5262477,100.4591392" },
  /* Play & lifestyle (OSM-verified, only publicly accessible spots) */
  "22": { name: "Taman Bandaraya Vision Park", zhAlt: "宏愿公园", cat: "lifestyle", catLabel: "Lifestyle", time: "3 min", dist: "1.4 km SW", gmaps: "5.5210065,100.4609212" },
  /* Pin 23 removed, the neighbourhood playgrounds in Bertam Perdana 2
     are private to that estate's residents, not for public use. */
  "24": { name: "Bertam Indah sports pitches & tennis",    cat: "lifestyle", catLabel: "Lifestyle", time: "4 min",       dist: "1.5 km SE", gmaps: "5.5210065,100.4731626" },
  "25": { name: "Bertam Plaza · Pizza Hut, Domino's, Secret Recipe, 7-Eleven, Maybank, Bank Rakyat", cat: "lifestyle", catLabel: "Lifestyle", time: "5 min", dist: "2.5 km SW", gmaps: "5.5172,100.4475" },
  /* Daily essentials & safety (all OSM-verified) */
  "26": { name: "Petronas Bertam", zhAlt: "国油",          cat: "daily", catLabel: "Daily life", time: "5 min", dist: "2.4 km SW", gmaps: "5.5174896,100.4495931" },
  "27": { name: "Klinik Desa Paya Keladi",                 cat: "daily", catLabel: "Daily life", time: "6 min", dist: "2.5 km NW", gmaps: "5.5383479,100.4427886" },
  "28": { name: "Ibu Pejabat Polis SPU (district police)", cat: "daily", catLabel: "Daily life", time: "7 min", dist: "3.1 km SW", gmaps: "5.5145973,100.4409252" },
  /* Brand landmarks (all OSM-verified) */
  "29": { name: "KFC Bertam", zhAlt: "肯德基", cat: "lifestyle", catLabel: "Lifestyle", time: "8 min", dist: "4.4 km SW", gmaps: "5.5151,100.4303" },
  "30": { name: "Kepala Batas Town · Public Bank, Hong Leong, Bank Islam, Pizza Hut, Agrobank", zhAlt: "大众银行 · 丰隆银行", cat: "lifestyle", catLabel: "Lifestyle", time: "8 min", dist: "4.0 km SW", gmaps: "5.5171,100.4314" },
  /* Major work-zone hotspots, the "I work there, I can live here" pins */
  "31": { name: "Kulim Hi-Tech Park (Intel, Infineon, ams Osram, Sandisk)", cat: "future", catLabel: "Jobs & Industry", time: "45 min", dist: "42 km NE", gmaps: "5.4061,100.5728" },
  "32": { name: "Prai Industrial Area & Free Zone", cat: "future", catLabel: "Jobs & Industry", time: "20 min", dist: "13 km S", gmaps: "5.3729,100.3942" },
  "33": { name: "Bayan Lepas Free Industrial Zone (semiconductor cluster)", cat: "future", catLabel: "Jobs & Industry", time: "40 min", dist: "30 km SW", gmaps: "5.3303,100.2806" },
  "34": { name: "Penang Port · North Butterworth Container Terminal", cat: "future", catLabel: "Jobs & Industry", time: "25 min", dist: "15 km S", gmaps: "5.4243,100.3683" }
};

// showPinDetail() + initMapPopup() removed, Leaflet handles popups natively now.

/* ── Dock active state (scroll-spy) ──────────── */
function initDockSpy(){
  const items = document.querySelectorAll(".dock a[data-dock]");
  if (!items.length) return;
  const map = {
    estate:   ["estate", "glance"],
    homes:    ["homes", "bungalow"],
    site:     ["bertam", "pricing", "calculator"],
    location: ["location"],
    register: ["faq", "register"]
  };
  const sections = [];
  Object.entries(map).forEach(([key, ids]) => {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) sections.push({ key, el });
    });
  });

  const onScroll = () => {
    const y = window.scrollY + window.innerHeight * 0.35;
    // Pick the section whose top is closest above the threshold line. Using the
    // max offsetTop (not array order) keeps this correct no matter what order the
    // map lists its sections in (the groups are not in strict DOM order).
    let activeKey = null, best = -Infinity;
    sections.forEach(({key, el}) => {
      // A home section switched off by the Semi-D / Bungalow toggle is
      // display:none (offsetTop 0), so it must not count as "above the line".
      if (el.hidden || !el.offsetParent) return;
      const top = el.offsetTop;
      if (top <= y && top > best) { best = top; activeKey = key; }
    });
    items.forEach(a => a.classList.toggle("active", a.dataset.dock === activeKey));
  };
  // At most one layout read per frame (offsetTop of every section), not one per scroll event
  let raf = 0;
  window.addEventListener("scroll", () => {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; onScroll(); });
  }, { passive: true });
  onScroll();
}
