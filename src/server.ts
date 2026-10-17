import { API } from "../supabase/functions/_shared/config/constants.ts";
import { env } from "../supabase/functions/_shared/config/env.ts";
import { createApp } from "../supabase/functions/_shared/app.ts";

/**
 * Servidor de desarrollo local: `npm run dev`
 *
 * Expone la misma API que la Edge Function de Supabase, pero en la LAN
 * (`http://<IP>:3000/api/v1`) para que la app Expo la consuma sin desplegar nada.
 */
const app = createApp();

function localAddresses(port: number): string[] {
  const addresses: string[] = [`http://localhost:${port}${API.basePath}`];

  try {
    for (const entry of Deno.networkInterfaces()) {
      if (entry.family === "IPv4" && !entry.address.startsWith("127.")) {
        addresses.push(`http://${entry.address}:${port}${API.basePath}`);
      }
    }
  } catch {
    // Entornos sin acceso a interfaces de red: solo localhost.
  }

  return addresses;
}

Deno.serve(
  {
    port: env.port,
    hostname: "0.0.0.0",
    onListen: ({ port }) => {
      const banner = [
        "",
        "  ╔══════════════════════════════════════════════════════════╗",
        "  ║   BioRed API · Bio-Nodos Barriales de Managua (UCT-3)    ║",
        "  ╚══════════════════════════════════════════════════════════╝",
        "",
        `  Modo de datos : ${
          env.mode === "postgres" ? "Supabase Postgres" : "MEMORIA (demo sin credenciales)"
        }`,
        `  Puerto        : ${port}`,
        "",
        "  Endpoints disponibles:",
        ...localAddresses(port).map((address) => `    · ${address}`),
        "",
        "  Prueba rápida:",
        `    curl ${localAddresses(port).at(-1)}/nodes`,
        "",
      ].join("\n");

      console.log(banner);
    },
  },
  (request) => app.fetch(request),
);
