/**
 * Transform raw Amadeus flightOffers response into the shape
 * the BA frontend expects (matching mockFlights.js generateFlights output).
 */
function transformFlightOffer(offer) {
  const seg = offer.itineraries[0].segments[0];
  const lastSeg = offer.itineraries[0].segments[offer.itineraries[0].segments.length - 1];
  const stops = offer.itineraries[0].segments.length - 1;

  // Parse ISO duration "PT7H45M" → "7h 45m"
  const parseDuration = (iso) => {
    const h = iso.match(/(\d+)H/);
    const m = iso.match(/(\d+)M/);
    return `${h ? h[1] + 'h ' : ''}${m ? m[1] + 'm' : ''}`.trim();
  };

  const prices = {};
  if (offer.travelerPricings && offer.travelerPricings.length > 0) {
    const tp = offer.travelerPricings[0];
    prices.economy        = parseFloat(offer.price.grandTotal);
    prices.premiumEconomy = Math.round(parseFloat(offer.price.grandTotal) * 1.8);
    prices.businessClass  = Math.round(parseFloat(offer.price.grandTotal) * 3.5);
    prices.firstClass     = Math.round(parseFloat(offer.price.grandTotal) * 6.0);
  }

  return {
    id: offer.id,
    flightNumber: seg.carrierCode + seg.number,
    airline: seg.operating?.carrierCode || seg.carrierCode,
    from: seg.departure.iataCode,
    to: lastSeg.arrival.iataCode,
    departure: seg.departure.at.substring(11, 16),
    arrival: lastSeg.arrival.at.substring(11, 16),
    duration: parseDuration(offer.itineraries[0].duration),
    stops,
    stopAirport: stops > 0 ? offer.itineraries[0].segments[0].arrival.iataCode : null,
    aircraft: seg.aircraft?.code || 'Unknown',
    prices,
    seatsLeft: {
      economy: offer.numberOfBookableSeats || 9,
      premiumEconomy: Math.max(1, (offer.numberOfBookableSeats || 4) - 2),
      businessClass:  Math.max(1, (offer.numberOfBookableSeats || 4) - 3),
      firstClass: 2,
    },
    amenities: ['Wi-Fi', 'Meals', 'Entertainment', 'USB Charging'],
    date: seg.departure.at.substring(0, 10),
    rawOffer: offer, // keep for flight-order creation
  };
}

/**
 * Transform Amadeus Flight Status response into frontend shape
 * (matching mockFlightStatuses).
 */
function transformFlightStatus(data) {
  const dep = data.flightPoints?.[0];
  const arr = data.flightPoints?.[1];
  const progress = (() => {
    if (!dep || !arr) return 0;
    const now = Date.now();
    const depTime = new Date(dep.departure?.timings?.[0]?.value || Date.now()).getTime();
    const arrTime = new Date(arr.arrival?.timings?.[0]?.value || Date.now()).getTime();
    if (now < depTime) return 0;
    if (now > arrTime) return 100;
    return Math.round(((now - depTime) / (arrTime - depTime)) * 100);
  })();

  const statusCode = data.legs?.[0]?.onTimePerformance?.categoryCode || 'ON_TIME';
  const statusMap = {
    ON_TIME: { status: 'on-time', label: 'On Time' },
    LATE_1: { status: 'delayed', label: 'Delayed' },
    LATE_2: { status: 'delayed', label: 'Delayed' },
    CANCELLED: { status: 'cancelled', label: 'Cancelled' },
  };
  const { status, label } = statusMap[statusCode] || { status: 'scheduled', label: 'Scheduled' };

  return {
    flightNumber: data.flightDesignator?.carrierCode + data.flightDesignator?.flightNumber,
    route: `${dep?.iataCode || ''} → ${arr?.iataCode || ''}`,
    scheduledDep: dep?.departure?.timings?.[0]?.value?.substring(11, 16) || '--:--',
    actualDep:    dep?.departure?.timings?.[0]?.value?.substring(11, 16) || '--:--',
    scheduledArr: arr?.arrival?.timings?.[0]?.value?.substring(11, 16) || '--:--',
    actualArr:    arr?.arrival?.timings?.[0]?.value?.substring(11, 16) || '--:--',
    status,
    statusLabel: label,
    gate: dep?.departure?.gate?.mainGate || 'TBD',
    terminal: dep?.departure?.terminal?.code || 'TBD',
    aircraft: data.legs?.[0]?.aircraftEquipment?.aircraftType || 'Unknown',
    progress,
  };
}

/**
 * Transform Amadeus airport/location into frontend shape.
 */
function transformAirport(location) {
  return {
    code: location.iataCode,
    name: location.name,
    city: location.address?.cityName || location.name,
    country: location.address?.countryName || '',
    countryCode: location.address?.countryCode || '',
    type: location.subType,
  };
}

/**
 * Calculate Avios points for a route + cabin.
 * Based on: distance × cabin multiplier × 1.5 base rate.
 */
function calculateAvios(distanceKm, cabin) {
  const multipliers = {
    economy: 1.0,
    premium_economy: 1.5,
    business: 2.5,
    first: 4.0,
  };
  const mult = multipliers[cabin] || 1.0;
  return Math.round(distanceKm * mult * 0.5);
}

module.exports = {
  transformFlightOffer,
  transformFlightStatus,
  transformAirport,
  calculateAvios,
};
