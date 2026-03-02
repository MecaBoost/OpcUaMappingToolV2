// Remplacez 5000 par le port réel de votre API C# (ex: 5169, 5001...)
const API_BASE_URL = 'http://localhost:5044/api/Mapping';

// État de l'application
let sessionId = null;
let xmlAssets = [];
let jsonAssets = {}; // Dictionnaire { "Conn1": ["pref1", "pref2"] }
let mappings = [];

// Éléments du DOM
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
// 1. UPLOAD DES FICHIERS
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
        
        sessionId = data.sessionId; // On sauvegarde la session
        xmlAssets = data.assets;
        
        document.getElementById('xmlStatus').innerHTML = `<span class="text-success">✅ ${xmlAssets.length} équipements trouvés.</span>`;
        updateXmlSelect();
    } catch (err) {
        document.getElementById('xmlStatus').innerHTML = '<span class="text-danger">❌ Erreur de lecture.</span>';
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
        
        const nbConns = Object.keys(jsonAssets).length;
        document.getElementById('jsonStatus').innerHTML = `<span class="text-success">✅ ${nbConns} connexions trouvées.</span>`;
        updateConnSelect();
    } catch (err) {
        document.getElementById('jsonStatus').innerHTML = '<span class="text-danger">❌ Erreur de lecture.</span>';
    }
});

// ==========================================
// 2. MISE À JOUR DES LISTES DÉROULANTES
// ==========================================

function updateXmlSelect() {
    xmlSelect.innerHTML = '<option value="">-- Choisir un équipement --</option>';
    // Filtrer ceux déjà mappés
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
        // Filtrer ceux déjà mappés pour cette connexion
        const available = jsonAssets[conn].filter(p => !mappings.some(m => m.jsonConnection === conn && m.jsonPrefix === p));
        available.forEach(pref => {
            prefixSelect.innerHTML += `<option value="${pref}">${pref}</option>`;
        });
    } else {
        prefixSelect.disabled = true;
    }
});

// ==========================================
// 3. GESTION DU TABLEAU DE MAPPING
// ==========================================

btnAddMapping.addEventListener('click', () => {
    const xml = xmlSelect.value;
    const conn = connSelect.value;
    const pref = prefixSelect.value;

    if (xml && conn && pref) {
        mappings.push({ xmlNode: xml, jsonConnection: conn, jsonPrefix: pref });
        
        // Réinitialiser la ligne de saisie
        xmlSelect.value = '';
        connSelect.value = '';
        prefixSelect.innerHTML = '<option value="">-- Choisir un préfixe --</option>';
        prefixSelect.disabled = true;

        renderTable();
        updateXmlSelect(); // Met à jour pour retirer l'élément choisi
    } else {
        alert("Veuillez remplir les 3 champs.");
    }
});

function removeMapping(index) {
    mappings.splice(index, 1);
    renderTable();
    updateXmlSelect();
    // Forcer le rafraîchissement des préfixes si une connexion est sélectionnée
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
// 4. ENVOI AU SERVEUR ET TÉLÉCHARGEMENT
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

        // Le serveur renvoie un fichier binaire (Blob)
        const blob = await response.blob();
        
        // Création du lien de téléchargement dynamique
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "urn.ComapanMeca4_Automated.xml";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        showMessage("✅ Traitement terminé avec succès ! Le fichier a été téléchargé.", true);
    } catch (err) {
        showMessage(`❌ Erreur : ${err.message}`, false);
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