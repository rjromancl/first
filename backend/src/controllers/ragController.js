/**
 * ragController.js — Agentic RAG controller
 *
 * Endpoints:
 *  POST /api/rag/context — raw context retrieval (used by voice agent)
 *  POST /api/rag/ask     — full agentic Q&A with tool execution + structured response
 *  GET  /api/rag/health  — readiness probe
 */
const {
  getContext,
  getContextWithSources,
  classifyQueryIntent,
  isReady,
  AGENTIC_TOOLS,
} = require('../services/ragService');

const { searchFlights }      = require('../services/flightService');
const { getBooking }         = require('../services/bookingService');
const { calculateFlightAvios } = require('../services/aviosService');
const { getDestinations, getDestinationByCode } = require('../services/destinationService');
const { success, error }     = require('../utils/responseHelper');
const logger                 = require('../config/logger');

// ── Tool executor ────────────────────────────────────────────────────────────
async function executeTool(toolName, params) {
  logger.info('[ragController] Executing tool', { toolName, params });
  try {
    switch (toolName) {
      case 'search_flights': {
        const result = await searchFlights({
          originLocationCode:      params.from      || 'LHR',
          destinationLocationCode: params.to,
          departureDate:           params.departureDate,
          returnDate:              params.returnDate || null,
          adults:                  params.adults    || 1,
          travelClass:             (params.cabin    || 'ECONOMY').toUpperCase(),
        });
        const flights = result.flights || [];
        return {
          found:   flights.length,
          flights: flights.slice(0, 3).map(f => ({
            flightNumber: f.flightNumber || f.id,
            departure:    f.itineraries?.[0]?.segments?.[0]?.departure?.at || params.departureDate,
            arrival:      f.itineraries?.[0]?.segments?.at(-1)?.arrival?.at || '',
            price:        `£${f.price?.grandTotal || f.price?.total || '—'}`,
            cabin:        params.cabin || 'ECONOMY',
            stops:        f.stops ?? 0,
          })),
          searchParams: params,
          navigateTo: `/book?from=${params.from||'LHR'}&to=${params.to}&date=${params.departureDate}&cabin=${params.cabin||'economy'}`,
        };
      }

      case 'get_booking': {
        const booking = getBooking(params.reference?.toUpperCase());
        if (!booking) return { found: false, message: `No booking found for reference ${params.reference}` };
        return {
          found:     true,
          reference: booking.reference,
          status:    booking.status,
          passenger: `${booking.passenger?.firstName} ${booking.passenger?.lastName}`,
          outbound: {
            flight:    booking.outbound?.flightNumber,
            from:      booking.outbound?.from,
            to:        booking.outbound?.to,
            departure: booking.outbound?.departure,
            cabin:     booking.outbound?.cabin,
            seat:      booking.outbound?.seat || 'Not selected',
          },
          inbound:    booking.inbound ? {
            flight:    booking.inbound.flightNumber,
            from:      booking.inbound.from,
            to:        booking.inbound.to,
            departure: booking.inbound.departure,
          } : null,
          checkedIn:  booking.checkedIn,
          bags:       booking.bags,
          totalPaid:  `£${booking.totalPaid}`,
          aviosEarned: booking.aviosEarned,
          navigateTo: '/manage',
        };
      }

      case 'get_flight_status': {
        // Mock live status — in production call Amadeus Flight Status API
        const num = params.flightNumber?.toUpperCase() || 'BA117';
        const STATUS_MOCK = {
          BA117: { status:'En Route', gate:'B38', terminal:'5', scheduledDep:'09:30', actualDep:'09:45', estArr:'12:15', progress:65, from:'LHR', to:'JFK' },
          BA474: { status:'On Time',  gate:'A22', terminal:'5', scheduledDep:'07:00', actualDep:'07:00', estArr:'09:15', progress:0,  from:'LHR', to:'BCN' },
          BA107: { status:'Boarding', gate:'C14', terminal:'5', scheduledDep:'08:15', actualDep:'08:15', estArr:'15:00', progress:0,  from:'LHR', to:'DXB' },
          BA015: { status:'En Route', gate:'B50', terminal:'5', scheduledDep:'21:15', actualDep:'21:30', estArr:'05:45+2', progress:40, from:'LHR', to:'SYD' },
        };
        const st = STATUS_MOCK[num] || { status:'Scheduled', gate:'TBC', terminal:'5', scheduledDep:'—', actualDep:'—', estArr:'—', progress:0, from: params.from||'LHR', to: params.to||'?' };
        return { flightNumber: num, ...st, navigateTo: '/flight-status' };
      }

      case 'calculate_avios': {
        const result = await calculateFlightAvios({
          origin:      params.from || 'LHR',
          destination: params.to,
          cabin:       params.cabin || 'economy',
        });
        return {
          route:       `${result.origin}→${result.destination}`,
          cabin:       result.cabin,
          distanceKm:  result.distanceKm,
          aviosEarned: result.avios,
          navigateTo:  '/executive-club',
        };
      }

      case 'get_destinations': {
        const dests = getDestinations({ category: params.category !== 'all' ? params.category : undefined });
        return {
          count:        dests.length,
          destinations: dests.slice(0, 6).map(d => ({
            city:      d.city,
            country:   d.country,
            iata:      d.code,
            fromPrice: `£${d.fromPrice}`,
            flightTime: d.flightTime,
            bestTime:  d.bestTime,
            highlights: d.highlights?.slice(0, 2),
          })),
          navigateTo: '/destinations',
        };
      }

      case 'navigate': {
        return { navigateTo: params.path, label: params.label || 'Open', prefill: params.prefill || null };
      }

      case 'check_in': {
        return {
          message:   `Ready to check in for booking ${params.reference}`,
          navigateTo: '/check-in',
          reference:  params.reference,
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    logger.error('[ragController] Tool execution error', { toolName, error: err.message });
    return { error: err.message };
  }
}

// ── POST /api/rag/context ────────────────────────────────────────────────────
async function getContextHandler(req, res, next) {
  try {
    const { query, topK } = req.body;
    if (!query?.trim()) return error(res, 'query is required', 400);

    const cleanQuery = query.trim();
    const intentData = classifyQueryIntent(cleanQuery);
    const context    = await getContext(cleanQuery);

    return success(res, {
      context,
      intent:     intentData,
      ready:      true,
      query:      cleanQuery,
      hasContext: !!context,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/rag/ask — full agentic endpoint ─────────────────────────────────
async function agenticAskHandler(req, res, next) {
  try {
    const { query, history = [], executeTool: shouldExecTool = true } = req.body;
    if (!query?.trim()) return error(res, 'query is required', 400);

    const cleanQuery = query.trim();
    const startMs    = Date.now();

    // Step 1 — classify intent + retrieve context + sources
    const { context, sources, intent, entities } = await getContextWithSources(cleanQuery);

    // Step 2 — decide if a tool should be auto-invoked based on intent
    let toolCall   = null;
    let toolResult = null;
    let navigateTo = null;
    let actionBtn  = null;

    if (shouldExecTool) {
      // Auto-invoke tools for clear agentic intents
      if (intent === 'FLIGHT_STATUS' && entities.flight?.length) {
        toolCall   = { name: 'get_flight_status', params: { flightNumber: entities.flight[0] } };
        toolResult = await executeTool('get_flight_status', toolCall.params);
        navigateTo = '/flight-status';
        actionBtn  = { label: 'Track Flight', path: '/flight-status' };
      } else if (intent === 'BOOK_FLIGHT' && entities.iata?.length >= 2) {
        // Enough info to search — auto-invoke flight search
        const from = entities.iata.find(c => ['LHR','LGW'].includes(c)) || entities.iata[0];
        const to   = entities.iata.find(c => c !== from) || entities.iata[1];
        const cabin = entities.cabin[0]?.toUpperCase().replace(/ /g,'_') || 'ECONOMY';
        const date  = new Date(); date.setDate(date.getDate() + 30);
        const departureDate = date.toISOString().split('T')[0];
        toolCall   = { name: 'search_flights', params: { from, to, departureDate, cabin } };
        toolResult = await executeTool('search_flights', toolCall.params);
        navigateTo = `/book?from=${from}&to=${to}`;
        actionBtn  = { label: 'Search Flights', path: '/book', prefill: { from, to, cabin: cabin.toLowerCase() } };
      } else if (intent === 'BOOKING' && entities.reference?.length) {
        toolCall   = { name: 'get_booking', params: { reference: entities.reference[0] } };
        toolResult = await executeTool('get_booking', toolCall.params);
        navigateTo = '/manage';
        actionBtn  = { label: 'Open Manage Booking', path: '/manage' };
      } else if (intent === 'CHECKIN') {
        navigateTo = '/check-in';
        actionBtn  = { label: 'Go to Check-In', path: '/check-in' };
        if (entities.reference?.length) {
          toolCall   = { name: 'check_in', params: { reference: entities.reference[0] } };
          toolResult = await executeTool('check_in', toolCall.params);
        }
      } else if (intent === 'EXECUTIVE_CLUB' && entities.iata?.length >= 2) {
        const from = entities.iata[0]; const to = entities.iata[1];
        const cabin = entities.cabin[0]?.toLowerCase() || 'economy';
        toolCall   = { name: 'calculate_avios', params: { from, to, cabin } };
        toolResult = await executeTool('calculate_avios', toolCall.params);
        navigateTo = '/executive-club';
        actionBtn  = { label: 'View My Avios', path: '/executive-club' };
      } else if (intent === 'DESTINATION') {
        toolCall   = { name: 'get_destinations', params: { category: 'all' } };
        toolResult = await executeTool('get_destinations', toolCall.params);
        navigateTo = '/destinations';
        actionBtn  = { label: 'Browse Destinations', path: '/destinations' };
      } else if (intent === 'BOOKING' && !entities.reference?.length) {
        navigateTo = '/manage';
        actionBtn  = { label: 'Open Manage Booking', path: '/manage' };
      } else if (intent === 'BOOK_FLIGHT') {
        navigateTo = '/book';
        actionBtn  = { label: 'Search Flights', path: '/book' };
      } else if (intent === 'EXECUTIVE_CLUB') {
        navigateTo = '/executive-club';
        actionBtn  = { label: 'View My Avios', path: '/executive-club' };
      } else if (intent === 'FLIGHT_STATUS') {
        navigateTo = '/flight-status';
        actionBtn  = { label: 'Track My Flight', path: '/flight-status' };
      }
    }

    const elapsedMs = Date.now() - startMs;
    logger.info('[ragController] Agentic ask complete', { intent, elapsedMs, toolCall: toolCall?.name, sources: sources.length });

    return success(res, {
      query:      cleanQuery,
      intent,
      entities,
      context,
      sources,
      toolCall,
      toolResult,
      navigateTo,
      actionBtn,
      availableTools: AGENTIC_TOOLS.map(t => ({ name: t.name, description: t.description })),
      ready:      true,
      elapsedMs,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/rag/health ──────────────────────────────────────────────────────
function healthHandler(req, res) {
  return success(res, {
    ready:          true,
    vectorDbReady:  isReady(),
    service:        'rag',
    tools:          AGENTIC_TOOLS.length,
    knowledgeDocs:  'see /api/rag/stats',
  });
}

// ── GET /api/rag/stats ───────────────────────────────────────────────────────
const { getAllKnowledgeDocs } = require('../services/ragService');
function statsHandler(req, res) {
  const docs = getAllKnowledgeDocs();
  const byCategory = docs.reduce((acc, d) => {
    const cat = d.metadata?.category || 'general';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  return success(res, {
    totalDocs:  docs.length,
    byCategory,
    intents:    19,
    tools:      AGENTIC_TOOLS.length,
  });
}

module.exports = {
  getContext:   getContextHandler,
  agenticAsk:   agenticAskHandler,
  health:       healthHandler,
  stats:        statsHandler,
};
