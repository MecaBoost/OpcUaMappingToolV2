// ==========================================
// CONFIGURATION GLOBALE
// ==========================================

// L'URL de base de votre API backend. 
// Assurez-vous que le port (ici 5044) correspond bien à celui sur lequel tourne votre backend.
const API_BASE_URL = 'http://localhost:5044/api/Mapping';

// ==========================================
// VARIABLES D'ÉTAT DE L'APPLICATION
// ==========================================

// Identifiant unique de la session de travail en cours.
// Il est renvoyé par le backend lors du premier upload de fichier pour lier le JSON et le XML ensemble.
let sessionId = null;

// Tableaux et objets pour stocker les données reçues du backend
let xmlAssets = []; // Liste des équipements extraits du XML (ex: ["Equipement1", "Equipement2"])
let jsonAssets = {}; // Dictionnaire des connexions et préfixes du JSON (ex: { "Conn1": ["pref1", "pref2"] })
let mappings = []; // Liste des liaisons validées par l'utilisateur { xmlNode, jsonConnection, jsonPrefix }

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
// 1. UPLOAD DES FICHIERS VERS LE BACKEND
// ==========================================

// Écouteur d'événement : Se déclenche quand l'utilisateur sélectionne un fichier XML
xmlInput.addEventListener('change', async (e) => {
    if (!e.target.files.length) return; // Si aucun fichier n'est sélectionné, on arrête

    // Préparation des données à envoyer (le fichier physique)
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    
    // Si une session existe déjà (ex: le JSON a été uploadé en premier), on l'envoie pour lier les deux
    if (sessionId) formData.append('sessionId', sessionId);

    // Affichage d'un message d'attente
    document.getElementById('xmlStatus').innerHTML = '<span class="text-muted">Analyse en cours...</span>';

    try {
        // Envoi de la requête POST au backend
        const response = await fetch(`${API_BASE_URL}/upload-xml`, { method: 'POST', body: formData });
        const data = await response.json();
        
        // Mise à jour de l'état avec les données renvoyées par le serveur
        sessionId = data.sessionId; 
        xmlAssets = data.assets;
        
        // Affichage du succès
        document.getElementById('xmlStatus').innerHTML = `<span class="text-success">✅ ${xmlAssets.length} équipements trouvés.</span>`;
        
        // Mise à jour de la liste déroulante (Sélecteur XML)
        updateXmlSelect();
    } catch (err) {
        document.getElementById('xmlStatus').innerHTML = '<span class="text-danger">❌ Erreur de lecture. Le backend est-il démarré ?</span>';
        console.error("Erreur Upload XML:", err);
    }
});

// Écouteur d'événement : Se déclenche quand l'utilisateur sélectionne un fichier JSON
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
        jsonAssets = data.assets; // Le JSON renvoie un objet complexe (dictionnaire)
        
        const nbConns = Object.keys(jsonAssets).length;
        document.getElementById('jsonStatus').innerHTML = `<span class="text-success">✅ ${nbConns} connexions trouvées.</span>`;
        
        // Mise à jour de la liste déroulante (Sélecteur Connexion)
        updateConnSelect();
    } catch (err) {
        document.getElementById('jsonStatus').innerHTML = '<span class="text-danger">❌ Erreur de lecture. Le backend est-il démarré ?</span>';
        console.error("Erreur Upload JSON:", err);
    }
});

// ==========================================
// 2. GESTION DES LISTES DÉROULANTES DYNAMIQUES
// ==========================================

// Met à jour la liste des équipements XML disponibles
function updateXmlSelect() {
    xmlSelect.innerHTML = '<option value="">-- Choisir un équipement --</option>';
    
    // On filtre les équipements pour ne garder que ceux qui ne sont pas déjà dans le tableau "mappings"
    const available = xmlAssets.filter(x => !mappings.some(m => m.xmlNode === x));
    
    // On ajoute chaque équipement disponible comme option dans la liste
    available.forEach(asset => {
        xmlSelect.innerHTML += `<option value="${asset}">${asset}</option>`;
    });
}

// Met à jour la liste des connexions JSON disponibles
function updateConnSelect() {
    connSelect.innerHTML = '<option value="">-- Choisir une connexion --</option>';
    
    Object.keys(jsonAssets).forEach(conn => {
        connSelect.innerHTML += `<option value="${conn}">${conn}</option>`;
    });
}

