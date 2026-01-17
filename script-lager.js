// =========================
// LOGIN CHECK & SEITEN-WECHSEL
// =========================
document.addEventListener("DOMContentLoaded", async function() {
  const auth = await window.checkAuthentication();
  
  if (!auth.authenticated) {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  } else {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    loadProfile();
    initializeServerStatus();
  }
});

// =========================
// SERVER STATUS FUNKTIONEN
// =========================
function initializeServerStatus() {
  updateServerStatus();
  // Alle 30 Sekunden aktualisieren
  setInterval(updateServerStatus, 30000);
}

async function updateServerStatus() {
  try {
    // mcstatus.io API für Java-Server
    const response = await fetch('https://api.mcstatus.io/v2/status/java/opsucht.net');
    const data = await response.json();
    
    if (data && data.online) {
      updateServerDisplay('online', data.players?.online || 0);
    } else {
      updateServerDisplay('offline', 0);
    }
  } catch (error) {
    console.error('Fehler beim Abrufen des Server-Status:', error);
    updateServerDisplay('error', 0);
  }
}

function updateServerDisplay(status, playerCount) {
  const statusIcon = document.getElementById('serverStatusIcon');
  const statusText = document.getElementById('serverStatusText');
  const countText = document.getElementById('serverCountText');
  
  if (!statusIcon || !statusText || !countText) return;
  
  switch (status) {
    case 'online':
      statusIcon.textContent = '🟢';
      statusText.textContent = 'Online';
      countText.textContent = playerCount;
      break;
    case 'offline':
      statusIcon.textContent = '🔴';
      statusText.textContent = 'Offline';
      countText.textContent = '0';
      break;
    case 'error':
      statusIcon.textContent = '🟡';
      statusText.textContent = 'Fehler';
      countText.textContent = '?';
      break;
  }
}

// =========================
// DATUMS-FORMATIERUNG
// =========================
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffTime / (1000 * 60));
      return diffMinutes <= 1 ? 'Gerade eben' : `Vor ${diffMinutes} Minuten`;
    }
    return diffHours === 1 ? `Vor 1 Stunde` : `Vor ${diffHours} Stunden`;
  } else if (diffDays === 1) {
    return 'Gestern';
  } else if (diffDays < 7) {
    return `Vor ${diffDays} Tagen`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? `Vor 1 Woche` : `Vor ${weeks} Wochen`;
  } else {
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  }
}

// =========================
// GLOBALS
// =========================
let CURRENT_USER_ID = null;
let CURRENT_MC_NAME = null;
let IS_ADMIN = false;
let SEARCH_TERM = '';
let AUTH_METHOD = null; // Neue Variable für Auth-Methode

// =========================
// PROFIL & NAV
// =========================
async function loadProfile() {
  console.log("loadProfile() gestartet (lager)");
  const currentUser = await window.getCurrentUser();
  console.log("currentUser (lager):", currentUser);
  
  if (!currentUser) {
    console.log("Kein currentUser gefunden (lager) - loadProfile() wird abgebrochen");
    return;
  }

  CURRENT_USER_ID = currentUser.id;
  CURRENT_MC_NAME = currentUser.mc_name;
  IS_ADMIN = currentUser.role === "admin";
  AUTH_METHOD = currentUser.method; // Auth-Methode speichern
  
  console.log("Profile geladen (lager):", {
    CURRENT_USER_ID,
    CURRENT_MC_NAME,
    IS_ADMIN,
    AUTH_METHOD
  });

  const navUser = document.getElementById("navUser");
  if (navUser) {
    document.getElementById("navUsername").innerText = currentUser.mc_name;
    document.getElementById("navAvatar").src =
      `https://mc-heads.net/avatar/${currentUser.mc_name}/64`;
    navUser.style.display = "flex";
  }

  // Lager-spezifische Elemente aktualisieren
  const currentUserAvatar = document.getElementById("currentUserAvatar");
  const currentUserName = document.getElementById("currentUserName");
  
  if (currentUserAvatar) {
    currentUserAvatar.src = `https://mc-heads.net/avatar/${currentUser.mc_name}/32`;
  }
  if (currentUserName) {
    currentUserName.textContent = currentUser.mc_name;
  }

  console.log("Rufe loadLagerItems() auf");
  loadLagerItems();
}

