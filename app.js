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

    "hero.eyebrow": "Pre-launch · Bertam, Seberang Perai Utara",
    "hero.h1.a": "Every home",
    "hero.h1.b": "opens to the green.",
    "hero.lede": "An intimate enclave of nineteen freehold homes, all facing a shared green of more than 700 m². Floor-to-ceiling glass and full-width sliding doors fold the park into the living room. A calm, private address on the mainland's quiet edge, just as it begins to rise.",
    "hero.f1.v": "RM 610k",  "hero.f1.k": "from",
    "hero.f2.v": "Freehold", "hero.f2.k": "tenure",
    "hero.f3.v": "19",       "hero.f3.k": "homes",
    "hero.f4.v": "5 min",    "hero.f4.k": "to Tech Park",
    "hero.m1.k": "Total Homes",     "hero.m1.v": "19",
    "hero.m2.k": "Bungalows",        "hero.m2.v": "3",
    "hero.m3.k": "Semi-Detached",    "hero.m3.v": "16",
    "hero.m4.k": "Central Green",    "hero.m4.v": "700+", "hero.m4.u": "m²",
    "hero.siteplan.toggle": "Site plan overview",
    "hero.cta.primary": "Register your interest",
    "hero.cta.wa": "WhatsApp Sales",
    "hero.legend": "Top-down diagram, actual site plan below",

    "idea.eyebrow": "The Idea",
    "idea.title": "The Estate",
    "idea.quote.a": "Houses, ",
    "idea.quote.b": "facing the park.",
    "idea.quote.tail": " A neighbourhood, by design.",
    "idea.p1.h": "01 · Courtyard plan",
    "idea.p1.t": "Every home faces the central green.",
    "idea.p1.b": "Rather than backing onto each other in long rows, all nineteen houses look onto a shared open space of over 700 m². Kids can be watched from any kitchen window.",
    "idea.p2.h": "02 · Right-sized",
    "idea.p2.t": "Generous, but not wasteful.",
    "idea.p2.b": "Semi-Ds at 1,917 sq ft built-up. Bungalows at 2,598 sq ft. Comfortable for a growing family, sized to live in, not to impress.",
    "idea.p3.h": "03 · A known quantity",
    "idea.p3.t": "Bertam, now.",
    "idea.p3.b": "Penang Technology Park is bringing in semiconductor and lithium-battery jobs five minutes away. Schools, malls, hospital, all within a fifteen-minute drive. The right place, at the right moment.",

    "glance.eyebrow": "At a glance",
    "glance.title": "What you're buying into.",
    "glance.lede": "Not just a house. A freehold address in a township the country is pouring billions into, bought while it is still quiet enough to call home.",
    "g1.k": "Total Land",     "g1.v": "2",  "g1.u": "acres freehold",
    "g2.k": "Homes",          "g2.v": "19",     "g2.u": "3 bungalow · 16 semi-D",
    "g3.k": "From",           "g3.v": "RM 610k","g3.u": "Pre-launch 2026 · register early",
    "g5.k": "Central Green",  "g5.v": "700+",    "g5.u": "m²", "g5.s": "Shared open space, never built over",

    "site.eyebrow": "Site Plan",
    "site.title": "The site.",
    "site.lede": "2 acres of freehold land off Bertam, arranged as a quiet inner ring of houses around a central open space, a layout you'll rarely see on the mainland at this size.",
    "site.cap.l": "Drawing · proposed development plan",
    "site.cap.r": "Lot 24480 · 7,939.59 m² · 1.962 ac",
    "site.aerial.l": "Artist's impression · aerial view from north",
    "site.aerial.r": "19 homes · over 700 m² central green · 298 m² retention pond",
    "site.note1.h": "Central green",
    "site.note1.t": "Over 700 m² of shared open space.",
    "site.note1.b": "The Kawasan Lapang at the heart of the site, dedicated as permanent public green, never to be built over.",
    "site.note2.h": "Inner ring road",
    "site.note2.t": "40-foot access roads, all sides.",
    "site.note2.b": "Every home addresses the park. Side roads keep through-traffic out of the estate.",
    "site.note3.h": "Freehold title",
    "site.note3.t": "Individual titles, issued at handover.",
    "site.note3.b": "No 99-year leasehold clock. The land is yours outright on Lot 24480, with a clean individual title for every home.",
    "site.note4.h": "Dry through the monsoon",
    "site.note4.t": "Ready for the heaviest downpours.",
    "site.note4.b": "An on-site retention pond and perimeter drains carry stormwater away fast, so the ring road and your porch stay usable when the rain comes down hard.",

    "homes.eyebrow": "The Homes",
    "homes.title": "Two homes, one green.",
    "homes.lede": "Both two-storey, freehold, modern-tropical. Choose for what suits your family.",
    "homes.street.cap": "Streetscape elevation · all 19 homes · scroll →",
    "homes.street.note": "Photo-render of the streetscape coming soon",

    "h.semid.tag": "16 units · Semi-Detached",
    "h.semid.name": "The Semi-D",
    "h.semid.pitch": "Right-sized for a growing family: 1,917 sq ft over two storeys, four bedrooms and a true garden setback. Every one faces the central green.",
    "h.semid.price.l": "From",
    "h.semid.price.v": "RM 610,000 onwards",
    "h.semid.price.s": "Bumi lot · standard from RM 632,917",
    "h.semid.s1.k": "Built-up", "h.semid.s1.v": "1,917", "h.semid.s1.u": "sq ft",
    "h.semid.s2.k": "Land Size", "h.semid.s2.v": "210–318 m²", "h.semid.s2.u": "2,260–3,423 ft²",
    "h.semid.s3.k": "Bedrooms", "h.semid.s3.v": "4",
    "h.semid.s4.k": "Bathrooms", "h.semid.s4.v": "4",
    "h.semid.s5.k": "Storeys", "h.semid.s5.v": "2",
    "h.semid.s6.k": "Tenure", "h.semid.s6.v": "Freehold",
    "h.semid.ph": "Render · Semi-D Streetscape",

    "h.bungalow.tag": "3 units · Bungalow",
    "h.bungalow.name": "The Bungalow",
    "h.bungalow.pitch": "The flagship: 2,598 sq ft, five bedrooms and six baths on the estate's largest lots. Only three will ever be built.",
    "h.bungalow.price.l": "From",
    "h.bungalow.price.v": "RM 860,000 onwards",
    "h.bungalow.price.s": "Non-Bumi · Bumi from RM 920,263",
    "h.bungalow.s1.k": "Built-up", "h.bungalow.s1.v": "2,598", "h.bungalow.s1.u": "sq ft",
    "h.bungalow.s2.k": "Land Size", "h.bungalow.s2.v": "356–493 m²", "h.bungalow.s2.u": "3,832–5,308 ft²",
    "h.bungalow.s3.k": "Bedrooms", "h.bungalow.s3.v": "5",
    "h.bungalow.s4.k": "Bathrooms", "h.bungalow.s4.v": "6",
    "h.bungalow.s5.k": "Storeys", "h.bungalow.s5.v": "2",
    "h.bungalow.s6.k": "Tenure", "h.bungalow.s6.v": "Freehold",
    "h.bungalow.ph": "Render · Bungalow Exterior",

    "pricing.eyebrow": "Pricing",
    "pricing.title": "Range pricing. Plainly told.",
    "pricing.lede": "Two house types, three tiers each. Bumi reserved lots receive a 5% discount. Want the full lot-by-lot list with current availability? WhatsApp our sales team, we'll send it over same-day.",
    "pricing.cta.title": "Want the full lot-by-lot list?",
    "pricing.cta.body": "Reach our sales team on WhatsApp, we'll send the live list with availability and Bumi-lot status the same day.",
    "pricing.cta.btn": "WhatsApp sales →",
    "pricing.h.lot": "Lot",
    "pricing.h.type": "Type",
    "pricing.h.land": "Land",
    "pricing.h.build": "Built-up",
    "pricing.h.status": "Status",
    "pricing.h.price": "Price (Nett)",
    "pricing.leg.bumi": "Bumi lot, 5% discount applied",
    "pricing.leg.note": "All prices subject to SPA · E. & O.E.",

    "loc.eyebrow": "Location",
    "loc.title": "Where you are.",
    "loc.lede": "Set just off Jalan Bertam, ten minutes from the North-South Expressway interchange, with everything a family needs, schools, mall, hospital, mosque, inside a quarter-hour drive.",
    "loc.open": "Open in Google Maps ↗",
    "loc.g1.h": "Daily life",
    "loc.g2.h": "Schools & education",
    "loc.g3.h": "Connectivity",
    "loc.g4.h": "Jobs & industry",

    "phil.eyebrow": "Design Philosophy",
    "phil.title": "We know what works here.",
    "phil.lede": "Four decisions that came from designing for this place, not for a brochure.",
    "phil.q1": "If you've lived in Penang, you know a typical taman puts your front door staring at the back of someone else's.",
    "phil.a1": "Ours doesn't. All nineteen houses face inward to a shared central green. Kids on the lawn from any kitchen window.",
    "phil.q2": "Anyone who's stayed through a monsoon knows the rain doesn't pour, it crashes.",
    "phil.a2": "That's why the roof is pitched terracotta tile. Water clears the slope in under a minute, no leaks waiting at year five.",
    "phil.q3": "A 200-unit launch sells units, not neighbourhoods. You can feel it the moment you walk in.",
    "phil.a3": "Nineteen houses is small on purpose. Small enough that you'll recognise your neighbours by their cars.",
    "phil.q4": "What works here is what's worked here for a hundred years.",
    "phil.a4": "White walls, terracotta tile, pitched roof. The form that handles the rain and the sun without trying to look like a magazine cover.",

    "reg.eyebrow": "Register your interest",
    "reg.title": "Be first in line.",
    "reg.lede": "Limited release. Drop your details and we'll send the brochure, floor plans, and book your private site preview before public launch.",
    "reg.f.name": "Your name",
    "reg.f.phone": "Phone / WhatsApp",
    "reg.f.email": "Email",
    "reg.f.interest": "Interested in",
    "reg.f.message": "Notes for our sales team (optional)",
    "reg.opt.both": "Both, show me what's available",
    "reg.opt.semid": "Semi-Detached (16 units)",
    "reg.opt.bungalow": "Bungalow (3 units)",
    "reg.submit": "Send via WhatsApp",
    "reg.submit.alt": "Or email us",
    "reg.contact.wa.h": "Faster, chat now",
    "reg.contact.wa.n": "+60 17-598 1858",
    "reg.contact.wa.cta": "Open WhatsApp ↗",
    "reg.contact.dev.h": "Developer",
    "reg.contact.dev.n": "Panthera Development Sdn. Bhd.",
    "reg.contact.dev.b": "Sales enquiries Mon–Sat, 9am–6pm.",

    "footer.tag": "A small, considered development in Bertam, Penang.",
    "footer.h.explore": "Explore",
    "footer.h.legal": "Legal",
    "footer.h.contact": "Contact",
    "footer.legal.disclaimer": "Disclaimer",
    "footer.legal.privacy": "Privacy",
    "footer.legal.spa": "SPA terms",
    "footer.copy": "© 2026 Panthera Development Sdn. Bhd.",

    "arch.eyebrow": "Design Notes",
    "arch.title": "Designed for the climate.",
    "arch.lede": "Modern tropical, not import. The roofs shed monsoon rain. The balconies catch the evening breeze. The car porch keeps your bonnet out of the noon sun. Every move comes from how a family actually lives in Penang.",
    "arch.feature.cap": "Built for the monsoon",
    "arch.n1.t": "Pitched gable roof, terracotta tile.",
    "arch.n1.b": "A traditional Malay-influenced roof line, scaled for two storeys. Sheds monsoon rain fast. Creates a tall, cross-ventilated upper floor, cooler than a flat slab can ever be.",
    "arch.n2.t": "Full-length first-floor balcony.",
    "arch.n2.b": "Not a token Juliet, a real balcony you can put two chairs and a coffee on. Doubles as the porch's roof, so the front of the house is sheltered without losing light.",
    "arch.n3.t": "Deep car porch, generous overhang.",
    "arch.n3.b": "Two cars under cover, paved in concrete pavers. The slab extends past the porch, load and unload groceries without getting wet.",
    "arch.n4.t": "Tall ground-floor windows.",
    "arch.n4.b": "Floor-to-ceiling sliding glass at the back, framed openings up front. The living room reads as one bright room, not a series of dim boxes, and air moves all the way through.",
    "arch.n5.t": "Set back from the boundary.",
    "arch.n5.b": "Kawasan Hijau buffers on every plot mean a true garden, not a fence-to-fence build. Plant frangipani. Plant lime trees. Let the kids run.",
    "arch.n6.t": "White on red, the Penang palette.",
    "arch.n6.b": "The colour story is the one this place is already wearing, limewashed walls and red clay roof. Ageless. Cooling. Quietly Penang.",

    "sketches.eyebrow": "Watercolour studies",
    "sketches.title": "The way the houses<br>actually feel.",
    "sketches.lede": "A handful of soft-edged perspective studies, painted from the architect's drawings. Each one shows how the houses sit on their land, plants and porch and afternoon shadow included.",
    "sketches.row1": "Bungalow · three perspectives",
    "sketches.row2": "Semi-Detached · three perspectives",
    "sketches.b.front": "Bungalow · Front facade",
    "sketches.b.left":  "Bungalow · Left side",
    "sketches.b.right": "Bungalow · Right side",
    "sketches.s.front": "Semi-D · Front pair",
    "sketches.s.left":  "Semi-D · Left side",
    "sketches.s.right": "Semi-D · Right side",
    "sketches.foot": "Artist's impressions for illustrative purposes only. Final built form, finishes, landscaping and orientation may vary. The signed Sale & Purchase Agreement and stamped architectural drawings are the binding versions.",

    "plans.eyebrow": "Floor Plans",
    "plans.title": "Inside the homes.",
    "plans.lede": "Fully furnished layout plans, ground and first floor, both house types, drawn to scale and showing where the sofa, the dining table, and the queen-size beds actually fit. Flip through below, or download the full PDF.",
    "plans.open": "Open Floor Plans (PDF)",
    "plans.download": "Download PDF",
    "plans.note": "4 sheets · Furniture-fitted · Bungalow + Semi-D · Ground + First floor",
    "plans.foot": "Artist's impressions and indicative layouts only. Furniture, finishes, fixtures and final dimensions may vary. The signed Sale & Purchase Agreement and stamped architectural drawings are the binding versions.",
    "plans.p1": "Bungalow · Ground Floor",
    "plans.p2": "Bungalow · First Floor",
    "plans.p3": "Semi-D · Ground Floor",
    "plans.p4": "Semi-D · First Floor"
  },

  bm: {
    "nav.estate": "Kediaman",
    "nav.homes":  "Rumah",
    "nav.site":   "Pelan Tapak",
    "nav.location": "Lokasi",
    "nav.register": "Daftar Minat",
    "nav.cta": "Daftar Minat",

    "hero.eyebrow": "Pra-Pelancaran · Bertam, Seberang Perai Utara",
    "hero.h1.a": "Setiap rumah",
    "hero.h1.b": "menghadap kehijauan.",
    "hero.lede": "Enklaf intim sembilan belas rumah pegangan bebas, semuanya menghadap taman hijau dikongsi seluas lebih 700 m². Tingkap lantai ke siling dan pintu gelongsor sepenuh dinding membawa taman masuk ke ruang tamu. Sebuah alamat yang tenang dan persendirian di tepi tanah besar yang kini mula meningkat.",
    "hero.f1.v": "RM 610k",       "hero.f1.k": "bermula",
    "hero.f2.v": "Pegangan bebas", "hero.f2.k": "milikan",
    "hero.f3.v": "19",            "hero.f3.k": "rumah",
    "hero.f4.v": "5 minit",       "hero.f4.k": "ke Tech Park",
    "hero.m1.k": "Jumlah Rumah",   "hero.m1.v": "19",
    "hero.m2.k": "Banglo",          "hero.m2.v": "3",
    "hero.m3.k": "Berkembar",       "hero.m3.v": "16",
    "hero.m4.k": "Kawasan Lapang",  "hero.m4.v": "700+", "hero.m4.u": "m²",
    "hero.siteplan.toggle": "Pelan tapak ringkas",
    "hero.cta.primary": "Daftar minat anda",
    "hero.cta.wa": "WhatsApp Jualan",
    "hero.legend": "Rajah pandangan atas, pelan tapak sebenar di bawah",

    "idea.eyebrow": "Konsep",
    "idea.title": "Kediaman",
    "idea.quote.a": "Rumah ",
    "idea.quote.b": "menghadap taman.",
    "idea.quote.tail": " Sebuah kejiranan, terancang.",
    "idea.p1.h": "01 · Pelan halaman",
    "idea.p1.t": "Setiap rumah menghadap taman pusat.",
    "idea.p1.b": "Bukannya berderet membelakangi satu sama lain, kesemua sembilan belas rumah menghadap ruang terbuka berkongsi seluas lebih 700 m². Anak-anak boleh diawasi dari mana-mana tingkap dapur.",
    "idea.p2.h": "02 · Saiz yang sesuai",
    "idea.p2.t": "Selesa, tanpa berlebihan.",
    "idea.p2.b": "Rumah berkembar dengan keluasan binaan 1,917 kaki persegi. Banglo 2,598 kaki persegi. Selesa untuk keluarga yang sedang membesar, direka untuk didiami, bukan untuk menunjuk-nunjuk.",
    "idea.p3.h": "03 · Lokasi yang dikenali",
    "idea.p3.t": "Bertam, kini.",
    "idea.p3.b": "Penang Technology Park membawa pekerjaan separuh konduktor dan bateri litium hanya lima minit dari sini. Sekolah, pusat beli-belah, hospital, semuanya dalam pemanduan lima belas minit. Tempat yang tepat, pada masa yang tepat.",

    "glance.eyebrow": "Ringkasan",
    "glance.title": "Apa yang anda miliki.",
    "glance.lede": "Bukan sekadar rumah. Alamat pegangan bebas dalam sebuah bandar yang sedang dilaburkan berbilion oleh negara, dimiliki ketika ia masih cukup tenang untuk dipanggil rumah.",
    "g1.k": "Jumlah Tanah",  "g1.v": "2",  "g1.u": "ekar pegangan bebas",
    "g2.k": "Rumah",         "g2.v": "19",     "g2.u": "3 banglo · 16 berkembar",
    "g3.k": "Bermula",       "g3.v": "RM 610k","g3.u": "Pra-pelancaran 2026 · daftar awal",
    "g5.k": "Kawasan Lapang", "g5.v": "700+",   "g5.u": "m²", "g5.s": "Ruang lapang dikongsi, tidak akan dibina",

    "site.eyebrow": "Pelan Tapak",
    "site.title": "Tapak.",
    "site.lede": "2 ekar tanah pegangan bebas di Bertam, disusun sebagai cincin dalaman rumah yang tenang mengelilingi ruang terbuka pusat, susun atur yang jarang ditemui di tanah besar pada saiz ini.",
    "site.cap.l": "Lukisan · pelan pembangunan cadangan",
    "site.cap.r": "Lot 24480 · 7,939.59 m² · 1.962 ek",
    "site.aerial.l": "Tafsiran artis · pandangan udara dari utara",
    "site.aerial.r": "19 rumah · lebih 700 m² kawasan lapang · 298 m² kolam tadahan",
    "site.note1.h": "Kawasan lapang",
    "site.note1.t": "Lebih 700 m² ruang terbuka dikongsi.",
    "site.note1.b": "Kawasan Lapang di tengah-tengah tapak, diserahkan secara percuma kepada Kerajaan Negeri sebagai kawasan hijau kekal, tidak akan dibangunkan.",
    "site.note2.h": "Jalan cincin dalaman",
    "site.note2.t": "Jalan akses 40 kaki, semua sisi.",
    "site.note2.b": "Setiap rumah menghadap taman. Jalan tepi menghalang lalu-lintas merentas dari memasuki kediaman.",
    "site.note3.h": "Pegangan bebas",
    "site.note3.t": "Hak milik individu, diserah semasa penyerahan.",
    "site.note3.b": "Tiada kiraan pajakan 99 tahun. Tanah milik anda sepenuhnya di Lot 24480, dengan hak milik individu yang bersih bagi setiap rumah.",
    "site.note4.h": "Kering sepanjang tengkujuh",
    "site.note4.t": "Sedia untuk hujan paling lebat.",
    "site.note4.b": "Kolam tadahan di tapak dan longkang sekeliling mengalirkan air hujan dengan pantas, supaya jalan dan porch anda kekal boleh digunakan ketika hujan turun lebat.",

    "homes.eyebrow": "Rumah",
    "homes.title": "Dua rumah, satu taman.",
    "homes.lede": "Kedua-duanya dua tingkat, pegangan bebas, tropika moden. Pilih yang sesuai untuk keluarga anda.",
    "homes.street.cap": "Pandangan jalan · 19 rumah · skrol →",
    "homes.street.note": "Render foto pandangan jalan akan menyusul",

    "h.semid.tag": "16 unit · Berkembar",
    "h.semid.name": "Rumah Berkembar",
    "h.semid.pitch": "Saiz yang sesuai untuk keluarga yang membesar: 1,917 kaki persegi, dua tingkat, empat bilik tidur dan halaman sebenar. Setiap satu menghadap taman pusat.",
    "h.semid.price.l": "Bermula",
    "h.semid.price.v": "RM 610,000 onwards",
    "h.semid.price.s": "Lot Bumi · standard dari RM 632,917",
    "h.semid.s1.k": "Keluasan binaan", "h.semid.s1.v": "1,917", "h.semid.s1.u": "kp",
    "h.semid.s2.k": "Saiz tanah", "h.semid.s2.v": "210–318 m²", "h.semid.s2.u": "2,260–3,423 kp",
    "h.semid.s3.k": "Bilik tidur", "h.semid.s3.v": "4",
    "h.semid.s4.k": "Bilik air", "h.semid.s4.v": "4",
    "h.semid.s5.k": "Tingkat", "h.semid.s5.v": "2",
    "h.semid.s6.k": "Pegangan", "h.semid.s6.v": "Bebas",
    "h.semid.ph": "Render · Rumah Berkembar",

    "h.bungalow.tag": "3 unit · Banglo",
    "h.bungalow.name": "Banglo",
    "h.bungalow.pitch": "Unit unggulan: 2,598 kaki persegi, lima bilik tidur dan enam bilik air di atas lot terbesar di kawasan ini. Hanya tiga unit sahaja akan dibina.",
    "h.bungalow.price.l": "Bermula",
    "h.bungalow.price.v": "RM 860,000 onwards",
    "h.bungalow.price.s": "Bukan-Bumi · Bumi dari RM 920,263",
    "h.bungalow.s1.k": "Keluasan binaan", "h.bungalow.s1.v": "2,598", "h.bungalow.s1.u": "kp",
    "h.bungalow.s2.k": "Saiz tanah", "h.bungalow.s2.v": "356–493 m²", "h.bungalow.s2.u": "3,832–5,308 kp",
    "h.bungalow.s3.k": "Bilik tidur", "h.bungalow.s3.v": "5",
    "h.bungalow.s4.k": "Bilik air", "h.bungalow.s4.v": "6",
    "h.bungalow.s5.k": "Tingkat", "h.bungalow.s5.v": "2",
    "h.bungalow.s6.k": "Pegangan", "h.bungalow.s6.v": "Bebas",
    "h.bungalow.ph": "Render · Banglo Luaran",

    "pricing.eyebrow": "Harga",
    "pricing.title": "Julat harga. Diceritakan dengan jelas.",
    "pricing.lede": "Dua jenis rumah, tiga peringkat setiap satu. Lot Bumi menerima diskaun 5%. Mahukan senarai lot-demi-lot terkini? WhatsApp pasukan jualan kami, kami akan hantar pada hari yang sama.",
    "pricing.cta.title": "Mahukan senarai harga lot-demi-lot?",
    "pricing.cta.body": "Hubungi pasukan jualan kami di WhatsApp, kami hantar senarai terkini dengan status ketersediaan & lot Bumi pada hari yang sama.",
    "pricing.cta.btn": "WhatsApp jualan →",
    "pricing.h.lot": "Lot",
    "pricing.h.type": "Jenis",
    "pricing.h.land": "Tanah",
    "pricing.h.build": "Binaan",
    "pricing.h.status": "Status",
    "pricing.h.price": "Harga (Bersih)",
    "pricing.leg.bumi": "Lot Bumi, diskaun 5% diterapkan",
    "pricing.leg.note": "Semua harga tertakluk kepada SPA · E. & O.E.",

    "loc.eyebrow": "Lokasi",
    "loc.title": "Di mana anda berada.",
    "loc.lede": "Terletak betul-betul di luar Jalan Bertam, sepuluh minit dari pertukaran Lebuhraya Utara-Selatan, dengan segala keperluan keluarga, sekolah, mal, hospital, masjid, dalam pemanduan suku jam.",
    "loc.open": "Buka di Google Maps ↗",
    "loc.g1.h": "Kehidupan harian",
    "loc.g2.h": "Sekolah & pendidikan",
    "loc.g3.h": "Sambungan",
    "loc.g4.h": "Pekerjaan & industri",

    "phil.eyebrow": "Falsafah Rekaan",
    "phil.title": "Kami tahu apa yang sesuai di sini.",
    "phil.lede": "Empat keputusan yang lahir daripada mereka bentuk untuk tempat ini, bukan untuk risalah.",
    "phil.q1": "Jika anda tinggal di Pulau Pinang, anda tahu taman biasa meletakkan pintu hadapan anda menentang belakang rumah jiran.",
    "phil.a1": "Kami tidak. Kesembilan belas rumah menghadap ke dalam, ke arah taman hijau berkongsi. Kanak-kanak di laman boleh dilihat dari mana-mana tingkap dapur.",
    "phil.q2": "Sesiapa yang pernah lalui musim tengkujuh tahu hujannya bukan menitis, ia menyerbu.",
    "phil.a2": "Itu sebabnya bumbung adalah jubin terakota bercerun. Air mengalir keluar dalam masa kurang seminit, tiada kebocoran menanti pada tahun kelima.",
    "phil.q3": "Pelancaran 200-unit menjual unit, bukan kejiranan. Anda dapat rasa perbezaannya sebaik melangkah masuk.",
    "phil.a3": "Sembilan belas rumah adalah kecil dengan sengaja. Cukup kecil untuk anda mengenali jiran melalui kereta mereka.",
    "phil.q4": "Apa yang sesuai di sini ialah apa yang telah sesuai di sini selama seratus tahun.",
    "phil.a4": "Dinding putih, jubin terakota, bumbung bercerun. Bentuk yang mengendalikan hujan dan matahari tanpa cuba kelihatan seperti gambar majalah.",

    "reg.eyebrow": "Daftar minat anda",
    "reg.title": "Jadilah yang pertama.",
    "reg.lede": "Pelepasan terhad. Tinggalkan butiran anda dan kami akan menghantar brosur, pelan lantai, dan menempah lawatan tapak peribadi sebelum pelancaran umum.",
    "reg.f.name": "Nama anda",
    "reg.f.phone": "Telefon / WhatsApp",
    "reg.f.email": "Emel",
    "reg.f.interest": "Berminat dengan",
    "reg.f.message": "Nota untuk pasukan jualan (pilihan)",
    "reg.opt.both": "Kedua-duanya, tunjukkan yang tersedia",
    "reg.opt.semid": "Rumah Berkembar (16 unit)",
    "reg.opt.bungalow": "Banglo (3 unit)",
    "reg.submit": "Hantar melalui WhatsApp",
    "reg.submit.alt": "Atau emel kami",
    "reg.contact.wa.h": "Lebih cepat, borak sekarang",
    "reg.contact.wa.n": "+60 17-598 1858",
    "reg.contact.wa.cta": "Buka WhatsApp ↗",
    "reg.contact.dev.h": "Pemaju",
    "reg.contact.dev.n": "Panthera Development Sdn. Bhd.",
    "reg.contact.dev.b": "Pertanyaan jualan Isnin–Sabtu, 9pg–6ptg.",

    "footer.tag": "Pembangunan kecil yang teliti di Bertam, Pulau Pinang.",
    "footer.h.explore": "Layari",
    "footer.h.legal": "Undang-undang",
    "footer.h.contact": "Hubungi",
    "footer.legal.disclaimer": "Penafian",
    "footer.legal.privacy": "Privasi",
    "footer.legal.spa": "Terma SPA",
    "footer.copy": "© 2026 Panthera Development Sdn. Bhd.",

    "arch.eyebrow": "Nota Reka Bentuk",
    "arch.title": "Direka untuk iklim.",
    "arch.lede": "Tropika moden, bukan import. Bumbungnya menolak hujan monsun. Balkoninya menangkap angin petang. Porch kereta melindungi bonet anda daripada matahari tengahari. Setiap langkah berdasarkan cara sesebuah keluarga sebenar tinggal di Pulau Pinang.",
    "arch.feature.cap": "Dibina untuk musim monsun",
    "arch.n1.t": "Bumbung gable bercerun, jubin tanah liat.",
    "arch.n1.b": "Garis bumbung tradisi berinspirasi Melayu, diskalakan untuk dua tingkat. Cepat menolak hujan monsun. Mencipta tingkat atas yang tinggi dan berventilasi silang, jauh lebih sejuk daripada lantai rata.",
    "arch.n2.t": "Balkoni penuh tingkat satu.",
    "arch.n2.b": "Bukan balkoni Juliet sahaja, balkoni sebenar yang muat dua kerusi dan secawan kopi. Berfungsi juga sebagai bumbung porch.",
    "arch.n3.t": "Porch kereta dalam, julang besar.",
    "arch.n3.b": "Dua kereta berlindung, bertongkat batu turapan. Slab terjulur melepasi porch, punggah barang tanpa basah.",
    "arch.n4.t": "Tingkap tingkat bawah yang tinggi.",
    "arch.n4.b": "Pintu kaca gelongsor lantai ke siling di belakang, bukaan berbingkai di hadapan. Ruang tamu kelihatan satu bilik terang, bukan kotak-kotak gelap, udara mengalir lancar.",
    "arch.n5.t": "Anjakan dari sempadan.",
    "arch.n5.b": "Penampan Kawasan Hijau pada setiap plot bermakna taman sebenar, bukan binaan pagar ke pagar. Tanam kemboja. Tanam pokok limau. Biar anak-anak berlari.",
    "arch.n6.t": "Putih atas merah, palet Pulau Pinang.",
    "arch.n6.b": "Cerita warna yang sudah dipakai oleh tempat ini sendiri, dinding berkapur dan bumbung tanah liat merah. Tidak lapuk. Menyejukkan. Pulau Pinang dengan tenang.",

    "sketches.eyebrow": "Lukisan Cat Air",
    "sketches.title": "Bagaimana rasa<br>rumah sebenarnya.",
    "sketches.lede": "Beberapa kajian perspektif berlukis lembut, dilukis daripada lukisan arkitek. Setiap satu menunjukkan kedudukan rumah pada tanahnya, lengkap dengan tumbuhan, porch dan bayang petang.",
    "sketches.row1": "Banglo · tiga perspektif",
    "sketches.row2": "Berkembar · tiga perspektif",
    "sketches.b.front": "Banglo · Fasad hadapan",
    "sketches.b.left":  "Banglo · Sisi kiri",
    "sketches.b.right": "Banglo · Sisi kanan",
    "sketches.s.front": "Berkembar · Pasangan hadapan",
    "sketches.s.left":  "Berkembar · Sisi kiri",
    "sketches.s.right": "Berkembar · Sisi kanan",
    "sketches.foot": "Tafsiran artis untuk tujuan ilustrasi sahaja. Bentuk binaan akhir, kemasan, landskap dan orientasi mungkin berbeza. Perjanjian Jual Beli yang dimeterai dan lukisan arkitek yang disetem ialah versi yang mengikat.",

    "plans.eyebrow": "Pelan Lantai",
    "plans.title": "Dalam rumah.",
    "plans.lede": "Pelan susun atur lengkap dengan perabot, tingkat bawah dan tingkat satu, kedua-dua jenis rumah, dilukis pada skala dan menunjukkan kedudukan sofa, meja makan dan katil bersaiz queen. Selak di bawah, atau muat turun PDF penuh.",
    "plans.open": "Buka Pelan Lantai (PDF)",
    "plans.download": "Muat Turun PDF",
    "plans.note": "4 helaian · Lengkap perabot · Banglo + Berkembar · Tingkat bawah + atas",
    "plans.foot": "Tafsiran artis dan susun atur indikatif sahaja. Perabot, kemasan, lekapan dan dimensi akhir mungkin berbeza. Perjanjian Jual Beli yang dimeterai dan lukisan arkitek yang disetem ialah versi yang mengikat."
  },

  zh: {
    "nav.estate": "项目概览",
    "nav.homes":  "房屋",
    "nav.site":   "总平面",
    "nav.location": "位置",
    "nav.register": "登记意向",
    "nav.cta": "登记意向",

    "hero.eyebrow": "预发布 · 北赖 Bertam,北威省北区",
    "hero.h1.a": "每一户",
    "hero.h1.b": "都向绿意敞开。",
    "hero.lede": "一个仅十九户永久地契住宅的私密社区, 户户面向逾 700 平方米的共享绿地。落地玻璃与整面推拉门, 将绿意引入客厅。宁静私密的居所, 落脚于对岸正悄然崛起的一隅。",
    "hero.f1.v": "RM 610k",  "hero.f1.k": "起",
    "hero.f2.v": "永久地契",  "hero.f2.k": "产权",
    "hero.f3.v": "19",       "hero.f3.k": "户",
    "hero.f4.v": "5 分钟",    "hero.f4.k": "至科技园",
    "hero.m1.k": "房屋总数",   "hero.m1.v": "19",
    "hero.m2.k": "独立式洋房",  "hero.m2.v": "3",
    "hero.m3.k": "半独立式",    "hero.m3.v": "16",
    "hero.m4.k": "中央绿地",    "hero.m4.v": "700+", "hero.m4.u": "m²",
    "hero.siteplan.toggle": "总平面图概览",
    "hero.cta.primary": "登记您的意向",
    "hero.cta.wa": "WhatsApp 销售",
    "hero.legend": "俯视示意图, 实际平面图见下方",

    "idea.eyebrow": "理念",
    "idea.title": "项目概览",
    "idea.quote.a": "房屋,",
    "idea.quote.b": "面向公园。",
    "idea.quote.tail": " 用心设计的社区。",
    "idea.p1.h": "01 · 庭院式布局",
    "idea.p1.t": "每户均面向中央绿地。",
    "idea.p1.b": "十九栋房屋不再背对背地排列,而是共同环绕一片逾 700 平方米的公共开放空间。从任何一扇厨房窗户都能看到孩子。",
    "idea.p2.h": "02 · 合适的尺度",
    "idea.p2.t": "宽敞,却不浪费。",
    "idea.p2.b": "半独立式建筑面积 1,917 平方英尺,独立式 2,598 平方英尺。适合成长中的家庭, 为生活而设,而非为炫耀。",
    "idea.p3.h": "03 · 熟悉的好地段",
    "idea.p3.t": "正当其时的北赖。",
    "idea.p3.b": "北赖科技园正在引入半导体与锂电池产业,五分钟车程即达。学校、商场、医院, 全部在十五分钟车程之内。对的地方,对的时机。",

    "glance.eyebrow": "一目了然",
    "glance.title": "您所购买的一切。",
    "glance.lede": "不只是一栋房子。这是一个永久地契的门牌, 落在国家正投入数十亿的新兴市镇, 而您在它仍然宁静、仍能称之为家的时候入手。",
    "g1.k": "总土地面积", "g1.v": "2",  "g1.u": "英亩永久地契",
    "g2.k": "房屋",        "g2.v": "19",     "g2.u": "3 独立 · 16 半独立",
    "g3.k": "起价",        "g3.v": "RM 610k","g3.u": "2026 预发布 · 提早登记",
    "g5.k": "中央绿地",     "g5.v": "700+",    "g5.u": "m²", "g5.s": "永久共享开放空间, 永不建房",

    "site.eyebrow": "总平面",
    "site.title": "地段。",
    "site.lede": "2 英亩永久地契土地,坐落北赖,房屋以静谧的内环方式围绕中央开放空间布置, 这种尺度的布局,在威省鲜有所见。",
    "site.cap.l": "图纸, 拟议发展计划",
    "site.cap.r": "Lot 24480 · 7,939.59 m² · 1.962 英亩",
    "site.aerial.l": "艺术家示意图 · 由北面俯瞰",
    "site.aerial.r": "19 户住宅 · 逾 700 m² 中央绿地 · 298 m² 蓄水池",
    "site.note1.h": "中央绿地",
    "site.note1.t": "逾 700 m² 的共享开放空间。",
    "site.note1.b": "Kawasan Lapang 位于地段中央,免费交予州政府作为永久公共绿地, 永不开发。",
    "site.note2.h": "内部环道",
    "site.note2.t": "40 英尺宽的进出道路,四面环绕。",
    "site.note2.b": "每户都面向公园。侧道阻挡过境车辆进入小区。",
    "site.note3.h": "永久地契",
    "site.note3.t": "个别地契, 交屋时发出。",
    "site.note3.b": "没有 99 年租赁年限。土地完全属于您 (Lot 24480), 每户均持清晰的个别地契。",
    "site.note4.h": "雨季也安心",
    "site.note4.t": "为最大的暴雨而建。",
    "site.note4.b": "场内蓄水池与四周排水沟迅速排走雨水, 即使大雨倾盆, 道路与前廊照样可用。",

    "homes.eyebrow": "房屋",
    "homes.title": "两种家,一片绿。",
    "homes.lede": "皆为双层,永久地契,现代热带风格。选择最适合您家庭的一款。",
    "homes.street.cap": "街景立面 · 全部 19 间 · 右滑 →",
    "homes.street.note": "街景实物渲染图即将推出",

    "h.semid.tag": "16 单位 · 半独立式",
    "h.semid.name": "半独立式",
    "h.semid.pitch": "为成长中的家庭量身打造:1,917 平方英尺,双层,四间卧房,真正的花园退距。每一户都面向中央绿地。",
    "h.semid.price.l": "起",
    "h.semid.price.v": "RM 610,000 onwards",
    "h.semid.price.s": "土著保留地 · 一般起价 RM 632,917",
    "h.semid.s1.k": "建筑面积", "h.semid.s1.v": "1,917", "h.semid.s1.u": "平方英尺",
    "h.semid.s2.k": "土地面积", "h.semid.s2.v": "210–318 m²", "h.semid.s2.u": "2,260–3,423 平方英尺",
    "h.semid.s3.k": "卧室", "h.semid.s3.v": "4",
    "h.semid.s4.k": "浴室", "h.semid.s4.v": "4",
    "h.semid.s5.k": "楼层", "h.semid.s5.v": "2",
    "h.semid.s6.k": "地契", "h.semid.s6.v": "永久",
    "h.semid.ph": "效果图, 半独立式街景",

    "h.bungalow.tag": "3 单位 · 独立式洋房",
    "h.bungalow.name": "独立式",
    "h.bungalow.pitch": "旗舰户型:2,598 平方英尺,五房六浴,坐落于全区最大地段。仅建三栋。",
    "h.bungalow.price.l": "起",
    "h.bungalow.price.v": "RM 860,000 onwards",
    "h.bungalow.price.s": "非土著 · 土著保留 RM 920,263 起",
    "h.bungalow.s1.k": "建筑面积", "h.bungalow.s1.v": "2,598", "h.bungalow.s1.u": "平方英尺",
    "h.bungalow.s2.k": "土地面积", "h.bungalow.s2.v": "356–493 m²", "h.bungalow.s2.u": "3,832–5,308 平方英尺",
    "h.bungalow.s3.k": "卧室", "h.bungalow.s3.v": "5",
    "h.bungalow.s4.k": "浴室", "h.bungalow.s4.v": "6",
    "h.bungalow.s5.k": "楼层", "h.bungalow.s5.v": "2",
    "h.bungalow.s6.k": "地契", "h.bungalow.s6.v": "永久",
    "h.bungalow.ph": "效果图, 独立式外观",

    "pricing.eyebrow": "价格",
    "pricing.title": "区间定价,坦诚相告。",
    "pricing.lede": "两种户型,每种三个价位。土著保留地享 5% 折扣。需要完整的逐栋价目表与最新库存?WhatsApp 联系销售团队 -- 当天即可送达。",
    "pricing.cta.title": "需要完整逐栋价目表?",
    "pricing.cta.body": "WhatsApp 联系销售团队 -- 我们当天发送实时价目表、库存状态与土著保留地信息。",
    "pricing.cta.btn": "WhatsApp 销售 →",
    "pricing.h.lot": "地号",
    "pricing.h.type": "类型",
    "pricing.h.land": "土地",
    "pricing.h.build": "建筑",
    "pricing.h.status": "类别",
    "pricing.h.price": "净价",
    "pricing.leg.bumi": "土著保留地, 已计入 5% 折扣",
    "pricing.leg.note": "所有价格以 SPA 为准 · E. & O.E.",

    "loc.eyebrow": "位置",
    "loc.title": "您身处何方。",
    "loc.lede": "位于北赖路旁,距南北大道交汇口十分钟车程,家庭所需的一切, 学校、商场、医院、清真寺, 皆在十五分钟车程内。",
    "loc.open": "在 Google Maps 中打开 ↗",
    "loc.g1.h": "日常生活",
    "loc.g2.h": "学校与教育",
    "loc.g3.h": "交通连接",
    "loc.g4.h": "工作机会与产业",

    "phil.eyebrow": "设计理念",
    "phil.title": "我们懂得什么适合这里。",
    "phil.lede": "四个决定,源自为这片土地而设计,而非为宣传册而设计。",
    "phil.q1": "如果您住过槟城,就知道一般的住宅区,前门往往对着邻居的后门。",
    "phil.a1": "我们不是。十九栋家全部面向中央共享绿地。任何一间厨房的窗户,都看得见草坪上的孩子。",
    "phil.q2": "经历过季候风的人都知道, 这里的雨不是落下, 是砸下。",
    "phil.a2": "这就是为何屋顶采用斜面陶瓦。水在不到一分钟内顺着坡面流尽,五年之后也不必担心漏水。",
    "phil.q3": "两百单位的发展案卖的是单位, 不是邻里。一走进去, 您就能感受到差别。",
    "phil.a3": "十九栋是刻意做小。小到您能凭车认出邻居。",
    "phil.q4": "这里适合的设计, 是过去一百年来一直适合的设计。",
    "phil.a4": "白墙、陶瓦、斜屋顶。能扛得住雨和阳光的形式,不是为了像杂志封面。",

    "reg.eyebrow": "登记您的意向",
    "reg.title": "抢占先机。",
    "reg.lede": "名额有限。留下您的联系方式,我们将发送宣传册、平面图,并在公开发布前安排您私下参观项目。",
    "reg.f.name": "您的姓名",
    "reg.f.phone": "电话 / WhatsApp",
    "reg.f.email": "电邮",
    "reg.f.interest": "感兴趣的户型",
    "reg.f.message": "给销售团队的备注(可选)",
    "reg.opt.both": "两者皆可, 请告知可选单位",
    "reg.opt.semid": "半独立式(16 单位)",
    "reg.opt.bungalow": "独立式洋房(3 单位)",
    "reg.submit": "通过 WhatsApp 发送",
    "reg.submit.alt": "或发送电邮",
    "reg.contact.wa.h": "更快捷, 立即对话",
    "reg.contact.wa.n": "+60 17-598 1858",
    "reg.contact.wa.cta": "打开 WhatsApp ↗",
    "reg.contact.dev.h": "发展商",
    "reg.contact.dev.n": "Panthera Development Sdn. Bhd.",
    "reg.contact.dev.b": "销售咨询 周一至周六,上午 9 时至下午 6 时。",

    "footer.tag": "位于槟城北赖的一个精心规划的小型住宅项目。",
    "footer.h.explore": "浏览",
    "footer.h.legal": "法律",
    "footer.h.contact": "联系",
    "footer.legal.disclaimer": "免责声明",
    "footer.legal.privacy": "隐私",
    "footer.legal.spa": "SPA 条款",
    "footer.copy": "© 2026 Panthera Development Sdn. Bhd.",

    "arch.eyebrow": "设计手记",
    "arch.title": "为气候而设计。",
    "arch.lede": "现代热带，而非进口。屋顶可送走雨季的雨水，阳台迮迎晚风，车廊为您的车隔绝正午阳光。每一个细节都源于一个家庭在槟城真正的生活方式。",
    "arch.feature.cap": "为雨季而建",
    "arch.n1.t": "陶土瓦人字屋顶。",
    "arch.n1.b": "受马来传统影响的屋面轮廓，为双层住宅所重新设计。雨水快速流下。高而通风的二层空间--远比平顶凉爽。",
    "arch.n2.t": "贯穿二楼的阳台。",
    "arch.n2.b": "不是象征性的珠丽叶阳台--是能摆上两把椅子、一杯咖啡的真阳台。同时为车廊提供遥蔗。",
    "arch.n3.t": "深车廊与室外出桃。",
    "arch.n3.b": "两辆车均可遥蔗，下面为混凝土路面砖。出桃延伸超过车廊--装卸货物不会淋雨。",
    "arch.n4.t": "一层高窗。",
    "arch.n4.b": "后侧落地推拉玻璃门，前面为边框窗。客厅是一个明亮的整体空间，而不是一串阴暗的间隔--空气也能透过。",
    "arch.n5.t": "远离边界。",
    "arch.n5.b": "每块地都有 Kawasan Hijau 绿区缓冲--是真正的花园，不是押在围墙之间的问题。种鸡蛋花。种香橙树。让孩子们奔跑。",
    "arch.n6.t": "白墙红瓦，槟城调色。",
    "arch.n6.b": "这片土地本身就在谱写的色调--人工涂白的墙与红陶牙陶顶。不过时。凉爽。安静的槟城。",

    "sketches.eyebrow": "水彩写生",
    "sketches.title": "屋宇真正的<br>感觉。",
    "sketches.lede": "几幅柔边透视写生，依据建筑师图纸绘制。每一幅都呈现房屋落在土地上的姿态，连同绿植、车廊与午后的阴影。",
    "sketches.row1": "独立式 · 三个视角",
    "sketches.row2": "半独立 · 三个视角",
    "sketches.b.front": "独立式 · 正面",
    "sketches.b.left":  "独立式 · 左侧",
    "sketches.b.right": "独立式 · 右侧",
    "sketches.s.front": "半独立 · 正面成对",
    "sketches.s.left":  "半独立 · 左侧",
    "sketches.s.right": "半独立 · 右侧",
    "sketches.foot": "艺术家示意图，仅供参考。最终建成形态、饰面、园景与朝向可能略有不同。已签署的买卖合约与盖章的建筑师图纸方为最终具约束力的版本。",

    "plans.eyebrow": "平面图",
    "plans.title": "走进家内。",
    "plans.lede": "完整家具布置的平面图--包含两种户型的一楼与二楼，按比例绘制，清楚标示沙发、餐桌、双人床的实际位置。下方预览，或者下载完整 PDF。",
    "plans.open": "打开平面图 (PDF)",
    "plans.download": "下载 PDF",
    "plans.note": "4 页 · 含家具 · 独立 + 半独立 · 一楼 + 二楼",
    "plans.foot": "艺术家示意图，仅供参考。家具、饰面、配件与最终尺寸可能略有不同。已签署的买卖合约与盖章的建筑师图纸方为最终具约束力的版本。",
    "plans.p1": "独立式 · 一楼",
    "plans.p2": "独立式 · 二楼",
    "plans.p3": "半独立式 · 一楼",
    "plans.p4": "半独立式 · 二楼"
  }
};

