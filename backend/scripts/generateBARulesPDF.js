/**
 * generateBARulesPDF.js
 *
 * Generates the official "B Airways — Rules & Knowledge Base" PDF.
 * Run:  node backend/scripts/generateBARulesPDF.js
 * Output: backend/uploads/BA_Rules_Knowledge_Base.pdf
 */

'use strict';

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

// ── Output path ───────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const OUTPUT_PATH = path.join(UPLOADS_DIR, 'BA_Rules_Knowledge_Base.pdf');

// ── Colour palette ────────────────────────────────────────────────────────
const C = {
  baBlue:    '#075AAA',
  baGold:    '#C8A951',
  baNavy:    '#011627',
  white:     '#FFFFFF',
  lightGrey: '#F5F7FA',
  midGrey:   '#8395A7',
  darkGrey:  '#2C3E50',
  red:       '#C0392B',
  green:     '#1E8449',
};

// ── BA Rules content ──────────────────────────────────────────────────────
const SECTIONS = [
  {
    title: '1. BAGGAGE ALLOWANCES',
    icon: '✈',
    subsections: [
      {
        heading: 'Hand Baggage (All Tickets)',
        body: [
          '• 1 cabin bag: max 56 × 45 × 25 cm (including handles and wheels)',
          '• 1 personal item: max 40 × 30 × 15 cm (handbag, laptop bag)',
          '• Max 23 kg each. 1 baby changing bag also permitted free of charge.',
          '• Items must fit in the overhead locker or under the seat in front.',
        ],
      },
      {
        heading: 'Checked Baggage by Cabin',
        body: [
          '• Hand Baggage Only / Basic fare:    0 checked bags',
          '• World Traveller (Economy):         1 × 23 kg',
          '• World Traveller Plus (Prem Eco):   2 × 23 kg',
          '• Club Europe (Short-haul Business): 2 × 32 kg',
          '• Club World / Club Suite (Business):2 × 32 kg',
          '• First Class:                       3 × 32 kg',
          '• Max bag dimensions: 90 × 75 × 43 cm per piece.',
        ],
      },
      {
        heading: 'Executive Club Tier Bonuses',
        body: [
          '• Bronze: Priority bag delivery, no extra bag.',
          '• Silver: 1 extra checked bag + 32 kg allowance in Economy.',
          '• Gold:   1 extra checked bag + 32 kg allowance, overweight waiver on 1 bag.',
        ],
      },
      {
        heading: 'Excess & Extra Baggage Fees',
        body: [
          '• Pre-purchase online via Manage Booking (up to 30% cheaper than airport).',
          '• Short-haul extra bag:  from £65 online / £85 airport.',
          '• Long-haul extra bag:   from £95 online / £130 airport.',
          '• Overweight (23–32 kg): £65 online / £85 airport.',
          '• Oversize bag:          £65 online / £85 airport.',
        ],
      },
      {
        heading: 'Sports Equipment & Restricted Items',
        body: [
          '• Golf clubs, skis, surfboards, bikes count as 1 checked bag.',
          '• Bikes must be in a padded bag/box.',
          '• Oversized musical instruments require their own seat (book in advance).',
          '• Lithium batteries >160 Wh are banned from all BA flights.',
          '• E-cigarettes / vapes must be in carry-on only, not hold.',
          '• Power banks max 100 Wh — carry-on only.',
          '• Hoverboards banned on all BA flights.',
          '• Liquids in hand baggage: max 100 ml containers in 1 resealable transparent bag.',
        ],
      },
    ],
  },
  {
    title: '2. EXECUTIVE CLUB & AVIOS',
    icon: '★',
    subsections: [
      {
        heading: 'Tier Overview',
        body: [
          '• Blue   (0 TP):       Base Avios earn, reward flights from 4,750 Avios.',
          '• Bronze (300 TP + 2 flights/yr, oneworld Ruby):',
          '    Priority check-in, free standard seat 7 days before, 25% Avios bonus.',
          '• Silver (600 TP + 4 flights/yr, oneworld Sapphire):',
          '    Galleries Club lounge + 1 guest, free seat at booking, 50% Avios bonus,',
          '    extra bag 2×32 kg in Economy.',
          '• Gold   (1,500 TP + 4 flights/yr, oneworld Emerald):',
          '    Galleries First + Concorde Room + 1 guest, The First Wing LHR,',
          '    free exit rows at booking, 100% Avios bonus.',
          '• Concorde Room Card: 5,000 lifetime TP.',
          '• Gold Guest List:    3,000 TP (exclusive benefits).',
        ],
      },
      {
        heading: 'Avios Earning Rates',
        body: [
          '• Economy (World Traveller):           50% of miles flown',
          '• Premium Economy (WT Plus):           75% of miles flown',
          '• Business (Club World / Club Suite): 150% of miles flown',
          '• First Class:                        300% of miles flown',
          '• Tier bonus applied on top: Bronze +25%, Silver +50%, Gold +100%.',
          '• Avios never expire with 1 qualifying transaction every 36 months.',
        ],
      },
      {
        heading: 'Tier Points per Route Type',
        body: [
          '• Short-haul Economy (Club Europe cabin): 10 TP',
          '• Short-haul Business (Club Europe):      30 TP',
          '• Long-haul Economy:                      40 TP',
          '• Long-haul Premium Economy:              80 TP',
          '• Long-haul Business:                    120 TP',
          '• Long-haul First Class:                 200 TP',
        ],
      },
      {
        heading: 'Spending Avios',
        body: [
          '• Reward Flight Saver (short-haul): from 4,750 Avios + £1.',
          '• Economy → Business upgrade:       from 7,500 Avios/segment.',
          '• Economy → First Class upgrade:    from 12,500 Avios/segment.',
          '• Hotel nights:                     from 4,000 Avios/night.',
          '• Club World NYC reward return:     80,000 Avios + £350 taxes.',
        ],
      },
      {
        heading: 'Companion Voucher',
        body: [
          '• BA American Express Premium Plus card: spend £12,000+ per year.',
          '• 2nd passenger travels free on any BA reward flight (only taxes for 2nd pax).',
          '• Or 50% Avios discount when travelling solo.',
          '• Valid 2 years from issue. Can be used for any cabin on any BA route.',
        ],
      },
      {
        heading: 'Family Account',
        body: [
          '• Pool Avios between up to 7 family members.',
          '• Tier Points and tier status are individual — not pooled.',
          '• All members must share the same residential address.',
        ],
      },
    ],
  },
  {
    title: '3. CABIN CLASSES',
    icon: '🛋',
    subsections: [
      {
        heading: 'First Class',
        body: [
          '• Private suite with sliding door, 198 cm flat bed.',
          '• White Company duvet and pillow, on-demand à la carte dining.',
          '• Laurent-Perrier Grand Siècle champagne.',
          '• 3 × 32 kg checked bags.',
          '• Routes: LHR–JFK, LHR–DXB, LHR–NRT, LHR–SYD, LHR–SIN, LHR–BOM.',
          '• Concorde Room lounge access included.',
        ],
      },
      {
        heading: 'Club Suite (New Business Class — A350 / B777)',
        body: [
          '• Direct aisle access from every seat, full-height privacy door.',
          '• 79-inch flat bed, 18.5-inch 4K touchscreen.',
          '• On-demand fine dining, noise-cancelling headphones.',
          '• 2 × 32 kg checked bags.',
          '• Available on A350-1000 and B777-300ER.',
        ],
      },
      {
        heading: 'Club World (Legacy Long-Haul Business)',
        body: [
          '• 183 cm flat bed, White Company bedding.',
          '• Multi-course dining on fine china, champagne.',
          '• 2 × 32 kg checked bags.',
          '• Being progressively replaced by Club Suite on refurbished aircraft.',
        ],
      },
      {
        heading: 'Club Europe (Short-Haul Business)',
        body: [
          '• Middle seat always kept empty for privacy.',
          '• Hot meal and champagne service.',
          '• Galleries Club lounge access.',
          '• 2 × 32 kg checked bags.',
          '• Group 1 boarding priority.',
        ],
      },
      {
        heading: 'World Traveller Plus (Premium Economy)',
        body: [
          '• 38-inch seat pitch, dedicated cabin.',
          '• Sparkling wine, 3-course meal on fine china, amenity kit.',
          '• Free seat selection at booking.',
          '• 2 × 23 kg checked bags.',
        ],
      },
      {
        heading: 'World Traveller (Economy)',
        body: [
          '• 31-inch seat pitch, 10-inch personal screen.',
          '• USB-A, USB-C, and AC power socket.',
          '• Complimentary meal and drinks on all flights.',
          '• 1 × 23 kg checked bag (Standard fare).',
        ],
      },
    ],
  },
  {
    title: '4. AIRPORT LOUNGES',
    icon: '🏛',
    subsections: [
      {
        heading: 'Galleries Club',
        body: [
          '• Locations: LHR T5 South/North/B, T3, LGW South, JFK T8.',
          '• Eligible: Club World/Club Europe pax, oneworld Business class,',
          '    Silver/Gold EC members + 1 guest (any cabin).',
          '• Facilities: Hot buffet, champagne bar, showers, Wi-Fi, quiet zone.',
        ],
      },
      {
        heading: 'Galleries First',
        body: [
          '• Locations: LHR T5 South, LGW South.',
          '• Eligible: First Class pax, Gold EC + 1 guest (any cabin), oneworld Emerald.',
          '• Facilities: À la carte dining, Laurent-Perrier champagne, Elemis spa (LHR),',
          '    private showers.',
        ],
      },
      {
        heading: 'The Concorde Room',
        body: [
          '• Locations: LHR T5, JFK T8.',
          '• Eligible: First Class pax, Concorde Room Card holders.',
          '• Facilities: Private dining booths, Forty Winks sleep suites,',
          '    vintage Krug champagne, Dom Perignon bar, butler service.',
        ],
      },
      {
        heading: 'The First Wing (LHR T5 only)',
        body: [
          '• Eligible: Gold EC members and First Class passengers.',
          '• Dedicated check-in desks, private security lane.',
          '• Direct walk through to Galleries First or Concorde Room.',
          '• Available 04:30–21:00 daily.',
        ],
      },
    ],
  },
  {
    title: '5. PASSENGER RIGHTS (UK261)',
    icon: '⚖',
    subsections: [
      {
        heading: 'Delay Compensation (BA at fault, not extraordinary)',
        body: [
          '• Flights <1,500 km:                  £220 per person',
          '• Flights 1,500–3,500 km:             £350 per person',
          '• Flights >3,500 km (4h+ delay):      £520 per person',
          '• Compensation halved if re-routed within 2h/3h/4h of original arrival.',
        ],
      },
      {
        heading: 'Cancellation Rights (<14 days notice)',
        body: [
          '• Same compensation as delay: £220 / £350 / £520.',
          '• Entitled to: full refund within 7 days OR re-routing at earliest opportunity',
          '    (including on other airlines if BA cannot accommodate sooner).',
          '• If notified >14 days: no cash compensation.',
        ],
      },
      {
        heading: 'Duty of Care',
        body: [
          '• Triggers: 2h+ delay (short-haul) or 3h+ (long-haul).',
          '• BA must provide: free meals and refreshments (reasonable to wait),',
          '    2 free phone calls / emails, free hotel + transfers if overnight stay required,',
          '    access to medical assistance.',
          '• Duty of Care applies even during extraordinary circumstances.',
        ],
      },
      {
        heading: 'Downgrade Refund',
        body: [
          '• If placed in a lower cabin than booked:',
          '    <1,500 km:      30% of ticket price refunded',
          '    1,500–3,500 km: 50% of ticket price refunded',
          '    >3,500 km:      75% of ticket price refunded',
          '• Claim at the airport or via ba.com/help/delays.',
        ],
      },
      {
        heading: 'Extraordinary Circumstances (No Cash Compensation)',
        body: [
          '• Severe weather, volcanic ash, ATC strikes, security threats,',
          '    bird strikes, medical emergencies, hidden manufacturing defects.',
          '• Note: Duty of Care still applies even if extraordinary circumstances.',
        ],
      },
      {
        heading: 'How to Claim',
        body: [
          '• Online: ba.com/help/delays — submit within 6 years.',
          '• Include: booking reference, flight number, date, reason given, receipts.',
          '• BA must respond within 14 days.',
          '• Escalate to CEDR (Centre for Effective Dispute Resolution) or CAA if refused.',
        ],
      },
    ],
  },
  {
    title: '6. BOOKING & MANAGE MY BOOKING',
    icon: '📋',
    subsections: [
      {
        heading: 'Accessing Your Booking',
        body: [
          '• Go to ba.com → Manage My Booking.',
          '• Enter 6-character booking reference (PNR). No surname required.',
          '• Available actions: view itinerary, change seats, add baggage, request meals,',
          '    upgrade with Avios, cancel booking.',
        ],
      },
      {
        heading: 'Changing Your Flight',
        body: [
          '• Flexible fares: change free, any time, no fare difference.',
          '• Standard Economy: change fee £60–£200 + fare difference.',
          '• Sale fares: date change only, no route changes, plus fare difference.',
          '• Same Day Change (SDC): flat fee, subject to availability, Silver/Gold priority.',
        ],
      },
      {
        heading: 'Cancellations & Refunds',
        body: [
          '• Fully Flexible fare: full cash refund within 7 days.',
          '• Standard fare: taxes and fees refunded (£50–£200 admin fee).',
          '• Sale / HBO fare: taxes only refunded.',
          '• BA cancels your flight: full cash refund within 7 days, regardless of fare.',
        ],
      },
      {
        heading: 'Seat Selection',
        body: [
          '• Economy: £10–£45, or free 24h before departure.',
          '• Extra Legroom / Exit Row: £25–£80.',
          '• World Traveller Plus: free at booking.',
          '• Club World / Club Suite: free at booking.',
          '• Bronze EC: free standard seat 7 days before.',
          '• Silver / Gold EC: free at booking, including exit rows.',
        ],
      },
      {
        heading: 'Name Corrections',
        body: [
          '• Minor correction (≤3 characters): free via Manage Booking.',
          '• Full name change: not allowed — cancel and rebook required.',
          '• Name must exactly match passport. Check carefully at booking.',
        ],
      },
      {
        heading: 'Upgrades',
        body: [
          '• Avios upgrade Economy → Premium Economy: from 7,500 Avios/segment.',
          '• Avios upgrade Economy → Business:        from 12,500 Avios/segment.',
          '• Bid Upgrade: submit a cash bid 3–7 days before departure.',
          '• Companion Voucher: 2nd passenger free on reward flights (BA Amex Premium Plus).',
        ],
      },
    ],
  },
  {
    title: '7. CHECK-IN & BOARDING',
    icon: '🎫',
    subsections: [
      {
        heading: 'Online Check-In',
        body: [
          '• Opens: 24 hours before scheduled departure.',
          '• Access via ba.com or BA app using 6-character booking reference.',
          '• Digital boarding pass: Apple Wallet, Google Wallet, or PDF.',
          '• Must submit Advance Passenger Information (API) for USA, Canada, Australia.',
        ],
      },
      {
        heading: 'Airport Deadlines',
        body: [
          '• Bag drop closes:',
          '    Long-haul: 60 minutes before departure.',
          '    Short-haul: 45 minutes before departure.',
          '• Gates close: 20 minutes before departure — arrive at gate early.',
          '• Check-in desk closes: 45 min (short-haul), 60 min (long-haul) before.',
        ],
      },
      {
        heading: 'Boarding Groups',
        body: [
          '• Pre-board:   Families with young children, special assistance.',
          '• Group 1:     First Class, Gold EC, oneworld Emerald.',
          '• Group 2:     Club Suite/World, Club Europe, Silver EC, oneworld Sapphire.',
          '• Group 3:     World Traveller Plus, Bronze EC, oneworld Ruby.',
          '• Group 4/5:   World Traveller (Economy) by zone.',
        ],
      },
    ],
  },
  {
    title: '8. SPECIAL SERVICES',
    icon: '♿',
    subsections: [
      {
        heading: 'Special Meals (Order 24h before via Manage Booking — all free)',
        body: [
          '• MOML — Halal          • KSML — Kosher',
          '• HNML — Hindu Non-Veg  • VGML — Vegan',
          '• GFML — Gluten Free    • DBML — Diabetic',
          '• CHML — Child (2–12)   • BBML — Baby (<2)',
          '• LSML — Low Sodium     • FPML — Fruit Platter',
          '• SFML — Seafood        • VJML — Vegetarian Jain',
          '• VLML — Low Calorie    • LCML — Low Cholesterol',
        ],
      },
      {
        heading: 'Infants & Children',
        body: [
          '• Infants under 2: travel free on lap (1 per adult).',
          '• Bassinet/COTS on long-haul: free, pre-book in advance.',
          '• Stroller/buggy allowed to aircraft door.',
          '• Child meals (CHML) available for ages 2–12.',
        ],
      },
      {
        heading: 'Unaccompanied Minors',
        body: [
          '• Ages 5–11: Unaccompanied Minor service required.',
          '• Fee: £40 each way (waived for Gold EC members).',
          '• Direct flights only, escorted throughout the journey.',
          '• Must be booked at least 24h before departure.',
        ],
      },
      {
        heading: 'Special Assistance',
        body: [
          '• Wheelchair codes: WCHR (walks short distances), WCHC (full), WCBD (dry battery).',
          '• Blind / deaf / other assistance — all free, request at least 48h before.',
          '• MEDIF medical form required for certain medical conditions.',
          '• Assistance dogs travel free in cabin (PETC) with documentation.',
        ],
      },
      {
        heading: 'Pets',
        body: [
          '• No pets in the cabin (except guide/assistance dogs).',
          '• Pets in hold: some routes via BA World Cargo at cargo.ba.com.',
          '• Carrier must be IATA-approved, advance booking required.',
        ],
      },
    ],
  },
  {
    title: '9. IN-FLIGHT SERVICES',
    icon: '📡',
    subsections: [
      {
        heading: 'Wi-Fi & Connectivity',
        body: [
          '• Available on most long-haul and many short-haul aircraft.',
          '• Free messaging (WhatsApp, iMessage, SMS) for all Executive Club members.',
          '• Full browsing: £3.99/hour or £9.99 flight pass.',
          '• Streaming available on A350 and select B777.',
          '• Bluetooth headphone pairing: A350 and select B777 aircraft.',
        ],
      },
      {
        heading: 'Entertainment',
        body: [
          '• 1,000+ hours of on-demand movies, TV shows, music, and games.',
          '• Pause and rewind any content at any time.',
          '• Noise-reducing headphones provided in Club World and First Class.',
          '• Power: USB-A + USB-C + AC socket at every long-haul seat.',
        ],
      },
    ],
  },
  {
    title: '10. TRAVEL DOCUMENTS & VISAS',
    icon: '🛂',
    subsections: [
      {
        heading: 'Passport Requirements',
        body: [
          '• Passport must be valid for at least 6 months beyond your return date.',
          '• Some destinations (EU) accept national ID cards.',
          '• Check requirements via TIMATIC at ba.com before booking.',
        ],
      },
      {
        heading: 'USA, Canada & Australia',
        body: [
          '• USA:       ESTA required. Apply online at esta.cbp.dhs.gov — 72h before.',
          '              Cost: $21. Valid for 2 years / multiple trips.',
          '• Canada:    eTA required for most foreign nationals. Online, CAD $7.',
          '• Australia: ETA or eVisitor — apply online, may be instant.',
          '• UAE:       Visa on arrival for UK/EU passport holders (30 days free).',
        ],
      },
      {
        heading: 'Advance Passenger Information (API)',
        body: [
          '• Required for flights to USA, Canada, Australia, UAE, Saudi Arabia.',
          '• Enter passport details via Manage Booking before online check-in.',
          '• Details must exactly match your passport.',
          '• Failure to submit API may prevent check-in.',
        ],
      },
      {
        heading: 'Travel Insurance',
        body: [
          '• BA recommends comprehensive cover: medical, cancellation, baggage.',
          '• EHIC / GHIC (UK residents): free emergency medical cover in EU/EEA.',
          '• BA insurance via AXA: ba.com/travelinsurance.',
        ],
      },
    ],
  },
  {
    title: '11. KEY ROUTES & SCHEDULES',
    icon: '🗺',
    subsections: [
      {
        heading: 'Long-Haul Routes from London Heathrow',
        body: [
          '• LHR → JFK (New York):     Up to 8 daily. 7h 15m. B777-300ER & A350.',
          '• LHR → DXB (Dubai):        3 daily. 6h 50m. A380 & B787-10.',
          '• LHR → NRT (Tokyo):        Daily BA005. 13h 40m polar route. B787-9.',
          '• LHR → SYD (Sydney):       Daily BA015 via SIN. 21h 30m total.',
          '• LHR → SIN (Singapore):    Daily. 12h 55m. B787-9.',
          '• LHR → BOM (Mumbai):       Double daily. 9h 15m. B787-9 & B777.',
          '• LHR → CPT (Cape Town):    Direct. 11h 20m. Seasonal frequency.',
          '• LHR → MLE (Maldives):     Direct. 10h 30m. Best Nov–Apr.',
          '• LHR → DEL (Delhi):        Daily. 8h 45m. Best Oct–Mar.',
        ],
      },
      {
        heading: 'Short-Haul Routes from London',
        body: [
          '• LHR → BCN (Barcelona):    Up to 6 daily. 2h 15m. A320neo.',
          '• LHR → CDG (Paris):        Up to 7 daily. 1h 15m. A320/A321.',
          '• LHR → AMS (Amsterdam):    Multiple daily. 1h 20m.',
          '• LHR → FCO (Rome):         Daily. 2h 40m.',
          '• LHR → MAD (Madrid):       Daily. 2h 20m.',
          '• LGW → ORL (Orlando):      Daily. 9h. Leisure routes.',
          '• LGW → CPT (Cape Town):    Seasonal. Leisure route.',
        ],
      },
      {
        heading: 'Best Time to Visit Key Destinations',
        body: [
          '• New York:     Apr–Jun, Sep–Nov (mild weather, fewer tourists).',
          '• Dubai:        Nov–Mar (avoid Apr–Oct extreme heat 40°C+).',
          '• Tokyo:        Mar–May (cherry blossom), Sep–Nov (autumn foliage).',
          '• Sydney:       Sep–Nov, Mar–May (Southern Hemisphere spring/autumn).',
          '• Maldives:     Nov–Apr (dry season, best visibility for diving).',
          '• Barcelona:    Apr–Jun, Sep–Oct (warm but not peak summer prices).',
          '• Mumbai:       Nov–Feb (dry, cooler, avoids monsoon Jun–Sep).',
        ],
      },
    ],
  },
  {
    title: '12. CURRENT OFFERS & PROMOTIONS',
    icon: '🏷',
    subsections: [
      {
        heading: 'Active Promotions (2026)',
        body: [
          '• Summer Escape Sale:   Up to 30% off Europe + North America.',
          '    Travel by 31 Aug 2026. Promo code: SUMMER30.',
          '• Business Class Deal:  Club World from £1,299 return to New York.',
          '    Valid to 30 Sep 2026. Code: BIZCLASS.',
          '    Includes lounge access + 2×32 kg bags.',
          '• Double Avios:         2× Avios on all direct BA flights.',
          '    Book by 31 Jul 2026. Opt-in via EC account. Code: DOUBLEAVIOS.',
        ],
      },
      {
        heading: 'Reward Flight Saver (RFS)',
        body: [
          '• Short-haul from 4,750 Avios + £1 (taxes).',
          '• Medium-haul from 9,000 Avios.',
          '• Long-haul from 20,000 Avios (economy, off-peak).',
          '• Club World to NYC return: 80,000 Avios + £350 taxes.',
          '• First Class to NYC return: 100,000 Avios + £350 taxes.',
        ],
      },
    ],
  },
];