// Écouteur : Se déclenche quand on change la valeur de la connexion JSON
// Objectif : Remplir la liste des préfixes en fonction de la connexion choisie
connSelect.addEventListener('change', (e) => {
    const conn = e.target.value;
    prefixSelect.innerHTML = '<option value="">-- Choisir un préfixe --</option>';
    
    if (conn && jsonAssets[conn]) {
        // Active le sélecteur de préfixes
        prefixSelect.disabled = false;
        
        // On filtre les préfixes pour ne proposer que ceux qui ne sont pas encore mappés avec cette connexion
        const available = jsonAssets[conn].filter(p => !mappings.some(m => m.jsonConnection === conn && m.jsonPrefix === p));
        
        available.forEach(pref => {
            prefixSelect.innerHTML += `<option value="${pref}">${pref}</option>`;
        });
    } else {
        // Si aucune connexion n'est sélectionnée, on désactive le sélecteur de préfixes
        prefixSelect.disabled = true;
    }
});

// ==========================================
// 3. GESTION DU TABLEAU DE MAPPING (INTERFACE)
// ==========================================

// Action du bouton "+" : Ajoute une nouvelle liaison dans le tableau
btnAddMapping.addEventListener('click', () => {
    const xml = xmlSelect.value;
    const conn = connSelect.value;
    const pref = prefixSelect.value;

    // Vérifie que les 3 champs sont bien sélectionnés
    if (xml && conn && pref) {
        // Ajout de la liaison dans notre tableau Javascript
        mappings.push({ xmlNode: xml, jsonConnection: conn, jsonPrefix: pref });
        
        // Réinitialisation des listes déroulantes pour la prochaine saisie
        xmlSelect.value = '';
        connSelect.value = '';
        prefixSelect.innerHTML = '<option value="">-- Choisir un préfixe --</option>';
        prefixSelect.disabled = true;

        // Met à jour l'affichage HTML
        renderTable();
        // Retire l'équipement qu'on vient de sélectionner de la liste déroulante XML
        updateXmlSelect(); 
    } else {
        alert("Veuillez remplir les 3 champs pour créer une liaison.");
    }
});

// Fonction appelée quand on clique sur la croix "X" rouge d'une ligne
function removeMapping(index) {
    // Retire l'élément du tableau Javascript
    mappings.splice(index, 1);
    
    // Met à jour l'affichage
    renderTable();
    updateXmlSelect(); // L'équipement supprimé redevient disponible
    
    // Force la mise à jour des préfixes si une connexion est actuellement sélectionnée
    connSelect.dispatchEvent(new Event('change'));
}

// Dessine les lignes du tableau HTML à partir des données du tableau Javascript `mappings`
function renderTable() {
    mappingTableBody.innerHTML = ''; // Vide le tableau existant
    
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
    // Vérification avant envoi
    if (!sessionId || mappings.length === 0) {
        showMessage("⚠️ Veuillez charger les fichiers et configurer au moins une liaison.", false);
        return;
    }

    // Désactive le bouton pour éviter le double-clic
    btnGenerate.disabled = true;
    btnGenerate.innerText = "Génération en cours...";

    // Préparation des données JSON à envoyer à l'API
    const payload = {
        sessionId: sessionId,
        mappings: mappings
    };

    try {
        // Appel de la méthode de génération du backend
        const response = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            // Si le serveur renvoie une erreur (400, 404, 500), on récupère le message texte
            const errorMsg = await response.text();
            throw new Error(errorMsg);
        }

        // ==========================================
        // TÉLÉCHARGEMENT DU FICHIER XML RENVOYÉ
        // ==========================================
        // Le serveur nous renvoie directement le fichier binaire (Blob)
        const blob = await response.blob();
        
        // Astuce Javascript pour forcer le téléchargement d'un Blob
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); // Crée un lien <a> invisible
        a.href = url;
        a.download = "urn.ComapanMeca4_Automated.xml"; // Nom du fichier de sortie
        document.body.appendChild(a);
        a.click(); // Simule un clic sur le lien
        a.remove(); // Nettoie le DOM
        window.URL.revokeObjectURL(url); // Libère la mémoire

        showMessage("✅ Traitement terminé avec succès ! Le fichier a été téléchargé.", true);
    } catch (err) {
        showMessage(`❌ Erreur : ${err.message}`, false);
        console.error("Erreur de génération:", err);
    } finally {
        // Restaure le bouton générer à son état normal
        btnGenerate.disabled = false;
        btnGenerate.innerText = "Lancer le Mapping Final et Télécharger";
    }
});

// Fonction utilitaire pour afficher un bandeau de succès/erreur en bas de la page
function showMessage(msg, isSuccess) {
    resultMessage.className = `alert mt-4 text-center fs-5 shadow-sm ${isSuccess ? 'alert-success' : 'alert-danger'}`;
    resultMessage.innerText = msg;
    resultMessage.classList.remove('d-none'); // Rend la zone visible
}