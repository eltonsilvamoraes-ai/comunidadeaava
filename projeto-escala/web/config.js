/* =====================================================================
 * CONFIGURAÇÃO DO SUPABASE
 * Onde achar: Supabase > Settings > API
 *
 *  - URL      = "Project URL"  -> a URL COMPLETA (https://....supabase.co)
 *  - ANON_KEY = "Project API keys" > "anon public"  -> um texto LONGO que
 *               começa com "eyJ..." (clique no botão de copiar ao lado dela)
 *
 * (A anon key pode ficar no frontend — é pública. Quem protege os dados é a
 *  RLS, não o segredo da chave.)
 * ===================================================================== */
window.SUPA_CONFIG = {
  // Já preenchido com o SEU projeto:
  URL: 'https://zkfjyllgewcvlvqyhsyp.supabase.co',

  // COLE AQUI a chave "anon public" (começa com eyJ...):
  ANON_KEY: 'COLE_AQUI_A_ANON_PUBLIC'
};