/* ── i18n engine ─────────────────────────────── */
const LS_KEY = "panthera.lang";
let currentLang = localStorage.getItem(LS_KEY) || "en";

function applyI18n(lang){
  const dict = I18N[lang] || I18N.en;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : (lang === "bm" ? "ms" : "en");
  // Toggle a body class so .zh-only elements only render in Mandarin
  document.body.classList.toggle("lang-zh", lang === "zh");
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] != null) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (dict[key] != null) el.innerHTML = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key] != null) el.setAttribute("placeholder", dict[key]);
  });
  document.querySelectorAll(".lang button").forEach(b => {
    b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  });
  currentLang = lang;
  localStorage.setItem(LS_KEY, lang);
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
    `*Email:* ${data.email || "-"}`,
    `*Interested in:* ${data.interest || "-"}`,
    data.message ? `*Notes:* ${data.message}` : null,
    ``,
    `Sent from pantheraestate.com`
  ].filter(Boolean);
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
    lbImg.src = `assets/floor-plan-p${current}.jpg?v=${current===1?6:4}`;
    lbImg.alt = `Floor Plan ${current}`;
    lbNum.textContent = String(current).padStart(2, '0');
    lbLbl.textContent = (PLAN_LABELS[currentLang] || PLAN_LABELS.en)[current];
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
    b.addEventListener("click", () => applyI18n(b.dataset.lang));
  });

  const form = document.getElementById("reg-form");
  if (form) form.addEventListener("submit", handleSubmit);

  initPlanLightbox();

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
  initLocationMap();
  initDockSpy();
  initPrelaunchBar();
  initLoadCascade();
  initScrollProgress();
  initTopoParallax();
});

