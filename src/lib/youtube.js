/* Extrai o ID de 11 caracteres de um link do YouTube (ou aceita o ID direto). */
export function ytId(valor) {
  const v = String(valor ?? '').trim();
  if (!v) return '';

  const m = v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];

  return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : '';
}

export function capaYoutube(id, tamanho = 'hqdefault') {
  return `https://img.youtube.com/vi/${id}/${tamanho}.jpg`;
}

export function linkYoutube(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}