// =========================
// LAGER ITEMS LADEN
// =========================
async function loadLagerItems() {
  console.log('=== Lade Lager Items ===');
  console.log('CURRENT_USER_ID:', CURRENT_USER_ID);
  console.log('CURRENT_MC_NAME:', CURRENT_MC_NAME);
  console.log('IS_ADMIN:', IS_ADMIN);
  
  const container = document.getElementById("lagerItems");
  if (!container) {
    console.log("Container 'lagerItems' nicht gefunden");
    return;
  }

  try {
    let { data: items, error } = await window.supabaseClient
      .from("team_lager_items")
      .select("id, name, quantity, added_by, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error('Fehler beim Laden von team_lager_items:', error);
      container.innerHTML = '<p class="no-items">Fehler beim Laden der Lager-Items: ' + error.message + '</p>';
      return;
    }

    console.log('Gefundene Lager-Items:', items?.length || 0);
    if (items && items.length > 0) {
      console.log('Beispiel-Lager-Item:', items[0]);
    }

    // Filter anwenden
    if (SEARCH_TERM) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(SEARCH_TERM.toLowerCase())
      );
    }

    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = `
        <div class="no-items">
          ${SEARCH_TERM ? `Keine Items gefunden für "${SEARCH_TERM}"` : 'Keine Items im Lager vorhanden'}
        </div>
      `;
      return;
    }

  // Grid für Lager-Items
  const itemsGrid = document.createElement('div');
  itemsGrid.className = 'lager-items-grid';
  itemsGrid.style.display = 'grid';
  itemsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
  itemsGrid.style.gap = '16px';

  items.forEach(item => {
    const itemElement = document.createElement('div');
    itemElement.className = 'lager-item';
    itemElement.dataset.id = item.id;
    itemElement.dataset.name = item.name;
    
    const isHighlighted = SEARCH_TERM && item.name.toLowerCase().includes(SEARCH_TERM.toLowerCase());
    
    // Stack-Berechnung
    const stacks = Math.floor(item.quantity / 64);
    const remainder = item.quantity % 64;
    
    itemElement.innerHTML = `
      <button class="remove-lager-item-btn" title="Item entfernen">×</button>
      <div class="lager-item-name ${isHighlighted ? 'item-highlight' : ''}">${item.name}</div>
      <div class="lager-item-quantity">
        <span class="quantity-badge">${item.quantity.toLocaleString()} Stück</span>
        ${stacks > 0 ? `<span class="stack-badge">${stacks} × 64</span>` : ''}
        ${remainder > 0 ? `<span class="remainder-badge">+${remainder}</span>` : ''}
      </div>
      <div class="lager-item-meta">
        <img src="https://mc-heads.net/avatar/${item.added_by}/24" 
             alt="${item.added_by}" 
             class="added-by-avatar">
        <div class="meta-info">
          <span class="added-by-text">Hinzugefügt von: ${item.added_by}</span>
          <span class="added-date">${formatDate(item.created_at)}</span>
        </div>
      </div>
    `;
    
    container.appendChild(itemElement);
  });

  // Statistik aktualisieren
  updateLagerStatistics(items);
  
  } catch (error) {
    console.error('Fehler in loadLagerItems:', error);
    container.innerHTML = '<p class="no-items">Fehler beim Laden: ' + error.message + '</p>';
  }
}

