// Abrir WhatsApp o el menú Compartir del celular con un mensaje ya escrito.
// Nada se envía solo: la persona siempre ve el mensaje y toca "Enviar" en WhatsApp.

// Con número ('569XXXXXXXX') abre el chat de esa persona.
// Sin número, WhatsApp pregunta a quién enviarlo.
export function abrirWhatsApp(texto, numero = '') {
  const enlace = document.createElement('a');
  enlace.href = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  enlace.target = '_blank';
  enlace.rel = 'noopener';
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
}

// Abre el menú Compartir (WhatsApp, estados, grupos, otras apps).
// Si el celular no lo tiene, abre WhatsApp. Devuelve 'compartido', 'cancelado' o 'whatsapp'.
export async function compartirTexto(texto) {
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return 'compartido';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelado';
    }
  }
  abrirWhatsApp(texto);
  return 'whatsapp';
}
