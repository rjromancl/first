/**
 * ragService.test.js — 100+ Comprehensive Agentic RAG Test Suite
 * 
 * Test Coverage:
 *  ✓ Intent Classification: 70 tests (19 intents × 3-4 variations)
 *  ✓ Entity Extraction: 10 tests
 *  ✓ Query Expansion: 7 tests
 *  ✓ BM25 Retrieval: 6 tests
 *  ✓ RRF Merge: 3 tests
 *  ✓ Context Retrieval: 12 tests
 *  ✓ Knowledge Base: 3 tests
 *  ✓ Tool Schema: 3 tests
 *  ✓ Edge Cases: 10 tests
 *  ═══════════════════════════
 *  TOTAL: 124 tests
 */

const {
  classifyQueryIntent,
  expandBAQuery,
  queryBM25Docs,
  reciprocalRankFusion,
  getContext,
  getContextWithSources,
  getAllKnowledgeDocs,
  AGENTIC_TOOLS,
  isReady,
} = require('./ragService');

// ═══════════════════════════════════════════════════════════════════════════
// 1. INTENT CLASSIFICATION (70 tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('1. Intent Classification — 70 tests', () => {

  // ── UK261 (4 tests) ──────────────────────────────────────────────────────
  describe('UK261', () => {
    test('1.  delay compensation keyword', () => {
      expect(classifyQueryIntent('What is my UK261 compensation for a 4 hour delay?').intent).toBe('UK261');
    });
    test('2.  cancelled flight refund', () => {
      expect(classifyQueryIntent('My flight was cancelled am I entitled to a refund?').intent).toBe('UK261');
    });
    test('3.  duty of care overnight', () => {
      expect(classifyQueryIntent('Does BA have duty of care if I am delayed overnight?').intent).toBe('UK261');
    });
    test('4.  EU261 variant keyword', () => {
      expect(classifyQueryIntent('What is EU261 compensation for a delayed British Airways flight?').intent).toBe('UK261');
    });
  });

  // ── BAGGAGE (5 tests) ────────────────────────────────────────────────────
  describe('BAGGAGE', () => {
    test('5.  hand baggage limit', () => {
      expect(classifyQueryIntent('What is the hand baggage limit?').intent).toBe('BAGGAGE');
    });
    test('6.  extra luggage cost long-haul', () => {
      expect(classifyQueryIntent('How much does extra luggage cost on long-haul?').intent).toBe('BAGGAGE');
    });
    test('7.  bag allowance with tier + cabin entities', () => {
      const r = classifyQueryIntent('Can I bring extra baggage as a Silver member in Club World?');
      expect(r.intent).toBe('BAGGAGE');
      expect(r.entities.tier).toContain('Silver');
      expect(r.entities.cabin).toContain('Club World');
    });
    test('8.  checked bag weight limit in economy', () => {
      expect(classifyQueryIntent('How many kg can I check in economy class?').intent).toBe('BAGGAGE');
    });
    test('9.  carry-on and personal item', () => {
      expect(classifyQueryIntent('Can I take a carry on and a personal item?').intent).toBe('BAGGAGE');
    });
  });

  // ── BOOKING (5 tests) ────────────────────────────────────────────────────
  describe('BOOKING', () => {
    test('10. manage my booking', () => {
      expect(classifyQueryIntent('How do I manage my booking?').intent).toBe('BOOKING');
    });
    test('11. change flight date', () => {
      expect(classifyQueryIntent('I want to change my flight date').intent).toBe('BOOKING');
    });
    test('12. booking reference lookup + entity', () => {
      const r = classifyQueryIntent('Find my booking ABC123');
      expect(r.intent).toBe('BOOKING');
      expect(r.entities.reference).toContain('ABC123');
    });
    test('13. name correction on booking', () => {
      expect(classifyQueryIntent('I need to do a name correction on my booking').intent).toBe('BOOKING');
    });
    test('14. seat selection', () => {
      expect(classifyQueryIntent('How do I choose my seat?').intent).toBe('BOOKING');
    });
  });

  // ── CHECKIN (3 tests) ────────────────────────────────────────────────────
  describe('CHECKIN', () => {
    test('15. online check-in', () => {
      expect(classifyQueryIntent('How do I check in online for my flight?').intent).toBe('CHECKIN');
    });
    test('16. boarding pass', () => {
      expect(classifyQueryIntent('Where do I get my boarding pass?').intent).toBe('CHECKIN');
    });
    test('17. web check-in open time', () => {
      expect(classifyQueryIntent('When does web check-in open?').intent).toBe('CHECKIN');
    });
  });

  // ── FLIGHT_STATUS (4 tests) ──────────────────────────────────────────────
  describe('FLIGHT_STATUS', () => {
    test('18. live status by flight number + entity', () => {
      const r = classifyQueryIntent('What is the live status of flight BA117?');
      expect(r.intent).toBe('FLIGHT_STATUS');
      expect(r.entities.flight).toContain('BA117');
    });
    test('19. is my flight on time', () => {
      expect(classifyQueryIntent('Is my flight on time today?').intent).toBe('FLIGHT_STATUS');
    });
    test('20. gate number with flight entity', () => {
      const r = classifyQueryIntent('What gate is BA474 departing from?');
      expect(r.intent).toBe('FLIGHT_STATUS');
      expect(r.entities.flight).toContain('BA474');
    });
    test('21. has landed query', () => {
      const r = classifyQueryIntent('Has BA015 landed yet?');
      expect(r.intent).toBe('FLIGHT_STATUS');
      expect(r.entities.flight).toContain('BA015');
    });
  });

  // ── LOUNGE (4 tests) ─────────────────────────────────────────────────────
  describe('LOUNGE', () => {
    test('22. Concorde Room at T5', () => {
      expect(classifyQueryIntent('Can I use the Concorde Room at Heathrow T5?').intent).toBe('LOUNGE');
    });
    test('23. Silver member lounge access', () => {
      expect(classifyQueryIntent('Do Silver members get lounge access?').intent).toBe('LOUNGE');
    });
    test('24. First Wing query', () => {
      expect(classifyQueryIntent('What is the First Wing at LHR?').intent).toBe('LOUNGE');
    });
    test('25. shower facilities at JFK lounge', () => {
      expect(classifyQueryIntent('Are there showers in the BA lounge at JFK?').intent).toBe('LOUNGE');
    });
  });

  // ── EXECUTIVE_CLUB (5 tests) ─────────────────────────────────────────────
  describe('EXECUTIVE_CLUB', () => {
    test('26. tier points for Gold + entity', () => {
      const r = classifyQueryIntent('How many Tier Points do I need for Gold status?');
      expect(r.intent).toBe('EXECUTIVE_CLUB');
      expect(r.entities.tier).toContain('Gold');
    });
    test('27. earn Avios on Business', () => {
      expect(classifyQueryIntent('How do I earn Avios on a Business class flight?').intent).toBe('EXECUTIVE_CLUB');
    });
    test('28. Amex companion voucher', () => {
      expect(classifyQueryIntent('How does the BA Amex companion voucher work?').intent).toBe('EXECUTIVE_CLUB');
    });
    test('29. reward flight Avios + IATA entity', () => {
      const r = classifyQueryIntent('How many Avios do I need for a reward flight to New York?');
      expect(r.intent).toBe('EXECUTIVE_CLUB');
      expect(r.entities.iata).toContain('JFK');
    });
    test('30. Silver tier benefits', () => {
      const r = classifyQueryIntent('What are the benefits of Silver Executive Club?');
      expect(r.intent).toBe('EXECUTIVE_CLUB');
      expect(r.entities.tier).toContain('Silver');
    });
  });

  // ── CABIN (4 tests) ──────────────────────────────────────────────────────
  describe('CABIN', () => {
    test('31. Club Suite details', () => {
      expect(classifyQueryIntent('What does the Club Suite cabin include?').intent).toBe('CABIN');
    });
    test('32. flat bed in business class', () => {
      expect(classifyQueryIntent('Does business class have a flat bed?').intent).toBe('CABIN');
    });
    test('33. legroom in World Traveller Plus', () => {
      expect(classifyQueryIntent('How much legroom is there in World Traveller Plus?').intent).toBe('CABIN');
    });
    test('34. First Class amenities', () => {
      expect(classifyQueryIntent('What amenities are included in First Class?').intent).toBe('CABIN');
    });
  });

  // ── DESTINATION (3 tests) ────────────────────────────────────────────────
  describe('DESTINATION', () => {
    test('35. where does BA fly from London', () => {
      expect(classifyQueryIntent('Where does BA fly from London?').intent).toBe('DESTINATION');
    });
    test('36. recommend holiday destination', () => {
      expect(classifyQueryIntent('Can you recommend a popular holiday destination?').intent).toBe('DESTINATION');
    });
    test('37. best places to visit with BA', () => {
      expect(classifyQueryIntent('What are the best places to visit with BA?').intent).toBe('DESTINATION');
    });
  });

  // ── BOOK_FLIGHT (3 tests) ────────────────────────────────────────────────
  describe('BOOK_FLIGHT', () => {
    test('38. book flight to New York + IATA entity', () => {
      const r = classifyQueryIntent('I want to book a flight to New York');
      expect(r.intent).toBe('BOOK_FLIGHT');
      expect(r.entities.iata).toContain('JFK');
    });
    test('39. price to fly to Dubai + IATA entity', () => {
      const r = classifyQueryIntent('How much does it cost to fly to Dubai?');
      expect(r.intent).toBe('BOOK_FLIGHT');
      expect(r.entities.iata).toContain('DXB');
    });
    test('40. find flights LHR to SYD', () => {
      const r = classifyQueryIntent('Find me flights from LHR to SYD next month');
      expect(r.intent).toBe('BOOK_FLIGHT');
      expect(r.entities.iata).toContain('LHR');
      expect(r.entities.iata).toContain('SYD');
    });
  });

  // ── AIRPORT (3 tests) ────────────────────────────────────────────────────
  describe('AIRPORT', () => {
    test('41. which terminal at Heathrow', () => {
      expect(classifyQueryIntent('Which terminal does BA use at Heathrow?').intent).toBe('AIRPORT');
    });
    test('42. where is Terminal 5', () => {
      expect(classifyQueryIntent('Where is Terminal 5 at LHR?').intent).toBe('AIRPORT');
    });
    test('43. BA at Gatwick', () => {
      expect(classifyQueryIntent('What terminal is BA at Gatwick?').intent).toBe('AIRPORT');
    });
  });

  // ── ROUTE (3 tests) ──────────────────────────────────────────────────────
  describe('ROUTE', () => {
    test('44. flight duration London to Tokyo', () => {
      expect(classifyQueryIntent('How long is the flight from London to Tokyo?').intent).toBe('ROUTE');
    });
    test('45. does BA fly direct to Sydney', () => {
      expect(classifyQueryIntent('Does BA fly direct to Sydney?').intent).toBe('ROUTE');
    });
    test('46. non-stop to Singapore', () => {
      expect(classifyQueryIntent('Is there a non-stop flight to Singapore?').intent).toBe('ROUTE');
    });
  });

  // ── OFFER (3 tests) ──────────────────────────────────────────────────────
  describe('OFFER', () => {
    test('47. deals or discounts on BA', () => {
      expect(classifyQueryIntent('Are there any deals or discounts on BA flights?').intent).toBe('OFFER');
    });
    test('48. next BA sale', () => {
      expect(classifyQueryIntent('When is the next BA sale?').intent).toBe('OFFER');
    });
    test('49. promo codes', () => {
      expect(classifyQueryIntent('Do you have any promo codes for cheap flights?').intent).toBe('OFFER');
    });
  });

  // ── SPECIAL_MEAL (3 tests) ───────────────────────────────────────────────
  describe('SPECIAL_MEAL', () => {
    test('50. order halal meal', () => {
      expect(classifyQueryIntent('How do I order a halal meal on my flight?').intent).toBe('SPECIAL_MEAL');
    });
    test('51. vegan meal option', () => {
      expect(classifyQueryIntent('Is there a vegan meal option on BA?').intent).toBe('SPECIAL_MEAL');
    });
    test('52. gluten-free meal', () => {
      expect(classifyQueryIntent('Can I get a gluten-free meal on board?').intent).toBe('SPECIAL_MEAL');
    });
  });

  // ── SPECIAL_SERVICE (3 tests) ────────────────────────────────────────────
  describe('SPECIAL_SERVICE', () => {
    test('53. wheelchair assistance', () => {
      expect(classifyQueryIntent('I need wheelchair assistance at the airport').intent).toBe('SPECIAL_SERVICE');
    });
    test('54. accessibility services', () => {
      expect(classifyQueryIntent('What accessibility services does BA provide?').intent).toBe('SPECIAL_SERVICE');
    });
    test('55. unaccompanied minor', () => {
      expect(classifyQueryIntent('Can my 8 year old fly alone as an unaccompanied minor?').intent).toBe('SPECIAL_SERVICE');
    });
  });

  // ── FAMILY (3 tests) ─────────────────────────────────────────────────────
  describe('FAMILY', () => {
    test('56. baby on lap', () => {
      expect(classifyQueryIntent('Can my baby travel on my lap?').intent).toBe('FAMILY');
    });
    test('57. bassinet for infant', () => {
      expect(classifyQueryIntent('How do I book a bassinet for my infant?').intent).toBe('FAMILY');
    });
    test('58. special meal for children', () => {
      expect(classifyQueryIntent('Is there a special meal for children on long-haul?').intent).toBe('FAMILY');
    });
  });

  // ── TRAVEL_DOCS (3 tests) ────────────────────────────────────────────────
  describe('TRAVEL_DOCS', () => {
    test('59. ESTA to fly to US', () => {
      expect(classifyQueryIntent('Do I need an ESTA to fly to the US?').intent).toBe('TRAVEL_DOCS');
    });
    test('60. passport validity for Australia', () => {
      expect(classifyQueryIntent('What passport validity do I need to enter Australia?').intent).toBe('TRAVEL_DOCS');
    });
    test('61. visa requirement for Dubai', () => {
      expect(classifyQueryIntent('Do I need a visa for Dubai?').intent).toBe('TRAVEL_DOCS');
    });
  });

  // ── PETS (2 tests) ───────────────────────────────────────────────────────
  describe('PETS', () => {
    test('62. take dog in cabin', () => {
      expect(classifyQueryIntent('Can I take my dog in the cabin?').intent).toBe('PETS');
    });
    test('63. BA pet travel policy', () => {
      expect(classifyQueryIntent('Does BA allow pets on flights?').intent).toBe('PETS');
    });
  });

  // ── INFLIGHT_SERVICES (3 tests) ──────────────────────────────────────────
  describe('INFLIGHT_SERVICES', () => {
    test('64. wifi on flight', () => {
      expect(classifyQueryIntent('Is there wifi on the flight?').intent).toBe('INFLIGHT_SERVICES');
    });
    test('65. entertainment available', () => {
      expect(classifyQueryIntent('What entertainment is available onboard?').intent).toBe('INFLIGHT_SERVICES');
    });
    test('66. use internet during flight', () => {
      expect(classifyQueryIntent('Can I use the internet during the flight?').intent).toBe('INFLIGHT_SERVICES');
    });
  });

  // ── INSURANCE (2 tests) ──────────────────────────────────────────────────
  describe('INSURANCE', () => {
    test('67. BA travel insurance', () => {
      expect(classifyQueryIntent('Does BA offer travel insurance?').intent).toBe('INSURANCE');
    });
    test('68. medical cover with ticket', () => {
      expect(classifyQueryIntent('Is medical cover included with my ticket?').intent).toBe('INSURANCE');
    });
  });

  // ── GENERAL fallback (2 tests) ───────────────────────────────────────────
  describe('GENERAL fallback', () => {
    test('69. unrecognised query falls back', () => {
      expect(classifyQueryIntent('Tell me about the history of aviation').intent).toBe('GENERAL');
    });
    test('70. off-topic question falls back', () => {
      expect(classifyQueryIntent('What is the capital of France?').intent).toBe('GENERAL');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ENTITY EXTRACTION (10 tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('2. Entity Extraction — 10 tests', () => {
  test('71. extracts multiple explicit IATA codes', () => {
    const r = classifyQueryIntent('Flight from LHR to JFK and connecting to LAX');
    expect(r.entities.iata).toContain('LHR');
    expect(r.entities.iata).toContain('JFK');
    expect(r.entities.iata).toContain('LAX');
  });

  test('72. maps city names to IATA', () => {
    const r = classifyQueryIntent('Book a flight from London to New York please');
    expect(r.entities.iata).toContain('LHR');
    expect(r.entities.iata).toContain('JFK');
  });

  test('73. extracts multiple flight numbers', () => {
    const r = classifyQueryIntent('What is the status of BA117 and BA474 today?');
    expect(r.entities.flight).toContain('BA117');
    expect(r.entities.flight).toContain('BA474');
  });

  test('74. extracts alphanumeric booking reference', () => {
    const r = classifyQueryIntent('Please look up my booking XY1234');
    expect(r.entities.reference).toContain('XY1234');
  });

  test('75. extracts multiple tier levels', () => {
    const r = classifyQueryIntent('What is the difference between Silver and Gold status?');
    expect(r.entities.tier).toContain('Silver');
    expect(r.entities.tier).toContain('Gold');
  });

  test('76. extracts cabin class upgrade context', () => {
    const r = classifyQueryIntent('Can I upgrade from economy to business class?');
    expect(r.entities.cabin).toContain('Club World');
    expect(r.entities.cabin).toContain('World Traveller');
  });

  test('77. extracts mixed entities in one query', () => {
    const r = classifyQueryIntent('BA117 from LHR to JFK in First Class as a Gold member');
    expect(r.entities.flight).toContain('BA117');
    expect(r.entities.iata).toContain('LHR');
    expect(r.entities.iata).toContain('JFK');
    expect(r.entities.tier).toContain('Gold');
    expect(r.entities.cabin).toContain('First');
  });

  test('78. maps Dubai and Singapore city names', () => {
    const r = classifyQueryIntent('Flying to Dubai and Singapore next week');
    expect(r.entities.iata).toContain('DXB');
    expect(r.entities.iata).toContain('SIN');
  });

  test('79. extracts alphanumeric reference with mixed case', () => {
    const r = classifyQueryIntent('My booking reference is A1B2C3');
    expect(r.entities.reference).toContain('A1B2C3');
  });

  test('80. does not extract purely alphabetic 6-char string as reference', () => {
    const r = classifyQueryIntent('My surname is JOHNSO');
    expect(r.entities.reference.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. QUERY EXPANSION (7 tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('3. Query Expansion — 7 tests', () => {
  test('81. expands "business class" to Club World and Club Suite', () => {
    const exp = expandBAQuery('business class seat');
    expect(exp).toContain('club world');
    expect(exp).toContain('club suite');
  });

  test('82. expands "luggage" and "carry on" to hand luggage terms', () => {
    const exp = expandBAQuery('carry on luggage limit');
    expect(exp).toContain('hand luggage');
    expect(exp).toContain('personal item');
  });

  test('83. expands "points" to avios and tier points', () => {
    const exp = expandBAQuery('how many points do I need');
    expect(exp).toContain('avios');
    expect(exp).toContain('tier points');
  });

  test('84. expands "lounge" to Galleries and Concorde Room', () => {
    const exp = expandBAQuery('airport lounge access');
    expect(exp).toContain('galleries');
    expect(exp).toContain('concorde room');
  });

  test('85. expands "delay" to uk261 and compensation', () => {
    const exp = expandBAQuery('flight delay rights');
    expect(exp).toContain('uk261');
    expect(exp).toContain('compensation');
  });

  test('86. expands "terminal 5" to T5 and First Wing', () => {
    const exp = expandBAQuery('terminal 5 check in');
    expect(exp).toContain('t5');
    expect(exp).toContain('first wing');
  });

  test('87. expands "heathrow" to LHR and T5', () => {
    const exp = expandBAQuery('heathrow airport guide');
    expect(exp).toContain('lhr');
    expect(exp).toContain('t5');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. BM25 RETRIEVAL (6 tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('4. BM25 Retrieval — 6 tests', () => {
  test('88. returns hand baggage doc as top result', () => {
    const intent = classifyQueryIntent('What is the hand baggage weight limit?');
    const exp    = expandBAQuery('What is the hand baggage weight limit?');
    const docs   = queryBM25Docs(exp, intent, 5);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].text.toLowerCase()).toContain('cabin bag');
  });

  test('89. returns UK261 doc for delay compensation', () => {
    const intent = classifyQueryIntent('UK261 compensation 4 hour delay');
    const exp    = expandBAQuery('UK261 compensation 4 hour delay');
    const docs   = queryBM25Docs(exp, intent, 5);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].id).toContain('uk261');
  });

  test('90. returns tier doc mentioning Gold', () => {
    const intent = classifyQueryIntent('Gold tier benefits Executive Club');
    const exp    = expandBAQuery('Gold tier benefits Executive Club');
    const docs   = queryBM25Docs(exp, intent, 5);
    expect(docs.length).toBeGreaterThan(0);
    const combined = docs.map(d => d.text.toLowerCase()).join(' ');
    expect(combined).toContain('gold');
  });

  test('91. returns destination-category doc', () => {
    const intent = classifyQueryIntent('Flight to New York JFK from London');
    const exp    = expandBAQuery('Flight to New York JFK from London');
    const docs   = queryBM25Docs(exp, intent, 5);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.some(d => d.metadata?.category === 'destination')).toBe(true);
  });

  test('92. IATA entity boost produces score above threshold', () => {
    const intent = classifyQueryIntent('Flights from LHR to JFK details');
    const exp    = expandBAQuery('Flights from LHR to JFK details');
    const docs   = queryBM25Docs(exp, intent, 5);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].bm25Score).toBeGreaterThan(5);
  });

  test('93. topK parameter limits returned doc count', () => {
    const intent = classifyQueryIntent('baggage allowance policy');
    const exp    = expandBAQuery('baggage allowance policy');
    const docs   = queryBM25Docs(exp, intent, 3);
    expect(docs.length).toBeLessThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. RECIPROCAL RANK FUSION (3 tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('5. Reciprocal Rank Fusion — 3 tests', () => {
  test('94. merges vector and BM25 with RRF scoring', () => {
    const vectorDocs = [
      { id: 'doc-a', text: 'Doc A', distance: 0.1, metadata: {} },
      { id: 'doc-b', text: 'Doc B', distance: 0.3, metadata: {} },
    ];
    const bm25Docs = [
      { id: 'doc-a', text: 'Doc A', bm25Score: 12.0, metadata: {} },
      { id: 'doc-c', text: 'Doc C', bm25Score: 9.0,  metadata: {} },
    ];
    const rrf = reciprocalRankFusion(vectorDocs, bm25Docs, 5);
    expect(rrf.length).toBe(3);
    expect(rrf[0].id).toBe('doc-a'); // appears in both = highest RRF
  });

  test('95. ranks docs by descending RRF score', () => {
    const vectorDocs = [{ id: 'doc-x', text: 'X', distance: 0.2, metadata: {} }];
    const bm25Docs   = [
      { id: 'doc-x', text: 'X', bm25Score: 15, metadata: {} },
      { id: 'doc-y', text: 'Y', bm25Score: 12, metadata: {} },
    ];
    const rrf = reciprocalRankFusion(vectorDocs, bm25Docs, 5);
    expect(rrf[0].id).toBe('doc-x');
    expect(rrf[0].rrfScore).toBeGreaterThan(rrf[1].rrfScore);
  });

  test('96. respects topK limit in final result', () => {
    const vectorDocs = [
      { id: 'd1', text: '1', distance: 0.1, metadata: {} },
      { id: 'd2', text: '2', distance: 0.2, metadata: {} },
    ];
    const bm25Docs = [
      { id: 'd3', text: '3', bm25Score: 10, metadata: {} },
      { id: 'd4', text: '4', bm25Score: 8,  metadata: {} },
    ];
    const rrf = reciprocalRankFusion(vectorDocs, bm25Docs, 2);
    expect(rrf.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. getContext — ASYNC RETRIEVAL (12 tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('6. getContext — 12 tests', () => {
  test('97.  returns null for empty string', async () => {
    expect(await getContext('')).toBeNull();
  });

  test('98.  returns null for whitespace-only', async () => {
    expect(await getContext('   ')).toBeNull();
  });

  test('99.  UK261 context contains compensation info', async () => {
    const ctx = await getContext('What is UK261 compensation for a cancelled flight?');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('UK261');
  });

  test('100. Baggage context contains cabin bag info', async () => {
    const ctx = await getContext('What is the hand baggage limit on BA?');
    expect(ctx).not.toBeNull();
    expect(ctx.toLowerCase()).toContain('cabin bag');
  });

  test('101. Silver lounge context contains Galleries Club', async () => {
    const ctx = await getContext('Does Silver Executive Club get lounge access at LHR T5?');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('Silver');
    expect(ctx).toContain('Galleries Club');
  });

  test('102. context for Gold status contains tier point value', async () => {
    const ctx = await getContext('How many Tier Points do I need for Gold?');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('1,500');
  });

  test('103. JFK destination context contains route info', async () => {
    const ctx = await getContext('Tell me about BA flights to New York JFK');
    expect(ctx).not.toBeNull();
    expect(ctx.toUpperCase()).toContain('JFK');
  });

  test('104. cabin context contains flat bed for Club Suite', async () => {
    const ctx = await getContext('Does Club Suite have a flat bed?');
    expect(ctx).not.toBeNull();
    expect(ctx.toLowerCase()).toContain('flat bed');
  });

  test('105. context is a non-empty string when docs found', async () => {
    const ctx = await getContext('What meals can I order on a BA flight?');
    expect(ctx).not.toBeNull();
    expect(typeof ctx).toBe('string');
    expect(ctx.length).toBeGreaterThan(100);
  });

  test('106. context is capped below MAX_CONTEXT_CHARS', async () => {
    const ctx = await getContext('Tell me everything about British Airways baggage lounges cabins rewards');
    expect(ctx).not.toBeNull();
    expect(ctx.length).toBeLessThanOrEqual(5100); // 5000 + small overflow margin
  });

  test('107. context contains category label header', async () => {
    const ctx = await getContext('baggage allowance for economy');
    expect(ctx).not.toBeNull();
    expect(ctx).toMatch(/\[BAGGAGE/i);
  });

  test('108. context for flight status contains route keyword', async () => {
    const ctx = await getContext('What is the status of BA117 to JFK?');
    expect(ctx).not.toBeNull();
    // Should surface route or destination docs mentioning JFK
    expect(ctx.toUpperCase()).toContain('JFK');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. getContextWithSources (4 tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('7. getContextWithSources — 4 tests', () => {
  test('109. returns null context and empty sources for empty query', async () => {
    const r = await getContextWithSources('');
    expect(r.context).toBeNull();
    expect(r.sources).toEqual([]);
    expect(r.intent).toBe('GENERAL');
  });

  test('110. returns correct intent in metadata', async () => {
    const r = await getContextWithSources('What is the baggage limit?');
    expect(r.intent).toBe('BAGGAGE');
    expect(r.context).not.toBeNull();
  });

  test('111. sources array contains category and id fields', async () => {
    const r = await getContextWithSources('UK261 compensation delayed flight');
    expect(r.sources.length).toBeGreaterThan(0);
    expect(r.sources[0]).toHaveProperty('id');
    expect(r.sources[0]).toHaveProperty('category');
    expect(r.sources[0]).toHaveProperty('score');
  });

  test('112. entities are returned alongside context', async () => {
    const r = await getContextWithSources('BA117 from LHR to JFK status');
    expect(r.entities.iata).toContain('LHR');
    expect(r.entities.iata).toContain('JFK');
    expect(r.entities.flight).toContain('BA117');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. KNOWLEDGE BASE COMPLETENESS (3 tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('8. Knowledge Base — 3 tests', () => {
  test('113. knowledge base contains 80+ documents', () => {
    const docs = getAllKnowledgeDocs();
    expect(docs.length).toBeGreaterThanOrEqual(80);
  });

  test('114. all docs have required fields (id, text, metadata)', () => {
    const docs = getAllKnowledgeDocs();
    docs.forEach(doc => {
      expect(doc).toHaveProperty('id');
      expect(doc).toHaveProperty('text');
      expect(doc).toHaveProperty('metadata');
      expect(typeof doc.id).toBe('string');
      expect(typeof doc.text).toBe('string');
      expect(typeof doc.metadata).toBe('object');
    });
  });

  test('115. knowledge base covers all key categories', () => {
    const docs = getAllKnowledgeDocs();
    const categories = [...new Set(docs.map(d => d.metadata?.category).filter(Boolean))];
    expect(categories).toContain('destination');
    expect(categories).toContain('executive-club');
    expect(categories).toContain('lounge');
    expect(categories).toContain('cabin');
    expect(categories).toContain('baggage');
    expect(categories).toContain('uk261');
    expect(categories).toContain('booking');
    expect(categories).toContain('service');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. AGENTIC TOOL SCHEMA (3 tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('9. Agentic Tool Schema — 3 tests', () => {
  test('116. AGENTIC_TOOLS exports an array of tools', () => {
    expect(Array.isArray(AGENTIC_TOOLS)).toBe(true);
    expect(AGENTIC_TOOLS.length).toBeGreaterThanOrEqual(7);
  });

  test('117. every tool has name, description, and parameters', () => {
    AGENTIC_TOOLS.forEach(tool => {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('parameters');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.parameters).toBe('object');
    });
  });

  test('118. key tools are present by name', () => {
    const names = AGENTIC_TOOLS.map(t => t.name);
    expect(names).toContain('search_flights');
    expect(names).toContain('get_booking');
    expect(names).toContain('get_flight_status');
    expect(names).toContain('calculate_avios');
    expect(names).toContain('navigate');
    expect(names).toContain('check_in');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. EDGE CASES (10 tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('10. Edge Cases — 10 tests', () => {
  test('119. empty query → GENERAL intent, empty entities', () => {
    const r = classifyQueryIntent('');
    expect(r.intent).toBe('GENERAL');
    expect(r.entities.iata).toEqual([]);
    expect(r.entities.flight).toEqual([]);
    expect(r.entities.reference).toEqual([]);
  });

  test('120. single character query returns GENERAL', () => {
    const r = classifyQueryIntent('?');
    expect(r.intent).toBe('GENERAL');
  });

  test('121. gibberish query returns GENERAL intent', () => {
    const r = classifyQueryIntent('xzqwerty12345 foobar baz');
    expect(r.intent).toBe('GENERAL');
  });

  test('122. Tamil-language query still extracts IATA from mixed text', () => {
    // Mixed Tamil-English query — IATA codes should still be extracted
    const r = classifyQueryIntent('LHR இலிருந்து DXB விமான நிலை என்ன?');
    expect(r.entities.iata).toContain('LHR');
    expect(r.entities.iata).toContain('DXB');
  });

  test('123. Tanglish query classifies flight status intent', () => {
    // Tanglish: Tamil + English mix — flight number present
    const r = classifyQueryIntent('BA117 flight status enna aachu?');
    expect(r.intent).toBe('FLIGHT_STATUS');
    expect(r.entities.flight).toContain('BA117');
  });

  test('124. very long query (>500 chars) still classifies correctly', () => {
    const longQuery =
      'I am a Gold Executive Club member flying from London Heathrow T5 to New York JFK ' +
      'on flight BA117 on a fully flexible Club Suite ticket and I would like to know about ' +
      'my UK261 rights regarding potential flight delay compensation if the aircraft is delayed ' +
      'by more than 3 hours on arrival and what my duty of care entitlement is for meals, ' +
      'refreshments, hotel accommodation and alternative transportation in such circumstances ' +
      'including whether my Gold status provides any additional entitlements beyond the standard ' +
      'statutory provisions under United Kingdom aviation law following Brexit.';
    const r = classifyQueryIntent(longQuery);
    expect(r.intent).toBe('UK261');
    expect(r.entities.iata).toContain('LHR');
    expect(r.entities.iata).toContain('JFK');
    expect(r.entities.flight).toContain('BA117');
    expect(r.entities.tier).toContain('Gold');
  });

  test('125. all-uppercase query is handled', () => {
    const r = classifyQueryIntent('WHAT IS THE BAGGAGE LIMIT ON BA?');
    expect(r.intent).toBe('BAGGAGE');
  });

  test('126. numbers-only string returns GENERAL', () => {
    const r = classifyQueryIntent('123456789');
    expect(r.intent).toBe('GENERAL');
  });

  test('127. expandBAQuery on empty string returns empty string', () => {
    const exp = expandBAQuery('');
    expect(typeof exp).toBe('string');
    expect(exp.trim()).toBe('');
  });

  test('128. BM25 on empty expanded query returns empty or zero-score docs', () => {
    const intent = classifyQueryIntent('');
    const docs   = queryBM25Docs('', intent, 5);
    // Should return docs but all with score 0 (no tokens to match)
    // or an empty array — either is valid
    docs.forEach(doc => {
      expect(doc.bm25Score).toBeLessThanOrEqual(0.1);
    });
  });
});