// =========================
// LAGER STATISTIK AKTUALISIEREN
// =========================
async function updateLagerStatistics(items) {
  const statisticsContainer = document.getElementById('lagerStatistics');
  if (!statisticsContainer) return;

  // Item-Kategorien für die Statistik
  const itemCategories = {
    'Erze': ['Diamant', 'Gold', 'Eisen', 'Kohle', 'Kupfer', 'Lapislazuli', 'Redstone', 'Smaragd', 'Netherit', 'Quarz'],
    'Blöcke': ['Block', 'Holz', 'Stein', 'Erde', 'Sand', 'Kies', 'Glas', 'Beton', 'Wolle', 'Terra'],
    'Werkzeuge': ['Axt', 'Spitzhacke', 'Schaufel', 'Hacke', 'Schwert', 'Bogen', 'Armbrust'],
    'Rüstung': ['Helm', 'Brustpanzer', 'Hose', 'Stiefel', 'Rüstung'],
    'Nahrung': ['Brot', 'Apfel', 'Karotte', 'Kartoffel', 'Fleisch', 'Fisch', 'Kuchen'],
    'Tränke': ['Trank', 'Potion'],
    'Sonstiges': []
  };

  // Items nach Kategorien zählen und summieren
  const categoryCounts = {};
  const categoryQuantities = {};
  const uncategorizedItems = [];

  items.forEach(item => {
    let categorized = false;
    
    for (const [category, keywords] of Object.entries(itemCategories)) {
      if (category === 'Sonstiges') continue;
      
      if (keywords.some(keyword => item.name.toLowerCase().includes(keyword.toLowerCase()))) {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        categoryQuantities[category] = (categoryQuantities[category] || 0) + item.quantity;
        categorized = true;
        break;
      }
    }
    
    if (!categorized) {
      uncategorizedItems.push(item);
      categoryQuantities['Sonstiges'] = (categoryQuantities['Sonstiges'] || 0) + item.quantity;
    }
  });

  if (uncategorizedItems.length > 0) {
    categoryCounts['Sonstiges'] = uncategorizedItems.length;
  }

  // Gesamtmenge berechnen
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Statistik-HTML erstellen
  let statisticsHTML = '<div class="statistics-grid">';
  
  for (const [category, count] of Object.entries(categoryCounts)) {
    const quantity = categoryQuantities[category] || 0;
    const percentage = totalQuantity > 0 ? Math.round((quantity / totalQuantity) * 100) : 0;
    const stacks = Math.floor(quantity / 64);
    
    statisticsHTML += `
      <div class="stat-item">
        <div class="stat-category">${category}</div>
        <div class="stat-count">${quantity.toLocaleString()} Stück</div>
        <div class="stat-stacks">${stacks} × 64 Stacks</div>
        <div class="stat-percentage">${percentage}%</div>
        <div class="stat-bar">
          <div class="stat-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }
  
  statisticsHTML += '</div>';
  
  // Gesamtstatistik hinzufügen
  const totalStacks = Math.floor(totalQuantity / 64);
  statisticsHTML += `
    <div class="total-statistics">
      <div class="total-item">
        <span class="total-label">Gesamtanzahl Items:</span>
        <span class="total-value">${items.length}</span>
      </div>
      <div class="total-item">
        <span class="total-label">Gesamtmenge:</span>
        <span class="total-value">${totalQuantity.toLocaleString()} Stück</span>
      </div>
      <div class="total-item">
        <span class="total-label">Gesamtstacks:</span>
        <span class="total-value">${totalStacks} × 64</span>
      </div>
      <div class="total-item">
        <span class="total-label">Kategorien:</span>
        <span class="total-value">${Object.keys(categoryCounts).length}</span>
      </div>
    </div>
  `;

  statisticsContainer.innerHTML = statisticsHTML;
}

// =========================
// LAGER ITEM HINZUFÜGEN
// =========================
async function addLagerItem(event) {
  event.preventDefault();
  
  const itemSelect = document.getElementById('lagerItemSelect');
  const customItemName = document.getElementById('lagerItemName').value.trim();
  const quantityInput = document.getElementById('lagerItemQuantity');
  
  let itemName = '';
  
  // Prüfen ob Dropdown oder Custom-Input verwendet wird
  if (itemSelect.value === 'custom') {
    itemName = customItemName;
  } else {
    itemName = itemSelect.value;
  }
  
  // Anzahl berechnen
  let quantity = parseInt(quantityInput.value) || 1;
  
  // Wenn Anzahl 1 ist, automatisch auf 64 setzen (für Blöcke/Items)
  if (quantity === 1) {
    quantity = 64;
  }
  
  if (!itemName) {
    showMessage('Bitte wähle ein Item aus oder gib ein eigenes Item ein.', 'error');
    return;
  }
  
  if (quantity < 1 || quantity > 999999) {
    showMessage('Bitte gib eine gültige Anzahl zwischen 1 und 999.999 ein.', 'error');
    return;
  }
  
  try {
    const timestamp = Date.now();
    const uniqueKey = `lager_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Debug-Informationen ausgeben
    console.log('Versuche Item hinzuzufügen:', {
      key: uniqueKey,
      name: itemName,
      quantity: quantity,
      added_by: CURRENT_MC_NAME
      // user_id wird nicht verwendet, da team_lager_items diese Spalte nicht hat
    });
    
    const { data, error } = await window.supabaseClient
      .from('team_lager_items')
      .insert([
        {
          key: uniqueKey,
          name: itemName,
          quantity: quantity,
          added_by: CURRENT_MC_NAME
        }
      ]);
    
    if (error) {
      console.error('Fehler beim Hinzufügen des Lager-Items:', error);
      console.error('Fehler-Details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Bessere Fehlermeldung für Benutzer
      const errorMessage = error.message || 'Unbekannter Fehler';
      showLagerMessage(`Fehler beim Hinzufügen: ${errorMessage}`, 'error');
      return;
    }
    
    console.log('Item erfolgreich hinzugefügt:', data);
    
    // Stack-Informationen für die Nachricht
    const stacks = Math.floor(quantity / 64);
    const remainder = quantity % 64;
    let quantityText = `${quantity.toLocaleString()} Stück`;
    if (stacks > 0) {
      quantityText += ` (${stacks} × 64`;
      if (remainder > 0) {
        quantityText += ` + ${remainder}`;
      }
      quantityText += ')';
    }
    
    showMessage(`Item "${itemName}" mit ${quantityText} wurde erfolgreich zum Lager hinzugefügt!`, 'success');
    
    // Notification für andere
    if (window.showTeamNotification && CURRENT_MC_NAME) {
      window.showTeamNotification(
        CURRENT_MC_NAME, 
        `${CURRENT_MC_NAME} hat ${itemName} (${quantityText}) zum Lager hinzugefügt`, 
        'info'
      );
    }
    
    // Formular zurücksetzen
    itemSelect.value = '';
    document.getElementById('customItemGroup').style.display = 'none';
    document.getElementById('lagerItemName').value = '';
    quantityInput.value = '1';
    updateQuantityInfo(1);
    
    setTimeout(() => {
      hideAddLagerItemModal();
      loadLagerItems();
    }, 1500);
    
  } catch (error) {
    console.error('Unerwarteter Fehler beim Hinzufügen des Lager-Items:', error);
    showMessage('Ein unerwarteter Fehler ist aufgetreten.', 'error');
  }
}

// =========================
// LAGER ITEM ENTFERNEN
// =========================
async function removeLagerItem(itemId, itemName) {
  try {
    const { error } = await window.supabaseClient
      .from("team_lager_items")
      .delete()
      .eq("id", itemId);
    
    if (error) {
      console.error("Fehler beim Entfernen des Lager-Items:", error);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error("Fehler beim Entfernen des Lager-Items:", error);
    return false;
  }
}

// =========================
// MODALE FUNKTIONEN
// =========================
function showAddLagerItemModal() {
  const modal = document.getElementById('addLagerItemModal');
  if (modal) {
    modal.style.display = 'flex';
    
    const form = document.getElementById('addLagerItemForm');
    if (form) {
      form.reset();
    }
    
    // Item-Dropdown füllen
    populateItemDropdown();
  }
}

// =========================
// ITEM DROPDOWN FÜLLEN
// =========================
function populateItemDropdown() {
  const itemSelect = document.getElementById('lagerItemSelect');
  if (!itemSelect) return;
  
  // Vordefinierte Items für Minecraft
  const predefinedItems = [
    // Erze
    'Diamant', 'Goldbarren', 'Eisenbarren', 'Kohle', 'Kupferbarren', 'Lapislazuli', 'Redstone', 'Smaragd', 'Netheritbarren', 'Quarz',
    // Blöcke
    'Diamantblock', 'Goldblock', 'Eisenblock', 'Stein', 'Holzbretter', 'Erde', 'Sand', 'Kies', 'Glas', 'Beton', 'Wolle',
    // Werkzeuge
    'Diamantspitzhacke', 'Diamantaxt', 'Diamantschwert', 'Diamantschaufel', 'Goldspitzhacke', 'Eisenspitzhacke', 'Steinspitzhacke',
    // Rüstung
    'Diamanthelm', 'Diamantbrustpanzer', 'Diamanthose', 'Diamantstiefel', 'Goldhelm', 'Eisenhelm',
    // Nahrung
    'Brot', 'Apfel', 'Goldener Apfel', 'Karotte', 'Gebratene Kartoffel', 'Rohes Fleisch', 'Gebratenes Fleisch', 'Fisch', 'Kuchen',
    // Tränke
    'Heiltrank', 'Stärketrank', 'Geschwindigkeitstrank', 'Feuerresistenztrank',
    // Sonstiges
    'Enderperle', 'Leuchtstein', 'Knochenmehl', 'Pfeil', 'Bogen', 'Armbrust', 'Schild', 'Eimer', 'Sattel'
  ];
  
  // Dropdown leeren und füllen
  itemSelect.innerHTML = '<option value="">-- Bitte wähle ein Item --</option>';
  
  // Items nach Kategorie gruppieren
  const categories = {
    'Erze': ['Diamant', 'Goldbarren', 'Eisenbarren', 'Kohle', 'Kupferbarren', 'Lapislazuli', 'Redstone', 'Smaragd', 'Netheritbarren', 'Quarz'],
    'Blöcke': ['Diamantblock', 'Goldblock', 'Eisenblock', 'Stein', 'Holzbretter', 'Erde', 'Sand', 'Kies', 'Glas', 'Beton', 'Wolle'],
    'Werkzeuge': ['Diamantspitzhacke', 'Diamantaxt', 'Diamantschwert', 'Diamantschaufel', 'Goldspitzhacke', 'Eisenspitzhacke', 'Steinspitzhacke'],
    'Rüstung': ['Diamanthelm', 'Diamantbrustpanzer', 'Diamanthose', 'Diamantstiefel', 'Goldhelm', 'Eisenhelm'],
    'Nahrung': ['Brot', 'Apfel', 'Goldener Apfel', 'Karotte', 'Gebratene Kartoffel', 'Rohes Fleisch', 'Gebratenes Fleisch', 'Fisch', 'Kuchen'],
    'Tränke': ['Heiltrank', 'Stärketrank', 'Geschwindigkeitstrank', 'Feuerresistenztrank'],
    'Sonstiges': ['Enderperle', 'Leuchtstein', 'Knochenmehl', 'Pfeil', 'Bogen', 'Armbrust', 'Schild', 'Eimer', 'Sattel']
  };
  
  // Optionen mit Optgroups erstellen
  for (const [category, items] of Object.entries(categories)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;
    
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item;
      option.textContent = item;
      optgroup.appendChild(option);
    });
    
    itemSelect.appendChild(optgroup);
  }
  
  // Option für eigenes Item hinzufügen
  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = '➕ Eigenes Item hinzufügen';
  itemSelect.appendChild(customOption);
  
  // Event Listener für Dropdown-Änderungen
  itemSelect.addEventListener('change', handleItemSelectChange);
}

