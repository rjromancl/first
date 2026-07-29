import { describe, it, expect } from 'vitest';
import { LANGUAGES, translations, getTranslation } from './translations';

describe('translations — Multilingual & Tamil dictionary', () => {
  it('defines all 8 supported languages', () => {
    expect(LANGUAGES).toHaveLength(8);
    const codes = LANGUAGES.map(l => l.code);
    expect(codes).toContain('en-GB');
    expect(codes).toContain('ta-IN');
    expect(codes).toContain('ta-TL');
    expect(codes).toContain('hi-IN');
    expect(codes).toContain('es-ES');
    expect(codes).toContain('fr-FR');
    expect(codes).toContain('de-DE');
    expect(codes).toContain('ja-JP');
  });

  it('provides complete Tamil (ta-IN) translations', () => {
    const tamil = translations['ta-IN'];
    expect(tamil.navBook).toBe('பதிவு செய்க');
    expect(tamil.navCheckIn).toBe('செக்-இன்');
    expect(tamil.searchFlightsBtn).toBe('விமானங்களை தேடு');
    expect(tamil.voiceTitle).toBe('பி ஏ குரல் உதவியாளர்');
    expect(tamil.ticketCardHeader).toBe('உறுதிசெய்யப்பட்ட டிக்கெட்');
  });

  it('provides complete Tanglish (ta-TL) translations', () => {
    const tanglish = translations['ta-TL'];
    expect(tanglish.searchFlightsTab).toBe('Flight Book Pannu');
    expect(tanglish.heroTitle).toBe('UK and World-fulla Parakkalaam!');
    expect(tanglish.fromLabel).toBe('Engerundhu (From)');
    expect(tanglish.toLabel).toBe('Engaku (To)');
  });

  it('provides complete Hindi (hi-IN) translations', () => {
    const hindi = translations['hi-IN'];
    expect(hindi.navBook).toBe('बुक करें');
    expect(hindi.searchFlightsBtn).toBe('उड़ानें खोजें');
  });

  it('fallback to en-GB if key is missing in target language', () => {
    const val = getTranslation('ta-IN', 'nonExistentKey123');
    expect(val).toBe('nonExistentKey123');
  });

  it('returns valid translation for getTranslation with valid key', () => {
    expect(getTranslation('ta-IN', 'fromLabel')).toBe('புறப்படும் இடம்');
    expect(getTranslation('ta-TL', 'fromLabel')).toBe('Engerundhu (From)');
    expect(getTranslation('en-GB', 'fromLabel')).toBe('From');
  });
});
