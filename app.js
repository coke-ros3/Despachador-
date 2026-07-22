// inicializar firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, collection, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
    
    // variables principales
    var appState = {
        stationLocation: [-38.7446590, -72.9521597], selectedCode: null, pendingLocation: null,
        pendingMarker: null, pendingRouting: null, pendingEta: null, pendingDist: null, isMarkingMode: false,
        apoyoModeId: null, activeEmergencies: [], selectedUnits: new Set(),
        units: [{id:'B-1',state:'disponible'},{id:'Z-1',state:'disponible'},{id:'BT-1',state:'disponible'},{id:'B-2',state:'disponible'},{id:'R-2',state:'disponible'},{id:'BX-2',state:'disponible'},{id:'B-3',state:'disponible'},{id:'BX-3',state:'disponible'},{id:'G-3',state:'disponible'}],
        maquinistas: [{id:'91',state:'fuera'},{id:'92',state:'fuera'},{id:'93',state:'fuera'},{id:'94',state:'fuera'},{id:'Maquinista 1',state:'fuera'},{id:'Maquinista 2',state:'fuera'},{id:'Maquinista 3',state:'fuera'},{id:'Maquinista 4',state:'fuera'},{id:'Maquinista 5',state:'fuera'}]
    }

    let modalBitacora = document.getElementById('modal-bitacora');
    let currentBitacoraId = null;

    // cargar datos locales
    const savedEmergencies = localStorage.getItem('cad_active_emergencies');
    if (savedEmergencies) appState.activeEmergencies = JSON.parse(savedEmergencies);
    const savedUnits = localStorage.getItem('cad_units_state');
    if (savedUnits) appState.units = JSON.parse(savedUnits);
    const savedMaquinistas = localStorage.getItem('cad_maquinistas_v2');
    if (savedMaquinistas) appState.maquinistas = JSON.parse(savedMaquinistas);

    function guardarEstadoLocal() {
        const safeEmergencies = appState.activeEmergencies.map(em => ({
            id: em.id, code: em.code, address: em.address, obs: em.obs, units: em.units, alarma: em.alarma, isAtentado: em.isAtentado, eta: em.eta, dist: em.dist, markerLatLng: em.markerLatLng, logs: em.logs || {}
        }));
        localStorage.setItem('cad_active_emergencies', JSON.stringify(safeEmergencies));
        localStorage.setItem('cad_units_state', JSON.stringify(appState.units));
        localStorage.setItem('cad_maquinistas_v2', JSON.stringify(appState.maquinistas));
    }

    // ocultar conductores
    const toggleMaqBtn = document.getElementById('toggle-maquinistas');
    const maqContainer = document.getElementById('maquinistas-container');
    toggleMaqBtn.addEventListener('click', () => {
        if (maqContainer.style.display === 'none') {
            maqContainer.style.display = 'grid';
            toggleMaqBtn.innerText = 'OCULTAR MAQUINISTAS ▲';
            toggleMaqBtn.style.backgroundColor = 'var(--c-blue)';
        } else {
            maqContainer.style.display = 'none';
            toggleMaqBtn.innerText = '+ VER OTROS CONDUCTORES';
            toggleMaqBtn.style.backgroundColor = 'var(--bg-dark)';
        }
    });

    // logica candado y arrastrar
    let isEditing = false;
    let isResL = false;
    let isResR = false;

    const btnEdit = document.getElementById('btn-edit-layout');
    btnEdit.addEventListener('click', () => {
        isEditing = !isEditing;
        if(isEditing) {
            btnEdit.innerText = '🔓';
            document.body.classList.add('layout-editing');
        } else {
            btnEdit.innerText = '🔒';
            document.body.classList.remove('layout-editing');
            localStorage.setItem('cad_left_w', document.documentElement.style.getPropertyValue('--left-w'));
            localStorage.setItem('cad_right_w', document.documentElement.style.getPropertyValue('--right-w'));
        }
    });

    // carga pantalla editada antes
    const savedL = localStorage.getItem('cad_left_w');
    const savedR = localStorage.getItem('cad_right_w');
    if(savedL) document.documentElement.style.setProperty('--left-w', savedL);
    if(savedR) document.documentElement.style.setProperty('--right-w', savedR);

    // los clics de arraste
    document.getElementById('resizer-L').addEventListener('mousedown', () => isResL = true);
    document.getElementById('resizer-R').addEventListener('mousedown', () => isResR = true);

    document.addEventListener('mousemove', (e) => {
        if(!isEditing) return;
        if(isResL) {
            let w = e.clientX - 20;
            if(w < 220) w = 220;
            if(w > 600) w = 600;
            document.documentElement.style.setProperty('--left-w', w + 'px');
        }
        if(isResR) {
            let w = window.innerWidth - e.clientX - 20;
            if(w < 250) w = 250;
            if(w > 600) w = 600;
            document.documentElement.style.setProperty('--right-w', w + 'px');
        }
    });

    document.addEventListener('mouseup', () => { isResL = false; isResR = false; });

    // escuchar firebase
    onSnapshot(collection(db, "maquinistas"), (snapshot) => {
        let changed = false;
        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            const maq = appState.maquinistas.find(m => m.id === change.doc.id);
            if (maq && maq.state !== data.estado) { maq.state = data.estado; changed = true; }
        });
        if (changed) renderMaquinistas();
    });

    onSnapshot(doc(db, "operaciones", "despacho_actual"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            let em = appState.activeEmergencies.find(e => e.id === data.id);
            if (em) {
                if(!em.logs) em.logs = {};
                if(data.logs) {
                    em.logs = data.logs;
                    guardarEstadoLocal();
                    if(currentBitacoraId === em.id) renderTablaBitacora(em);
                }
            }
        }
    });

    // listar claves
    const clavesList = [
        {id: '10-0', desc: 'Llamado estructural'}, {id: '10-1', desc: 'Fuego en vehículos'}, {id: '10-2', desc: 'Fuego en pastizales'}, {id: '10-3', desc: 'Rescate simple'}, {id: '10-4', desc: 'Accidentes vehiculares'}, {id: '10-5', desc: 'Derrame químico'}, {id: '10-6', desc: 'Emanación de químicos'}, {id: '10-7', desc: 'Llamado eléctrico'}, {id: '10-8', desc: 'No clasificado'}, {id: '10-9', desc: 'Otros servicios'}, {id: '10-10', desc: 'Llamado a escombros'}, {id: '10-12', desc: 'Apoyo a otros Cuerpos'}, {id: '10-14', desc: 'Accidente aéreo'}, {id: '10-15', desc: 'Simulacro'}, {id: '10-17', desc: 'Inundación'}
    ];

    let clavesContainer = document.getElementById('claves-container');
    clavesList.forEach(clave => {
        let btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'clave-btn';
        btn.innerText = `${clave.id}: ${clave.desc}`;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if(appState.apoyoModeId) return; 
            document.querySelectorAll('.clave-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            appState.selectedCode = clave.id;
        });
        clavesContainer.appendChild(btn);
    });

    // token mapbox blindado y estilo personalizado
    const mapboxToken = 'pk.eyJ1Ijoiam9yZ2VsYW5kZXIiLCJhIjoiY21ycDZrNjc5Mjh0dTVzcTFsNThnZDVybiJ9.YeBk7kJuK-Hq5_kKuBY8fw';
    var map = L.map('map').setView(appState.stationLocation, 17);
    
    L.tileLayer(`https://api.mapbox.com/styles/v1/jorgelander/cmrp6ml2r009y01s1drm39dhw/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`, {
        attribution: '© Mapbox', maxZoom: 19
    }).addTo(map);

    L.marker(appState.stationLocation, {
        icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png', iconSize: [25, 41], iconAnchor: [12, 41] })
    }).addTo(map).bindPopup("<b>Base Operativa</b><br>Cuartel").openPopup();

    appState.activeEmergencies.forEach(em => {
        if (em.markerLatLng) {
            em.marker = L.marker([em.markerLatLng.lat, em.markerLatLng.lng], {
                icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', iconSize: [25, 41], iconAnchor: [12, 41] })
            }).addTo(map);
        }
    });

    // marcador gps externo (cuando responden al link)
    let gpsMarker = null;
    onSnapshot(doc(db, "ubicaciones", "mdt_principal"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const pos = [data.lat, data.lng];
            if (!gpsMarker) {
                gpsMarker = L.marker(pos, {
                    icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png', iconSize: [25, 41], iconAnchor: [12, 41] })
                }).addTo(map).bindPopup("<b>UNIDAD EN RUTA</b>");
            } else { gpsMarker.setLatLng(pos); }
        } else {
            if (gpsMarker) { map.removeLayer(gpsMarker); gpsMarker = null; }
        }
    });

    document.getElementById('btn-clear-gps').addEventListener('click', async () => {
        try { await deleteDoc(doc(db, "ubicaciones", "mdt_principal")); } catch (error) { console.error(error); }
    });

    // reset general
    document.getElementById('btn-master-reset').addEventListener('click', async () => {
        const pwd = prompt("Ingrese clave de autorización para formatear el sistema:");
        if (pwd === "Coke.21314") {
            try {
                await deleteDoc(doc(db, "operaciones", "despacho_actual"));
                await deleteDoc(doc(db, "ubicaciones", "mdt_principal"));
                appState.maquinistas.forEach(m => { setDoc(doc(db, "maquinistas", m.id), { estado: 'fuera', timestamp: Date.now() }); });
                appState.activeEmergencies.forEach(em => { if(em.marker) map.removeLayer(em.marker); if(em.routing) map.removeControl(em.routing); });
                appState.activeEmergencies = []; appState.units.forEach(u => u.state = 'disponible'); appState.maquinistas.forEach(m => m.state = 'fuera');
                appState.selectedUnits.clear(); appState.selectedCode = null; appState.apoyoModeId = null;
                guardarEstadoLocal(); renderUnits(); renderMaquinistas(); renderActiveEmergencies();
                document.getElementById('dispatch-form').reset();
                document.querySelectorAll('.clave-btn').forEach(b => b.classList.remove('selected'));
                document.getElementById('apoyo-panel').style.display = 'none';
                document.getElementById('dispatch-form').style.display = 'flex';
                map.setView(appState.stationLocation, 17);
                alert("Base de datos y memorias locales formateadas correctamente.");
            } catch (error) { alert("Error de conexión al intentar formatear."); }
        } else if (pwd !== null) { alert("Clave incorrecta. Operación cancelada."); }
    });

    // capa grifos
    const grifosData = {
        "type": "FeatureCollection", "features": [
            { "type": "Feature", "properties": { "id": "001", "caudal": "Alto", "diametro": "100mm" }, "geometry": { "type": "Point", "coordinates": [-72.9521597, -38.7446590] } },
            { "type": "Feature", "properties": { "id": "002", "caudal": "Medio", "diametro": "75mm" }, "geometry": { "type": "Point", "coordinates": [-72.9535000, -38.7450000] } },
            { "type": "Feature", "properties": { "id": "003", "caudal": "Alto", "diametro": "100mm" }, "geometry": { "type": "Point", "coordinates": [-72.9500000, -38.7430000] } }
        ]
    };

    let grifosLayer = L.geoJSON(grifosData, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, { radius: 6, fillColor: "#1976D2", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.8 }).bindPopup(`<b>GRIFO #${feature.properties.id}</b><br>Caudal: ${feature.properties.caudal}<br>Diámetro: ${feature.properties.diametro}`);
        }
    });

    let grifosActivos = false;
    const btnToggleGrifos = document.getElementById('btn-toggle-grifos');
    btnToggleGrifos.addEventListener('click', () => {
        if (grifosActivos) {
            map.removeLayer(grifosLayer);
            btnToggleGrifos.style.backgroundColor = 'var(--c-gray)';
        } else {
            map.addLayer(grifosLayer);
            btnToggleGrifos.style.backgroundColor = 'var(--c-blue)';
        }
        grifosActivos = !grifosActivos;
    });

    setInterval(function(){ document.getElementById('clock').innerText = new Date().toLocaleTimeString('es-CL'); }, 1000);

    const unitsContainer = document.getElementById('units-container');
    const stateCycle = ['disponible', 'despachada', 'en-ruta', 'emergencia', 'fuera'];

    // render carros
    function renderUnits() {
        unitsContainer.innerHTML = '';
        appState.units.forEach(unit => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'unit-btn';
            btn.dataset.state = unit.state;
            btn.innerText = unit.id;
            if(appState.selectedUnits.has(unit.id)) { btn.classList.add('selected'); }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (unit.state === 'disponible') {
                    if(appState.selectedUnits.has(unit.id)){ appState.selectedUnits.delete(unit.id); }else{ appState.selectedUnits.add(unit.id); }
                    renderUnits();
                } else if (appState.selectedUnits.has(unit.id)) {
                    appState.selectedUnits.delete(unit.id);
                    renderUnits();
                } else { alert('La unidad se encuentra ' + unit.state + ' y no puede ser despachada.'); }
            });

            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                let currentIndex = stateCycle.indexOf(unit.state);
                unit.state = stateCycle[(currentIndex + 1) % stateCycle.length];
                if(unit.state !== 'disponible' && unit.state !== 'despachada') { appState.selectedUnits.delete(unit.id); }
                renderUnits();
            });
            unitsContainer.appendChild(btn);
        });
        guardarEstadoLocal();
    }

    const stateCycleMaq = ['fuera', 'disponible', 'cuartel'];

    function renderMaquinistas() {
        const container = document.getElementById('maquinistas-container');
        container.innerHTML = '';
        appState.maquinistas.forEach(maq => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'unit-btn';
            btn.dataset.state = maq.state;
            btn.innerText = maq.id;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                let currentIndex = stateCycleMaq.indexOf(maq.state);
                let nextState = stateCycleMaq[(currentIndex + 1) % stateCycleMaq.length];
                maq.state = nextState;
                renderMaquinistas();
                setDoc(doc(db, "maquinistas", maq.id), { estado: nextState, timestamp: Date.now() }).catch(err => console.error(err));
            });
            container.appendChild(btn);
        });
        guardarEstadoLocal();
    }

    renderUnits(); renderMaquinistas(); renderActiveEmergencies();

    // autocompletar mapa
    const addressInput = document.getElementById('address-input');
    const suggestionsList = document.getElementById('address-suggestions');
    let timeoutId;

    addressInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestionsList.style.display === 'block' && suggestionsList.firstChild) { suggestionsList.firstChild.click(); }
        }
    });

    addressInput.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        const query = e.target.value;
        if (query.length < 3) { suggestionsList.style.display = 'none'; return; }
        
        let searchQuery = query.replace(/\bcon\b/gi, 'and').replace(/\by\b/gi, 'and');
        searchQuery += ', Nueva Imperial, Chile';
        
        const bboxImperial = '-73.10,-38.85,-72.80,-38.65';

        timeoutId = setTimeout(() => {
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxToken}&bbox=${bboxImperial}&proximity=-72.9521597,-38.7446590&country=cl&language=es&limit=5`)
                .then(res => res.json())
                .then(data => {
                    suggestionsList.innerHTML = '';
                    if (data.features && data.features.length > 0) {
                        data.features.forEach(place => {
                            const li = document.createElement('li');
                            let placeName = place.place_name.replace(', Región de la Araucanía, Chile', '').replace(', Chile', '');
                            li.innerText = placeName;
                            li.addEventListener('click', () => {
                                addressInput.value = query; 
                                suggestionsList.style.display = 'none';
                                handleLocationSelection([place.center[1], place.center[0]]);
                            });
                            suggestionsList.appendChild(li);
                        });
                        suggestionsList.style.display = 'block';
                    } else { 
                        if(query.toLowerCase().includes(" con ") || query.toLowerCase().includes(" y ")) {
                            let callePrincipal = query.split(/ con | y /i)[0].trim() + ', Nueva Imperial, Chile';
                            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(callePrincipal)}.json?access_token=${mapboxToken}&bbox=${bboxImperial}&proximity=-72.9521597,-38.7446590&country=cl&language=es&limit=5`)
                                .then(res2 => res2.json())
                                .then(data2 => {
                                    if(data2.features && data2.features.length > 0) {
                                        data2.features.forEach(place => {
                                            const li = document.createElement('li');
                                            let placeName = place.place_name.replace(', Región de la Araucanía, Chile', '').replace(', Chile', '');
                                            li.innerText = placeName + " (Aproximación)";
                                            li.addEventListener('click', () => {
                                                addressInput.value = query;
                                                suggestionsList.style.display = 'none';
                                                handleLocationSelection([place.center[1], place.center[0]]);
                                            });
                                            suggestionsList.appendChild(li);
                                        });
                                        suggestionsList.style.display = 'block';
                                    } else { suggestionsList.style.display = 'none'; }
                                }).catch(err => console.error(err));
                        } else { suggestionsList.style.display = 'none'; }
                    }
                }).catch(err => console.error(err));
        }, 500);
    });

    document.addEventListener('click', (e) => { if (e.target !== addressInput) suggestionsList.style.display = 'none'; });

    // marcar rural
    const btnManualMark = document.getElementById('btn-manual-mark');
    btnManualMark.addEventListener('click', () => {
        appState.isMarkingMode = true;
        map.getContainer().style.cursor = 'crosshair';
        btnManualMark.style.backgroundColor = 'var(--c-orange)';
        btnManualMark.innerText = 'HAZ CLIC EN EL MAPA PARA MARCAR...';
    });

    map.on('click', (e) => {
        if (appState.isMarkingMode) {
            addressInput.value = "UBICACIÓN RURAL / SECTOR MARCADO";
            handleLocationSelection([e.latlng.lat, e.latlng.lng]);
            appState.isMarkingMode = false;
            map.getContainer().style.cursor = '';
            btnManualMark.style.backgroundColor = 'var(--bg-panel)';
            btnManualMark.innerText = '[ MARCAR RURAL ]';
        }
    });

    function handleLocationSelection(coords) {
        if (appState.pendingMarker) map.removeLayer(appState.pendingMarker);
        if (appState.pendingRouting) map.removeControl(appState.pendingRouting);
        appState.pendingLocation = coords;
        
        appState.pendingMarker = L.marker(appState.pendingLocation, {
            icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', iconSize: [25, 41], iconAnchor: [12, 41] })
        }).addTo(map);

        appState.pendingRouting = L.Routing.control({
            waypoints: [ L.latLng(appState.stationLocation[0], appState.stationLocation[1]), L.latLng(appState.pendingLocation[0], appState.pendingLocation[1]) ],
            router: L.Routing.osrmv1({ profile: 'driving' }),
            lineOptions: { styles: [{ color: '#F57C00', opacity: 0.8, weight: 5 }] },
            show: false, addWaypoints: false
        }).on('routesfound', function(e) {
            let summary = e.routes[0].summary;
            let distanceKm = (summary.totalDistance / 1000).toFixed(1);
            let timeMin = Math.round(summary.totalTime / 60);
            document.getElementById('pending-routing-info').style.display = 'block';
            document.getElementById('route-distance').innerText = `Distancia: ${distanceKm} km`;
            document.getElementById('route-time').innerText = `Tiempo estimado: ${timeMin} min`;
            appState.pendingEta = timeMin; 
            appState.pendingDist = distanceKm;
            map.fitBounds([appState.stationLocation, appState.pendingLocation], {padding: [30, 30]});
        }).addTo(map);
    }

    // ENVÍA DESPACHO Y RECOPILA TODOS LOS INPUTS CLÁSICOS
    document.getElementById('dispatch-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!appState.selectedCode) { alert("Debe seleccionar una Clave Radial."); return; }
        if (appState.selectedUnits.size === 0) { alert("Seleccione al menos una unidad."); return; }
        if (!appState.pendingLocation) { alert("Seleccione una dirección en el mapa."); return; }

        let obs = document.getElementById('observations').value;
        
        // Recolectar partes de la dirección
        let baseAddress = document.getElementById('address-input').value;
        let intersection = document.getElementById('address-intersection') ? document.getElementById('address-intersection').value : '';
        let num = document.getElementById('address-number') ? document.getElementById('address-number').value : '';
        
        let fullAddress = baseAddress;
        if (num) fullAddress += " " + num;
        if (intersection) fullAddress += " / " + intersection;
        fullAddress = fullAddress.toUpperCase();

        // Recolectar Checkbox de Atentado
        let isAtentado = document.getElementById('chk-atentado') ? document.getElementById('chk-atentado').checked : false;

        // Recolectar Nivel de Alarma del panel izquierdo (Es el primer select con ese ID)
        let alarmSelects = document.querySelectorAll('#apoyo-alarm-select');
        let initialAlarm = alarmSelects.length > 0 ? parseInt(alarmSelects[0].value) : 0;

        let unitsArray = Array.from(appState.selectedUnits);

        appState.units.forEach(u => { if (appState.selectedUnits.has(u.id)) u.state = 'despachada'; });

        const newEmergency = {
            id: Date.now(), code: appState.selectedCode, address: fullAddress, obs: obs, units: unitsArray, alarma: initialAlarm, isAtentado: isAtentado,
            marker: appState.pendingMarker, routing: appState.pendingRouting, eta: appState.pendingEta || '--', dist: appState.pendingDist || '--',
            markerLatLng: appState.pendingLocation ? { lat: appState.pendingLocation[0], lng: appState.pendingLocation[1] } : null, logs: {} 
        };

        appState.activeEmergencies.push(newEmergency);
        guardarEstadoLocal();

        const safePayload = {
            id: newEmergency.id, code: newEmergency.code, address: newEmergency.address, obs: newEmergency.obs, units: newEmergency.units,
            alarma: newEmergency.alarma, isAtentado: newEmergency.isAtentado, eta: newEmergency.eta, dist: newEmergency.dist, markerLatLng: newEmergency.markerLatLng, logs: {}
        };

        setDoc(doc(db, "operaciones", "despacho_actual"), safePayload).catch((error) => console.error(error));

        appState.pendingMarker = null; appState.pendingRouting = null; appState.pendingLocation = null;
        document.getElementById('pending-routing-info').style.display = 'none';
        
        document.getElementById('dispatch-form').reset();
        document.querySelectorAll('.clave-btn').forEach(b => b.classList.remove('selected'));
        if (alarmSelects.length > 0) alarmSelects[0].value = "0"; // Reinicia el select
        appState.selectedCode = null; appState.selectedUnits.clear();
        map.setView(appState.stationLocation, 17);
        renderActiveEmergencies(); renderUnits();
    });

    // boton apoyo
    window.triggerApoyo = function(id) {
        let em = appState.activeEmergencies.find(e => e.id === id);
        if (!em) return;
        appState.apoyoModeId = id;
        document.getElementById('dispatch-form').style.display = 'none';
        document.getElementById('apoyo-panel').style.display = 'flex';
        document.getElementById('apoyo-title').innerText = `${em.code} - ${em.address}`;
        document.getElementById('apoyo-current-units').innerText = em.units.join(', ');
        
        let alarmSelects = document.querySelectorAll('#apoyo-alarm-select');
        let apoyoSelect = alarmSelects.length > 1 ? alarmSelects[1] : alarmSelects[0];
        
        const alarmGroup = document.getElementById('apoyo-alarm-group');
        if (alarmGroup) {
            if (em.code === '10-0' || em.code === '10-2') {
                alarmGroup.style.display = 'block'; 
                apoyoSelect.value = em.alarma;
            } else { 
                alarmGroup.style.display = 'none'; 
                apoyoSelect.value = "0"; 
            }
        }
        appState.selectedUnits.clear(); renderUnits();
    };

    document.getElementById('btn-cancel-apoyo').addEventListener('click', () => {
        appState.apoyoModeId = null;
        document.getElementById('apoyo-panel').style.display = 'none';
        document.getElementById('dispatch-form').style.display = 'flex';
        appState.selectedUnits.clear(); renderUnits();
    });

    document.getElementById('btn-confirm-apoyo').addEventListener('click', () => {
        let em = appState.activeEmergencies.find(e => e.id === appState.apoyoModeId);
        if (!em) return;
        const newUnits = Array.from(appState.selectedUnits);
        
        let alarmSelects = document.querySelectorAll('#apoyo-alarm-select');
        let apoyoSelect = alarmSelects.length > 1 ? alarmSelects[1] : alarmSelects[0];
        const newAlarmLevel = parseInt(apoyoSelect.value);

        if (newUnits.length === 0 && newAlarmLevel === em.alarma) { alert("Seleccione nuevas unidades o cambie el nivel de alarma."); return; }
        
        appState.units.forEach(u => { if (appState.selectedUnits.has(u.id)) u.state = 'despachada'; });
        em.units.push(...newUnits); em.alarma = newAlarmLevel;
        guardarEstadoLocal();
        
        const safeUpdatePayload = { 
            id: em.id, code: em.code, address: em.address, obs: em.obs, units: em.units, alarma: em.alarma, isAtentado: em.isAtentado, eta: em.eta, dist: em.dist,
            isUpdate: true, addedUnits: newUnits, markerLatLng: em.markerLatLng, logs: em.logs || {}
        };

        setDoc(doc(db, "operaciones", "despacho_actual"), safeUpdatePayload, { merge: true }).catch((error) => console.error(error));
        document.getElementById('btn-cancel-apoyo').click();
        renderActiveEmergencies(); renderUnits();
    });

    function renderActiveEmergencies() {
        const container = document.getElementById('active-emergencies-container');
        container.innerHTML = '';

        appState.activeEmergencies.forEach(em => {
            let card = document.createElement('div');
            card.className = `emergency-card ${em.alarma > 0 ? 'alarma-' + em.alarma : ''}`;
            let alarmText = em.alarma > 0 ? ` <span style="color:var(--c-orange);">(${em.alarma}ª ALARMA)</span>` : '';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>${em.code}${alarmText}</h3>
                    <span style="font-size:0.75rem; color:var(--text-muted);">#${em.id.toString().slice(-5)}</span>
                </div>
                <p>DIRECCIÓN: <strong>${em.address}</strong></p>
                <p>UNIDADES: <strong style="color:var(--text-light);">${em.units.join(', ')}</strong></p>
                
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
                    <div style="display:flex; gap:10px;">
                        <button onclick="window.triggerApoyo(${em.id})" class="btn-primary" style="flex:1; margin-top:0;">GESTIONAR APOYO</button>
                        <button onclick="window.concludeEmergency(${em.id})" class="btn-destructive" style="flex:1; margin-top:0;">TERMINAR</button>
                    </div>
                    <button onclick="window.openBitacora(${em.id})" class="btn-secondary" style="margin-top:0;">[ VER BITÁCORA DE TIEMPOS ]</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    window.openBitacora = function(id) {
        let em = appState.activeEmergencies.find(e => e.id === id);
        if (!em) return;
        currentBitacoraId = id;
        document.getElementById('bitacora-title').innerText = `${em.code} - ${em.address}`;
        renderTablaBitacora(em);
        modalBitacora.style.display = 'flex';
    };

    window.renderTablaBitacora = function(em) {
        const tbody = document.getElementById('bitacora-tbody');
        tbody.innerHTML = '';
        em.units.forEach(unitId => {
            const l = (em.logs && em.logs[unitId]) ? em.logs[unitId] : {};
            let tr = document.createElement('tr');
            tr.innerHTML = `<td style="color:var(--c-blue);">${unitId}</td><td>${l['6-0'] || '--'}</td><td>${l['6-3'] || '--'}</td><td>${l['6-7'] || '--'}</td><td>${l['6-8'] || '--'}</td><td>${l['6-9'] || '--'}</td><td>${l['6-10'] || '--'}</td><td>${l.km || '--'}</td><td>${l.combustible || '--'}</td>`;
            tbody.appendChild(tr);
        });
    };

    document.getElementById('btn-close-bitacora').addEventListener('click', () => { modalBitacora.style.display = 'none'; currentBitacoraId = null; });

    // CIERRA EMERGENCIA Y RESPALDA EN EL GYRAS HISTÓRICO
    window.concludeEmergency = async function(id) {
        let index = appState.activeEmergencies.findIndex(e => e.id === id);
        if(index > -1) {
            let em = appState.activeEmergencies[index];

            // 1. Preparar datos completos para el Gyras histórico (Incluye si fue atentado)
            const historialPayload = {
                id: em.id, 
                code: em.code, 
                address: em.address, 
                obs: em.obs, 
                units: em.units, 
                alarma: em.alarma,
                isAtentado: em.isAtentado || false,
                logs: em.logs || {},
                fecha_termino: new Date().toISOString()
            };

            // 2. Crear/Guardar en la colección permanente de Firestore
            try {
                await setDoc(doc(db, "historial_emergencias", em.id.toString()), historialPayload);
            } catch(error) {
                console.error("Error guardando historial:", error);
            }

            // 3. Limpieza gráfica del mapa
            if(em.marker) map.removeLayer(em.marker);
            if(em.routing) map.removeControl(em.routing);
            
            em.units.forEach(unitId => { 
                let u = appState.units.find(x => x.id === unitId); 
                if(u && ['despachada', 'en-ruta', 'emergencia'].includes(u.state)) { 
                    u.state = 'disponible'; 
                } 
            });
            
            appState.activeEmergencies.splice(index, 1);
            guardarEstadoLocal(); 
            renderActiveEmergencies(); 
            renderUnits();
            
            // 4. Borrar el despacho actual vivo para liberar las pantallas
            try { 
                await deleteDoc(doc(db, "operaciones", "despacho_actual")); 
            } catch(e) { 
                console.error(e); 
            }
        }
    };

    // LINKS WHATSAPP Y SMS GPS
    let currentLinkId = null;

    function generarLinkGPS(metodo) {
        currentLinkId = Math.floor(Math.random() * 10000).toString();
        let urlBase = window.location.origin + window.location.pathname.replace('central.html', '');
        let linkFinal = `${urlBase}loc.html?id=${currentLinkId}`;
        
        let mensaje = `🚨 *Bomberos Nueva Imperial* 🚨\nPara enviar la unidad de emergencia al lugar exacto, necesitamos su ubicación.\n\nHaga clic en el siguiente enlace y presione "ENVIAR MI UBICACIÓN":\n${linkFinal}`;
        
        // Copia el enlace al portapapeles por seguridad
        navigator.clipboard.writeText(linkFinal).catch(err => console.error('Falla copiado: ', err));

        // Ejecuta WhatsApp o SMS según el botón presionado
        if (metodo === 'wa') {
            window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
        } else if (metodo === 'sms') {
            window.open(`sms:?body=${encodeURIComponent(mensaje)}`, '_self');
        }

        // Escucha en tiempo real cuando el usuario envíe su GPS
        onSnapshot(doc(db, "ubicaciones_externas", currentLinkId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                appState.isMarkingMode = false;
                map.getContainer().style.cursor = '';
                
                let btnManual = document.getElementById('btn-manual-mark');
                if (btnManual) {
                    btnManual.style.backgroundColor = 'var(--bg-panel)';
                    btnManual.innerText = '[ MARCAR RURAL ]';
                }
                
                document.getElementById('address-input').value = "UBICACIÓN OBTENIDA VÍA LINK GPS";
                handleLocationSelection([data.lat, data.lng]);
                
                alert("¡El usuario ha compartido su ubicación con éxito!");
            }
        });
    }

    // Escuchadores de los botones actualizados
    document.getElementById('btn-link-gps-wa')?.addEventListener('click', () => generarLinkGPS('wa'));
    document.getElementById('btn-link-gps-sms')?.addEventListener('click', () => generarLinkGPS('sms'));
});
