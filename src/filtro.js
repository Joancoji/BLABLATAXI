// src/filtro.js

// Lista de palabras malsonantes (en minúsculas y sin acentos)
export const PALABRAS_PROHIBIDAS = [
  "puta", "puto", "mierda", "coño", "joder", "gilipollas", "cabron", "cabrón",
  "idiota", "imbecil", "imbécil", "estupido", "estúpido", "pendejo", "verga",
  "chinga", "polla", "culo", "marica", "maricon", "zorra", "perra", "carajo",
  "hostia", "capullo", "subnormal", "retrasado", "bastardo", "follar", "follate",
  "asshole", "shit", "fuck", "bitch", "dick", "pussy", "cunt", "bastard"
];

// Normaliza un texto: minúsculas y sin acentos (para comparar)
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Comprueba si un texto contiene palabras prohibidas
export function contienePalabrasProhibidas(texto) {
  const normalizado = " " + normalizar(texto) + " ";
  return PALABRAS_PROHIBIDAS.some(palabra => {
    const p = normalizar(palabra);
    // Busca la palabra como palabra completa (con espacios o límites)
    const regex = new RegExp(`(^|\\s)${p}(\\s|$|[.,!?])`, "i");
    return regex.test(normalizado);
  });
}

// Sustituye las palabras prohibidas por asteriscos
export function censurarTexto(texto) {
  let resultado = texto;
  PALABRAS_PROHIBIDAS.forEach(palabra => {
    const regex = new RegExp(palabra, "gi");
    resultado = resultado.replace(regex, "*".repeat(palabra.length));
  });
  return resultado;
}