// firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-NIM0pbgU2w85mWFhqUEkbA3L0_NrimI",
  authDomain: "despachador-58fb8.firebaseapp.com",
  projectId: "despachador-58fb8",
  storageBucket: "despachador-58fb8.firebasestorage.app",
  messagingSenderId: "1024295745401",
  appId: "1:1024295745401:web:8d49683a86a8b1ff7aa1a8",
  measurementId: "G-97PX1JLRP3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    let selectionScreen = document.getElementById('unit-selection-screen');
    let standbyScreen = document.getElementById('standby-screen');
    let activeScreen = document.getElementById('active-screen');
    let topBanner = document.getElementById('top-unit-banner');
    
    const baseLocation = [-38.7446590, -72.9521597]; 
    let map = null;
    let routingControl = null;
    let destinationMarker = null;

    let ultimaFirma = null;
    let rawUnit = localStorage.getItem('mdt_assigned_unit');
    let myUnitId = rawUnit ? rawUnit.trim() : null; 
    
    let currentDispatchData = null;

    const allUnits = ['B-1', 'Z-1', 'BT-1', 'B-2', 'R-2', 'BX-2', 'B-3', 'BX-3', 'G-3'];

    if (!myUnitId) {
        initSelectionScreen();
    } else {
        activateUnit(myUnitId);
    }

    // ui inicio
    function initSelectionScreen() {
        selectionScreen.style.display = 'flex';
        standbyScreen.style.display = 'none';
        activeScreen.style.display = 'none';
        topBanner.style.display = 'none';
        
        const grid = document.getElementById('selection-grid');
        grid.innerHTML = '';
        allUnits.forEach(u => {
            let btn = document.createElement('button');
            btn.className = 'btn-select-unit';
            btn.innerText = u;
            btn.onclick = () => activateUnit(u);
            grid.appendChild(btn);
        });
    }

    async function activateUnit(unitName) {
        myUnitId = unitName.trim();
        localStorage.setItem('mdt_assigned_unit', myUnitId);
        document.getElementById('lbl-active-unit').innerText = myUnitId;
        
        selectionScreen.style.display = 'none';
        topBanner.style.display = 'flex';
        
        standbyScreen.style.display = 'flex';
        standbyScreen.innerHTML = '<div class="pulse-line"></div><h2>CONECTANDO...</h2><p style="color: var(--text-muted); font-weight: bold;">Sincronizando con la Central</p>';
        
        ultimaFirma = null; 

        try {
            const docSnap = await getDoc(doc(db, "operaciones", "despacho_actual"));
            if (docSnap.exists()) {
                currentDispatchData = docSnap.data();
            } else {
                currentDispatchData = null;
            }
            verificarDespacho();
        } catch(e) {
            console.error("error db:", e);
            verificarDespacho(); 
        }
    }

    document.getElementById('btn-change-unit').addEventListener('click', () => {
        localStorage.removeItem('mdt_assigned_unit');
        myUnitId = null;
        ultimaFirma = null;
        initSelectionScreen();
    });

    // data grifos
    const grifosData = {
        "type": "FeatureCollection",
        "features": [
            { "type": "Feature", "properties": { "id": "001", "caudal": "Alto", "diametro": "100mm" }, "geometry": { "type": "Point", "coordinates": [-72.9521597, -38.7446590] } },
            { "type": "Feature", "properties": { "id": "002", "caudal": "Medio", "diametro": "75mm" }, "geometry": { "type": "Point", "coordinates": [-72.9535000, -38.7450000] } }
        ]
    };

    let grifosLayer = L.geoJSON(grifosData, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 8, fillColor: "#1976D2", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.9
            }).bindPopup(`<div style="text-align:center; font-size:1.1rem;"><b>GRIFO #${feature.properties.id}</b><br><span style="color:#1976D2; font-weight:bold;">Caudal: ${feature.properties.caudal}</span></div>`);
        }
    });

    let grifosActivos = false;
    const btnToggleGrifos = document.getElementById('btn-toggle-grifos');

    // gps base
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition((position) => {
            if(!myUnitId) return;
            const payload = { lat: position.coords.latitude, lng: position.coords.longitude, timestamp: Date.now() };
            setDoc(doc(db, "ubicaciones", "mdt_principal"), payload).catch(e => console.error(e));
        }, (error) => { console.warn("error gps:", error); }, { enableHighAccuracy: true, maximumAge: 0 });
    }

    // actualiza fb
    onSnapshot(doc(db, "operaciones", "despacho_actual"), (docSnap) => {
        if (docSnap.exists()) {
            currentDispatchData = docSnap.data();
        } else {
            currentDispatchData = null;
        }
        verificarDespacho();
    });

    function verificarDespacho() {
        if (!myUnitId) return;

        if (currentDispatchData && currentDispatchData.units && currentDispatchData.units.includes(myUnitId)) {
            let firmaActual = currentDispatchData.id + "-" + currentDispatchData.alarma;
            if(firmaActual !== ultimaFirma) {
                ultimaFirma = firmaActual;
                procesarDespacho(currentDispatchData);
            } else if (activeScreen.style.display !== 'flex') {
                procesarDespacho(currentDispatchData);
            }
        } else {
            retornarStandby();
        }
    }

    // dibuja UI y carga mapa personalizado actualizado
    function procesarDespacho(em) {
        try {
            let codigoMostrar = em.code || '10-0';
            let banner = document.getElementById('banner-estado');
            
            if (em.isUpdate) {
                banner.classList.add('update-mode');
                codigoMostrar = em.alarma > 0 ? `${em.alarma}A ALARMA DE INCENDIO` : `APOYO SOLICITADO`;
            } else {
                banner.classList.remove('update-mode');
            }
            
            document.getElementById('carro-code').innerText = codigoMostrar;
            document.getElementById('carro-address').innerText = (em.address || "DIRECCIÓN EN EL MAPA").toUpperCase();
            document.getElementById('carro-units').innerText = `UNIDADES: ${(em.units || []).join(' - ')}`;
            document.getElementById('carro-obs').innerText = em.obs ? em.obs : 'Sin observaciones adicionales.';

            standbyScreen.style.display = 'none';
            activeScreen.style.display = 'flex';

            if (!map) {
                map = L.map('carro-map', { zoomControl: false }).setView(baseLocation, 15);
                L.tileLayer('https://api.mapbox.com/styles/v1/jorgelander/cmrp6ml2r009y01s1drm39dhw/tiles/{z}/{x}/{y}?access_token=pk.eyJ1Ijoiam9yZ2VsYW5kZXIiLCJhIjoiY21ycDZrNjc5Mjh0dTVzcTFsNThnZDVybiJ9.YeBk7kJuK-Hq5_kKuBY8fw', {
                    attribution: '© Mapbox', maxZoom: 19
                }).addTo(map);
                L.control.zoom({ position: 'topright' }).addTo(map);

                btnToggleGrifos?.addEventListener('click', () => {
                    if (grifosActivos) {
                        map.removeLayer(grifosLayer);
                        btnToggleGrifos.style.backgroundColor = 'var(--c-gray)';
                    } else {
                        map.addLayer(grifosLayer);
                        btnToggleGrifos.style.backgroundColor = 'var(--c-blue)';
                    }
                    grifosActivos = !grifosActivos;
                });
            }

            if (routingControl) map.removeControl(routingControl);
            if (destinationMarker) map.removeLayer(destinationMarker);

            if (em.markerLatLng) {
                let destLatLng = L.latLng(em.markerLatLng.lat, em.markerLatLng.lng);
                destinationMarker = L.marker(destLatLng, {
                    icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', iconSize: [25, 41], iconAnchor: [12, 41] })
                }).addTo(map);

                routingControl = L.Routing.control({
                    waypoints: [L.latLng(baseLocation[0], baseLocation[1]), destLatLng],
                    router: L.Routing.osrmv1({ profile: 'driving' }),
                    lineOptions: { styles: [{ color: '#F57C00', opacity: 0.8, weight: 6 }] },
                    show: false, addWaypoints: false, createMarker: function() { return null; } 
                }).on('routesfound', function(e) {
                    let summary = e.routes[0].summary;
                    let distKm = (summary.totalDistance / 1000).toFixed(1);
                    let tiempoMin = Math.round(summary.totalTime / 60);
                    
                    document.getElementById('routing-metrics').style.display = 'block';
                    document.getElementById('metric-text').innerText = `Distancia: ${distKm} km\nTiempo Estimado: ${tiempoMin} min`;
                    
                    map.fitBounds([baseLocation, [em.markerLatLng.lat, em.markerLatLng.lng]], { padding: [40, 40] });
                }).addTo(map);
            }
        } catch (err) {
            console.error("error render:", err);
            retornarStandby();
        }
    }

    // oculta todo
    function retornarStandby() {
        if(selectionScreen.style.display === 'flex') return;
        activeScreen.style.display = 'none';
        standbyScreen.style.display = 'flex';
        standbyScreen.innerHTML = '<div class="pulse-line"></div><h2>TERMINAL DE DATOS MÓVIL</h2><p style="color: var(--text-muted); margin-top: 8px; font-size: 1rem; letter-spacing: 0.5px;">EN ESPERA DE ASIGNACIÓN DESDE LA CENTRAL</p>';
        
        if (routingControl && map) map.removeControl(routingControl);
        if (destinationMarker && map) map.removeLayer(destinationMarker);

        if (grifosActivos && map) {
            map.removeLayer(grifosLayer);
            if(btnToggleGrifos) btnToggleGrifos.style.backgroundColor = 'var(--c-gray)';
            grifosActivos = false;
        }
        ultimaFirma = null;
    }

    // enviar clave
    window.transmitirClave6 = async function(claveStr, extras = {}) {
        if(!myUnitId) return;
        const timeStr = new Date().toLocaleTimeString('es-CL', { hour12: false });
        
        const payloadData = { [claveStr]: timeStr };
        if(extras.km) payloadData.km = extras.km;
        if(extras.fuel) payloadData.combustible = extras.fuel;
        if(extras.cargo) payloadData.cargo = extras.cargo;
        if(extras.vol) payloadData.vol = extras.vol;
        if(extras.maq) payloadData.maq = extras.maq;

        try {
            await setDoc(doc(db, "operaciones", "despacho_actual"), {
                logs: { [myUnitId]: payloadData }
            }, { merge: true });
            
            let btn = document.getElementById(`btn-${claveStr}`);
            if(btn) {
                let originalBg = btn.style.backgroundColor;
                let borderColor = window.getComputedStyle(btn).borderColor;
                btn.style.backgroundColor = borderColor;
                setTimeout(() => { btn.style.backgroundColor = originalBg; }, 300);
            }
            if(claveStr.startsWith('1-')) alert(`Llegada de ${claveStr} registrada con éxito a las ${timeStr}.`);

        } catch(e) { console.error("error envio logs", e); }
    };

    // modal apoyo
    const modalApoyo = document.getElementById('modal-apoyo');
    document.getElementById('btn-modal-apoyo')?.addEventListener('click', () => { if(modalApoyo) modalApoyo.style.display = 'flex'; });
    document.getElementById('btn-cancel-apoyo')?.addEventListener('click', () => { if(modalApoyo) modalApoyo.style.display = 'none'; });
    
    window.transmitirApoyo = function(codigo) {
        transmitirClave6(codigo);
        if(modalApoyo) modalApoyo.style.display = 'none';
    };

    // modal 6-0
    const modal60 = document.getElementById('modal-6-0');
    document.getElementById('btn-6-0')?.addEventListener('click', () => { if(modal60) modal60.style.display = 'flex'; });
    document.getElementById('btn-cancel-6-0')?.addEventListener('click', () => {
        if(modal60) modal60.style.display = 'none';
        document.getElementById('input-cargo').value = '';
        document.getElementById('input-vol').value = '';
        document.getElementById('input-maq').value = '';
    });
    document.getElementById('btn-submit-6-0')?.addEventListener('click', () => {
        const cargo = document.getElementById('input-cargo').value || '--';
        const vol = document.getElementById('input-vol').value || '0';
        const maq = document.getElementById('input-maq').value || '--';
        transmitirClave6("6-0", { cargo: cargo, vol: vol, maq: maq });
        document.getElementById('btn-cancel-6-0').click();
    });

    document.getElementById('btn-6-3')?.addEventListener('click', () => transmitirClave6("6-3"));
    document.getElementById('btn-6-7')?.addEventListener('click', () => transmitirClave6("6-7"));
    document.getElementById('btn-6-8')?.addEventListener('click', () => transmitirClave6("6-8"));
    document.getElementById('btn-6-9')?.addEventListener('click', () => transmitirClave6("6-9"));

    // modal 6-10
    const modal610 = document.getElementById('modal-6-10');
    const fuelBtns = document.querySelectorAll('.btn-fuel');
    let selectedFuel = null;

    document.getElementById('btn-6-10')?.addEventListener('click', () => { if(modal610) modal610.style.display = 'flex'; });
    fuelBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            fuelBtns.forEach(b => { b.style.backgroundColor = 'var(--bg-dark)'; b.style.borderColor = 'var(--border-color)'; });
            e.target.style.backgroundColor = 'var(--c-blue)';
            e.target.style.borderColor = 'var(--c-blue)';
            selectedFuel = e.target.getAttribute('data-fuel');
        });
    });
    document.getElementById('btn-cancel-6-10')?.addEventListener('click', () => {
        if(modal610) modal610.style.display = 'none';
        selectedFuel = null;
        fuelBtns.forEach(b => { b.style.backgroundColor = 'var(--bg-dark)'; b.style.borderColor = 'var(--border-color)'; });
        document.getElementById('input-km').value = '';
    });
    document.getElementById('btn-submit-6-10')?.addEventListener('click', () => {
        const km = document.getElementById('input-km').value;
        if(!km || !selectedFuel) { alert("Debe ingresar el kilometraje y seleccionar el nivel de combustible."); return; }
        transmitirClave6("6-10", { km: km, fuel: selectedFuel });
        document.getElementById('btn-cancel-6-10').click();
    });
});
