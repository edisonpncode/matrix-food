/**
 * Destrava o AudioContext silenciosamente na primeira interação do
 * usuário. Browsers (Chrome/Firefox/Safari) bloqueiam reprodução de
 * áudio antes de qualquer gesto — esta lib usa o próximo clique/keydown
 * que o atendente já vai fazer naturalmente para liberar o contexto,
 * sem mostrar aviso visível.
 *
 * Uso:
 *   const ctx = ensureUnlockedAudioContext();
 *   if (ctx.state === "running") playBeep(ctx);
 *
 * Idempotente: chamar várias vezes não cria múltiplos contextos.
 */

type WindowWithLegacyAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let sharedCtx: AudioContext | null = null;
let unlockListenerAttached = false;

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as WindowWithLegacyAudio;
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function ensureUnlockedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;

  if (!sharedCtx) {
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }

  if (sharedCtx.state === "running") return sharedCtx;

  if (!unlockListenerAttached) {
    unlockListenerAttached = true;
    const handler = () => {
      const ctx = sharedCtx;
      if (!ctx) return;
      if (ctx.state !== "running") {
        ctx.resume().catch(() => {
          // ignora — próxima interação tenta de novo
        });
      }
    };
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", handler, opts);
    window.addEventListener("keydown", handler, opts);
    window.addEventListener("touchstart", handler, opts);
  }

  return sharedCtx;
}

/**
 * Toca um beep curto. Sem efeito se o contexto ainda não foi destravado.
 */
export function playBeep(opts?: {
  frequency?: number;
  durationMs?: number;
  volume?: number;
}): void {
  const ctx = ensureUnlockedAudioContext();
  if (!ctx || ctx.state !== "running") return;

  const frequency = opts?.frequency ?? 880;
  const durationMs = opts?.durationMs ?? 250;
  const volume = opts?.volume ?? 0.35;

  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    // Envelope simples para evitar clique no início/fim
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000 + 0.05);
  } catch {
    // Ignora — falhas pontuais não devem quebrar a UI
  }
}

/**
 * Toca sequência de 2 beeps com tom mais alto, característico de
 * pedido novo. Padrão sonoro distinto para que o atendente reconheça.
 */
export function playNewOrderChime(): void {
  const ctx = ensureUnlockedAudioContext();
  if (!ctx || ctx.state !== "running") return;
  playBeep({ frequency: 880, durationMs: 180, volume: 0.4 });
  setTimeout(() => playBeep({ frequency: 1175, durationMs: 220, volume: 0.4 }), 200);
}
