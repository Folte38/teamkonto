// =========================
// LOGIN CHECK & SEITEN-WECHSEL
// =========================
window.supabaseClient.auth.getSession().then(({ data }) => {
  if (!data.session) {
    // Nicht eingeloggt -> Login-Seite anzeigen
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  } else {
    // Eingeloggt -> Hauptinhalt anzeigen
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    loadProfile();
  }
});

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

// =========================
// PROFIL & NAV
// =========================
async function loadProfile() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) return;

  CURRENT_USER_ID = user.id;

  const { data: profile } = await window.supabaseClient
    .from("profiles")
    .select("mc_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  CURRENT_MC_NAME = profile.mc_name;
  IS_ADMIN = profile.role === "admin";

  const navUser = document.getElementById("navUser");
  if (navUser) {
    document.getElementById("navUsername").innerText = profile.mc_name;
    document.getElementById("navAvatar").src =
      `https://mc-heads.net/avatar/${profile.mc_name}/64`;
    navUser.style.display = "flex";
  }

  // Lager-spezifische Elemente aktualisieren
  const currentUserAvatar = document.getElementById("currentUserAvatar");
  const currentUserName = document.getElementById("currentUserName");
  
  if (currentUserAvatar) {
    currentUserAvatar.src = `https://mc-heads.net/avatar/${profile.mc_name}/32`;
  }
  if (currentUserName) {
    currentUserName.textContent = profile.mc_name;
  }

  loadLagerItems();
}

// =========================
// LAGER ITEMS LADEN
// =========================
async function loadLagerItems() {
  const container = document.getElementById("lagerItems");
  if (!container) return;

  let { data: items } = await window.supabaseClient
    .from("team_lager_items")
    .select("id, name, added_by, created_at")
    .order("created_at", { ascending: false });

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
    
    itemElement.innerHTML = `
      <button class="remove-lager-item-btn" title="Item entfernen">×</button>
      <div class="lager-item-name ${isHighlighted ? 'item-highlight' : ''}">${item.name}</div>
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
    
    itemsGrid.appendChild(itemElement);
  });

  container.appendChild(itemsGrid);
}

// =========================
// LAGER ITEM HINZUFÜGEN
// =========================
async function addLagerItem(event) {
  event.preventDefault();
  
  const itemName = document.getElementById('lagerItemName').value.trim();
  
  if (!itemName) {
    showMessage('Bitte gib einen Item-Namen ein.', 'error');
    return;
  }
  
  try {
    const timestamp = Date.now();
    const uniqueKey = `lager_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data, error } = await window.supabaseClient
      .from('team_lager_items')
      .insert([
        {
          key: uniqueKey,
          name: itemName,
          added_by: CURRENT_MC_NAME
        }
      ]);
    
    if (error) {
      console.error('Fehler beim Hinzufügen des Lager-Items:', error);
      showMessage('Fehler beim Hinzufügen des Items: ' + error.message, 'error');
      return;
    }
    
    showMessage(`Item "${itemName}" wurde erfolgreich zum Lager hinzugefügt!`, 'success');
    
    // Notification für andere
    if (window.showTeamNotification && CURRENT_MC_NAME) {
      window.showTeamNotification(
        CURRENT_MC_NAME, 
        `${CURRENT_MC_NAME} hat ${itemName} zum Lager hinzugefügt`, 
        'info'
      );
    }
    
    document.getElementById('lagerItemName').value = '';
    
    setTimeout(() => {
      hideAddLagerItemModal();
      loadLagerItems();
    }, 1500);
    
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Lager-Items:', error);
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
        max-width: 1200px;
        margin: 30px auto;
        padding: 30px 34px;
        background: rgba(15, 15, 15, 0.88);
        backdrop-filter: blur(10px);
        border-radius: 20px;
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
      @media (max-width: 768px) {
        .lager-items-grid {
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }
        
        .lager-item {
          padding: 12px;
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
