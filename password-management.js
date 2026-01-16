// Passwort-Management für die Team Kasse
console.log("password-management.js geladen");

class PasswordManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Dropdown-Menü
    const navUserTrigger = document.getElementById('navUserTrigger');
    const navUserDropdown = document.getElementById('navUserDropdown');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    
    // Modal-Elemente
    const passwordModal = document.getElementById('passwordModal');
    const passwordModalOverlay = document.getElementById('passwordModalOverlay');
    const passwordModalClose = document.getElementById('passwordModalClose');
    const passwordCancelBtn = document.getElementById('passwordCancelBtn');
    const passwordForm = document.getElementById('passwordForm');

    // Dropdown öffnen/schließen
    if (navUserTrigger) {
      navUserTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        navUserDropdown.classList.toggle('active');
      });
    }

    // Dropdown schließen wenn man außerhalb klickt
    document.addEventListener('click', (e) => {
      if (!navUserDropdown.contains(e.target)) {
        navUserDropdown.classList.remove('active');
      }
    });

    // Passwort-Modal öffnen
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openPasswordModal();
      });
    }

    // Modal schließen
    const closePasswordModal = () => {
      this.closePasswordModal();
    };

    if (passwordModalClose) {
      passwordModalClose.addEventListener('click', closePasswordModal);
    }
    
    if (passwordModalOverlay) {
      passwordModalOverlay.addEventListener('click', closePasswordModal);
    }
    
    if (passwordCancelBtn) {
      passwordCancelBtn.addEventListener('click', closePasswordModal);
    }

    // Formular absenden
    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handlePasswordChange();
      });
    }

    // ESC-Taste zum Schließen des Modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && passwordModal.style.display === 'block') {
        this.closePasswordModal();
      }
    });
  }

  openPasswordModal() {
    const passwordModal = document.getElementById('passwordModal');
    const passwordModalOverlay = document.getElementById('passwordModalOverlay');
    const navUserDropdown = document.getElementById('navUserDropdown');
    
    // Dropdown schließen
    navUserDropdown.classList.remove('active');
    
    // Modal anzeigen
    passwordModal.style.display = 'block';
    passwordModalOverlay.style.display = 'block';
    
    // Formular zurücksetzen
    this.resetPasswordForm();
    
    // Fokus auf das erste Eingabefeld
    setTimeout(() => {
      document.getElementById('currentPassword').focus();
    }, 100);
  }

  closePasswordModal() {
    const passwordModal = document.getElementById('passwordModal');
    const passwordModalOverlay = document.getElementById('passwordModalOverlay');
    
    passwordModal.style.display = 'none';
    passwordModalOverlay.style.display = 'none';
    
    this.resetPasswordForm();
  }

  resetPasswordForm() {
    const passwordForm = document.getElementById('passwordForm');
    const passwordMessage = document.getElementById('passwordMessage');
    
    if (passwordForm) {
      passwordForm.reset();
    }
    
    if (passwordMessage) {
      passwordMessage.style.display = 'none';
      passwordMessage.className = 'password-message';
    }
  }

  async handlePasswordChange() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const passwordMessage = document.getElementById('passwordMessage');

    // Validierung
    if (!currentPassword || !newPassword || !confirmPassword) {
      this.showPasswordMessage('Bitte alle Felder ausfüllen', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showPasswordMessage('Neue Passwörter stimmen nicht überein', 'error');
      return;
    }

    if (newPassword.length < 6) {
      this.showPasswordMessage('Passwort muss mindestens 6 Zeichen lang sein', 'error');
      return;
    }

    try {
      // Aktuellen Benutzer abrufen
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Benutzer nicht gefunden');
      }

      // Profil aus der Datenbank abrufen
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Profil nicht gefunden');
      }

      // Aktuelles Passwort überprüfen (wird in profiles Tabelle gespeichert)
      if (profile.additional_password && profile.additional_password !== currentPassword) {
        this.showPasswordMessage('Aktuelles Passwort ist falsch', 'error');
        return;
      }

      // Neues Passwort in der Datenbank speichern
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ 
          additional_password: newPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        throw new Error('Fehler beim Speichern des Passworts: ' + updateError.message);
      }

      this.showPasswordMessage('Passwort erfolgreich geändert!', 'success');
      
      // Modal nach 2 Sekunden schließen
      setTimeout(() => {
        this.closePasswordModal();
      }, 2000);

    } catch (error) {
      console.error('Passwort-Änderungsfehler:', error);
      this.showPasswordMessage('Fehler: ' + error.message, 'error');
    }
  }

  showPasswordMessage(message, type) {
    const passwordMessage = document.getElementById('passwordMessage');
    
    passwordMessage.textContent = message;
    passwordMessage.className = `password-message ${type}`;
    passwordMessage.style.display = 'block';
  }
}

// Passwort-Manager initialisieren wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
  window.passwordManager = new PasswordManager();
});

// Export für andere Skripte
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PasswordManager;
}