// ── PDF Builder ────────────────────────────────────────────────────────────
function buildPDF() {
  const doc = new PDFDocument({
    size:    'A4',
    margins: { top: 60, bottom: 60, left: 55, right: 55 },
    info: {
      Title:   'B Airways — Rules & Knowledge Base',
      Author:  'B Airways AI Team',
      Subject: 'Official BA Policies, Rules & RAG Knowledge Base',
      Keywords:'British Airways, baggage, avios, executive club, uk261, cabin, lounge',
    },
  });

  const stream = fs.createWriteStream(OUTPUT_PATH);
  doc.pipe(stream);

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ── Helper: draw a filled rect ──────────────────────────────────────────
  const fillRect = (x, y, w, h, color) =>
    doc.rect(x, y, w, h).fill(color);

  // ── Cover Page ──────────────────────────────────────────────────────────
  fillRect(0, 0, doc.page.width, doc.page.height, C.baNavy);

  // BA Logo area (text-based)
  doc.fillColor(C.baGold)
     .fontSize(52).font('Helvetica-Bold')
     .text('B', 55, 130)
     .fontSize(18).font('Helvetica-Bold')
     .fillColor(C.white)
     .text('AIRWAYS', 55, 192)
     .fontSize(11).font('Helvetica')
     .fillColor(C.midGrey)
     .text('To Fly. To Serve.', 55, 215);

  // Gold divider
  doc.moveTo(55, 250).lineTo(doc.page.width - 55, 250)
     .strokeColor(C.baGold).lineWidth(2).stroke();

  // Main title
  doc.fillColor(C.white)
     .fontSize(30).font('Helvetica-Bold')
     .text('RULES &', 55, 280)
     .text('KNOWLEDGE BASE', 55, 320);

  doc.fillColor(C.midGrey)
     .fontSize(13).font('Helvetica')
     .text('Official Policies • Cabin Standards • Passenger Rights', 55, 375)
     .text('Baggage Rules • Executive Club • Route Information', 55, 397)
     .text('Special Services • In-flight • Travel Documents', 55, 419);

  doc.moveTo(55, 450).lineTo(doc.page.width - 55, 450)
     .strokeColor(C.baGold).lineWidth(0.5).stroke();

  doc.fillColor(C.midGrey)
     .fontSize(10).font('Helvetica')
     .text(`Generated: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}`, 55, 465)
     .text('Version 2.0 — RAG Knowledge Base', 55, 482)
     .text('For internal AI assistant use and staff reference.', 55, 499);

  // Section count badge
  fillRect(55, 540, 220, 40, C.baBlue);
  doc.fillColor(C.white)
     .fontSize(12).font('Helvetica-Bold')
     .text(`${SECTIONS.length} Policy Sections`, 65, 555);

  doc.addPage();

  // ── Table of Contents ───────────────────────────────────────────────────
  fillRect(0, 0, doc.page.width, 80, C.baBlue);
  doc.fillColor(C.white)
     .fontSize(22).font('Helvetica-Bold')
     .text('TABLE OF CONTENTS', doc.page.margins.left, 25);

  doc.fillColor(C.baGold)
     .fontSize(10)
     .text('B Airways Rules & Knowledge Base 2026', doc.page.margins.left, 55);

  let y = 105;
  doc.fillColor(C.darkGrey).fontSize(12).font('Helvetica-Bold');

  SECTIONS.forEach((sec, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 60; }

    // Section row
    const isEven = i % 2 === 0;
    if (isEven) fillRect(doc.page.margins.left - 5, y - 4, W + 10, 22, C.lightGrey);

    doc.fillColor(C.baBlue).fontSize(11).font('Helvetica-Bold')
       .text(sec.title, doc.page.margins.left + 5, y, { continued: true })
       .fillColor(C.midGrey).font('Helvetica').fontSize(10)
       .text(` — ${sec.subsections.length} subsections`, { align: 'left' });

    y += 26;
  });

  // ── Content pages ───────────────────────────────────────────────────────
  SECTIONS.forEach((section) => {
    doc.addPage();
    let sy = doc.page.margins.top;

    // Section header bar
    fillRect(0, 0, doc.page.width, 70, C.baBlue);
    doc.fillColor(C.baGold)
       .fontSize(9).font('Helvetica-Bold')
       .text('B AIRWAYS', doc.page.margins.left, 14)
       .text('RULES & KNOWLEDGE BASE', doc.page.margins.left + 80, 14);

    doc.fillColor(C.white)
       .fontSize(18).font('Helvetica-Bold')
       .text(section.title, doc.page.margins.left, 32);

    sy = 90;

    section.subsections.forEach((sub) => {
      // Check if we need a new page
      const estimatedHeight = 30 + sub.body.length * 16;
      if (sy + estimatedHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        // Mini header on continuation pages
        fillRect(0, 0, doc.page.width, 35, C.baNavy);
        doc.fillColor(C.baGold).fontSize(8).font('Helvetica-Bold')
           .text(`${section.title} (continued)`, doc.page.margins.left, 12);
        sy = 50;
      }

      // Subsection heading
      fillRect(doc.page.margins.left - 5, sy, W + 10, 22, '#EBF3FB');
      doc.moveTo(doc.page.margins.left - 5, sy)
         .lineTo(doc.page.margins.left - 5, sy + 22)
         .strokeColor(C.baBlue).lineWidth(3).stroke();

      doc.fillColor(C.baBlue)
         .fontSize(11).font('Helvetica-Bold')
         .text(sub.heading, doc.page.margins.left + 5, sy + 5);

      sy += 28;

      // Body lines
      sub.body.forEach((line) => {
        if (sy > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          fillRect(0, 0, doc.page.width, 35, C.baNavy);
          doc.fillColor(C.baGold).fontSize(8).font('Helvetica-Bold')
             .text(`${section.title} (continued)`, doc.page.margins.left, 12);
          sy = 50;
        }

        const isBullet = line.trim().startsWith('•');
        doc.fillColor(isBullet ? C.darkGrey : C.darkGrey)
           .fontSize(10).font(isBullet ? 'Helvetica' : 'Helvetica-Bold')
           .text(line, doc.page.margins.left + (isBullet ? 8 : 0), sy, {
             width: W - 8,
             lineGap: 2,
           });
        sy += 16;
      });

      sy += 12; // spacing between subsections
    });

    // Bottom page rule
    doc.moveTo(doc.page.margins.left, doc.page.height - 45)
       .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 45)
       .strokeColor(C.baBlue).lineWidth(0.5).stroke();

    doc.fillColor(C.midGrey).fontSize(8).font('Helvetica')
       .text('B Airways Rules & Knowledge Base — Confidential — For internal AI/staff use only',
             doc.page.margins.left, doc.page.height - 38, { align: 'center', width: W });
  });

  // ── Final page — RAG Upload Instructions ─────────────────────────────────
  doc.addPage();
  fillRect(0, 0, doc.page.width, 70, C.baNavy);
  doc.fillColor(C.baGold).fontSize(20).font('Helvetica-Bold')
     .text('RAG SYSTEM USAGE', doc.page.margins.left, 25);

  let fy = 95;

  const ragInstructions = [
    {
      heading: 'What is this document?',
      body: 'This PDF is the official B Airways Rules & Knowledge Base used to power the AI Voice Assistant RAG (Retrieval-Augmented Generation) system. It contains all airline policies, cabin standards, passenger rights, baggage rules, and route information.',
    },
    {
      heading: 'How to upload to the RAG system',
      body: '1. Navigate to the Admin Panel in the B Airways app.\n2. Click "Upload PDF to RAG" in the Knowledge Base section.\n3. Select this file (BA_Rules_Knowledge_Base.pdf).\n4. The system will parse, chunk, and index the document automatically.\n5. The voice assistant will begin using the new knowledge immediately.',
    },
    {
      heading: 'Updating the knowledge base',
      body: 'To update policies: edit generateBARulesPDF.js and regenerate. Then re-upload the new PDF. Old chunks are replaced automatically. The RAG system supports multiple PDFs — each is chunked and merged with the existing BM25 + vector indexes.',
    },
    {
      heading: 'API Endpoint',
      body: 'POST /api/rag/upload-pdf\nContent-Type: multipart/form-data\nField: file (PDF, max 10 MB)\nResponse: { success: true, chunks: N, filename: "...", pages: N }',
    },
  ];

  ragInstructions.forEach(item => {
    fillRect(doc.page.margins.left - 5, fy, W + 10, 22, '#EBF3FB');
    doc.moveTo(doc.page.margins.left - 5, fy).lineTo(doc.page.margins.left - 5, fy + 22)
       .strokeColor(C.baGold).lineWidth(3).stroke();
    doc.fillColor(C.baBlue).fontSize(11).font('Helvetica-Bold')
       .text(item.heading, doc.page.margins.left + 5, fy + 5);
    fy += 28;
    doc.fillColor(C.darkGrey).fontSize(10).font('Helvetica')
       .text(item.body, doc.page.margins.left, fy, { width: W, lineGap: 3 });
    fy += (item.body.split('\n').length * 16) + 20;
  });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(OUTPUT_PATH));
    stream.on('error',  reject);
  });
}

// ── Run ───────────────────────────────────────────────────────────────────
buildPDF()
  .then(outPath => {
    const size = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`✅  PDF generated successfully!`);
    console.log(`📄  File: ${outPath}`);
    console.log(`📦  Size: ${size} KB`);
    console.log(`📚  Sections: ${SECTIONS.length}`);
    console.log(`\nUpload it via: POST /api/rag/upload-pdf`);
  })
  .catch(err => {
    console.error('❌  PDF generation failed:', err.message);
    process.exit(1);
  });