// =========================
// ITEM SELECT CHANGE HANDLER
// =========================
function handleItemSelectChange(event) {
  const select = event.target;
  const customItemGroup = document.getElementById('customItemGroup');
  const customItemInput = document.getElementById('lagerItemName');
  
  if (select.value === 'custom') {
    customItemGroup.style.display = 'block';
    customItemInput.required = true;
    customItemInput.focus();
  } else {
    customItemGroup.style.display = 'none';
    customItemInput.required = false;
    customItemInput.value = '';
  }
}

// =========================
// QUANTITY INFO UPDATE
// =========================
function updateQuantityInfo(quantity) {
  const quantityInfo = document.getElementById('quantityInfo');
  const stackInfo = document.getElementById('stackInfo');
  
  if (!quantityInfo || !stackInfo) return;
  
  const actualQuantity = quantity === 1 ? 64 : quantity;
  const stacks = Math.floor(actualQuantity / 64);
  const remainder = actualQuantity % 64;
  
  if (quantity === 1) {
    quantityInfo.textContent = '1 Stück = 64 Stück (Auto-Stack)';
  } else {
    quantityInfo.textContent = `${quantity} Stück = ${actualQuantity.toLocaleString()} Stück`;
  }
  
  if (stacks > 0) {
    stackInfo.textContent = `Stacks: ${stacks} × 64${remainder > 0 ? ` + ${remainder}` : ''}`;
  } else {
    stackInfo.textContent = 'Stacks: 0 × 64';
  }
}

