// Entrada compatible: utiliza el catálogo revisado, sin direcciones ni coordenadas aproximadas.
// Sin --confirmar muestra el plan; con --confirmar sincroniza y respalda Supabase.
import { actualizarCatalogo } from './actualizar_catalogo_canchas.mjs';

actualizarCatalogo().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