/* ── Topo contour parallax ──────────────────────
   Fed by the body::before background-position-y
   binding. As the user scrolls, the contour lines
   shift very slowly (12% of the scroll distance,
   in the opposite direction) so they feel like a
   deeper, slower layer behind the prose. Honors
   prefers-reduced-motion via a CSS media query. */
function initTopoParallax(){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  function apply(){
    // Negative direction creates the "deeper layer" feel: as the page scrolls
    // down, contours slowly rise, a subtle ~12% counter-parallax.
    root.style.setProperty('--scroll-parallax', `${(-window.scrollY * 0.12).toFixed(1)}px`);
  }
  window.addEventListener('scroll', apply, { passive: true });
  apply();
}

/* ── First-load cascade ────────────────────────
   Flip `loaded` once fonts + hero image have settled,
   with a hard timeout so the page never gets stuck
   in a "loading" state. */
function initLoadCascade(){
  const root = document.documentElement;
  if (!root.classList.contains('first-paint')) return;

  const reveal = () => root.classList.add('loaded');
  // Hard ceiling so reveal always fires
  const safety = setTimeout(reveal, 500);

  const heroImg = document.querySelector('.hero-art--photo .hero-photo');
  const fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
  const imgReady = (heroImg && !heroImg.complete)
    ? new Promise(res => {
        heroImg.addEventListener('load', res, { once:true });
        heroImg.addEventListener('error', res, { once:true });
      })
    : Promise.resolve();
  Promise.all([fontsReady, imgReady]).then(() => {
    clearTimeout(safety);
    reveal();
  });
}

