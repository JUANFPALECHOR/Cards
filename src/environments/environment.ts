/**
 * Configuración pública del cliente. Solo valores aptos para el navegador:
 * la clave publicable no es secreta; la protección de los datos depende de RLS en Supabase.
 * Nunca añadir aquí la clave service_role ni contraseñas de PostgreSQL.
 */
export const environment = {
  supabaseUrl: 'https://bsdcswwsspidnhsfuxei.supabase.co',
  supabaseKey: 'sb_publishable_cV4DjGNPqlLf1KIwAngnsg_cA3nkgcn',
};
