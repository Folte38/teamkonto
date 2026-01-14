console.log("supabase.js geladen"); // DEBUG

const SUPABASE_URL = "https://izravhoqrmyqpltcoldx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cmF2aG9xcm15cXBsdGNvbGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNTkxMjQsImV4cCI6MjA4MzczNTEyNH0.tIawkLW4zB8OgFIUO1t6sQqsYru5XRKZR8Un_BN7Zf0";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);