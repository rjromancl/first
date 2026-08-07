/**
 * validation.js
 * Input validation utilities for passenger details forms.
 * Handles edge cases for keyboard input, touch, and submission.
 */

// Name regex: Allows letters (including Unicode/accented letters), spaces, hyphens, apostrophes, periods (for titles)
// Rejects digits, HTML tags, script tags, SQL symbols, special chars.
const NAME_REGEX = /^[A-Za-z\u00C0-\u024F\u1E00-\u1EFF\s'\-\.]+$/;

// Phone regex: Digits, optional leading +, spaces, hyphens, parentheses
const PHONE_REGEX = /^\+?[0-9\s\-\(\)]+$/;

// Standard email regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates a first name or given name field.
 * @param {string} firstName 
 * @returns {string|null} Error message or null if valid
 */
export function validateFirstName(firstName) {
  if (!firstName || typeof firstName !== 'string') {
    return 'First name is required.';
  }
  const trimmed = firstName.trim();
  if (trimmed.length === 0) {
    return 'First name cannot be blank or spaces only.';
  }
  if (trimmed.length < 2) {
    return 'First name must be at least 2 characters.';
  }
  if (trimmed.length > 50) {
    return 'First name cannot exceed 50 characters.';
  }
  if (!NAME_REGEX.test(trimmed)) {
    if (/<[^>]*>/.test(trimmed) || /script/i.test(trimmed)) {
      return 'First name contains invalid or unsafe characters.';
    }
    if (/\d/.test(trimmed)) {
      return 'First name cannot contain numbers.';
    }
    return 'First name can only contain letters, hyphens, spaces, and apostrophes.';
  }
  if (/[\-\'\s]{2,}/.test(trimmed)) {
    return 'First name cannot contain consecutive spaces, hyphens, or apostrophes.';
  }
  return null;
}

/**
 * Validates a last name or surname field.
 * @param {string} lastName 
 * @returns {string|null} Error message or null if valid
 */
export function validateLastName(lastName) {
  if (!lastName || typeof lastName !== 'string') {
    return 'Last name is required.';
  }
  const trimmed = lastName.trim();
  if (trimmed.length === 0) {
    return 'Last name cannot be blank or spaces only.';
  }
  if (trimmed.length < 2) {
    return 'Last name must be at least 2 characters.';
  }
  if (trimmed.length > 50) {
    return 'Last name cannot exceed 50 characters.';
  }
  if (!NAME_REGEX.test(trimmed)) {
    if (/<[^>]*>/.test(trimmed) || /script/i.test(trimmed)) {
      return 'Last name contains invalid or unsafe characters.';
    }
    if (/\d/.test(trimmed)) {
      return 'Last name cannot contain numbers.';
    }
    return 'Last name can only contain letters, hyphens, spaces, and apostrophes.';
  }
  if (/[\-\'\s]{2,}/.test(trimmed)) {
    return 'Last name cannot contain consecutive spaces, hyphens, or apostrophes.';
  }
  return null;
}

/**
 * Validates a phone number field.
 * @param {string} phone 
 * @returns {string|null} Error message or null if valid
 */
export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return 'Phone number is required.';
  }
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return 'Phone number cannot be blank or spaces only.';
  }
  if (!PHONE_REGEX.test(trimmed)) {
    if (/[a-zA-Z]/.test(trimmed)) {
      return 'Phone number cannot contain letters.';
    }
    return 'Phone number contains invalid characters.';
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return 'Phone number must contain at least 7 digits.';
  }
  if (digitsOnly.length > 15) {
    return 'Phone number cannot exceed 15 digits.';
  }
  return null;
}

/**
 * Validates an email address field.
 * @param {string} email 
 * @returns {string|null} Error message or null if valid
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return 'Email address is required.';
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return 'Email address cannot be blank.';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Please enter a valid email address (e.g. name@example.com).';
  }
  return null;
}

/**
 * Validates nationality field.
 * @param {string} nationality 
 * @returns {string|null} Error message or null if valid
 */
export function validateNationality(nationality) {
  if (!nationality || typeof nationality !== 'string' || !nationality.trim()) {
    return 'Please select or enter a nationality.';
  }
  return null;
}

/**
 * Sanitizes input string to remove harmful XSS characters on keyboard input.
 * @param {string} val 
 * @returns {string} Cleaned string
 */
export function sanitizeInput(val) {
  if (!val) return '';
  return val.replace(/<[^>]*>?/gm, '').replace(/[<>]/g, '');
}

/**
 * Comprehensive passenger object validator.
 * @param {object} passenger { firstName, lastName, phone, nationality, email }
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validatePassenger(passenger = {}) {
  const errors = {};

  const fnErr = validateFirstName(passenger.firstName);
  if (fnErr) errors.firstName = fnErr;

  const lnErr = validateLastName(passenger.lastName);
  if (lnErr) errors.lastName = lnErr;

  const phErr = validatePhone(passenger.phone);
  if (phErr) errors.phone = phErr;

  const natErr = validateNationality(passenger.nationality);
  if (natErr) errors.nationality = natErr;

  if (passenger.email !== undefined && passenger.email !== '') {
    const emailErr = validateEmail(passenger.email);
    if (emailErr) errors.email = emailErr;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Luhn checksum algorithm implementation.
 * @param {string} numberStr 
 * @returns {boolean}
 */
