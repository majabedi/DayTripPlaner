/* Map Initialization */
const map = L.map('map').setView([51.505, -0.09], 13); // Default London

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

/* State */
let currentLocation = null; // {lat, lon}
let userMarker = null;
let poiMarkers = L.layerGroup().addTo(map);
let keywords = new Set();

/* Elements */
const btnGeo = document.getElementById('btn-geolocation');
const btnSearch = document.getElementById('btn-search-location');
const locInput = document.getElementById('location-input');
const locStatus = document.getElementById('location-status');
const tagsContainer = document.getElementById('tags-container');
const keywordInput = document.getElementById('keyword-input');
const radiusSlider = document.getElementById('radius-slider');
const radiusValue = document.getElementById('radius-value');
const btnFind = document.getElementById('btn-find-places');
const loadingOverlay = document.getElementById('loading-overlay');
const resultsCount = document.getElementById('results-count');

/* Interactive UI */
radiusSlider.addEventListener('input', (e) => {
    radiusValue.textContent = `${e.target.value} km`;
});

// Tags interaction
document.querySelectorAll('.tag').forEach(tag => {
    tag.addEventListener('click', () => {
        tag.classList.toggle('active');
        updateKeywords();
        checkReady();
    });
});

keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        const val = e.target.value.trim().toLowerCase();
        // Create new tag
        const span = document.createElement('span');
        span.className = 'tag active';
        span.dataset.val = val;
        span.textContent = val;
        span.addEventListener('click', () => {
            span.classList.toggle('active');
            updateKeywords();
            checkReady();
        });
        tagsContainer.appendChild(span);
        e.target.value = '';
        updateKeywords();
        checkReady();
    }
});

function updateKeywords() {
    keywords.clear();
    document.querySelectorAll('.tag.active').forEach(tag => {
        keywords.add(tag.dataset.val);
    });
}

function checkReady() {
    if (currentLocation && keywords.size > 0) {
        btnFind.disabled = false;
    } else {
        btnFind.disabled = true;
    }
}

function setLocation(lat, lon, title = "Selected Location") {
    currentLocation = { lat, lon };
    map.setView([lat, lon], 14);
    
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    // Custom icon for user location
    const userIcon = L.divIcon({
        className: 'custom-user-icon',
        html: `<div style="background: var(--accent-color); width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    userMarker = L.marker([lat, lon], {icon: userIcon}).addTo(map)
        .bindPopup(`<b>${title}</b><br>Will search around here.`).openPopup();
        
    checkReady();
}

/* Location Actions */
btnGeo.addEventListener('click', () => {
    locStatus.textContent = "Getting location...";
    locStatus.className = "status-msg loading";
    
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            // Optional: reverse geocode to get name
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const data = await res.json();
                const placeName = data.address.city || data.address.town || data.address.village || 'Your Location';
                setLocation(lat, lon, "Your Location (" + placeName + ")");
                locStatus.textContent = "Location found!";
                locStatus.className = "status-msg success";
            } catch (err) {
                setLocation(lat, lon, "Your Location");
                locStatus.textContent = "Location found!";
                locStatus.className = "status-msg success";
            }
        }, err => {
            locStatus.textContent = "Location access denied or failed.";
            locStatus.className = "status-msg error";
        });
    } else {
        locStatus.textContent = "Geolocation not supported.";
        locStatus.className = "status-msg error";
    }
});

btnSearch.addEventListener('click', async () => {
    const query = locInput.value.trim();
    if (!query) return;
    
    locStatus.textContent = "Searching...";
    locStatus.className = "status-msg loading";
    
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            setLocation(lat, lon, data[0].display_name);
            locStatus.textContent = "Location found!";
            locStatus.className = "status-msg success";
        } else {
            locStatus.textContent = "No results found.";
            locStatus.className = "status-msg error";
        }
    } catch (err) {
        locStatus.textContent = "Search failed.";
        locStatus.className = "status-msg error";
    }
});

/* Overpass API Search */
btnFind.addEventListener('click', async () => {
    if (!currentLocation || keywords.size === 0) return;
    
    loadingOverlay.classList.remove('hidden');
    resultsCount.textContent = "";
    btnFind.disabled = true;
    
    const radius = parseFloat(radiusSlider.value) * 1000; // in meters
    const {lat, lon} = currentLocation;
    
    // Construct regex pipe for keywords
    const regexStr = Array.from(keywords).join('|');
    
    // Construct Overpass query
    // Search in amenity, tourism, leisure, shop, historic
    const query = `
        [out:json][timeout:25];
        (
          nwr["amenity"~"${regexStr}",i](around:${radius},${lat},${lon});
          nwr["tourism"~"${regexStr}",i](around:${radius},${lat},${lon});
          nwr["leisure"~"${regexStr}",i](around:${radius},${lat},${lon});
          nwr["shop"~"${regexStr}",i](around:${radius},${lat},${lon});
          nwr["historic"~"${regexStr}",i](around:${radius},${lat},${lon});
        );
        out center;
    `;
    
    try {
        const res = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: query
        });
        
        const data = await res.json();
        
        poiMarkers.clearLayers(); // Clear old markers
        
        if (data.elements && data.elements.length > 0) {
            const bounds = [];
            
            data.elements.forEach(el => {
                const elLat = el.center ? el.center.lat : el.lat;
                const elLon = el.center ? el.center.lon : el.lon;
                
                if (elLat && elLon) {
                    bounds.push([elLat, elLon]);
                    
                    const tags = el.tags || {};
                    const name = tags.name || "Unnamed Place";
                    
                    // Determine type for display
                    let type = "Place";
                    if (tags.amenity) type = tags.amenity;
                    else if (tags.tourism) type = tags.tourism;
                    else if (tags.leisure) type = tags.leisure;
                    else if (tags.shop) type = tags.shop;
                    else if (tags.historic) type = tags.historic;
                    
                    const details = [];
                    if (tags.website) details.push(`<a href="${tags.website}" target="_blank">Website</a>`);
                    if (tags.phone) details.push(`Tel: ${tags.phone}`);
                    if (tags.opening_hours) details.push(`Hours: ${tags.opening_hours}`);
                    
                    const popupHTML = `
                        <div class="popup-title">${name}</div>
                        <div class="popup-type">${type}</div>
                        ${details.length > 0 ? `<div class="popup-detail">${details.join('<br>')}</div>` : ''}
                        <button class="btn btn-primary" style="padding: 5px; font-size: 0.8rem; margin-top: 8px;" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${elLat},${elLon}')">
                            <i class="fa-solid fa-directions"></i> Get Directions
                        </button>
                    `;
                    
                    const markerIcon = L.divIcon({
                        className: 'custom-poi-icon',
                        html: `<div style="background: var(--primary-color); color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size:12px;">
                            <i class="fa-solid fa-location-dot"></i>
                        </div>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });
                    
                    L.marker([elLat, elLon], {icon: markerIcon})
                        .bindPopup(popupHTML)
                        .addTo(poiMarkers);
                }
            });
            
            if (bounds.length > 0) {
                map.fitBounds(L.latLngBounds(bounds).pad(0.1));
            }
            resultsCount.textContent = `Found ${data.elements.length} places!`;
        } else {
            resultsCount.textContent = "No places found. Try expanding radius or changing keywords.";
        }
        
    } catch (err) {
        console.error(err);
        resultsCount.textContent = "Error communicating with Overpass API.";
    } finally {
        loadingOverlay.classList.add('hidden');
        checkReady();
    }
});
