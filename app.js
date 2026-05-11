// ─── State variables ──────────────────────────────────────────────
let marker = null;
let accuracyCircle = null;
let routeLine = null;
let lastPosition = null;
let isTracking = false;
let totalDistance = 0;
let routePoints = [];
let tripStartTime = null;
let timerInterval = null;
let watchId = null;

// ─── Create the map ───────────────────────────────────────────────
const map = L.map('map').setView([20.5937, 78.9629], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

// ─── Status helper ────────────────────────────────────────────────
function setStatus(text, color = '#aaa') {
  const el = document.getElementById('status');
  el.textContent = text;
  el.style.color = color;
}

// ─── Calculate distance between two GPS points (in km) ───────────
// This uses the Haversine formula — the standard way to measure
// distance between two lat/lng points on a sphere (Earth)
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Timer — updates Duration every second ────────────────────────
function startTimer() {
  tripStartTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - tripStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    document.getElementById('duration').textContent = mins + ':' + secs;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ─── Called every time GPS updates ───────────────────────────────
function onPosition(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const speed = position.coords.speed;
  const accuracy = position.coords.accuracy;

  // Update marker and map
  map.setView([lat, lng], 16);

  if (marker) {
    marker.setLatLng([lat, lng]);
    accuracyCircle.setLatLng([lat, lng]);
    accuracyCircle.setRadius(accuracy);
  } else {
    marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup('Vehicle location').openPopup();
    accuracyCircle = L.circle([lat, lng], {
      radius: accuracy,
      color: '#1D9E75',
      fillColor: '#1D9E75',
      fillOpacity: 0.1
    }).addTo(map);
  }

  // Update speed display
  if (speed !== null) {
    document.getElementById('speed').textContent = (speed * 3.6).toFixed(1) + ' km/h';
  }

  // ── Only track distance when trip is active ──
  if (isTracking) {
    routePoints.push([lat, lng]);

    // Calculate distance from last known point
    if (lastPosition) {
      const d = calcDistance(
        lastPosition.lat, lastPosition.lng, lat, lng
      );
      // Only count if moved more than 5 meters (filters GPS jitter)
      if (d > 0.005) {
        totalDistance += d;
        document.getElementById('distance').textContent =
          totalDistance.toFixed(2) + ' km';
      }
    }

    // Draw the route line on the map
    if (routeLine) {
      map.removeLayer(routeLine);
    }
    routeLine = L.polyline(routePoints, {
      color: '#1D9E75',
      weight: 4,
      opacity: 0.8
    }).addTo(map);
  }

  lastPosition = { lat, lng };
  setStatus('GPS Active ✓', '#1D9E75');
}

function onError(error) {
  if (error.code === 1) setStatus('GPS permission denied', '#e74c3c');
  else if (error.code === 2) setStatus('GPS signal not found', '#e74c3c');
  else setStatus('GPS error', '#e74c3c');
}

// ─── Start GPS watching ───────────────────────────────────────────
if ('geolocation' in navigator) {
  watchId = navigator.geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000
  });
} else {
  setStatus('GPS not supported', '#e74c3c');
}

// ─── Start Trip button ────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', () => {
  isTracking = true;
  totalDistance = 0;
  routePoints = [];
  lastPosition = null;

  // Reset displays
  document.getElementById('distance').textContent = '0.00 km';
  document.getElementById('duration').textContent = '00:00';
  document.getElementById('speed').textContent = '0 km/h';

  // Clear old route from map
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }

  startTimer();

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  setStatus('Trip recording...', '#f39c12');
});

// ─── Stop Trip button ─────────────────────────────────────────────
document.getElementById('stopBtn').addEventListener('click', () => {
  isTracking = false;
  stopTimer();

  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
  setStatus('Trip saved ✓', '#1D9E75');

  // Save trip to localStorage (the device, no internet needed)
  const trip = {
    date: new Date().toLocaleString(),
    distance: totalDistance.toFixed(2),
    duration: document.getElementById('duration').textContent,
    points: routePoints
  };

  const trips = JSON.parse(localStorage.getItem('trips') || '[]');
  trips.push(trip);
  localStorage.setItem('trips', JSON.stringify(trips));

  alert(`Trip saved!\nDistance: ${trip.distance} km\nDuration: ${trip.duration}`);
});

// ─── History Panel ────────────────────────────────────────────────

function loadTrips() {
  return JSON.parse(localStorage.getItem('trips') || '[]');
}

function renderTripList() {
  const trips = loadTrips();
  const container = document.getElementById('tripList');

  if (trips.length === 0) {
    container.innerHTML = '<p class="no-trips">No trips recorded yet.</p>';
    return;
  }

  container.innerHTML = '';

  // Show newest trip first
  [...trips].reverse().forEach((trip, reversedIndex) => {
    const realIndex = trips.length - 1 - reversedIndex;

    const item = document.createElement('div');
    item.className = 'trip-item';
    item.innerHTML = `
      <button class="delete-btn" data-index="${realIndex}" title="Delete trip">🗑</button>
      <div class="trip-date">${trip.date}</div>
      <div class="trip-stats">
        <div>📍 <span>${trip.distance} km</span></div>
        <div>⏱ <span>${trip.duration}</span></div>
        <div>📌 <span>${trip.points.length} points</span></div>
      </div>
    `;

    // Click trip row → replay route on map
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return;
      replayTrip(trip);
      closeHistoryPanel();
    });

    container.appendChild(item);
  });

  // Delete buttons
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      deleteTrip(index);
    });
  });
}

function deleteTrip(index) {
  const trips = loadTrips();
  trips.splice(index, 1);
  localStorage.setItem('trips', JSON.stringify(trips));
  renderTripList();
}

function replayTrip(trip) {
  // Clear current route
  if (routeLine) map.removeLayer(routeLine);

  if (trip.points.length === 0) return;

  // Draw the saved route in blue
  routeLine = L.polyline(trip.points, {
    color: '#378ADD',
    weight: 4,
    opacity: 0.8
  }).addTo(map);

  // Zoom map to fit the whole route
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
}

function openHistoryPanel() {
  renderTripList();
  document.getElementById('historyPanel').classList.add('open');
}

function closeHistoryPanel() {
  document.getElementById('historyPanel').classList.remove('open');
}

document.getElementById('historyBtn').addEventListener('click', openHistoryPanel);
document.getElementById('closeHistory').addEventListener('click', closeHistoryPanel);