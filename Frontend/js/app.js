// ==========================================
// CONFIGURATION GLOBALE
// ==========================================

// L'URL de base de votre API backend. 
// Assurez-vous que le port correspond bien à celui sur lequel tourne votre backend.
const API_BASE_URL = 'http://localhost:5044/api/Mapping';

// ==========================================
// VARIABLES D'ÉTAT DE L'APPLICATION (Avec sauvegarde)
// ==========================================

// On essaie de récupérer les données précédentes s'il y a eu un rafraîchissement
let sessionId = sessionStorage.getItem('sessionId') || null;
let xmlAssets = JSON.parse(sessionStorage.getItem('xmlAssets')) || [];
let jsonAssets = JSON.parse(sessionStorage.getItem('jsonAssets')) || {};
let mappings = JSON.parse(sessionStorage.getItem('mappings')) || [];

// Fonction utilitaire pour sauvegarder l'état actuel dans le navigateur
function saveState() {
    if (sessionId) sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('xmlAssets', JSON.stringify(xmlAssets));
    sessionStorage.setItem('jsonAssets', JSON.stringify(jsonAssets));
    sessionStorage.setItem('mappings', JSON.stringify(mappings));
}

// ==========================================
// RÉCUPÉRATION DES ÉLÉMENTS DU DOM (INTERFACE HTML)
// ==========================================

const xmlInput = document.getElementById('xmlInput');
const jsonInput = document.getElementById('jsonInput');
const xmlSelect = document.getElementById('xmlSelect');
const connSelect = document.getElementById('connSelect');
const prefixSelect = document.getElementById('prefixSelect');
const mappingTableBody = document.getElementById('mappingTableBody');
const btnAddMapping = document.getElementById('btnAddMapping');
const btnGenerate = document.getElementById('btnGenerate');
const resultMessage = document.getElementById('resultMessage');

// ==========================================
// RESTAURATION AU CHARGEMENT DE LA PAGE
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    if (xmlAssets.length > 0) {
        document.getElementById('xmlStatus').innerHTML = `<span class="text-success">✅ ${xmlAssets.length} équipements restaurés.</span>`;
        updateXmlSelect();
    }
    if (Object.keys(jsonAssets).length > 0) {
        document.getElementById('jsonStatus').innerHTML = `<span class="text-success">✅ ${Object.keys(jsonAssets).length} connexions restaurées.</span>`;
        updateConnSelect();
    }
    if (mappings.length > 0) {
        renderTable();
    }
});

// ==========================================
// 1. UPLOAD DES FICHIERS VERS LE BACKEND
// ==========================================

xmlInput.addEventListener('change', async (e) => {
    if (!e.target.files.length) return;

    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    if (sessionId) formData.append('sessionId', sessionId);

    document.getElementById('xmlStatus').innerHTML = '<span class="text-muted">Analyse en cours...</span>';

    try {
        const response = await fetch(`${API_BASE_URL}/upload-xml`, { method: 'POST', body: formData });
        const data = await response.json();
        
        sessionId = data.sessionId; 
        xmlAssets = data.assets;
        
        saveState(); // <-- SAUVEGARDE DE L'ÉTAT

        document.getElementById('xmlStatus').innerHTML = `<span class="text-success">✅ ${xmlAssets.length} équipements trouvés.</span>`;
        updateXmlSelect();
    } catch (err) {
        document.getElementById('xmlStatus').innerHTML = '<span class="text-danger">❌ Erreur de lecture. Le backend est-il démarré ?</span>';
        console.error("Erreur Upload XML:", err);
    }
});

jsonInput.addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    if (sessionId) formData.append('sessionId', sessionId);

    document.getElementById('jsonStatus').innerHTML = '<span class="text-muted">Analyse en cours...</span>';

    try {
        const response = await fetch(`${API_BASE_URL}/upload-json`, { method: 'POST', body: formData });
        const data = await response.json();
        
        sessionId = data.sessionId;
        jsonAssets = data.assets;
        
        saveState(); // <-- SAUVEGARDE DE L'ÉTAT

        const nbConns = Object.keys(jsonAssets).length;
        document.getElementById('jsonStatus').innerHTML = `<span class="text-success">✅ ${nbConns} connexions trouvées.</span>`;
        updateConnSelect();
    } catch (err) {
        document.getElementById('jsonStatus').innerHTML = '<span class="text-danger">❌ Erreur de lecture. Le backend est-il démarré ?</span>';
        console.error("Erreur Upload JSON:", err);
    }
});

// ==========================================
// 2. GESTION DES LISTES DÉROULANTES DYNAMIQUES
// ==========================================

