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

function renderBookFlightAtPassengerStep() {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/book',
          state: {
            jumpToStep: 3,
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

describe('BookFlight Passenger Form Keyboard Validation - Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-UI-001: Renders passenger details input fields on step 3', () => {
    renderBookFlightAtPassengerStep();
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nationality/i)).toBeInTheDocument();
  });

  it('TC-UI-002: Shows inline validation error when typing invalid characters into First Name', () => {
    renderBookFlightAtPassengerStep();
    const firstNameInput = screen.getByLabelText(/First Name/i);

    // Type digits into first name
    fireEvent.change(firstNameInput, { target: { value: 'John123' } });
    fireEvent.blur(firstNameInput);

    expect(screen.getByText('First name cannot contain numbers.')).toBeInTheDocument();
    expect(firstNameInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('TC-UI-003: Shows inline validation error when typing invalid phone number', () => {
    renderBookFlightAtPassengerStep();
    const phoneInput = screen.getByLabelText(/Phone Number/i);

    // Type letters into phone number
    fireEvent.change(phoneInput, { target: { value: '+4477009000abc' } });
    fireEvent.blur(phoneInput);

    expect(screen.getByText('Phone number cannot contain letters.')).toBeInTheDocument();
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('TC-UI-004: Prevents proceeding to step 4 when form has validation errors', () => {
    renderBookFlightAtPassengerStep();

    const firstNameInput = screen.getByLabelText(/First Name/i);
    fireEvent.change(firstNameInput, { target: { value: 'John123' } });

    const submitBtn = screen.getByRole('button', { name: /Proceed to Payment Gateway/i });
    fireEvent.click(submitBtn);

    // Should stay on step 3 (Passenger Details heading in form)
    expect(screen.getByRole('heading', { level: 2, name: /Passenger Details/i })).toBeInTheDocument();
    expect(screen.getByText('First name cannot contain numbers.')).toBeInTheDocument();
  });

  it('TC-UI-005: Successfully proceeds to step 4 when valid passenger details are provided', () => {
    renderBookFlightAtPassengerStep();

    const firstNameInput = screen.getByLabelText(/First Name/i);
    const lastNameInput = screen.getByLabelText(/Last Name/i);
    const phoneInput = screen.getByLabelText(/Phone Number/i);

    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(lastNameInput, { target: { value: 'Smith' } });
    fireEvent.change(phoneInput, { target: { value: '+447912345678' } });

    const submitBtn = screen.getByRole('button', { name: /Proceed to Payment Gateway/i });
    fireEvent.click(submitBtn);

    // Should transition to step 4 (Order Summary / Payment)
    expect(screen.getByRole('heading', { level: 3, name: /Order Summary/i })).toBeInTheDocument();
  });
});
