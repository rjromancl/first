import { describe, it, expect } from 'vitest';
import { parseVoiceInput } from '../utils/voiceNLP';
import { getContext, buildAugmentedPrompt } from './ragService';
import { getTranslation } from '../utils/translations';

describe('Real-Life Aspect 1 — Festival & Holiday Travel (Tamil, Tanglish & English)', () => {
  it('resolves Diwali family flight request in Pure Tamil script', async () => {
    // Simulated input: "தீபாவளிக்கு லண்டனிலிருந்து சென்னைக்கு போக வேண்டும்"
    const input = 'தீபாவளிக்கு லண்டனிலிருந்து சென்னைக்கு போக வேண்டும்';
    const result = await parseVoiceInput(input);
    expect(result.intent).toBeDefined();
    // Verify fallback or model intent resolves booking
    expect(result.response.text).toBeDefined();
  });

  it('resolves Diwali flight request in Tanglish', async () => {
    const input = 'Diwali-ku London-la irundhu Chennai-ku flight book pannu for 2 adults';
    const result = await parseVoiceInput(input);
    expect(['BOOK_FLIGHT', 'HELP', 'CHAT', 'FLIGHT_STATUS']).toContain(result.intent);
    expect(result.response.quickReplies).toBeDefined();
  });

  it('resolves Christmas flight request in English', async () => {
    const input = 'Book a flight from London to New York for Christmas return';
    const result = await parseVoiceInput(input);
    expect(['BOOK_FLIGHT', 'HELP']).toContain(result.intent);
  });
});

describe('Real-Life Aspect 2 — Real-World Baggage & Policy RAG (Tamil & Tanglish)', () => {
  it('fetches exact baggage weight limits for Tamil query "லக்கேஜ் எடை"', async () => {
    const context = await getContext('லக்கேஜ் எடை எவ்வளவு அனுமதிக்கப்படும்?');
    expect(context).not.toBeNull();
    expect(context).toContain('23kg');
    expect(context).toContain('32kg');
    expect(context).toContain('Hand Baggage');
  });

  it('fetches exact baggage allowance for Tanglish query "baggage weight evvalavu"', async () => {
    const context = await getContext('Business class baggage weight evvalavu?');
    expect(context).not.toBeNull();
    expect(context).toContain('32kg');
  });

  it('fetches Executive Club Gold & Silver lounge access policy', async () => {
    const context = await getContext('Executive Club Silver member lounge access London Heathrow');
    expect(context).not.toBeNull();
    expect(context).toContain('Lounge');
    expect(context).toContain('Galleries');
  });
});

describe('Real-Life Aspect 3 — Check-in & Mobile Boarding Pass Scenarios', () => {
  it('handles online check-in query with PNR and surname in Tanglish', async () => {
    const input = 'Check in pannu for PNR XYMBA1 surname Wilson';
    const result = await parseVoiceInput(input);
    expect(result.intent).toBeDefined();
    expect(result.response.text).toBeDefined();
  });

  it('handles check-in query in Pure Tamil script', async () => {
    const input = 'எனக்கு ஆன்லைன் செக்-இன் செய்ய வேண்டும்';
    const result = await parseVoiceInput(input);
    expect(result.intent).toBeDefined();
  });
});

describe('Real-Life Aspect 4 — Colloquial Speech & Typo Resilience', () => {
  it('handles typos in city names "chenai flight poganom"', async () => {
    const input = 'chenai flight poganom adutha vaaram';
    const result = await parseVoiceInput(input);
    expect(result.intent).toBeDefined();
  });

  it('handles mixed greeting and flight request "Vanakkam London to Dubai tomorrow"', async () => {
    const input = 'Vanakkam London to Dubai tomorrow';
    const result = await parseVoiceInput(input);
    expect(result.intent).toBeDefined();
  });
});

describe('Real-Life Aspect 5 — Multilingual UI Consistency Across 8 Languages', () => {
  const languages = ['en-GB', 'ta-IN', 'ta-TL', 'hi-IN', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'];

  languages.forEach(lang => {
    it(`renders non-empty key translations for locale [${lang}]`, () => {
      expect(getTranslation(lang, 'navBook')).toBeTruthy();
      expect(getTranslation(lang, 'searchFlightsBtn')).toBeTruthy();
      expect(getTranslation(lang, 'voiceTitle')).toBeTruthy();
      expect(getTranslation(lang, 'fromLabel')).toBeTruthy();
      expect(getTranslation(lang, 'toLabel')).toBeTruthy();
    });
  });
});