function hideAddLagerItemModal() {
  const modal = document.getElementById('addLagerItemModal');
  if (modal) {
    modal.style.display = 'none';
    
    const messages = modal.querySelectorAll('.message');
    messages.forEach(msg => msg.remove());
  }
}

// =========================
// NACHRICHT ANZEIGEN
// =========================
function showMessage(text, type) {
  const modalBody = document.querySelector('.modal-body');
  if (!modalBody) return;
  
  const existingMessages = modalBody.querySelectorAll('.message');
  existingMessages.forEach(msg => msg.remove());
  
  const message = document.createElement('div');
  message.className = `message ${type}`;
  message.textContent = text;
  
  const form = document.getElementById('addLagerItemForm');
  if (form) {
    form.appendChild(message);
  }
}

// =========================
// BENACHRICHTIGUNG ANZEIGEN
// =========================
function showNotification(message, type) {
  const existingNotification = document.querySelector('.item-notification');
  if (existingNotification) existingNotification.remove();
  
  const notification = document.createElement('div');
  notification.className = `item-notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 10px;
    background: ${type === 'success' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)'};
    color: white;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// =========================
// MODALE BESTÄTIGUNG FÜR LAGER-ITEM-ENTFERNUNG
// =========================
function showDeleteLagerConfirmation(itemId, itemName) {
  showConfirmModal(
    'Lager-Item entfernen',
    `Möchtest du das Item "${itemName}" wirklich aus dem Lager entfernen? Diese Aktion kann nicht rückgängig gemacht werden.`,
    'Ja, entfernen',
    'Abbrechen',
    async () => {
      const success = await removeLagerItem(itemId, itemName);
      
      if (success) {
        showNotification(`Item "${itemName}" wurde erfolgreich aus dem Lager entfernt.`, 'success');
        
        // Notification für andere
        if (window.showTeamNotification && CURRENT_MC_NAME) {
          window.showTeamNotification(
            CURRENT_MC_NAME, 
            `${CURRENT_MC_NAME} hat ${itemName} aus dem Lager entfernt`, 
            'info'
          );
        }
        
        setTimeout(() => {
          loadLagerItems();
        }, 500);
      } else {
        showNotification('Fehler beim Entfernen des Items.', 'error');
      }
    }
  );
}

// =========================
// BESTÄTIGUNGS-MODAL
// =========================
function showConfirmModal(title, message, confirmText, cancelText, onConfirm) {
  let modal = document.getElementById('confirmModal');
  let overlay = document.getElementById('confirmOverlay');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'confirm-modal';
    modal.innerHTML = `
      <div class="confirm-modal-content">
        <h3 class="confirm-modal-title"></h3>
        <div class="confirm-modal-message"></div>
        <div class="confirm-modal-actions">
          <button class="confirm-btn cancel-btn"></button>
          <button class="confirm-btn confirm-btn-primary"></button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confirmOverlay';
    overlay.className = 'confirm-overlay';
    document.body.appendChild(overlay);
  }
  
  modal.querySelector('.confirm-modal-title').textContent = title;
  modal.querySelector('.confirm-modal-message').textContent = message;
  modal.querySelector('.cancel-btn').textContent = cancelText || 'Abbrechen';
  modal.querySelector('.confirm-btn-primary').textContent = confirmText || 'Bestätigen';
  
  const confirmBtn = modal.querySelector('.confirm-btn-primary');
  const cancelBtn = modal.querySelector('.cancel-btn');
  
  const closeModal = () => {
    modal.style.display = 'none';
    overlay.style.display = 'none';
  };
  
  const confirmHandler = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
  
  const cancelHandler = () => {
    closeModal();
  };
  
  confirmBtn.replaceWith(confirmBtn.cloneNode(true));
  cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  
  modal.querySelector('.confirm-btn-primary').addEventListener('click', confirmHandler);
  modal.querySelector('.cancel-btn').addEventListener('click', cancelHandler);
  overlay.addEventListener('click', cancelHandler);
  
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      cancelHandler();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  modal.style.display = 'block';
  overlay.style.display = 'block';
}

