const {
  classifyQueryIntent,
  expandBAQuery,
  queryBM25Docs,
  reciprocalRankFusion,
  getContext,
} = require('./ragService');

describe('Advanced B Airways RAG Service', () => {
  describe('classifyQueryIntent', () => {
    it('classifies UK261 compensation and delay queries', () => {
      const res = classifyQueryIntent('What is my UK261 compensation for a 4 hour delay on BA117 to JFK?');
      expect(res.intent).toBe('UK261');
      expect(res.entities.iata).toContain('JFK');
      expect(res.entities.flight).toContain('BA117');
    });

    it('classifies Baggage policy and tier queries', () => {
      const res = classifyQueryIntent('Can I bring extra baggage as a Silver member in Club World?');
      expect(res.intent).toBe('BAGGAGE');
      expect(res.entities.tier).toContain('Silver');
      expect(res.entities.cabin).toContain('Club World');
    });

    it('classifies Executive Club & Tier Point queries', () => {
      const res = classifyQueryIntent('How many Tier Points do I need for Gold status?');
      expect(res.intent).toBe('EXECUTIVE_CLUB');
      expect(res.entities.tier).toContain('Gold');
    });

    it('classifies Lounge access queries', () => {
      const res = classifyQueryIntent('Can I use the Concorde Room lounge at Heathrow Terminal 5?');
      expect(res.intent).toBe('LOUNGE');
    });
  });

  describe('expandBAQuery', () => {
    it('expands colloquial business class to Club World / Suite', () => {
      const expanded = expandBAQuery('business class to New York');
      expect(expanded).toContain('club world');
      expect(expanded).toContain('club suite');
    });

    it('expands luggage terms to baggage', () => {
      const expanded = expandBAQuery('carry on luggage limit');
      expect(expanded).toContain('hand luggage');
      expect(expanded).toContain('personal item');
    });
  });

  describe('queryBM25Docs & ReciprocalRankFusion', () => {
    it('retrieves relevant baggage policy document via hybrid search', () => {
      const intentData = classifyQueryIntent('What is the hand baggage weight limit?');
      const expanded = expandBAQuery('What is the hand baggage weight limit?');
      const docs = queryBM25Docs(expanded, intentData, 5);

      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].text.toLowerCase()).toContain('cabin bag');
    });

    it('merges vector and BM25 search rankings with RRF', () => {
      const vectorDocs = [
        { id: 'ec-tier-gold', text: 'Gold tier info', distance: 0.1, metadata: {} },
      ];
      const bm25Docs = [
        { id: 'ec-tier-gold', text: 'Gold tier info', bm25Score: 12.0, metadata: {} },
        { id: 'lounge-galleries-first', text: 'First lounge info', bm25Score: 8.0, metadata: {} },
      ];

      const rrf = reciprocalRankFusion(vectorDocs, bm25Docs, 5);
      expect(rrf.length).toBe(2);
      expect(rrf[0].id).toBe('ec-tier-gold');
      expect(rrf[0].rrfScore).toBeGreaterThan(rrf[1].rrfScore);
    });
  });

  describe('getContext', () => {
    it('returns rich structured context for UK261 compensation query', async () => {
      const context = await getContext('How much UK261 compensation do I get for a cancelled flight?');
      expect(context).not.toBeNull();
      expect(context).toContain('UK261');
      expect(context.toLowerCase()).toContain('cancellation');
    });

    it('returns rich context for Silver tier lounge access', async () => {
      const context = await getContext('Does Silver Executive Club get lounge access at London Heathrow T5?');
      expect(context).not.toBeNull();
      expect(context).toContain('Silver');
      expect(context).toContain('Galleries Club');
    });

    it('returns null for empty queries', async () => {
      const context = await getContext('');
      expect(context).toBeNull();
    });
  });
});
