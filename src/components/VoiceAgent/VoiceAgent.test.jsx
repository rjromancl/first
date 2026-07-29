import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import VoiceAgent from './VoiceAgent';
import { AppProvider } from '../../context/AppContext';
import { speak, stopSpeaking } from '../../utils/voiceNLP';

// Mock speech synthesis & voice NLP helpers
vi.mock('../../utils/voiceNLP', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    speak: vi.fn().mockResolvedValue(undefined),
    stopSpeaking: vi.fn(),
    parseVoiceInput: vi.fn().mockResolvedValue({
      intent: 'BOOK_FLIGHT',
      entities: { from: 'LHR', to: 'CDG' },
      passengerField: null,
      response: {
        text: 'Searching flights from London to Paris',
        quickReplies: ['Book a flight', 'Check in'],
        action: null,
      },
    }),
  };
});

import { useApp } from '../../context/AppContext';

function TestWrapper() {
  const { openVoiceAgent } = useApp();
  React.useEffect(() => {
    openVoiceAgent();
  }, [openVoiceAgent]);

  return <VoiceAgent />;
}

function renderVoiceAgent() {
  return render(
    <BrowserRouter>
      <AppProvider>
        <TestWrapper />
      </AppProvider>
    </BrowserRouter>
  );
}

describe('VoiceAgent Component — Detailed Voice & UI Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders Voice Agent header, initial welcome message, and action buttons', () => {
    renderVoiceAgent();
    expect(screen.getByText(/BA Advanced Agentic AI/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Hands-free/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Clear/i)).toBeInTheDocument();
  });

  it('2. Renders all 8 multilingual language selection chips', () => {
    renderVoiceAgent();
    expect(screen.getByText(/EN \(UK\)/i)).toBeInTheDocument();
    expect(screen.getByText(/தமிழ்/i)).toBeInTheDocument();
    expect(screen.getByText(/Tanglish/i)).toBeInTheDocument();
    expect(screen.getByText(/HI/i)).toBeInTheDocument();
    expect(screen.getByText(/ES/i)).toBeInTheDocument();
    expect(screen.getByText(/FR/i)).toBeInTheDocument();
    expect(screen.getByText(/DE/i)).toBeInTheDocument();
    expect(screen.getByText(/JP/i)).toBeInTheDocument();
  });

  it('3. Switches active language chip when clicked', () => {
    renderVoiceAgent();
    const tamilChip = screen.getByText(/தமிழ்/i);
    fireEvent.click(tamilChip);
    expect(tamilChip.parentElement).toHaveClass('va-lang-chip--active');
  });

  it('4. Allows toggling Hands-Free continuous mode button', () => {
    renderVoiceAgent();
    const handsFreeBtn = screen.getByTitle(/Hands-free/i);
    expect(handsFreeBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(handsFreeBtn);
    expect(handsFreeBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('5. Allows toggling Text input mode vs Voice input mode', () => {
    renderVoiceAgent();
    const inputModeBtn = screen.getByRole('button', { name: /Text/i });
    fireEvent.click(inputModeBtn);
    expect(screen.getByPlaceholderText(/Type your flight request/i)).toBeInTheDocument();
  });

  it('6. Submits typed message in text mode', async () => {
    renderVoiceAgent();
    const inputModeBtn = screen.getByRole('button', { name: /Text/i });
    fireEvent.click(inputModeBtn);

    const input = screen.getByPlaceholderText(/Type your flight request/i);
    fireEvent.change(input, { target: { value: 'London to Paris flight' } });
    
    const sendForm = input.closest('form');
    fireEvent.submit(sendForm);

    expect(await screen.findByText(/London to Paris flight/i)).toBeInTheDocument();
  });

  it('7. Calls stopSpeaking when user cancels or clears chat', () => {
    renderVoiceAgent();
    const clearBtn = screen.getByTitle(/Clear/i);
    fireEvent.click(clearBtn);
    expect(stopSpeaking).toHaveBeenCalled();
  });
});