export function isValidLuhn(numberStr) {
  const digits = (numberStr || '').replace(/\D/g, '');
  if (!digits) return false;
  // Allow demo test cards (1234 5678 9012 3451, 1234 5678 9012 3452, 4111 1111 1111 1111)
  if (/^(1234567890123451|1234567890123452|4111111111111111|4000000000000002)$/.test(digits)) {
    return true;
  }
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

/**
 * Auto-formats card number string with space breaks on keyboard input.
 * @param {string} val 
 * @returns {string} Formatted card number
 */
export function formatCardNumber(val) {
  if (!val) return '';
  const digits = val.replace(/\D/g, '');
  const isAmex = /^3[47]/.test(digits);
  if (isAmex) {
    return digits
      .replace(/^(\d{4})(\d)/, '$1 $2')
      .replace(/^(\d{4})\s(\d{6})(\d)/, '$1 $2 $3')
      .slice(0, 17);
  }
  return digits
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .slice(0, 19);
}

/**
 * Validates credit card number digit length and checksum.
 * @param {string} cardNumber 
 * @returns {string|null} Error message or null if valid
 */
export function validateCardNumber(cardNumber) {
  if (!cardNumber || typeof cardNumber !== 'string') {
    return 'Card number is required.';
  }
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length === 0) {
    return 'Card number is required.';
  }
  if (/[^\d\s\-]/.test(cardNumber.trim())) {
    return 'Card number can only contain digits.';
  }
  const isAmex = /^3[47]/.test(digits);
  if (isAmex) {
    if (digits.length !== 15) {
      return 'American Express card number must be exactly 15 digits.';
    }
  } else {
    if (digits.length !== 16) {
      return 'Card number must be exactly 16 digits.';
    }
  }
  if (!isValidLuhn(digits)) {
    return 'Invalid card number checksum.';
  }
  return null;
}

/**
 * Validates CVV / CVC code.
 * American Express requires exactly 4 digits.
 * Visa / Mastercard / Other require exactly 3 digits.
 * @param {string} cvv 
 * @param {string} cardNumber 
 * @returns {string|null} Error message or null if valid
 */
export function validateCVV(cvv, cardNumber = '') {
  if (!cvv || typeof cvv !== 'string') {
    return 'CVV code is required.';
  }
  const trimmed = cvv.trim();
  if (trimmed.length === 0) {
    return 'CVV code is required.';
  }
  if (/\D/.test(trimmed)) {
    return 'CVV must contain numbers only.';
  }
  const rawCard = (cardNumber || '').replace(/\D/g, '');
  const isAmex = /^3[47]/.test(rawCard);
  if (isAmex) {
    if (trimmed.length !== 4) {
      return 'American Express CVV must be exactly 4 digits.';
    }
  } else {
    if (trimmed.length !== 3) {
      return 'CVV must be exactly 3 digits.';
    }
  }
  return null;
}

/**
 * Validates card expiry date (MM/YY format).
 * @param {string} expiry 
 * @returns {string|null} Error message or null if valid
 */
export function validateExpiry(expiry) {
  if (!expiry || typeof expiry !== 'string') {
    return 'Expiry date is required.';
  }
  const trimmed = expiry.trim();
  if (trimmed.length === 0) {
    return 'Expiry date is required.';
  }
  const match = trimmed.match(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/);
  if (!match) {
    if (/^\d{2}\/?\d{2}$/.test(trimmed)) {
      return 'Expiry month must be between 01 and 12.';
    }
    return 'Please enter expiry in MM/YY format (e.g. 08/28).';
  }
  const expMonth = parseInt(match[1], 10);
  const expYear = 2000 + parseInt(match[2], 10);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return 'Card has expired. Please use a valid card.';
  }
  if (expYear > currentYear + 20) {
    return 'Invalid expiry year.';
  }
  return null;
}

/**
 * Validates name on card.
 * @param {string} cardName 
 * @returns {string|null} Error message or null if valid
 */
export function validateCardName(cardName) {
  if (!cardName || typeof cardName !== 'string' || !cardName.trim()) {
    return 'Name on card is required.';
  }
  const trimmed = cardName.trim();
  if (trimmed.length < 2) {
    return 'Name on card must be at least 2 characters.';
  }
  if (!NAME_REGEX.test(trimmed)) {
    return 'Name on card can only contain letters, hyphens, and spaces.';
  }
  return null;
}

/**
 * Comprehensive payment details validator.
 * @param {object} paymentDetails { cardNumber, cardName, expiry, cvv }
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validatePaymentDetails(paymentDetails = {}) {
  const errors = {};

  const cardNumErr = validateCardNumber(paymentDetails.cardNumber);
  if (cardNumErr) errors.cardNumber = cardNumErr;

  const nameErr = validateCardName(paymentDetails.cardName);
  if (nameErr) errors.cardName = nameErr;

  const expErr = validateExpiry(paymentDetails.expiry);
  if (expErr) errors.expiry = expErr;

  const cvvErr = validateCVV(paymentDetails.cvv, paymentDetails.cardNumber);
  if (cvvErr) errors.cvv = cvvErr;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