/* ── Scroll progress indicator ──────────────────
   Drives --sp on .scroll-progress reflecting how
   far down the page the reader is. */
function initScrollProgress(){
  const el = document.querySelector('.scroll-progress');
  if (!el) return;
  let raf = 0;
  function update(){
    raf = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    el.style.setProperty('--sp', pct.toFixed(2) + '%');
  }
  function onScroll(){ if (!raf) raf = requestAnimationFrame(update); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

/* ── Pre-launch urgency bar ─────────────────────
   Slides in after user scrolls past the hero.
   Persists dismissal across the session. */
function initPrelaunchBar(){
  const bar = document.getElementById('prelaunch-bar');
  if (!bar) return;
  // Honor dismissal stored for the current session.
  if (sessionStorage.getItem('panthera.prelaunch.dismissed') === '1') return;

  // Unhide so the slide-in transition can play.
  bar.hidden = false;

  const hero = document.querySelector('section.hero');
  const heroBottom = hero ? hero.offsetTop + hero.offsetHeight - 140 : 600;

  // Once dismissed, stop toggling so the scroll handler can never re-add
  // `has-prelaunch-bar` (which would push the topbar down 42px and leave a
  // transparent gap above it while the bar itself stays hidden).
  let dismissed = false;
  function update(){
    if (dismissed) return;
    const past = window.scrollY > heroBottom;
    bar.classList.toggle('is-visible', past);
    document.body.classList.toggle('has-prelaunch-bar', past);
  }
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  bar.querySelector('.prelaunch-close')?.addEventListener('click', () => {
    dismissed = true;
    bar.classList.remove('is-visible');
    document.body.classList.remove('has-prelaunch-bar');
    sessionStorage.setItem('panthera.prelaunch.dismissed', '1');
    // After the slide-out, hide entirely so it doesn't intercept clicks.
    setTimeout(() => { bar.hidden = true; }, 400);
  });
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
  streets: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19
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

function initLocationMap(){
  const el = document.getElementById("loc-leaflet");
  if (!el) return;
  if (typeof L === "undefined"){
    // Leaflet script may still be loading (defer + DOMContentLoaded race). Retry.
    setTimeout(initLocationMap, 120);
    return;
  }

  leafletMap = L.map(el, {
    center: SITE_COORD,
    zoom: 14,
    scrollWheelZoom: false,        // Ctrl+scroll to zoom, friendly on long pages
    zoomControl: true,
    attributionControl: true,
    tap: true                      // touch support
  });
  leafletMap.on("focus", () => leafletMap.scrollWheelZoom.enable());
  leafletMap.on("blur",  () => leafletMap.scrollWheelZoom.disable());

  // Initial tiles
  setTileLayer("streets");

  // ── Site marker, uses the exact e-mark.png image as the brand mark ──
  const siteIcon = L.divIcon({
    className: "pin-site-wrap",
    html:
      '<div class="pin-site">' +
        '<img src="assets/e-mark-square.png?v=5" alt="" aria-hidden="true" class="pin-site-img">' +
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
  // detectRetina only on Carto (Esri/OpenTopo return 404 at +1 zoom).
  if (key === 'streets') opts.detectRetina = true;
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
  "18": { name: "INV Lithium Battery Plant (under construction)", cat: "future", catLabel: "Jobs & Industry", time: "6 min", dist: "≈3 km E", gmaps: "5.5360,100.4920" },
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
    estate:   ["estate", "glance", "philosophy"],
    homes:    ["homes", "bungalow", "architecture", "specs"],
    site:     ["bertam", "pricing", "calculator"],
    location: ["location"],
    register: ["journey", "faq", "register"]
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
      const top = el.offsetTop;
      if (top <= y && top > best) { best = top; activeKey = key; }
    });
    items.forEach(a => a.classList.toggle("active", a.dataset.dock === activeKey));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}
