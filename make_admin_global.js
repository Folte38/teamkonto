// =========================
// IS_ADMIN GLOBAL FÜR ALLE SEITEN VERFÜGBAR MACHEN
// =========================

// Füge zu script-index.js hinzu (am Ende der Datei):

// Globale Variable für andere Seiten verfügbar machen
window.IS_ADMIN = IS_ADMIN;

// =========================
// ERGEBNIS:
// =========================
/*
Damit können andere Seiten auf die Admin-Variable zugreifen:
- strafkatalog.js: window.IS_ADMIN
- kalender.js: window.IS_ADMIN
- etc.

Alle Seiten können die gleiche Admin-Logik verwenden.
*/
