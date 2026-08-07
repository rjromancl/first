import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BookFlight from './BookFlight';
import { AppProvider } from '../../context/AppContext';

const mockFlight = {
  id: 'BA101',
  flightNumber: 'BA101',
  departure: '10:00',
  arrival: '13:00',
  prices: { economy: 250, businessClass: 800 },
  seatsLeft: { economy: 5, businessClass: 2 },
  amenities: ['Wi-Fi', 'Meals'],
};

function renderBookFlightAtPaymentStep() {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/book',
          state: {
            jumpToStep: 4,
            from: 'LHR',
            to: 'JFK',
            selectedFlight: mockFlight,
          },
        },
      ]}
    >
      <AppProvider>
        <Routes>
          <Route path="/book" element={<BookFlight />} />
        </Routes>
      </AppProvider>
    </MemoryRouter>
  );
}

describe('BookFlight Payment Form Keyboard Validation - Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-PAY-001: Renders payment input fields on step 4', () => {
    renderBookFlightAtPaymentStep();
    expect(screen.getByLabelText(/Card Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name on Card/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expiry Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CVV/i)).toBeInTheDocument();
  });

  it('TC-PAY-002: Shows error when entering 4-digit CVV for non-Amex card', () => {
    renderBookFlightAtPaymentStep();
    const cardInput = screen.getByLabelText(/Card Number/i);
    const cvvInput = screen.getByLabelText(/CVV/i);

    // Visa 16-digit card
    fireEvent.change(cardInput, { target: { value: '4532 0151 1283 0366' } });
    fireEvent.change(cvvInput, { target: { value: '1234' } });
    fireEvent.blur(cvvInput);

    expect(screen.getByText('CVV must be exactly 3 digits.')).toBeInTheDocument();
    expect(cvvInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('TC-PAY-003: Shows error when entering 3-digit CVV for American Express card', () => {
    renderBookFlightAtPaymentStep();
    const cardInput = screen.getByLabelText(/Card Number/i);
    const cvvInput = screen.getByLabelText(/CVV/i);

    // Amex 15-digit card starting with 37
    fireEvent.change(cardInput, { target: { value: '3782 822463 10005' } });
    fireEvent.change(cvvInput, { target: { value: '123' } });
    fireEvent.blur(cvvInput);

    expect(screen.getByText('American Express CVV must be exactly 4 digits.')).toBeInTheDocument();
    expect(cvvInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('TC-PAY-004: Shows error for incomplete card number and prevents submission', () => {
    renderBookFlightAtPaymentStep();
    const cardInput = screen.getByLabelText(/Card Number/i);
    fireEvent.change(cardInput, { target: { value: '12345678' } });

    const payBtn = screen.getByRole('button', { name: /Pay £/i });
    fireEvent.click(payBtn);

    expect(screen.getByText('Card number must be exactly 16 digits.')).toBeInTheDocument();
  });
});
