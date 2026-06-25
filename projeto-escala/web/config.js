/* =====================================================================
 * CONFIGURAÇÃO DO SUPABASE
 * Onde achar: Supabase > Settings > API Keys
 *
 *  - URL       = "Project URL"  -> a URL COMPLETA (https://....supabase.co)
 *  - CHAVE     = a "Publishable key" (começa com "sb_publishable_...")
 *                -> é a chave segura para usar no navegador (a RLS protege).
 *                NUNCA use a "Secret key" (sb_secret_...) aqui!
 *
 *  Obs.: em projetos antigos a chave do navegador é a "anon public"
 *  (um JWT que começa com "eyJ..."). Qualquer uma das duas serve aqui.
 * ===================================================================== */
window.SUPA_CONFIG = {
  // Já preenchido com o SEU projeto:
  URL: 'https://zkfjyllgewcvlvqyhsyp.supabase.co',

  // COLE AQUI a "Publishable key" (sb_publishable_...):
  ANON_KEY: 'sb_publishable_XbtD-QLlwQQvbWnRudFgPQ_iTy71oMQ'
};
