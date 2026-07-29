import { describe, it, expect } from 'vitest';
import { getContext, buildAugmentedPrompt } from './ragService';

describe('ragService — Multilingual RAG Engine', () => {
  it('returns RAG context for Tamil baggage query (லக்கேஜ்)', async () => {
    const ctx = await getContext('லக்கேஜ் எடை எவ்வளவு?');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('B Airways Baggage Allowance Policy');
    expect(ctx).toContain('Hand Baggage');
  });

  it('returns RAG context for Tanglish baggage query (baggage weight evvalavu)', async () => {
    const ctx = await getContext('Baggage weight evvalavu for business class?');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('Checked Baggage');
    expect(ctx).toContain('32kg');
  });

  it('returns RAG context for Tamil check-in query (செக்-இன்)', async () => {
    const ctx = await getContext('ஆன்லைன் செக்-இன் எப்போது திறக்கும்?');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('Online Check-In');
  });

  it('augments base system prompt with RAG context block', () => {
    const base = 'Base prompt';
    const context = 'Baggage limit: 23kg';
    const augmented = buildAugmentedPrompt(base, context);
    expect(augmented).toContain('Base prompt');
    expect(augmented).toContain('OFFICIAL BRITISH AIRWAYS KNOWLEDGE BASE CONTEXT (MULTILINGUAL RAG)');
    expect(augmented).toContain('Baggage limit: 23kg');
  });
});