function updateXmlSelect() {
    xmlSelect.innerHTML = '<option value="">-- Choisir un équipement --</option>';
    const available = xmlAssets.filter(x => !mappings.some(m => m.xmlNode === x));
    available.forEach(asset => {
        xmlSelect.innerHTML += `<option value="${asset}">${asset}</option>`;
    });
}

function updateConnSelect() {
    connSelect.innerHTML = '<option value="">-- Choisir une connexion --</option>';
    Object.keys(jsonAssets).forEach(conn => {
        connSelect.innerHTML += `<option value="${conn}">${conn}</option>`;
    });
}

connSelect.addEventListener('change', (e) => {
    const conn = e.target.value;
    prefixSelect.innerHTML = '<option value="">-- Choisir un préfixe --</option>';
    
    if (conn && jsonAssets[conn]) {
        prefixSelect.disabled = false;
        const available = jsonAssets[conn].filter(p => !mappings.some(m => m.jsonConnection === conn && m.jsonPrefix === p));
        available.forEach(pref => {
            prefixSelect.innerHTML += `<option value="${pref}">${pref}</option>`;
        });
    } else {
        prefixSelect.disabled = true;
    }
});

// ==========================================
// 3. GESTION DU TABLEAU DE MAPPING (INTERFACE)
// ==========================================

btnAddMapping.addEventListener('click', () => {
    const xml = xmlSelect.value;
    const conn = connSelect.value;
    const pref = prefixSelect.value;

    if (xml && conn && pref) {
        mappings.push({ xmlNode: xml, jsonConnection: conn, jsonPrefix: pref });
        
        saveState(); // <-- SAUVEGARDE DE L'ÉTAT

        xmlSelect.value = '';
        connSelect.value = '';
        prefixSelect.innerHTML = '<option value="">-- Choisir un préfixe --</option>';
        prefixSelect.disabled = true;

        renderTable();
        updateXmlSelect(); 
    } else {
        alert("Veuillez remplir les 3 champs pour créer une liaison.");
    }
});

function removeMapping(index) {
    mappings.splice(index, 1);
    
    saveState(); // <-- SAUVEGARDE DE L'ÉTAT

    renderTable();
    updateXmlSelect();
    connSelect.dispatchEvent(new Event('change'));
}

function renderTable() {
    mappingTableBody.innerHTML = '';
    mappings.forEach((m, index) => {
        mappingTableBody.innerHTML += `
            <tr>
                <td class="fw-bold">${m.xmlNode}</td>
                <td>${m.jsonConnection}</td>
                <td class="text-muted">${m.jsonPrefix}...</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger" onclick="removeMapping(${index})">✕</button>
                </td>
            </tr>
        `;
    });
}

// ==========================================
// 4. GÉNÉRATION FINALE ET TÉLÉCHARGEMENT
// ==========================================

btnGenerate.addEventListener('click', async () => {
    if (!sessionId || mappings.length === 0) {
        showMessage("⚠️ Veuillez charger les fichiers et configurer au moins une liaison.", false);
        return;
    }

    btnGenerate.disabled = true;
    btnGenerate.innerText = "Génération en cours...";

    const payload = {
        sessionId: sessionId,
        mappings: mappings
    };

    try {
        const response = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg);
        }

        const data = await response.json();
        
        showMessage(
            `✅ ${data.mappedCount} / ${data.totalVariables} variables mappées.
        ❌ ${data.unmappedCount} non mappées.`,
            true
        );

        const unmappedDiv = document.getElementById("unmappedList");

        if (data.unmappedVariables && data.unmappedVariables.length > 0) {
            unmappedDiv.innerHTML = `
                <div class="alert alert-warning mt-3">
                    <strong>Variables non mappées :</strong>
                    <ul class="mb-0">
                        ${data.unmappedVariables.map(v => `<li>${v}</li>`).join("")}
                    </ul>
                </div>
            `;
        } else {
            unmappedDiv.innerHTML = "";
        }

        const byteCharacters = atob(data.fileBase64);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/xml" });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "urn.ComapanMeca4_Automated.xml";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        showMessage("✅ Traitement terminé avec succès ! Le fichier a été téléchargé.", true);
    } catch (err) {
        showMessage(`❌ Erreur : ${err.message}`, false);
        console.error("Erreur de génération:", err);
    } finally {
        btnGenerate.disabled = false;
        btnGenerate.innerText = "Lancer le Mapping Final et Télécharger";
    }
});

function showMessage(msg, isSuccess) {
    resultMessage.className = `alert mt-4 text-center fs-5 shadow-sm ${isSuccess ? 'alert-success' : 'alert-danger'}`;
    resultMessage.innerText = msg;
    resultMessage.classList.remove('d-none');
}