// =========================
// AKTIVE FILTER ANZEIGEN
// =========================
function updateActiveFilters() {
  const activeFilters = document.getElementById('lagerActiveFilters');
  const filterTags = document.getElementById('lagerFilterTags');
  
  if (!activeFilters || !filterTags) return;
  
  const filters = [];
  
  if (SEARCH_TERM) {
    filters.push({
      type: 'search',
      label: `"${SEARCH_TERM}"`,
      icon: '🔍'
    });
  }
  
  if (filters.length > 0) {
    activeFilters.style.display = 'block';
    
    filterTags.innerHTML = filters.map(filter => `
      <div class="filter-tag">
        ${filter.icon.startsWith('http') ? `<img src="${filter.icon}" alt="${filter.label}">` : filter.icon}
        ${filter.label}
      </div>
    `).join('');
  } else {
    activeFilters.style.display = 'none';
  }
}

// =========================
// EVENT LISTENER SETUP
// =========================
function setupEventListeners() {
  const searchInput = document.getElementById('lagerSearchInput');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        SEARCH_TERM = e.target.value.trim();
        updateActiveFilters();
        loadLagerItems();
      }, 300);
    });
  }

  const clearSearchBtn = document.getElementById('clearLagerSearchBtn');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      SEARCH_TERM = '';
      if (searchInput) searchInput.value = '';
      updateActiveFilters();
      loadLagerItems();
    });
  }

  const clearFiltersBtn = document.getElementById('clearLagerFiltersBtn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      SEARCH_TERM = '';
      if (searchInput) searchInput.value = '';
      updateActiveFilters();
      loadLagerItems();
    });
  }

  const addItemBtn = document.getElementById('addLagerItemBtn');
  if (addItemBtn) {
    addItemBtn.addEventListener('click', showAddLagerItemModal);
  }
  
  const closeModalBtn = document.getElementById('closeLagerModalBtn');
  const cancelModalBtn = document.getElementById('cancelLagerModalBtn');
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', hideAddLagerItemModal);
  }
  
  if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', hideAddLagerItemModal);
  }
  
  const addItemForm = document.getElementById('addLagerItemForm');
  if (addItemForm) {
    addItemForm.addEventListener('submit', addLagerItem);
  }
  
  const modalOverlay = document.getElementById('addLagerItemModal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        hideAddLagerItemModal();
      }
    });
  }
  
  // Quantity Input Event Listener
  const quantityInput = document.getElementById('lagerItemQuantity');
  if (quantityInput) {
    quantityInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value) || 1;
      updateQuantityInfo(value);
    });
    
    quantityInput.addEventListener('focus', () => {
      updateQuantityInfo(parseInt(quantityInput.value) || 1);
    });
  }
}

