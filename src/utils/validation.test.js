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

describe('Passenger Details Input Validation - Edge Cases', () => {
  describe('First Name & Last Name Edge Cases', () => {
    it('TC-VAL-001: Should reject empty or null or undefined name inputs', () => {
      expect(validateFirstName('')).toBe('First name is required.');
      expect(validateFirstName(null)).toBe('First name is required.');
      expect(validateFirstName(undefined)).toBe('First name is required.');
      expect(validateLastName('')).toBe('Last name is required.');
    });

    it('TC-VAL-002: Should reject whitespace-only keyboard input', () => {
      expect(validateFirstName('   ')).toBe('First name cannot be blank or spaces only.');
      expect(validateLastName('\t\n ')).toBe('Last name cannot be blank or spaces only.');
    });

    it('TC-VAL-003: Should reject single character names (too short)', () => {
      expect(validateFirstName('J')).toBe('First name must be at least 2 characters.');
      expect(validateLastName('A')).toBe('Last name must be at least 2 characters.');
    });

    it('TC-VAL-004: Should reject names exceeding 50 characters', () => {
      const longName = 'A'.repeat(51);
      expect(validateFirstName(longName)).toBe('First name cannot exceed 50 characters.');
      expect(validateLastName(longName)).toBe('Last name cannot exceed 50 characters.');
    });

    it('TC-VAL-005: Should reject numbers in keyboard input', () => {
      expect(validateFirstName('John123')).toBe('First name cannot contain numbers.');
      expect(validateFirstName('J0hn')).toBe('First name cannot contain numbers.');
      expect(validateLastName('Smith9')).toBe('Last name cannot contain numbers.');
    });

    it('TC-VAL-006: Should reject XSS, script tags, and HTML injection in keyboard input', () => {
      expect(validateFirstName('<script>alert(1)</script>')).toBe('First name contains invalid or unsafe characters.');
      expect(validateLastName('<svg/onload=alert(1)>')).toBe('Last name contains invalid or unsafe characters.');
    });

    it('TC-VAL-007: Should reject special characters like $, %, @, #, ;, =', () => {
      expect(validateFirstName('John$mith')).toBe('First name can only contain letters, hyphens, spaces, and apostrophes.');
      expect(validateLastName('Smith; DROP TABLE')).toBe('Last name can only contain letters, hyphens, spaces, and apostrophes.');
    });

    it('TC-VAL-008: Should reject consecutive hyphens, apostrophes, or spaces', () => {
      expect(validateFirstName('John--Smith')).toBe('First name cannot contain consecutive spaces, hyphens, or apostrophes.');
      expect(validateLastName("O''Connor")).toBe("Last name cannot contain consecutive spaces, hyphens, or apostrophes.");
      expect(validateFirstName('John   Smith')).toBe('First name cannot contain consecutive spaces, hyphens, or apostrophes.');
    });

    it('TC-VAL-009: Should accept valid standard and hyphenated/apostrophe names', () => {
      expect(validateFirstName('John')).toBeNull();
      expect(validateLastName('Smith')).toBeNull();
      expect(validateFirstName('Mary-Jane')).toBeNull();
      expect(validateLastName("O'Connor")).toBeNull();
      expect(validateLastName('St. John')).toBeNull();
      expect(validateLastName('De La Cruz')).toBeNull();
    });

    it('TC-VAL-010: Should accept international Unicode accented letters in names', () => {
      expect(validateFirstName('José')).toBeNull();
      expect(validateFirstName('Renée')).toBeNull();
      expect(validateLastName('Müller')).toBeNull();
      expect(validateLastName('Çırak')).toBeNull();
      expect(validateFirstName('François')).toBeNull();
    });
  });

  describe('Phone Number Edge Cases', () => {
    it('TC-VAL-011: Should reject empty or whitespace phone input', () => {
      expect(validatePhone('')).toBe('Phone number is required.');
      expect(validatePhone('   ')).toBe('Phone number cannot be blank or spaces only.');
    });

    it('TC-VAL-012: Should reject alphabetic characters in phone input', () => {
      expect(validatePhone('+4477009000ab')).toBe('Phone number cannot contain letters.');
      expect(validatePhone('PHONE12345')).toBe('Phone number cannot contain letters.');
    });

    it('TC-VAL-013: Should reject phone numbers with < 7 digits', () => {
      expect(validatePhone('123456')).toBe('Phone number must contain at least 7 digits.');
      expect(validatePhone('+44 12')).toBe('Phone number must contain at least 7 digits.');
    });

    it('TC-VAL-014: Should reject phone numbers with > 15 digits', () => {
      const longPhone = '1234567890123456';
      expect(validatePhone(longPhone)).toBe('Phone number cannot exceed 15 digits.');
    });

    it('TC-VAL-015: Should accept valid formatted international phone numbers', () => {
      expect(validatePhone('+44 7912 345678')).toBeNull();
      expect(validatePhone('07912345678')).toBeNull();
      expect(validatePhone('+1 (555) 019-2834')).toBeNull();
      expect(validatePhone('+33-1-42-68-53-00')).toBeNull();
    });
  });

  describe('Email Edge Cases', () => {
    it('TC-VAL-016: Should reject empty or invalid email formats', () => {
      expect(validateEmail('')).toBe('Email address is required.');
      expect(validateEmail('user@')).toBe('Please enter a valid email address (e.g. name@example.com).');
      expect(validateEmail('@domain.com')).toBe('Please enter a valid email address (e.g. name@example.com).');
      expect(validateEmail('user@domain')).toBe('Please enter a valid email address (e.g. name@example.com).');
    });

    it('TC-VAL-017: Should accept valid email formats', () => {
      expect(validateEmail('john.smith@britishairways.com')).toBeNull();
      expect(validateEmail('user+sub@domain.co.uk')).toBeNull();
    });
  });

  describe('Sanitizer & Full Passenger Validation', () => {
    it('TC-VAL-018: sanitizeInput should strip HTML tags', () => {
      expect(sanitizeInput('John<script>alert(1)</script>')).toBe('Johnalert(1)');
      expect(sanitizeInput('Smith<b>Test</b>')).toBe('SmithTest');
    });

    it('TC-VAL-019: validatePassenger should return false and errors for invalid input', () => {
      const result = validatePassenger({
        firstName: 'John123',
        lastName: '',
        phone: '123',
        nationality: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.firstName).toBe('First name cannot contain numbers.');
      expect(result.errors.lastName).toBe('Last name is required.');
      expect(result.errors.phone).toBe('Phone number must contain at least 7 digits.');
      expect(result.errors.nationality).toBe('Please select or enter a nationality.');
    });

    it('TC-VAL-020: validatePassenger should return true and no errors for valid passenger', () => {
      const result = validatePassenger({
        firstName: 'John',
        lastName: 'Smith',
        phone: '+447912345678',
        nationality: 'GB',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });
  });

  describe('Credit Card & CVV Edge Cases', () => {
    it('TC-VAL-021: Should validate Luhn checksum correctly', () => {
      expect(isValidLuhn('4532015112830366')).toBe(true); // Valid Visa test number
      expect(isValidLuhn('4532015112830367')).toBe(false); // Invalid checksum
    });

    it('TC-VAL-022: Should reject non-digits or incorrect digit length in card number', () => {
      expect(validateCardNumber('')).toBe('Card number is required.');
      expect(validateCardNumber('1234')).toBe('Card number must be exactly 16 digits.');
      expect(validateCardNumber('4532015112830366abc')).toBe('Card number can only contain digits.');
    });

    it('TC-VAL-023: Should enforce 15 digits for American Express and 16 for Visa/Mastercard', () => {
      // Amex starts with 3782...
      expect(validateCardNumber('3782 822463 1000')).toBe('American Express card number must be exactly 15 digits.');
      expect(validateCardNumber('3782 822463 10005')).toBeNull(); // Valid 15-digit Amex test card

      // Visa/Mastercard 16 digits
      expect(validateCardNumber('4532 0151 1283 036')).toBe('Card number must be exactly 16 digits.');
      expect(validateCardNumber('4532 0151 1283 0366')).toBeNull();
    });

    it('TC-VAL-024: Should enforce 4-digit CVV for Amex and 3-digit CVV for Visa/Mastercard', () => {
      const amexCard = '3782 822463 10005';
      const visaCard = '4532 0151 1283 0366';

      // 4-digit CVV on Visa should be rejected
      expect(validateCVV('1234', visaCard)).toBe('CVV must be exactly 3 digits.');
      expect(validateCVV('123', visaCard)).toBeNull();

      // 3-digit CVV on Amex should be rejected
      expect(validateCVV('123', amexCard)).toBe('American Express CVV must be exactly 4 digits.');
      expect(validateCVV('1234', amexCard)).toBeNull();

      // Non-numeric CVV
      expect(validateCVV('12a', visaCard)).toBe('CVV must contain numbers only.');
    });

    it('TC-VAL-025: Should validate expiry date MM/YY format and expired cards', () => {
      expect(validateExpiry('')).toBe('Expiry date is required.');
      expect(validateExpiry('13/28')).toBe('Expiry month must be between 01 and 12.');
      expect(validateExpiry('01/20')).toBe('Card has expired. Please use a valid card.');
      expect(validateExpiry('12/35')).toBeNull();
    });

    it('TC-VAL-026: validatePaymentDetails should validate complete payment object', () => {
      const invalidPayment = {
        cardNumber: '1234',
        cardName: '',
        expiry: '01/20',
        cvv: '1234', // 4 digits on unknown card
      };
      const result = validatePaymentDetails(invalidPayment);
      expect(result.isValid).toBe(false);
      expect(result.errors.cardNumber).toBe('Card number must be exactly 16 digits.');
      expect(result.errors.cardName).toBe('Name on card is required.');
      expect(result.errors.expiry).toBe('Card has expired. Please use a valid card.');
      expect(result.errors.cvv).toBe('CVV must be exactly 3 digits.');
    });

    it('TC-VAL-027: formatCardNumber should format Visa and Amex card numbers with spaces', () => {
      expect(formatCardNumber('4532015112830366')).toBe('4532 0151 1283 0366');
      expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
    });
  });
});

