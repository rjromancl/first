import { describe, it, expect } from 'vitest';
import {
  validateFirstName,
  validateLastName,
  validatePhone,
  validateEmail,
  validateNationality,
  sanitizeInput,
  validatePassenger,
  validateCardNumber,
  validateCVV,
  validateExpiry,
  validateCardName,
  validatePaymentDetails,
  formatCardNumber,
  isValidLuhn,
} from './validation';

describe('Comprehensive Validation Test Suite (500 Test Cases)', () => {

  // =============================================================
  // 1. First Name Edge Cases (TC-VAL-001 to TC-VAL-060)
  // =============================================================
  describe('1. First Name Edge Cases (TC-VAL-001 to TC-VAL-060)', () => {
    it('TC-VAL-001: Reject empty string first name', () => { expect(validateFirstName('')).toBe('First name is required.'); });
    it('TC-VAL-002: Reject null first name', () => { expect(validateFirstName(null)).toBe('First name is required.'); });
    it('TC-VAL-003: Reject undefined first name', () => { expect(validateFirstName(undefined)).toBe('First name is required.'); });
    it('TC-VAL-004: Reject single space first name', () => { expect(validateFirstName(' ')).toBe('First name cannot be blank or spaces only.'); });
    it('TC-VAL-005: Reject triple spaces first name', () => { expect(validateFirstName('   ')).toBe('First name cannot be blank or spaces only.'); });
    it('TC-VAL-006: Reject tab character first name', () => { expect(validateFirstName('\t')).toBe('First name cannot be blank or spaces only.'); });
    it('TC-VAL-007: Reject newline character first name', () => { expect(validateFirstName('\n')).toBe('First name cannot be blank or spaces only.'); });
    it('TC-VAL-008: Reject mixed tabs and newlines first name', () => { expect(validateFirstName('\t\n\r ')).toBe('First name cannot be blank or spaces only.'); });
    it('TC-VAL-009: Reject zero-width space first name', () => { expect(validateFirstName('\u200B\u200B')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-010: Reject single char A first name', () => { expect(validateFirstName('A')).toBe('First name must be at least 2 characters.'); });
    it('TC-VAL-011: Reject single char Z first name', () => { expect(validateFirstName('Z')).toBe('First name must be at least 2 characters.'); });
    it('TC-VAL-012: Accept 2-character min boundary "Ab"', () => { expect(validateFirstName('Ab')).toBeNull(); });
    it('TC-VAL-013: Accept 2-character min boundary "Jo"', () => { expect(validateFirstName('Jo')).toBeNull(); });
    it('TC-VAL-014: Accept 3-character name "Dan"', () => { expect(validateFirstName('Dan')).toBeNull(); });
    it('TC-VAL-015: Accept 10-character name "Alexander"', () => { expect(validateFirstName('Alexander')).toBeNull(); });
    it('TC-VAL-016: Accept 25-character name', () => { expect(validateFirstName('A'.repeat(25))).toBeNull(); });
    it('TC-VAL-017: Accept 49-character name', () => { expect(validateFirstName('A'.repeat(49))).toBeNull(); });
    it('TC-VAL-018: Accept 50-character max boundary name', () => { expect(validateFirstName('A'.repeat(50))).toBeNull(); });
    it('TC-VAL-019: Reject 51-character name', () => { expect(validateFirstName('A'.repeat(51))).toBe('First name cannot exceed 50 characters.'); });
    it('TC-VAL-020: Reject 52-character name', () => { expect(validateFirstName('A'.repeat(52))).toBe('First name cannot exceed 50 characters.'); });
    it('TC-VAL-021: Reject 100-character name', () => { expect(validateFirstName('A'.repeat(100))).toBe('First name cannot exceed 50 characters.'); });
    it('TC-VAL-022: Reject leading digit in first name', () => { expect(validateFirstName('1John')).toBe('First name cannot contain numbers.'); });
    it('TC-VAL-023: Reject trailing digit in first name', () => { expect(validateFirstName('John2')).toBe('First name cannot contain numbers.'); });
    it('TC-VAL-024: Reject middle digit in first name', () => { expect(validateFirstName('J0hn')).toBe('First name cannot contain numbers.'); });
    it('TC-VAL-025: Reject multiple digits in first name', () => { expect(validateFirstName('John123')).toBe('First name cannot contain numbers.'); });
    it('TC-VAL-026: Reject digits with spaces in first name', () => { expect(validateFirstName('John 2')).toBe('First name cannot contain numbers.'); });
    it('TC-VAL-027: Reject Roman numeral with digit 8th', () => { expect(validateFirstName('Henry 8th')).toBe('First name cannot contain numbers.'); });
    it('TC-VAL-028: Reject <script> tag XSS', () => { expect(validateFirstName('<script>alert(1)</script>')).toBe('First name contains invalid or unsafe characters.'); });
    it('TC-VAL-029: Reject uppercase <SCRIPT> tag XSS', () => { expect(validateFirstName('<SCRIPT>alert(1)</SCRIPT>')).toBe('First name contains invalid or unsafe characters.'); });
    it('TC-VAL-030: Reject <svg> tag XSS', () => { expect(validateFirstName('<svg/onload=alert(1)>')).toBe('First name contains invalid or unsafe characters.'); });
    it('TC-VAL-031: Reject <iframe> tag XSS', () => { expect(validateFirstName('<iframe src="x"></iframe>')).toBe('First name contains invalid or unsafe characters.'); });
    it('TC-VAL-032: Reject javascript: URI XSS', () => { expect(validateFirstName('javascript:alert(1)')).toBe('First name contains invalid or unsafe characters.'); });
    it('TC-VAL-033: Reject event attribute onerror with numbers', () => { expect(validateFirstName('John onerror=alert(1)')).toBe('First name cannot contain numbers.'); });
    it('TC-VAL-034: Reject SQL injection semicolon', () => { expect(validateFirstName('John;DROP')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-035: Reject SQL OR 1=1 condition', () => { expect(validateFirstName("John' OR 1=1")).toBe('First name cannot contain numbers.'); });
    it('TC-VAL-036: Reject SQL comment dashes', () => { expect(validateFirstName('John--admin')).toBe('First name cannot contain consecutive spaces, hyphens, or apostrophes.'); });
    it('TC-VAL-037: Reject dollar sign in first name', () => { expect(validateFirstName('John$mith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-038: Reject percent sign with digits', () => { expect(validateFirstName('John%20Smith')).toBe('First name cannot contain numbers.'); });
    it('TC-VAL-039: Reject at-symbol in first name', () => { expect(validateFirstName('John@Smith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-040: Reject hashtag in first name', () => { expect(validateFirstName('John#Smith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-041: Reject ampersand in first name', () => { expect(validateFirstName('John&Smith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-042: Reject asterisk in first name', () => { expect(validateFirstName('John*Smith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-043: Reject exclamation mark in first name', () => { expect(validateFirstName('John!Smith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-044: Reject question mark in first name', () => { expect(validateFirstName('John?Smith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-045: Reject slash in first name', () => { expect(validateFirstName('John/Smith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-046: Reject backslash in first name', () => { expect(validateFirstName('John\\Smith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-047: Reject pipe symbol in first name', () => { expect(validateFirstName('John|Smith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-048: Reject double spaces in first name', () => { expect(validateFirstName('John  Smith')).toBe('First name cannot contain consecutive spaces, hyphens, or apostrophes.'); });
    it('TC-VAL-049: Reject triple spaces in first name', () => { expect(validateFirstName('John   Smith')).toBe('First name cannot contain consecutive spaces, hyphens, or apostrophes.'); });
    it('TC-VAL-050: Reject double hyphens in first name', () => { expect(validateFirstName('John--Smith')).toBe('First name cannot contain consecutive spaces, hyphens, or apostrophes.'); });
    it('TC-VAL-051: Reject double apostrophes in first name', () => { expect(validateFirstName("Jo''hn")).toBe('First name cannot contain consecutive spaces, hyphens, or apostrophes.'); });
    it('TC-VAL-052: Accept valid hyphenated name "Mary-Jane"', () => { expect(validateFirstName('Mary-Jane')).toBeNull(); });
    it('TC-VAL-053: Accept valid apostrophe name "D\'Angelo"', () => { expect(validateFirstName("D'Angelo")).toBeNull(); });
    it('TC-VAL-054: Accept title period "St. John"', () => { expect(validateFirstName('St. John')).toBeNull(); });
    it('TC-VAL-055: Accept spaced double first name "Anne Marie"', () => { expect(validateFirstName('Anne Marie')).toBeNull(); });
    it('TC-VAL-056: Accept Spanish accented "José"', () => { expect(validateFirstName('José')).toBeNull(); });
    it('TC-VAL-057: Accept French accented "Renée"', () => { expect(validateFirstName('Renée')).toBeNull(); });
    it('TC-VAL-058: Accept French "François"', () => { expect(validateFirstName('François')).toBeNull(); });
    it('TC-VAL-059: Accept German "Müller"', () => { expect(validateFirstName('Müller')).toBeNull(); });
    it('TC-VAL-060: Auto-trim surrounding whitespace for valid first name', () => { expect(validateFirstName('  John  ')).toBeNull(); });
  });

  // =============================================================
  // 2. Last Name Edge Cases (TC-VAL-061 to TC-VAL-120)
  // =============================================================
  describe('2. Last Name Edge Cases (TC-VAL-061 to TC-VAL-120)', () => {
    it('TC-VAL-061: Reject empty string last name', () => { expect(validateLastName('')).toBe('Last name is required.'); });
    it('TC-VAL-062: Reject null last name', () => { expect(validateLastName(null)).toBe('Last name is required.'); });
    it('TC-VAL-063: Reject undefined last name', () => { expect(validateLastName(undefined)).toBe('Last name is required.'); });
    it('TC-VAL-064: Reject single space last name', () => { expect(validateLastName(' ')).toBe('Last name cannot be blank or spaces only.'); });
    it('TC-VAL-065: Reject triple spaces last name', () => { expect(validateLastName('   ')).toBe('Last name cannot be blank or spaces only.'); });
    it('TC-VAL-066: Reject tab character last name', () => { expect(validateLastName('\t')).toBe('Last name cannot be blank or spaces only.'); });
    it('TC-VAL-067: Reject newline character last name', () => { expect(validateLastName('\n')).toBe('Last name cannot be blank or spaces only.'); });
    it('TC-VAL-068: Reject single letter "S" last name', () => { expect(validateLastName('S')).toBe('Last name must be at least 2 characters.'); });
    it('TC-VAL-069: Accept 2-character min boundary "Li"', () => { expect(validateLastName('Li')).toBeNull(); });
    it('TC-VAL-070: Accept 3-character name "Lee"', () => { expect(validateLastName('Lee')).toBeNull(); });
    it('TC-VAL-071: Accept 5-character name "Smith"', () => { expect(validateLastName('Smith')).toBeNull(); });
    it('TC-VAL-072: Accept 49-character last name', () => { expect(validateLastName('B'.repeat(49))).toBeNull(); });
    it('TC-VAL-073: Accept 50-character max boundary last name', () => { expect(validateLastName('B'.repeat(50))).toBeNull(); });
    it('TC-VAL-074: Reject 51-character last name', () => { expect(validateLastName('B'.repeat(51))).toBe('Last name cannot exceed 50 characters.'); });
    it('TC-VAL-075: Reject 80-character last name', () => { expect(validateLastName('B'.repeat(80))).toBe('Last name cannot exceed 50 characters.'); });
    it('TC-VAL-076: Reject trailing digit in last name', () => { expect(validateLastName('Smith9')).toBe('Last name cannot contain numbers.'); });
    it('TC-VAL-077: Reject leading digit in last name', () => { expect(validateLastName('1Smith')).toBe('Last name cannot contain numbers.'); });
    it('TC-VAL-078: Reject middle digit in last name', () => { expect(validateLastName('Sm1th')).toBe('Last name cannot contain numbers.'); });
    it('TC-VAL-079: Reject multiple digits in last name', () => { expect(validateLastName('Smith123')).toBe('Last name cannot contain numbers.'); });
    it('TC-VAL-080: Reject <script> tag in last name', () => { expect(validateLastName('<script>alert("XSS")</script>')).toBe('Last name contains invalid or unsafe characters.'); });
    it('TC-VAL-081: Reject <svg> tag in last name', () => { expect(validateLastName('<svg/onload=alert(1)>')).toBe('Last name contains invalid or unsafe characters.'); });
    it('TC-VAL-082: Reject <img src=x> in last name', () => { expect(validateLastName('<img src=x onerror=alert(1)>')).toBe('Last name contains invalid or unsafe characters.'); });
    it('TC-VAL-083: Reject SQL DROP TABLE in last name', () => { expect(validateLastName('Smith; DROP TABLE users;--')).toBe('Last name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-084: Reject SQL UNION SELECT in last name', () => { expect(validateLastName("Smith' UNION SELECT 1--")).toBe('Last name cannot contain numbers.'); });
    it('TC-VAL-085: Reject caret symbol in last name', () => { expect(validateLastName('Smith^')).toBe('Last name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-086: Reject plus symbol in last name', () => { expect(validateLastName('Smith+Jones')).toBe('Last name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-087: Reject equals symbol in last name', () => { expect(validateLastName('Smith=Jones')).toBe('Last name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-088: Reject curly braces in last name', () => { expect(validateLastName('Smith{Jones}')).toBe('Last name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-089: Reject square brackets in last name', () => { expect(validateLastName('Smith[Jones]')).toBe('Last name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-090: Reject tilde symbol in last name', () => { expect(validateLastName('Smith~')).toBe('Last name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-091: Reject backtick symbol in last name', () => { expect(validateLastName('Smith`')).toBe('Last name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-092: Reject colon symbol in last name', () => { expect(validateLastName('Smith:Jones')).toBe('Last name can only contain letters, hyphens, spaces, and apostrophes.'); });
    it('TC-VAL-093: Reject double spaces in last name', () => { expect(validateLastName('Van  Halen')).toBe('Last name cannot contain consecutive spaces, hyphens, or apostrophes.'); });
    it('TC-VAL-094: Reject triple spaces in last name', () => { expect(validateLastName('Van   Halen')).toBe('Last name cannot contain consecutive spaces, hyphens, or apostrophes.'); });
    it('TC-VAL-095: Reject double hyphens in last name', () => { expect(validateLastName('Smith--Jones')).toBe('Last name cannot contain consecutive spaces, hyphens, or apostrophes.'); });
    it('TC-VAL-096: Reject double apostrophes in last name', () => { expect(validateLastName("O''Connor")).toBe("Last name cannot contain consecutive spaces, hyphens, or apostrophes."); });
    it('TC-VAL-097: Accept valid hyphenated surname', () => { expect(validateLastName('Smith-Jones')).toBeNull(); });
    it('TC-VAL-098: Accept valid apostrophe surname', () => { expect(validateLastName("O'Connor")).toBeNull(); });
    it('TC-VAL-099: Accept multi-word surname "De La Cruz"', () => { expect(validateLastName('De La Cruz')).toBeNull(); });
    it('TC-VAL-100: Accept Dutch prefix "Van Der Beek"', () => { expect(validateLastName('Van Der Beek')).toBeNull(); });
    it('TC-VAL-101: Accept Spanish "García"', () => { expect(validateLastName('García')).toBeNull(); });
    it('TC-VAL-102: Accept Turkish "Çırak"', () => { expect(validateLastName('Çırak')).toBeNull(); });
    it('TC-VAL-103: Accept Hungarian "Kovács"', () => { expect(validateLastName('Kovács')).toBeNull(); });
    it('TC-VAL-104: Accept Czech "Dvořák"', () => { expect(validateLastName('Dvořák')).toBeNull(); });
    it('TC-VAL-105: Accept Nordic "Sørensen"', () => { expect(validateLastName('Sørensen')).toBeNull(); });
    it('TC-VAL-106: Accept Finnish "Hämäläinen"', () => { expect(validateLastName('Hämäläinen')).toBeNull(); });
    it('TC-VAL-107: Accept Irish "Ní Chuinn"', () => { expect(validateLastName('Ní Chuinn')).toBeNull(); });
    it('TC-VAL-108: Accept mixed case "McDonald"', () => { expect(validateLastName('McDonald')).toBeNull(); });
    it('TC-VAL-109: Accept mixed case "MacArthur"', () => { expect(validateLastName('MacArthur')).toBeNull(); });
    it('TC-VAL-110: Accept uppercase "SMITH"', () => { expect(validateLastName('SMITH')).toBeNull(); });
    it('TC-VAL-111: Accept lowercase "smith"', () => { expect(validateLastName('smith')).toBeNull(); });
    it('TC-VAL-112: Auto-trim whitespace for last name', () => { expect(validateLastName('  Smith  ')).toBeNull(); });
    it('TC-VAL-113: Accept surname with title period "St. Claire"', () => { expect(validateLastName('St. Claire')).toBeNull(); });
    it('TC-VAL-114: Accept surname with apostrophe "D\'Cruz"', () => { expect(validateLastName("D'Cruz")).toBeNull(); });
    it('TC-VAL-115: Accept surname with hyphen "Al-Mansoor"', () => { expect(validateLastName('Al-Mansoor')).toBeNull(); });
    it('TC-VAL-116: Reject boolean true for last name', () => { expect(validateLastName(true)).toBe('Last name is required.'); });
    it('TC-VAL-117: Reject object for last name', () => { expect(validateLastName({ name: 'Smith' })).toBe('Last name is required.'); });
    it('TC-VAL-118: Reject array for last name', () => { expect(validateLastName(['Smith'])).toBe('Last name is required.'); });
    it('TC-VAL-119: Reject number for last name', () => { expect(validateLastName(12345)).toBe('Last name is required.'); });
    it('TC-VAL-120: Accept 4-character surname "Bond"', () => { expect(validateLastName('Bond')).toBeNull(); });
  });

  // =============================================================
  // 3. Phone Number Edge Cases (TC-VAL-121 to TC-VAL-180)
  // =============================================================
  describe('3. Phone Number Edge Cases (TC-VAL-121 to TC-VAL-180)', () => {
    it('TC-VAL-121: Reject empty string phone', () => { expect(validatePhone('')).toBe('Phone number is required.'); });
    it('TC-VAL-122: Reject null phone', () => { expect(validatePhone(null)).toBe('Phone number is required.'); });
    it('TC-VAL-123: Reject undefined phone', () => { expect(validatePhone(undefined)).toBe('Phone number is required.'); });
    it('TC-VAL-124: Reject single space phone', () => { expect(validatePhone(' ')).toBe('Phone number cannot be blank or spaces only.'); });
    it('TC-VAL-125: Reject triple spaces phone', () => { expect(validatePhone('   ')).toBe('Phone number cannot be blank or spaces only.'); });
    it('TC-VAL-126: Reject letters at end of phone', () => { expect(validatePhone('+4477009000ab')).toBe('Phone number cannot contain letters.'); });
    it('TC-VAL-127: Reject letters at start of phone', () => { expect(validatePhone('TEL+4477009000')).toBe('Phone number cannot contain letters.'); });
    it('TC-VAL-128: Reject vanity text word phone', () => { expect(validatePhone('CALLME')).toBe('Phone number cannot contain letters.'); });
    it('TC-VAL-129: Reject 1-digit phone', () => { expect(validatePhone('1')).toBe('Phone number must contain at least 7 digits.'); });
    it('TC-VAL-130: Reject 2-digit phone', () => { expect(validatePhone('12')).toBe('Phone number must contain at least 7 digits.'); });
    it('TC-VAL-131: Reject 3-digit phone', () => { expect(validatePhone('123')).toBe('Phone number must contain at least 7 digits.'); });
    it('TC-VAL-132: Reject 4-digit phone', () => { expect(validatePhone('1234')).toBe('Phone number must contain at least 7 digits.'); });
    it('TC-VAL-133: Reject 5-digit phone', () => { expect(validatePhone('12345')).toBe('Phone number must contain at least 7 digits.'); });
    it('TC-VAL-134: Reject 6-digit phone', () => { expect(validatePhone('123456')).toBe('Phone number must contain at least 7 digits.'); });
    it('TC-VAL-135: Accept 7-digit min boundary phone', () => { expect(validatePhone('1234567')).toBeNull(); });
    it('TC-VAL-136: Accept 8-digit phone', () => { expect(validatePhone('12345678')).toBeNull(); });
    it('TC-VAL-137: Accept 9-digit phone', () => { expect(validatePhone('123456789')).toBeNull(); });
    it('TC-VAL-138: Accept 10-digit US phone', () => { expect(validatePhone('2025550143')).toBeNull(); });
    it('TC-VAL-139: Accept 11-digit UK local phone', () => { expect(validatePhone('07700900077')).toBeNull(); });
    it('TC-VAL-140: Accept 12-digit UK international phone', () => { expect(validatePhone('+447700900077')).toBeNull(); });
    it('TC-VAL-141: Accept 13-digit European phone', () => { expect(validatePhone('+3314268530000')).toBeNull(); });
    it('TC-VAL-142: Accept 14-digit international phone', () => { expect(validatePhone('+91987654321099')).toBeNull(); });
    it('TC-VAL-143: Accept 15-digit max boundary phone', () => { expect(validatePhone('+123456789012345')).toBeNull(); });
    it('TC-VAL-144: Reject 16-digit phone', () => { expect(validatePhone('+1234567890123456')).toBe('Phone number cannot exceed 15 digits.'); });
    it('TC-VAL-145: Reject 17-digit phone', () => { expect(validatePhone('+12345678901234567')).toBe('Phone number cannot exceed 15 digits.'); });
    it('TC-VAL-146: Reject 20-digit phone', () => { expect(validatePhone('+12345678901234567890')).toBe('Phone number cannot exceed 15 digits.'); });
    it('TC-VAL-147: Reject hashtag in phone', () => { expect(validatePhone('123#4567890')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-148: Reject dollar sign in phone', () => { expect(validatePhone('123$4567890')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-149: Reject at-symbol in phone', () => { expect(validatePhone('123@4567890')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-150: Reject exclamation mark in phone', () => { expect(validatePhone('123!4567890')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-151: Reject asterisk in phone', () => { expect(validatePhone('*447700900077')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-152: Reject percent sign in phone', () => { expect(validatePhone('44%7700900077')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-153: Reject ampersand in phone', () => { expect(validatePhone('44&7700900077')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-154: Reject slash in phone', () => { expect(validatePhone('44/7700900077')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-155: Accept hyphenated US phone', () => { expect(validatePhone('+1-555-123-4567')).toBeNull(); });
    it('TC-VAL-156: Accept spaced UK phone', () => { expect(validatePhone('+44 7700 900077')).toBeNull(); });
    it('TC-VAL-157: Accept European format with parentheses', () => { expect(validatePhone('+33 (0) 1 42 68 53 00')).toBeNull(); });
    it('TC-VAL-158: Accept local area code in parentheses', () => { expect(validatePhone('(020) 7946 0912')).toBeNull(); });
    it('TC-VAL-159: Reject plus sign in middle of phone', () => { expect(validatePhone('44+7000000000')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-160: Reject multiple leading plus signs', () => { expect(validatePhone('++4412345678')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-161: Accept Indian (+91)', () => { expect(validatePhone('+91 98765 43210')).toBeNull(); });
    it('TC-VAL-162: Accept Japanese (+81)', () => { expect(validatePhone('+81-3-1234-5678')).toBeNull(); });
    it('TC-VAL-163: Accept Australian (+61)', () => { expect(validatePhone('+61 412 345 678')).toBeNull(); });
    it('TC-VAL-164: Accept Chinese (+86)', () => { expect(validatePhone('+86 10 1234 5678')).toBeNull(); });
    it('TC-VAL-165: Accept German (+49)', () => { expect(validatePhone('+49 30 1234567')).toBeNull(); });
    it('TC-VAL-166: Accept Brazilian (+55)', () => { expect(validatePhone('+55 11 98765-4321')).toBeNull(); });
    it('TC-VAL-167: Accept Spanish (+34)', () => { expect(validatePhone('+34 912 34 56 78')).toBeNull(); });
    it('TC-VAL-168: Accept Italian (+39)', () => { expect(validatePhone('+39 06 6982')).toBeNull(); });
    it('TC-VAL-169: Accept Canadian (+1)', () => { expect(validatePhone('+1 416 555 0198')).toBeNull(); });
    it('TC-VAL-170: Accept Swiss (+41)', () => { expect(validatePhone('+41 22 123 45 67')).toBeNull(); });
    it('TC-VAL-171: Trim surrounding whitespace for valid phone', () => { expect(validatePhone('   +447700900077   ')).toBeNull(); });
    it('TC-VAL-172: Reject numeric primitive type phone', () => { expect(validatePhone(1234567890)).toBe('Phone number is required.'); });
    it('TC-VAL-173: Reject boolean type phone', () => { expect(validatePhone(true)).toBe('Phone number is required.'); });
    it('TC-VAL-174: Reject object type phone', () => { expect(validatePhone({ num: '+447700900077' })).toBe('Phone number is required.'); });
    it('TC-VAL-175: Accept phone with multiple hyphens', () => { expect(validatePhone('1-800-555-0199')).toBeNull(); });
    it('TC-VAL-176: Accept phone with multiple spaces', () => { expect(validatePhone('07700 900 077')).toBeNull(); });
    it('TC-VAL-177: Reject semicolon in phone', () => { expect(validatePhone('07700900077;')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-178: Reject colon in phone', () => { expect(validatePhone('07700:900077')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-179: Reject comma in phone', () => { expect(validatePhone('07700,900077')).toBe('Phone number contains invalid characters.'); });
    it('TC-VAL-180: Reject quotes in phone', () => { expect(validatePhone('"07700900077"')).toBe('Phone number contains invalid characters.'); });
  });

  // =============================================================
  // 4. Email Address Edge Cases (TC-VAL-181 to TC-VAL-240)
  // =============================================================
  describe('4. Email Address Edge Cases (TC-VAL-181 to TC-VAL-240)', () => {
    it('TC-VAL-181: Reject empty string email', () => { expect(validateEmail('')).toBe('Email address is required.'); });
    it('TC-VAL-182: Reject null email', () => { expect(validateEmail(null)).toBe('Email address is required.'); });
    it('TC-VAL-183: Reject undefined email', () => { expect(validateEmail(undefined)).toBe('Email address is required.'); });
    it('TC-VAL-184: Reject whitespace-only email', () => { expect(validateEmail('   ')).toBe('Email address cannot be blank.'); });
    it('TC-VAL-185: Reject email missing @ symbol', () => { expect(validateEmail('userdomain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-186: Reject email missing domain', () => { expect(validateEmail('user@')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-187: Reject email missing username', () => { expect(validateEmail('@domain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-188: Reject email missing TLD', () => { expect(validateEmail('user@domain')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-189: Reject double @ symbol', () => { expect(validateEmail('user@@domain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-190: Reject split @ symbols', () => { expect(validateEmail('user@domain@test.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-191: Reject 1-char TLD (.c)', () => { expect(validateEmail('user@domain.c')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-192: Accept 2-char TLD (.uk)', () => { expect(validateEmail('user@domain.uk')).toBeNull(); });
    it('TC-VAL-193: Accept 3-char TLD (.com)', () => { expect(validateEmail('user@domain.com')).toBeNull(); });
    it('TC-VAL-194: Accept 4-char TLD (.info)', () => { expect(validateEmail('user@domain.info')).toBeNull(); });
    it('TC-VAL-195: Accept 6-char TLD (.museum)', () => { expect(validateEmail('user@domain.museum')).toBeNull(); });
    it('TC-VAL-196: Accept multi-level TLD (.co.uk)', () => { expect(validateEmail('user@mail.co.uk')).toBeNull(); });
    it('TC-VAL-197: Accept multi-level subdomain (.sub.domain.org)', () => { expect(validateEmail('user@sub.domain.org')).toBeNull(); });
    it('TC-VAL-198: Accept plus addressing', () => { expect(validateEmail('user+tag@domain.com')).toBeNull(); });
    it('TC-VAL-199: Accept multiple plus tags', () => { expect(validateEmail('user+tag+filter@domain.com')).toBeNull(); });
    it('TC-VAL-200: Accept dots in username', () => { expect(validateEmail('john.doe@domain.com')).toBeNull(); });
    it('TC-VAL-201: Accept hyphens in username', () => { expect(validateEmail('john-doe@domain.com')).toBeNull(); });
    it('TC-VAL-202: Accept underscores in username', () => { expect(validateEmail('john_doe@domain.com')).toBeNull(); });
    it('TC-VAL-203: Accept hyphens in domain name', () => { expect(validateEmail('user@my-domain.com')).toBeNull(); });
    it('TC-VAL-204: Reject spaces before @', () => { expect(validateEmail('user @domain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-205: Reject spaces after @', () => { expect(validateEmail('user@ domain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-206: Reject spaces in TLD', () => { expect(validateEmail('user@domain. com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-207: Reject dollar sign in domain', () => { expect(validateEmail('user@dom$ain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-208: Reject hashtag in domain', () => { expect(validateEmail('user@dom#ain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-209: Reject exclamation mark in domain', () => { expect(validateEmail('user@dom!ain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-210: Accept uppercase username and domain', () => { expect(validateEmail('USER@DOMAIN.COM')).toBeNull(); });
    it('TC-VAL-211: Accept mixed case email address', () => { expect(validateEmail('John.Doe@Example.Co.UK')).toBeNull(); });
    it('TC-VAL-212: Auto-trim surrounding whitespace', () => { expect(validateEmail('   user@domain.com   ')).toBeNull(); });
    it('TC-VAL-213: Accept numbers in username and domain', () => { expect(validateEmail('user123@domain123.com')).toBeNull(); });
    it('TC-VAL-214: Accept long valid email address', () => { expect(validateEmail('a.very.long.email.address.for.testing@subdomain.example.com')).toBeNull(); });
    it('TC-VAL-215: Email starting with dot format check', () => { expect(validateEmail('.user@domain.com')).toBeNull(); });
    it('TC-VAL-216: Email ending with dot format check', () => { expect(validateEmail('user.@domain.com')).toBeNull(); });
    it('TC-VAL-217: Email with consecutive dots format check', () => { expect(validateEmail('user..name@domain.com')).toBeNull(); });
    it('TC-VAL-218: Reject email with trailing dot after TLD', () => { expect(validateEmail('user@domain.com.')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-219: Reject boolean true input for email', () => { expect(validateEmail(true)).toBe('Email address is required.'); });
    it('TC-VAL-220: Reject object input for email', () => { expect(validateEmail({ email: 'user@domain.com' })).toBe('Email address is required.'); });
    it('TC-VAL-221: Accept email with hyphenated subdomain', () => { expect(validateEmail('user@sub-domain.example.com')).toBeNull(); });
    it('TC-VAL-222: Accept email with numeric TLD subdomain', () => { expect(validateEmail('user@domain1.org')).toBeNull(); });
    it('TC-VAL-223: Reject email with missing domain dot', () => { expect(validateEmail('user@domaincom')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-224: Reject email with semicolon', () => { expect(validateEmail('user;1@domain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-225: Reject email with colon', () => { expect(validateEmail('user:1@domain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-226: Reject email with angle brackets', () => { expect(validateEmail('<user@domain.com>')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-227: Reject email with square brackets', () => { expect(validateEmail('[user]@domain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-228: Reject email with quotes', () => { expect(validateEmail('"user"@domain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-229: Accept email with percent sign in username', () => { expect(validateEmail('user%test@domain.com')).toBeNull(); });
    it('TC-VAL-230: Accept email with hyphen in local part', () => { expect(validateEmail('first-last@domain.com')).toBeNull(); });
    it('TC-VAL-231: Accept email with .org TLD', () => { expect(validateEmail('user@charity.org')).toBeNull(); });
    it('TC-VAL-232: Accept email with .gov TLD', () => { expect(validateEmail('user@state.gov')).toBeNull(); });
    it('TC-VAL-233: Accept email with .edu TLD', () => { expect(validateEmail('student@uni.edu')).toBeNull(); });
    it('TC-VAL-234: Accept email with .net TLD', () => { expect(validateEmail('user@provider.net')).toBeNull(); });
    it('TC-VAL-235: Accept email with .io TLD', () => { expect(validateEmail('dev@startup.io')).toBeNull(); });
    it('TC-VAL-236: Accept email with .ai TLD', () => { expect(validateEmail('bot@tech.ai')).toBeNull(); });
    it('TC-VAL-237: Accept email with .app TLD', () => { expect(validateEmail('mobile@web.app')).toBeNull(); });
    it('TC-VAL-238: Accept email with .dev TLD', () => { expect(validateEmail('coder@project.dev')).toBeNull(); });
    it('TC-VAL-239: Reject email with space in local part', () => { expect(validateEmail('john doe@domain.com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
    it('TC-VAL-240: Reject email with space in domain part', () => { expect(validateEmail('johndoe@domain .com')).toBe('Please enter a valid email address (e.g. name@example.com).'); });
  });

  // =============================================================
  // 5. Nationality Validation Edge Cases (TC-VAL-241 to TC-VAL-280)
  // =============================================================
  describe('5. Nationality Validation Edge Cases (TC-VAL-241 to TC-VAL-280)', () => {
    it('TC-VAL-241: Reject empty string nationality', () => { expect(validateNationality('')).toBe('Please select or enter a nationality.'); });
    it('TC-VAL-242: Reject null nationality', () => { expect(validateNationality(null)).toBe('Please select or enter a nationality.'); });
    it('TC-VAL-243: Reject undefined nationality', () => { expect(validateNationality(undefined)).toBe('Please select or enter a nationality.'); });
    it('TC-VAL-244: Reject single space nationality', () => { expect(validateNationality(' ')).toBe('Please select or enter a nationality.'); });
    it('TC-VAL-245: Reject triple spaces nationality', () => { expect(validateNationality('   ')).toBe('Please select or enter a nationality.'); });
    it('TC-VAL-246: Accept ISO code "GB"', () => { expect(validateNationality('GB')).toBeNull(); });
    it('TC-VAL-247: Accept ISO code "US"', () => { expect(validateNationality('US')).toBeNull(); });
    it('TC-VAL-248: Accept ISO code "FR"', () => { expect(validateNationality('FR')).toBeNull(); });
    it('TC-VAL-249: Accept ISO code "DE"', () => { expect(validateNationality('DE')).toBeNull(); });
    it('TC-VAL-250: Accept ISO code "IN"', () => { expect(validateNationality('IN')).toBeNull(); });
    it('TC-VAL-251: Accept ISO code "JP"', () => { expect(validateNationality('JP')).toBeNull(); });
    it('TC-VAL-252: Accept ISO code "CA"', () => { expect(validateNationality('CA')).toBeNull(); });
    it('TC-VAL-253: Accept ISO code "AU"', () => { expect(validateNationality('AU')).toBeNull(); });
    it('TC-VAL-254: Accept ISO code "ES"', () => { expect(validateNationality('ES')).toBeNull(); });
    it('TC-VAL-255: Accept ISO code "IT"', () => { expect(validateNationality('IT')).toBeNull(); });
    it('TC-VAL-256: Accept ISO code "BR"', () => { expect(validateNationality('BR')).toBeNull(); });
    it('TC-VAL-257: Accept ISO code "CN"', () => { expect(validateNationality('CN')).toBeNull(); });
    it('TC-VAL-258: Accept ISO code "MX"', () => { expect(validateNationality('MX')).toBeNull(); });
    it('TC-VAL-259: Accept ISO code "NL"', () => { expect(validateNationality('NL')).toBeNull(); });
    it('TC-VAL-260: Accept ISO code "SE"', () => { expect(validateNationality('SE')).toBeNull(); });
    it('TC-VAL-261: Accept full name "United Kingdom"', () => { expect(validateNationality('United Kingdom')).toBeNull(); });
    it('TC-VAL-262: Accept full name "United States of America"', () => { expect(validateNationality('United States of America')).toBeNull(); });
    it('TC-VAL-263: Accept nationality string "British"', () => { expect(validateNationality('British')).toBeNull(); });
    it('TC-VAL-264: Accept nationality string "American"', () => { expect(validateNationality('American')).toBeNull(); });
    it('TC-VAL-265: Accept nationality string "French"', () => { expect(validateNationality('French')).toBeNull(); });
    it('TC-VAL-266: Accept nationality string "German"', () => { expect(validateNationality('German')).toBeNull(); });
    it('TC-VAL-267: Accept nationality string "Indian"', () => { expect(validateNationality('Indian')).toBeNull(); });
    it('TC-VAL-268: Accept nationality string "Japanese"', () => { expect(validateNationality('Japanese')).toBeNull(); });
    it('TC-VAL-269: Accept nationality string "Canadian"', () => { expect(validateNationality('Canadian')).toBeNull(); });
    it('TC-VAL-270: Accept nationality string "Australian"', () => { expect(validateNationality('Australian')).toBeNull(); });
    it('TC-VAL-271: Accept multi-word "United Arab Emirates"', () => { expect(validateNationality('United Arab Emirates')).toBeNull(); });
    it('TC-VAL-272: Accept multi-word "South Africa"', () => { expect(validateNationality('South Africa')).toBeNull(); });
    it('TC-VAL-273: Accept multi-word "New Zealand"', () => { expect(validateNationality('New Zealand')).toBeNull(); });
    it('TC-VAL-274: Accept multi-word "Saudi Arabia"', () => { expect(validateNationality('Saudi Arabia')).toBeNull(); });
    it('TC-VAL-275: Accept multi-word "South Korea"', () => { expect(validateNationality('South Korea')).toBeNull(); });
    it('TC-VAL-276: Reject number primitive for nationality', () => { expect(validateNationality(44)).toBe('Please select or enter a nationality.'); });
    it('TC-VAL-277: Reject object for nationality', () => { expect(validateNationality({ code: 'GB' })).toBe('Please select or enter a nationality.'); });
    it('TC-VAL-278: Reject boolean for nationality', () => { expect(validateNationality(true)).toBe('Please select or enter a nationality.'); });
    it('TC-VAL-279: Reject array for nationality', () => { expect(validateNationality(['GB'])).toBe('Please select or enter a nationality.'); });
    it('TC-VAL-280: Accept nationality "Italian"', () => { expect(validateNationality('Italian')).toBeNull(); });
  });

  // =============================================================
  // 6. Input Sanitization Edge Cases (TC-VAL-281 to TC-VAL-320)
  // =============================================================
  describe('6. Input Sanitization Edge Cases (TC-VAL-281 to TC-VAL-320)', () => {
    it('TC-VAL-281: Return empty string for empty input', () => { expect(sanitizeInput('')).toBe(''); });
    it('TC-VAL-282: Return empty string for null input', () => { expect(sanitizeInput(null)).toBe(''); });
    it('TC-VAL-283: Return empty string for undefined input', () => { expect(sanitizeInput(undefined)).toBe(''); });
    it('TC-VAL-284: Preserve standard plain text name', () => { expect(sanitizeInput('John Smith')).toBe('John Smith'); });
    it('TC-VAL-285: Strip <script> tag completely', () => { expect(sanitizeInput('<script>alert(1)</script>')).toBe('alert(1)'); });
    it('TC-VAL-286: Strip <b> html tags', () => { expect(sanitizeInput('<b>John</b>')).toBe('John'); });
    it('TC-VAL-287: Strip <i> html tags', () => { expect(sanitizeInput('<i>Smith</i>')).toBe('Smith'); });
    it('TC-VAL-288: Strip <a> html link tags', () => { expect(sanitizeInput('<a href="http://evil.com">Click</a>')).toBe('Click'); });
    it('TC-VAL-289: Strip <div> wrapper tags', () => { expect(sanitizeInput('<div>John</div>')).toBe('John'); });
    it('TC-VAL-290: Strip <iframe> tags', () => { expect(sanitizeInput('<iframe src="x">John</iframe>')).toBe('John'); });
    it('TC-VAL-291: Strip <object> tags', () => { expect(sanitizeInput('<object data="x">John</object>')).toBe('John'); });
    it('TC-VAL-292: Strip <embed> tags', () => { expect(sanitizeInput('<embed src="x">')).toBe(''); });
    it('TC-VAL-293: Strip <style> tags', () => { expect(sanitizeInput('<style>body{color:red}</style>')).toBe('body{color:red}'); });
    it('TC-VAL-294: Strip <svg> tags', () => { expect(sanitizeInput('<svg onload=alert(1)>Text</svg>')).toBe('Text'); });
    it('TC-VAL-295: Strip <img src=x> tags', () => { expect(sanitizeInput('<img src=x onerror=alert(1)>')).toBe(''); });
    it('TC-VAL-296: Strip HTML comments', () => { expect(sanitizeInput('John<!-- secret comment -->Smith')).toBe('JohnSmith'); });
    it('TC-VAL-297: Strip lone angle brackets pattern', () => { expect(sanitizeInput('John < Smith >')).toBe('John '); });
    it('TC-VAL-298: Preserve apostrophes and hyphens', () => { expect(sanitizeInput("O'Connor-Smith")).toBe("O'Connor-Smith"); });
    it('TC-VAL-299: Preserve title dots', () => { expect(sanitizeInput('St. John')).toBe('St. John'); });
    it('TC-VAL-300: Preserve commas and spaces', () => { expect(sanitizeInput('Smith, John')).toBe('Smith, John'); });
    it('TC-VAL-301: Strip <span> tags', () => { expect(sanitizeInput('<span>Text</span>')).toBe('Text'); });
    it('TC-VAL-302: Strip <p> paragraph tags', () => { expect(sanitizeInput('<p>Paragraph</p>')).toBe('Paragraph'); });
    it('TC-VAL-303: Strip <h1> heading tags', () => { expect(sanitizeInput('<h1>Title</h1>')).toBe('Title'); });
    it('TC-VAL-304: Strip <input> tags', () => { expect(sanitizeInput('<input type="text">')).toBe(''); });
    it('TC-VAL-305: Strip <form> tags', () => { expect(sanitizeInput('<form action="x">Test</form>')).toBe('Test'); });
    it('TC-VAL-306: Strip <button> tags', () => { expect(sanitizeInput('<button>Click</button>')).toBe('Click'); });
    it('TC-VAL-307: Strip <meta> tags', () => { expect(sanitizeInput('<meta charset="utf-8">')).toBe(''); });
    it('TC-VAL-308: Strip <link> tags', () => { expect(sanitizeInput('<link rel="stylesheet" href="x">')).toBe(''); });
    it('TC-VAL-309: Strip nested tags <div><p>text</p></div>', () => { expect(sanitizeInput('<div><p>text</p></div>')).toBe('text'); });
    it('TC-VAL-310: Strip <ul> and <li> tags', () => { expect(sanitizeInput('<ul><li>Item</li></ul>')).toBe('Item'); });
    it('TC-VAL-311: Strip <table> tags', () => { expect(sanitizeInput('<table><tr><td>Cell</td></tr></table>')).toBe('Cell'); });
    it('TC-VAL-312: Strip <textarea> tags', () => { expect(sanitizeInput('<textarea>Value</textarea>')).toBe('Value'); });
    it('TC-VAL-313: Preserve spaces between words', () => { expect(sanitizeInput('John Smith Jr.')).toBe('John Smith Jr.'); });
    it('TC-VAL-314: Preserve numbers in text', () => { expect(sanitizeInput('Flight 123')).toBe('Flight 123'); });
    it('TC-VAL-315: Preserve hyphenated text', () => { expect(sanitizeInput('British-Airways')).toBe('British-Airways'); });
    it('TC-VAL-316: Preserve accented letters', () => { expect(sanitizeInput('José François')).toBe('José François'); });
    it('TC-VAL-317: Strip multiple script blocks', () => { expect(sanitizeInput('A<script>1</script>B<script>2</script>C')).toBe('A1B2C'); });
    it('TC-VAL-318: Strip self-closing <br/> tag', () => { expect(sanitizeInput('Line1<br/>Line2')).toBe('Line1Line2'); });
    it('TC-VAL-319: Strip self-closing <hr/> tag', () => { expect(sanitizeInput('Top<hr/>Bottom')).toBe('TopBottom'); });
    it('TC-VAL-320: Handle stringified number input', () => { expect(sanitizeInput('123')).toBe('123'); });
  });

  // =============================================================
  // 7. Passenger Object Validation (TC-VAL-321 to TC-VAL-370)
  // =============================================================
  describe('7. Passenger Object Validation (TC-VAL-321 to TC-VAL-370)', () => {
    it('TC-VAL-321: Reject empty passenger object', () => {
      const res = validatePassenger({});
      expect(res.isValid).toBe(false);
      expect(res.errors.firstName).toBe('First name is required.');
      expect(res.errors.lastName).toBe('Last name is required.');
      expect(res.errors.phone).toBe('Phone number is required.');
      expect(res.errors.nationality).toBe('Please select or enter a nationality.');
    });

    it('TC-VAL-322: Accept fully valid passenger object', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB', email: 'john@example.com' };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(true);
      expect(res.errors).toEqual({});
    });

    it('TC-VAL-323: Flag invalid first name in passenger', () => {
      const p = { firstName: 'J', lastName: 'Smith', phone: '+447700900077', nationality: 'GB' };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(false);
      expect(res.errors.firstName).toBe('First name must be at least 2 characters.');
    });

    it('TC-VAL-324: Flag invalid last name in passenger', () => {
      const p = { firstName: 'John', lastName: 'S1', phone: '+447700900077', nationality: 'GB' };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(false);
      expect(res.errors.lastName).toBe('Last name cannot contain numbers.');
    });

    it('TC-VAL-325: Flag invalid phone in passenger', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '123', nationality: 'GB' };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(false);
      expect(res.errors.phone).toBe('Phone number must contain at least 7 digits.');
    });

    it('TC-VAL-326: Flag missing nationality in passenger', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: '' };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(false);
      expect(res.errors.nationality).toBe('Please select or enter a nationality.');
    });

    it('TC-VAL-327: Flag invalid optional email in passenger', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB', email: 'invalid' };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(false);
      expect(res.errors.email).toBe('Please enter a valid email address (e.g. name@example.com).');
    });

    it('TC-VAL-328: Pass when optional email field is omitted', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB' };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(true);
      expect(res.errors.email).toBeUndefined();
    });

    it('TC-VAL-329: Pass when optional email field is empty string', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB', email: '' };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(true);
    });

    it('TC-VAL-330: Flag multiple simultaneous field errors', () => {
      const p = { firstName: '1', lastName: '2', phone: '3', nationality: '' };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(false);
      expect(Object.keys(res.errors).length).toBe(4);
    });

    it('TC-VAL-331: Ignore extra unknown properties in passenger object', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB', age: 30 };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(true);
    });

    it('TC-VAL-332: Handle undefined argument for validatePassenger', () => {
      const res = validatePassenger();
      expect(res.isValid).toBe(false);
    });

    it('TC-VAL-333: Handle null argument for validatePassenger safely', () => {
      const res = validatePassenger(null);
      expect(res.isValid).toBe(false);
      expect(res.errors.firstName).toBe('First name is required.');
    });

    it('TC-VAL-334: Validate French passenger with accents', () => {
      const p = { firstName: 'François', lastName: 'Dupond', phone: '+33612345678', nationality: 'FR', email: 'francois@domain.fr' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-335: Validate German passenger with accents', () => {
      const p = { firstName: 'Jürgen', lastName: 'Müller', phone: '+4930123456', nationality: 'DE', email: 'jurgen@domain.de' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-336: Validate Spanish passenger with accents', () => {
      const p = { firstName: 'María', lastName: 'García', phone: '+34912345678', nationality: 'ES', email: 'maria@domain.es' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-337: Validate UK hyphenated passenger', () => {
      const p = { firstName: 'Mary-Jane', lastName: 'Smith-Jones', phone: '+447700900077', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-338: Validate Irish apostrophe passenger', () => {
      const p = { firstName: 'Liam', lastName: "O'Brien", phone: '+353871234567', nationality: 'IE' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-339: Validate US passenger with hyphenated phone', () => {
      const p = { firstName: 'John', lastName: 'Doe', phone: '+1-555-0199', nationality: 'US', email: 'john.doe@example.com' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-340: Validate Australian passenger', () => {
      const p = { firstName: 'Jack', lastName: 'Taylor', phone: '+61412345678', nationality: 'AU' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-341: Reject passenger with HTML script in first name', () => {
      const p = { firstName: '<script>alert(1)</script>', lastName: 'Smith', phone: '+447700900077', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(false);
    });

    it('TC-VAL-342: Reject passenger with SQL in last name', () => {
      const p = { firstName: 'John', lastName: 'DROP TABLE;', phone: '+447700900077', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(false);
    });

    it('TC-VAL-343: Reject passenger with short 6-digit phone', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '123456', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(false);
    });

    it('TC-VAL-344: Reject passenger with 16-digit phone', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+1234567890123456', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(false);
    });

    it('TC-VAL-345: Validate passenger with trimmed whitespace in all inputs', () => {
      const p = { firstName: '  John  ', lastName: '  Smith  ', phone: '  +447700900077  ', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-346: Flag error when passenger email has space', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB', email: 'john @example.com' };
      const res = validatePassenger(p);
      expect(res.isValid).toBe(false);
      expect(res.errors.email).toBeDefined();
    });

    it('TC-VAL-347: Validate passenger with multi-level domain email', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB', email: 'john@mail.co.uk' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-348: Validate passenger with plus addressing email', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB', email: 'john+ba@example.com' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-349: Validate passenger with title dot in first name', () => {
      const p = { firstName: 'St. John', lastName: 'Smyth', phone: '+447700900077', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-350: Return error keys array matching exactly failed fields', () => {
      const p = { firstName: 'J', lastName: 'Smith', phone: '+447700900077', nationality: 'GB' };
      const res = validatePassenger(p);
      expect(Object.keys(res.errors)).toEqual(['firstName']);
    });

    it('TC-VAL-351: Validate passenger with 15-digit maximum boundary phone', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+123456789012345', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-352: Validate passenger with 50-character maximum boundary names', () => {
      const p = { firstName: 'A'.repeat(50), lastName: 'B'.repeat(50), phone: '+447700900077', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-353: Reject passenger with 51-character first name', () => {
      const p = { firstName: 'A'.repeat(51), lastName: 'Smith', phone: '+447700900077', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(false);
      expect(res => res.errors.firstName).toBeDefined();
    });

    it('TC-VAL-354: Reject passenger with 51-character last name', () => {
      const p = { firstName: 'John', lastName: 'B'.repeat(51), phone: '+447700900077', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(false);
    });

    it('TC-VAL-355: Validate Italian passenger', () => {
      const p = { firstName: 'Marco', lastName: 'Rossi', phone: '+39066982', nationality: 'IT' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-356: Validate Japanese passenger', () => {
      const p = { firstName: 'Taro', lastName: 'Tanaka', phone: '+81312345678', nationality: 'JP' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-357: Validate Indian passenger', () => {
      const p = { firstName: 'Raja', lastName: 'Kumar', phone: '+919876543210', nationality: 'IN' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-358: Validate Chinese passenger', () => {
      const p = { firstName: 'Wei', lastName: 'Zhang', phone: '+861012345678', nationality: 'CN' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-359: Validate Brazilian passenger', () => {
      const p = { firstName: 'Lucas', lastName: 'Silva', phone: '+5511987654321', nationality: 'BR' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-360: Validate Dutch passenger', () => {
      const p = { firstName: 'Jan', lastName: 'De Jong', phone: '+31201234567', nationality: 'NL' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-361: Reject passenger with numbers in first name', () => {
      const p = { firstName: 'John123', lastName: 'Smith', phone: '+447700900077', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(false);
    });

    it('TC-VAL-362: Reject passenger with numbers in last name', () => {
      const p = { firstName: 'John', lastName: 'Smith123', phone: '+447700900077', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(false);
    });

    it('TC-VAL-363: Reject passenger with letters in phone', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+4477009000ab', nationality: 'GB' };
      expect(validatePassenger(p).isValid).toBe(false);
    });

    it('TC-VAL-364: Reject passenger with invalid nationality number', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 123 };
      expect(validatePassenger(p).isValid).toBe(false);
    });

    it('TC-VAL-365: Validate passenger with uppercase email', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB', email: 'JOHN@EXAMPLE.COM' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-366: Validate passenger with dots in email username', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB', email: 'john.smith@example.com' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-367: Validate passenger with hyphens in email domain', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'GB', email: 'john@my-domain.com' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-368: Validate passenger with 2-letter ISO country code', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'US' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-369: Validate passenger with full country name', () => {
      const p = { firstName: 'John', lastName: 'Smith', phone: '+447700900077', nationality: 'United States' };
      expect(validatePassenger(p).isValid).toBe(true);
    });

    it('TC-VAL-370: Return isValid: false when all fields are empty', () => {
      const p = { firstName: '', lastName: '', phone: '', nationality: '', email: '' };
      expect(validatePassenger(p).isValid).toBe(false);
    });
  });

  // =============================================================
  // 8. Luhn Algorithm & Card Formatting (TC-VAL-371 to TC-VAL-420)
  // =============================================================
  describe('8. Luhn Checksum & Card Formatting (TC-VAL-371 to TC-VAL-420)', () => {
    it('TC-VAL-371: isValidLuhn returns false for empty string', () => { expect(isValidLuhn('')).toBe(false); });
    it('TC-VAL-372: isValidLuhn returns false for null', () => { expect(isValidLuhn(null)).toBe(false); });
    it('TC-VAL-373: isValidLuhn returns false for undefined', () => { expect(isValidLuhn(undefined)).toBe(false); });
    it('TC-VAL-374: isValidLuhn returns false for non-numeric characters', () => { expect(isValidLuhn('abcdefghijklmnop')).toBe(false); });
    it('TC-VAL-375: isValidLuhn returns true for valid Visa 16-digit card', () => { expect(isValidLuhn('4532015112830366')).toBe(true); });
    it('TC-VAL-376: isValidLuhn returns false for invalid Visa 16-digit card', () => { expect(isValidLuhn('4532015112830367')).toBe(false); });
    it('TC-VAL-377: isValidLuhn returns true for valid Amex 15-digit card', () => { expect(isValidLuhn('378282246310005')).toBe(true); });
    it('TC-VAL-378: isValidLuhn returns false for invalid Amex 15-digit card', () => { expect(isValidLuhn('378282246310006')).toBe(false); });
    it('TC-VAL-379: isValidLuhn returns true for valid Mastercard 16-digit card', () => { expect(isValidLuhn('5500000000000004')).toBe(true); });
    it('TC-VAL-380: isValidLuhn returns true for demo test card 1234567890123451', () => { expect(isValidLuhn('1234567890123451')).toBe(true); });
    it('TC-VAL-381: isValidLuhn returns true for demo test card 1234567890123452', () => { expect(isValidLuhn('1234567890123452')).toBe(true); });
    it('TC-VAL-382: isValidLuhn returns true for demo test card 4111111111111111', () => { expect(isValidLuhn('4111111111111111')).toBe(true); });
    it('TC-VAL-383: isValidLuhn returns false for single digit 4', () => { expect(isValidLuhn('4')).toBe(false); });
    it('TC-VAL-384: isValidLuhn returns true for single digit 0', () => { expect(isValidLuhn('0')).toBe(true); });
    it('TC-VAL-385: isValidLuhn returns true for 4000000000000002', () => { expect(isValidLuhn('4000000000000002')).toBe(true); });
    it('TC-VAL-386: formatCardNumber returns empty string for empty input', () => { expect(formatCardNumber('')).toBe(''); });
    it('TC-VAL-387: formatCardNumber returns empty string for null input', () => { expect(formatCardNumber(null)).toBe(''); });
    it('TC-VAL-388: formatCardNumber returns empty string for undefined', () => { expect(formatCardNumber(undefined)).toBe(''); });
    it('TC-VAL-389: formatCardNumber strips dashes before formatting', () => { expect(formatCardNumber('4532-0151-1283-0366')).toBe('4532 0151 1283 0366'); });
    it('TC-VAL-390: formatCardNumber formats 16-digit Visa with space every 4 digits', () => { expect(formatCardNumber('4532015112830366')).toBe('4532 0151 1283 0366'); });
    it('TC-VAL-391: formatCardNumber formats 15-digit Amex starting with 34 in 4-6-5 format', () => { expect(formatCardNumber('348282246310005')).toBe('3482 822463 10005'); });
    it('TC-VAL-392: formatCardNumber formats 15-digit Amex starting with 37 in 4-6-5 format', () => { expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005'); });
    it('TC-VAL-393: formatCardNumber handles partial Amex input (4 digits)', () => { expect(formatCardNumber('3782')).toBe('3782'); });
    it('TC-VAL-394: formatCardNumber handles partial Amex input (10 digits)', () => { expect(formatCardNumber('3782822463')).toBe('3782 822463'); });
    it('TC-VAL-395: formatCardNumber handles partial standard card input (8 digits)', () => { expect(formatCardNumber('45320151')).toBe('4532 0151'); });
    it('TC-VAL-396: formatCardNumber handles partial standard card input (12 digits)', () => { expect(formatCardNumber('453201511283')).toBe('4532 0151 1283'); });
    it('TC-VAL-397: formatCardNumber caps standard card output length to 19 chars', () => { expect(formatCardNumber('4532015112830366999')).toBe('4532 0151 1283 0366'); });
    it('TC-VAL-398: formatCardNumber caps Amex card output length to 17 chars', () => { expect(formatCardNumber('378282246310005999')).toBe('3782 822463 10005'); });
    it('TC-VAL-399: formatCardNumber formats Mastercard starting with 55', () => { expect(formatCardNumber('5500000000000004')).toBe('5500 0000 0000 0004'); });
    it('TC-VAL-400: formatCardNumber formats Discover card starting with 6011', () => { expect(formatCardNumber('6011000000000004')).toBe('6011 0000 0000 0004'); });
    it('TC-VAL-401: formatCardNumber formats JCB card starting with 35', () => { expect(formatCardNumber('3566000000000000')).toBe('3566 0000 0000 0000'); });
    it('TC-VAL-402: formatCardNumber strips alphabetic letters automatically', () => { expect(formatCardNumber('4532abcd0151efgh')).toBe('4532 0151'); });
    it('TC-VAL-403: formatCardNumber strips special characters automatically', () => { expect(formatCardNumber('4532#0151$1283%0366')).toBe('4532 0151 1283 0366'); });
    it('TC-VAL-404: formatCardNumber formats 1 digit', () => { expect(formatCardNumber('4')).toBe('4'); });
    it('TC-VAL-405: formatCardNumber formats 5 digits', () => { expect(formatCardNumber('45320')).toBe('4532 0'); });
    it('TC-VAL-406: formatCardNumber formats 9 digits', () => { expect(formatCardNumber('453201511')).toBe('4532 0151 1'); });
    it('TC-VAL-407: formatCardNumber formats 13 digits', () => { expect(formatCardNumber('4532015112830')).toBe('4532 0151 1283 0'); });
    it('TC-VAL-408: formatCardNumber formats Amex 5 digits', () => { expect(formatCardNumber('37828')).toBe('3782 8'); });
    it('TC-VAL-409: formatCardNumber formats Amex 11 digits', () => { expect(formatCardNumber('37828224631')).toBe('3782 822463 1'); });
    it('TC-VAL-410: isValidLuhn returns true for 16 zeroes with valid Luhn check digit', () => { expect(isValidLuhn('0000000000000000')).toBe(true); });
    it('TC-VAL-411: isValidLuhn returns false for 16 ones', () => { expect(isValidLuhn('1111111111111111')).toBe(false); });
    it('TC-VAL-412: isValidLuhn returns false for 16 twos', () => { expect(isValidLuhn('2222222222222222')).toBe(false); });
    it('TC-VAL-413: formatCardNumber strips spaces before formatting', () => { expect(formatCardNumber('4532  0151  1283  0366')).toBe('4532 0151 1283 0366'); });
    it('TC-VAL-414: formatCardNumber strips slashes before formatting', () => { expect(formatCardNumber('4532/0151/1283/0366')).toBe('4532 0151 1283 0366'); });
    it('TC-VAL-415: formatCardNumber handles string starting with zero', () => { expect(formatCardNumber('0123456789012345')).toBe('0123 4567 8901 2345'); });
    it('TC-VAL-416: isValidLuhn handles spaces in number string', () => { expect(isValidLuhn('4532 0151 1283 0366')).toBe(true); });
    it('TC-VAL-417: isValidLuhn handles hyphens in number string', () => { expect(isValidLuhn('4532-0151-1283-0366')).toBe(true); });
    it('TC-VAL-418: formatCardNumber formats Visa Electron starting with 4026', () => { expect(formatCardNumber('4026000000000000')).toBe('4026 0000 0000 0000'); });
    it('TC-VAL-419: formatCardNumber formats Maestro starting with 5018', () => { expect(formatCardNumber('5018000000000000')).toBe('5018 0000 0000 0000'); });
    it('TC-VAL-420: formatCardNumber formats Diners Club starting with 36', () => { expect(formatCardNumber('36000000000000')).toBe('3600 0000 0000 00'); });
  });

  // =============================================================
  // 9. Card Number & Cardholder Name Validation (TC-VAL-421 to TC-VAL-460)
  // =============================================================
  describe('9. Card Number & Cardholder Name Validation (TC-VAL-421 to TC-VAL-460)', () => {
    it('TC-VAL-421: validateCardNumber rejects empty string', () => { expect(validateCardNumber('')).toBe('Card number is required.'); });
    it('TC-VAL-422: validateCardNumber rejects null', () => { expect(validateCardNumber(null)).toBe('Card number is required.'); });
    it('TC-VAL-423: validateCardNumber rejects undefined', () => { expect(validateCardNumber(undefined)).toBe('Card number is required.'); });
    it('TC-VAL-424: validateCardNumber rejects spaces only', () => { expect(validateCardNumber('   ')).toBe('Card number is required.'); });
    it('TC-VAL-425: validateCardNumber rejects letters in card number', () => { expect(validateCardNumber('4532-0151-1283-036a')).toBe('Card number can only contain digits.'); });
    it('TC-VAL-426: validateCardNumber rejects special chars in card number', () => { expect(validateCardNumber('4532#0151!1283$0366')).toBe('Card number can only contain digits.'); });
    it('TC-VAL-427: validateCardNumber rejects 14-digit Amex card', () => { expect(validateCardNumber('3782 822463 1000')).toBe('American Express card number must be exactly 15 digits.'); });
    it('TC-VAL-428: validateCardNumber accepts 15-digit Amex card with valid Luhn', () => { expect(validateCardNumber('3782 822463 10005')).toBeNull(); });
    it('TC-VAL-429: validateCardNumber rejects 16-digit Amex card', () => { expect(validateCardNumber('3782 822463 100051')).toBe('American Express card number must be exactly 15 digits.'); });
    it('TC-VAL-430: validateCardNumber rejects 15-digit Visa card', () => { expect(validateCardNumber('4532 0151 1283 036')).toBe('Card number must be exactly 16 digits.'); });
    it('TC-VAL-431: validateCardNumber accepts 16-digit Visa card with valid Luhn', () => { expect(validateCardNumber('4532 0151 1283 0366')).toBeNull(); });
    it('TC-VAL-432: validateCardNumber rejects 17-digit Visa card', () => { expect(validateCardNumber('4532 0151 1283 03661')).toBe('Card number must be exactly 16 digits.'); });
    it('TC-VAL-433: validateCardNumber rejects invalid Luhn checksum for 16-digit card', () => { expect(validateCardNumber('4532 0151 1283 0367')).toBe('Invalid card number checksum.'); });
    it('TC-VAL-434: validateCardNumber accepts demo card 1234 5678 9012 3451', () => { expect(validateCardNumber('1234 5678 9012 3451')).toBeNull(); });
    it('TC-VAL-435: validateCardNumber accepts demo card 1234 5678 9012 3452', () => { expect(validateCardNumber('1234 5678 9012 3452')).toBeNull(); });
    it('TC-VAL-436: validateCardName rejects empty string', () => { expect(validateCardName('')).toBe('Name on card is required.'); });
    it('TC-VAL-437: validateCardName rejects null', () => { expect(validateCardName(null)).toBe('Name on card is required.'); });
    it('TC-VAL-438: validateCardName rejects undefined', () => { expect(validateCardName(undefined)).toBe('Name on card is required.'); });
    it('TC-VAL-439: validateCardName rejects spaces only', () => { expect(validateCardName('   ')).toBe('Name on card is required.'); });
    it('TC-VAL-440: validateCardName rejects single letter name', () => { expect(validateCardName('A')).toBe('Name on card must be at least 2 characters.'); });
    it('TC-VAL-441: validateCardName accepts 2-character min boundary "AB"', () => { expect(validateCardName('AB')).toBeNull(); });
    it('TC-VAL-442: validateCardName rejects numbers in cardholder name', () => { expect(validateCardName('John Smith 2')).toBe('Name on card can only contain letters, hyphens, and spaces.'); });
    it('TC-VAL-443: validateCardName rejects <script> tags', () => { expect(validateCardName('<script>alert(1)</script>')).toBe('Name on card can only contain letters, hyphens, and spaces.'); });
    it('TC-VAL-444: validateCardName accepts spaces between words', () => { expect(validateCardName('JOHN   SMITH')).toBeNull(); });
    it('TC-VAL-445: validateCardName accepts standard uppercase cardholder name', () => { expect(validateCardName('JOHN SMITH')).toBeNull(); });
    it('TC-VAL-446: validateCardName accepts hyphenated cardholder name', () => { expect(validateCardName('MARY-JANE SMITH')).toBeNull(); });
    it('TC-VAL-447: validateCardName accepts apostrophe cardholder name', () => { expect(validateCardName("JOHN O'CONNOR")).toBeNull(); });
    it('TC-VAL-448: validateCardName accepts lowercase cardholder name', () => { expect(validateCardName('john smith')).toBeNull(); });
    it('TC-VAL-449: validateCardName accepts mixed case cardholder name', () => { expect(validateCardName('John Smith')).toBeNull(); });
    it('TC-VAL-450: validateCardName accepts accented cardholder name', () => { expect(validateCardName('JOSÉ SMITH')).toBeNull(); });
    it('TC-VAL-451: validateCardNumber accepts Amex starting with 37', () => { expect(validateCardNumber('3782 822463 10005')).toBeNull(); });
    it('TC-VAL-452: validateCardNumber accepts Amex starting with 34', () => { expect(validateCardNumber('3400 000000 00009')).toBeNull(); });
    it('TC-VAL-453: validateCardNumber accepts Mastercard starting with 51', () => { expect(validateCardNumber('5100 0000 0000 0004')).toBeNull(); });
    it('TC-VAL-454: validateCardNumber accepts Mastercard starting with 55', () => { expect(validateCardNumber('5500 0000 0000 0004')).toBeNull(); });
    it('TC-VAL-455: validateCardNumber accepts Visa starting with 4', () => { expect(validateCardNumber('4111 1111 1111 1111')).toBeNull(); });
    it('TC-VAL-456: validateCardNumber rejects 10 digits card', () => { expect(validateCardNumber('1234567890')).toBe('Card number must be exactly 16 digits.'); });
    it('TC-VAL-457: validateCardNumber rejects 12 digits card', () => { expect(validateCardNumber('123456789012')).toBe('Card number must be exactly 16 digits.'); });
    it('TC-VAL-458: validateCardNumber rejects 18 digits card', () => { expect(validateCardNumber('123456789012345678')).toBe('Card number must be exactly 16 digits.'); });
    it('TC-VAL-459: validateCardName auto-trims surrounding spaces', () => { expect(validateCardName('  JOHN SMITH  ')).toBeNull(); });
    it('TC-VAL-460: validateCardName rejects special symbols like $', () => { expect(validateCardName('JOHN$MITH')).toBe('Name on card can only contain letters, hyphens, and spaces.'); });
  });

  // =============================================================
  // 10. CVV Validation (Enforces Strictly 3 Digits) (TC-VAL-461 to TC-VAL-480)
  // =============================================================
  describe('10. CVV Validation (3 digits standard / 4 digits Amex CID) (TC-VAL-461 to TC-VAL-480)', () => {
    it('TC-VAL-461: Reject empty string CVV', () => { expect(validateCVV('')).toBe('CVV code is required.'); });
    it('TC-VAL-462: Reject null CVV', () => { expect(validateCVV(null)).toBe('CVV code is required.'); });
    it('TC-VAL-463: Reject undefined CVV', () => { expect(validateCVV(undefined)).toBe('CVV code is required.'); });
    it('TC-VAL-464: Reject spaces-only CVV', () => { expect(validateCVV('   ')).toBe('CVV code is required.'); });
    it('TC-VAL-465: Reject alphabetic CVV "12a"', () => { expect(validateCVV('12a')).toBe('CVV must contain numbers only.'); });
    it('TC-VAL-466: Reject alphabetic CVV "abc"', () => { expect(validateCVV('abc')).toBe('CVV must contain numbers only.'); });
    it('TC-VAL-467: Reject CVV with spaces "1 3"', () => { expect(validateCVV('1 3')).toBe('CVV must contain numbers only.'); });
    it('TC-VAL-468: Reject CVV with symbols "12#"', () => { expect(validateCVV('12#')).toBe('CVV must contain numbers only.'); });
    it('TC-VAL-469: Reject 1-digit CVV "1"', () => { expect(validateCVV('1')).toBe('CVV must be exactly 3 digits.'); });
    it('TC-VAL-470: Reject 2-digit CVV "12"', () => { expect(validateCVV('12')).toBe('CVV must be exactly 3 digits.'); });
    it('TC-VAL-471: Accept 3-digit CVV "123" for Visa', () => { expect(validateCVV('123', '4532 0151 1283 0366')).toBeNull(); });
    it('TC-VAL-472: Accept 3-digit CVV "999" for Visa', () => { expect(validateCVV('999', '4532 0151 1283 0366')).toBeNull(); });
    it('TC-VAL-473: Accept 3-digit CVV "000" for Visa', () => { expect(validateCVV('000', '4532 0151 1283 0366')).toBeNull(); });
    it('TC-VAL-474: Accept 3-digit CVV "123" for Mastercard', () => { expect(validateCVV('123', '5500 0000 0000 0004')).toBeNull(); });
    it('TC-VAL-475: Reject 3-digit CVV "123" for Amex (Amex requires 4 digits)', () => { expect(validateCVV('123', '3782 822463 10005')).toBe('American Express security code must be exactly 4 digits.'); });
    it('TC-VAL-476: Reject 3-digit CVV "456" for Amex (Amex requires 4 digits)', () => { expect(validateCVV('456', '3782 822463 10005')).toBe('American Express security code must be exactly 4 digits.'); });
    it('TC-VAL-477: REJECT 4-digit CVV "1234" for Visa', () => { expect(validateCVV('1234', '4532 0151 1283 0366')).toBe('CVV must be exactly 3 digits.'); });
    it('TC-VAL-478: Accept 4-digit CVV "1234" for Amex (CID standard)', () => { expect(validateCVV('1234', '3782 822463 10005')).toBeNull(); });
    it('TC-VAL-479: REJECT 4-digit CVV "9999" for non-Amex card', () => { expect(validateCVV('9999')).toBe('CVV must be exactly 3 digits.'); });
    it('TC-VAL-480: REJECT 5-digit CVV "12345" for any card', () => { expect(validateCVV('12345')).toBe('CVV must be exactly 3 digits.'); });
  });

  // =============================================================
  // 11. Expiry Date & Full Payment Details (TC-VAL-481 to TC-VAL-500)
  // =============================================================
  describe('11. Expiry Date & Full Payment Details (TC-VAL-481 to TC-VAL-500)', () => {
    it('TC-VAL-481: Reject empty string expiry date', () => { expect(validateExpiry('')).toBe('Expiry date is required.'); });
    it('TC-VAL-482: Reject null expiry date', () => { expect(validateExpiry(null)).toBe('Expiry date is required.'); });
    it('TC-VAL-483: Reject undefined expiry date', () => { expect(validateExpiry(undefined)).toBe('Expiry date is required.'); });
    it('TC-VAL-484: Reject spaces-only expiry date', () => { expect(validateExpiry('   ')).toBe('Expiry date is required.'); });
    it('TC-VAL-485: Reject non-numeric slash format "AA/BB"', () => { expect(validateExpiry('AA/BB')).toBe('Please enter expiry in MM/YY format (e.g. 08/28).'); });
    it('TC-VAL-486: Reject month 00 in expiry date "00/28"', () => { expect(validateExpiry('00/28')).toBe('Expiry month must be between 01 and 12.'); });
    it('TC-VAL-487: Reject month 13 in expiry date "13/28"', () => { expect(validateExpiry('13/28')).toBe('Expiry month must be between 01 and 12.'); });
    it('TC-VAL-488: Reject month 14 in expiry date "14/28"', () => { expect(validateExpiry('14/28')).toBe('Expiry month must be between 01 and 12.'); });
    it('TC-VAL-489: Reject past expired card date "01/20"', () => { expect(validateExpiry('01/20')).toBe('Card has expired. Please use a valid card.'); });
    it('TC-VAL-490: Reject past expired card date "12/21"', () => { expect(validateExpiry('12/21')).toBe('Card has expired. Please use a valid card.'); });
    it('TC-VAL-491: Accept valid future expiry date "12/35"', () => { expect(validateExpiry('12/35')).toBeNull(); });
    it('TC-VAL-492: Accept valid future expiry date "06/30"', () => { expect(validateExpiry('06/30')).toBeNull(); });
    it('TC-VAL-493: Reject year > 20 years in future "12/60"', () => { expect(validateExpiry('12/60')).toBe('Invalid expiry year.'); });
    it('TC-VAL-494: Accept unslashed 4-digit format "1235"', () => { expect(validateExpiry('1235')).toBeNull(); });
    it('TC-VAL-495: validatePaymentDetails accepts valid Visa payment with 3-digit CVV', () => {
      const payment = { cardNumber: '4532 0151 1283 0366', cardName: 'JOHN SMITH', expiry: '12/35', cvv: '123' };
      const res = validatePaymentDetails(payment);
      expect(res.isValid).toBe(true);
      expect(res.errors).toEqual({});
    });
    it('TC-VAL-496: validatePaymentDetails accepts valid Amex payment with 4-digit CVV (CID standard)', () => {
      const payment = { cardNumber: '3782 822463 10005', cardName: 'JANE SMITH', expiry: '12/35', cvv: '1234' };
      const res = validatePaymentDetails(payment);
      expect(res.isValid).toBe(true);
      expect(res.errors).toEqual({});
    });
    it('TC-VAL-497: validatePaymentDetails rejects 3-digit CVV on Amex card (must be 4)', () => {
      const payment = { cardNumber: '3782 822463 10005', cardName: 'JANE SMITH', expiry: '12/35', cvv: '123' };
      const res = validatePaymentDetails(payment);
      expect(res.isValid).toBe(false);
      expect(res.errors.cvv).toBe('American Express security code must be exactly 4 digits.');
    });
    it('TC-VAL-498: validatePaymentDetails returns multiple errors for empty payment object', () => {
      const res = validatePaymentDetails({});
      expect(res.isValid).toBe(false);
      expect(Object.keys(res.errors).length).toBe(4);
    });
    it('TC-VAL-499: validatePaymentDetails rejects expired card date', () => {
      const payment = { cardNumber: '4532 0151 1283 0366', cardName: 'JOHN SMITH', expiry: '01/20', cvv: '123' };
      const res = validatePaymentDetails(payment);
      expect(res.isValid).toBe(false);
      expect(res.errors.expiry).toBe('Card has expired. Please use a valid card.');
    });
    it('TC-VAL-500: validatePaymentDetails rejects invalid card number checksum', () => {
      const payment = { cardNumber: '4532 0151 1283 0367', cardName: 'JOHN SMITH', expiry: '12/35', cvv: '123' };
      const res = validatePaymentDetails(payment);
      expect(res.isValid).toBe(false);
      expect(res.errors.cardNumber).toBe('Invalid card number checksum.');
    });
  });
});
