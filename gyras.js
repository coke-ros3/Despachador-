// inicio firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-NIM0pbgU2w85mWFhqUEkbA3L0_NrimI",
  authDomain: "despachador-58fb8.firebaseapp.com",
  projectId: "despachador-58fb8",
  storageBucket: "despachador-58fb8.firebasestorage.app",
  messagingSenderId: "1024295745401",
  appId: "1:1024295745401:web:8d49683a86a8b1ff7aa1a8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    let activeEmergencies = [];
    let selectedId = null;
    let liveLogs = {};

    const container = document.getElementById('lista-emergencias-container');
    const hojaParte = document.getElementById('hoja-parte');
    const mensajeVacio = document.getElementById('mensaje-vacio');
    const btnPrintContainer = document.getElementById('btn-print-container');

    // guarda manual
    const inputsManuales = [
        'gyras-parte', 'gyras-operador', 'gyras-numero', 'gyras-referencia', 
        'gyras-emisor-nombre', 'gyras-emisor-tel', 'gyras-oficial-cargo', 
        'gyras-ampliacion', 'gyras-1-0', 'gyras-1-2', 'gyras-1-3', 
        'gyras-1-4', 'gyras-1-5', 'gyras-1-8'
    ];

    // lee emergencias
    function loadEmergencies() {
        const saved = localStorage.getItem('cad_active_emergencies');
        if (saved) {
            let parsed = JSON.parse(saved);
            if(JSON.stringify(parsed) !== JSON.stringify(activeEmergencies)) {
                activeEmergencies = parsed;
                renderInbox();
            }
        } else {
            if(activeEmergencies.length > 0) {
                activeEmergencies = [];
                renderInbox();
            }
        }
    }

    setInterval(loadEmergencies, 2000); 
    loadEmergencies();

    onSnapshot(doc(db, "operaciones", "despacho_actual"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.logs) {
                liveLogs = data.logs;
                if (selectedId === data.id) {
                    actualizarTiemposEnTabla();
                    inyectarApoyoExterno();
                }
            }
        }
    });

    // dibuja lista
    function renderInbox() {
        container.innerHTML = '';
        if (activeEmergencies.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No hay emergencias activas en curso.</p>';
            if(selectedId) {
                hojaParte.style.display = 'none';
                btnPrintContainer.style.display = 'none';
                mensajeVacio.style.display = 'block';
                selectedId = null;
            }
            return;
        }

        activeEmergencies.forEach(em => {
            let div = document.createElement('div');
            div.className = 'emergencia-item';
            if (em.id === selectedId) div.classList.add('activa');
            
            let alarmTxt = em.alarma > 0 ? ` (${em.alarma}A ALARMA)` : '';
            
            div.innerHTML = `
                <strong>${em.code}${alarmTxt}</strong>
                <p>${em.address}</p>
                <span style="font-size: 0.75rem; color: var(--text-muted);">#${em.id.toString().slice(-4)}</span>
            `;
            div.onclick = () => selectEmergency(em.id);
            container.appendChild(div);
        });
    }

    // carga datos de em
    window.selectEmergency = function(id) {
        selectedId = id;
        renderInbox(); 
        
        let em = activeEmergencies.find(e => e.id === id);
        if(!em) return;

        mensajeVacio.style.display = 'none';
        hojaParte.style.display = 'block';
        btnPrintContainer.style.display = 'flex';

        let dateObj = new Date(em.id);
        document.getElementById('gyras-fecha').innerText = dateObj.toLocaleDateString('es-CL');
        document.getElementById('gyras-hora').innerText = dateObj.toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' });
        
        document.getElementById('gyras-clave').innerText = em.code;
        document.getElementById('gyras-direccion').innerText = em.address;
        document.getElementById('gyras-04').innerText = em.obs || 'Sin observaciones al despacho.';

        // reponer draft
        let draftStr = localStorage.getItem(`gyras_draft_${id}`);
        let draft = draftStr ? JSON.parse(draftStr) : {};
        inputsManuales.forEach(inputId => {
            let el = document.getElementById(inputId);
            if(el) el.value = draft[inputId] || '';
        });

        // forzar parte 0
        let parteInput = document.getElementById('gyras-parte');
        if(parteInput && !parteInput.value) {
            parteInput.value = '0';
        }

        construirTablas(em);
        actualizarTiemposEnTabla();
        inyectarApoyoExterno();
    };

    // arma tabla uni
    function construirTablas(em) {
        const tbodyUni = document.getElementById('gyras-unidades-tbody');
        const tbodyLog = document.getElementById('gyras-logistica-tbody');
        tbodyUni.innerHTML = ''; tbodyLog.innerHTML = '';

        em.units.forEach(u => {
            let trU = document.createElement('tr');
            trU.innerHTML = `
                <td class="celda-readonly" style="color: black;">${u}</td>
                <td class="celda-readonly" id="t-60-${u}">--:--</td>
                <td><input type="text" class="celda-input gyras-memoria" id="t-cargo-${u}" placeholder="..."></td>
                <td><input type="text" class="celda-input gyras-memoria" id="t-vol-${u}" placeholder="..."></td>
                <td><input type="text" class="celda-input gyras-memoria" id="t-maq-${u}" placeholder="..."></td>
                <td class="celda-readonly" id="t-63-${u}">--:--</td>
                <td class="celda-readonly" id="t-67-${u}">--:--</td>
                <td class="celda-readonly" id="t-69-${u}">--:--</td>
                <td class="celda-readonly" id="t-610-${u}">--:--</td>
            `;
            tbodyUni.appendChild(trU);

            let trL = document.createElement('tr');
            trL.innerHTML = `
                <td class="celda-readonly" style="color: black;">${u}</td>
                <td class="celda-readonly" id="t-km-${u}">--</td>
                <td class="celda-readonly" id="t-fuel-${u}">--</td>
            `;
            tbodyLog.appendChild(trL);

            document.getElementById(`t-cargo-${u}`).addEventListener('input', saveDraft);
            document.getElementById(`t-vol-${u}`).addEventListener('input', saveDraft);
            document.getElementById(`t-maq-${u}`).addEventListener('input', saveDraft);
        });

        let draftStr = localStorage.getItem(`gyras_draft_${em.id}`);
        let draft = draftStr ? JSON.parse(draftStr) : {};
        em.units.forEach(u => {
            if(draft[`t-cargo-${u}`]) document.getElementById(`t-cargo-${u}`).value = draft[`t-cargo-${u}`];
            if(draft[`t-vol-${u}`]) document.getElementById(`t-vol-${u}`).value = draft[`t-vol-${u}`];
            if(draft[`t-maq-${u}`]) document.getElementById(`t-maq-${u}`).value = draft[`t-maq-${u}`];
        });
    }

    // pone horas fb
    function actualizarTiemposEnTabla() {
        if(!selectedId) return;
        let em = activeEmergencies.find(e => e.id === selectedId);
        if(!em) return;

        em.units.forEach(u => {
            let logs = liveLogs[u] || (em.logs ? em.logs[u] : {}) || {};
            
            if(logs['6-0']) document.getElementById(`t-60-${u}`).innerText = logs['6-0'];
            if(logs['6-3']) document.getElementById(`t-63-${u}`).innerText = logs['6-3'];
            if(logs['6-7']) document.getElementById(`t-67-${u}`).innerText = logs['6-7'];
            if(logs['6-9']) document.getElementById(`t-69-${u}`).innerText = logs['6-9'];
            if(logs['6-10']) document.getElementById(`t-610-${u}`).innerText = logs['6-10'];
            if(logs.km) document.getElementById(`t-km-${u}`).innerText = logs.km;
            if(logs.combustible) document.getElementById(`t-fuel-${u}`).innerText = logs.combustible;

            if(logs.cargo && !document.getElementById(`t-cargo-${u}`).value) document.getElementById(`t-cargo-${u}`).value = logs.cargo;
            if(logs.vol && !document.getElementById(`t-vol-${u}`).value) document.getElementById(`t-vol-${u}`).value = logs.vol;
            if(logs.maq && !document.getElementById(`t-maq-${u}`).value) document.getElementById(`t-maq-${u}`).value = logs.maq;
        });
    }

    // pone apoyos fb
    function inyectarApoyoExterno() {
        if(!selectedId) return;
        let em = activeEmergencies.find(e => e.id === selectedId);
        if(!em) return;

        const apoyos = ['1-0', '1-2', '1-3', '1-4', '1-5', '1-8'];
        apoyos.forEach(clave => {
            let timeStr = null;
            em.units.forEach(u => {
                let logs = liveLogs[u] || (em.logs ? em.logs[u] : {}) || {};
                if(logs[clave]) timeStr = logs[clave];
            });

            let input = document.getElementById(`gyras-${clave}`);
            if(input && timeStr && !input.value) {
                input.value = timeStr;
                saveDraft(); 
            }
        });
    }

    // guarda auto
    function saveDraft() {
        if(!selectedId) return;
        let draft = {};
        
        inputsManuales.forEach(id => {
            let el = document.getElementById(id);
            if(el) draft[id] = el.value;
        });

        let em = activeEmergencies.find(e => e.id === selectedId);
        if(em) {
            em.units.forEach(u => {
                let iCargo = document.getElementById(`t-cargo-${u}`);
                let iVol = document.getElementById(`t-vol-${u}`);
                let iMaq = document.getElementById(`t-maq-${u}`);
                if(iCargo) draft[`t-cargo-${u}`] = iCargo.value;
                if(iVol) draft[`t-vol-${u}`] = iVol.value;
                if(iMaq) draft[`t-maq-${u}`] = iMaq.value;
            });
        }

        localStorage.setItem(`gyras_draft_${selectedId}`, JSON.stringify(draft));
    }

    inputsManuales.forEach(id => {
        let el = document.getElementById(id);
        if(el) el.addEventListener('input', saveDraft);
    });
});