// =========================
// CLICK HANDLER
// =========================
document.addEventListener("click", async (e) => {
  // 🗑️ Lager-Item entfernen
  const deleteBtn = e.target.closest(".remove-lager-item-btn");
  if (deleteBtn) {
    e.stopPropagation();
    
    const itemElement = deleteBtn.closest('.lager-item');
    const itemId = itemElement.dataset.id;
    const itemName = itemElement.dataset.name || itemElement.querySelector('.lager-item-name').textContent;
    
    showDeleteLagerConfirmation(itemId, itemName);
    return;
  }
});

// =========================
// CSS FÜR LAGER-SEITE HINZUFÜGEN
// =========================
function addLagerStyles() {
  if (!document.getElementById('lager-styles')) {
    const style = document.createElement('style');
    style.id = 'lager-styles';
    style.textContent = `
      /* Lager-seitenspezifische Styles */
      .lager-page {
        max-width: 1400px;
        margin: 30px auto;
        padding: 30px 34px;
        background: rgba(15, 15, 15, 0.88);
        backdrop-filter: blur(10px);
        border-radius: 20px;
      }

      .lager-content-wrapper {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 30px;
        margin-top: 20px;
      }

      .lager-main-content {
        min-width: 0;
      }

      .lager-statistics {
        background: rgba(20, 20, 20, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 20px;
        backdrop-filter: blur(10px);
        height: fit-content;
        position: sticky;
        top: 30px;
      }

      .statistics-header {
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .statistics-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #fff;
      }

      .statistics-grid {
        display: flex;
        flex-direction: column;
        gap: 15px;
        margin-bottom: 20px;
      }

      .stat-item {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 12px;
      }

      .stat-category {
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 4px;
      }

      .stat-count {
        font-size: 16px;
        font-weight: 700;
        color: #4CAF50;
        margin-bottom: 4px;
      }

      .stat-percentage {
        font-size: 12px;
        color: #999;
        margin-bottom: 8px;
      }

      .stat-bar {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
      }

      .stat-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #4CAF50, #45a049);
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      .total-statistics {
        padding-top: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .total-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .total-label {
        font-size: 13px;
        color: #ccc;
      }

      .total-value {
        font-size: 14px;
        font-weight: 600;
        color: #fff;
      }

      .lager-items-grid {
        margin-top: 20px;
      }

      .lager-item {
        background: #141414;
        border: 1px solid #1f1f1f;
        border-radius: 12px;
        padding: 16px;
        position: relative;
        transition: all 0.2s ease;
      }

      .lager-item:hover {
        background: #1a1a1a;
        border-color: #333;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .lager-item-name {
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
        margin-bottom: 12px;
        color: #fff;
      }

      .lager-item-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #999;
      }

      .added-by-avatar {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        flex-shrink: 0;
      }

      .added-by-text {
        line-height: 1.3;
        display: block;
        margin-bottom: 2px;
      }

      .added-date {
        font-size: 11px;
        color: #666;
        font-style: italic;
      }

      .meta-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .remove-lager-item-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        background: rgba(220, 53, 69, 0.1);
        border: 1px solid rgba(220, 53, 69, 0.3);
        border-radius: 50%;
        color: #dc3545;
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        opacity: 0.7;
        transition: all 0.2s;
        z-index: 10;
      }

      .remove-lager-item-btn:hover {
        opacity: 1;
        background: rgba(220, 53, 69, 0.2);
        border-color: #dc3545;
        transform: scale(1.1);
      }

      .lager-item:hover .remove-lager-item-btn {
        opacity: 1;
      }

      .item-highlight {
        background: linear-gradient(90deg, rgba(76, 175, 80, 0.2), transparent);
        padding: 2px 4px;
        border-radius: 4px;
      }

      .no-items {
        text-align: center;
        padding: 40px;
        font-size: 16px;
        color: #999;
        font-style: italic;
      }

      /* Modal Styles für Lager */
      .owner-info {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        margin-bottom: 16px;
      }

      .current-user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 6px;
      }

      .lager-item-select {
        width: 100%;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        background: rgba(20, 20, 20, 0.9);
        color: #fff;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .lager-item-select:focus {
        outline: none;
        border-color: #4CAF50;
        box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
      }

      .lager-item-select option {
        background: #1a1a1a;
        color: #fff;
        padding: 8px;
      }

      .lager-item-select optgroup {
        background: #2a2a2a;
        color: #4CAF50;
        font-weight: 600;
        padding: 4px 8px;
      }

      .quantity-input-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .lager-quantity-input {
        width: 100%;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        background: rgba(20, 20, 20, 0.9);
        color: #fff;
        font-size: 14px;
        transition: all 0.2s ease;
      }

      .lager-quantity-input:focus {
        outline: none;
        border-color: #4CAF50;
        box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
      }

      .quantity-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 12px;
        background: rgba(76, 175, 80, 0.1);
        border: 1px solid rgba(76, 175, 80, 0.2);
        border-radius: 6px;
      }

      .quantity-info small {
        font-size: 12px;
        color: #4CAF50;
        font-weight: 500;
      }

      .lager-item-quantity {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 12px;
        padding: 8px;
        background: rgba(76, 175, 80, 0.1);
        border: 1px solid rgba(76, 175, 80, 0.2);
        border-radius: 6px;
      }

      .quantity-badge {
        font-size: 14px;
        font-weight: 700;
        color: #4CAF50;
        display: block;
      }

      .stack-badge {
        font-size: 12px;
        color: #2196F3;
        font-weight: 600;
      }

      .remainder-badge {
        font-size: 11px;
        color: #FF9800;
        font-weight: 600;
      }

      .stat-stacks {
        font-size: 13px;
        color: #2196F3;
        font-weight: 600;
        margin-bottom: 4px;
      }

      /* Bestätigungs-Modal */
      .confirm-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        display: none;
      }
      
      .confirm-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 25px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        min-width: 350px;
        max-width: 90%;
        display: none;
      }
      
      .confirm-modal-content {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .confirm-modal-title {
        margin: 0;
        font-size: 20px;
        color: #333;
        font-weight: 600;
      }
      
      .confirm-modal-message {
        color: #555;
        font-size: 15px;
        line-height: 1.5;
      }
      
      .confirm-modal-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 10px;
      }
      
      .confirm-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
      }
      
      .confirm-btn.cancel-btn {
        background: #f0f0f0;
        color: #555;
      }
      
      .confirm-btn.cancel-btn:hover {
        background: #e0e0e0;
      }
      
      .confirm-btn.confirm-btn-primary {
        background: #4CAF50;
        color: white;
      }
      
      .confirm-btn.confirm-btn-primary:hover {
        background: #45a049;
      }

      /* Animationen */
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      /* Login-Overlay Styles */
      .login-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: url("background.png") center / cover no-repeat;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }

      .login-overlay-content {
        background: rgba(15, 15, 15, 0.9);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        padding: 40px 30px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        max-width: 400px;
        width: 90%;
      }

      .login-logo {
        width: 180px;
        margin-bottom: 20px;
      }

      .login-overlay-content h2 {
        margin: 0 0 15px 0;
        font-size: 24px;
        font-weight: 600;
        color: #fff;
      }

      .login-overlay-content p {
        margin: 0 0 25px 0;
        font-size: 16px;
        color: #ccc;
        line-height: 1.5;
      }

      .login-btn {
        background: #4caf50;
        color: white;
        border: none;
        padding: 14px 28px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .login-btn:hover {
        background: #45a049;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
      }

      /* Responsive Design */
      @media (max-width: 1024px) {
        .lager-content-wrapper {
          grid-template-columns: 1fr;
          gap: 20px;
        }
        
        .lager-statistics {
          position: static;
          order: -1;
        }
      }

      @media (max-width: 768px) {
        .lager-items-grid {
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }
        
        .lager-item {
          padding: 12px;
        }
        
        .lager-page {
          padding: 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  addLagerStyles();
  await loadProfile();
  setupEventListeners();
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideAddLagerItemModal();
    }
  });
});
