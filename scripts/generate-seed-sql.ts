import {
  SEED_BATCHES,
  SEED_NODES,
  SEED_NURSERY_ITEMS,
  SEED_POSTS,
  SEED_REDEMPTIONS,
  SEED_TICKETS,
  SEED_USERS,
} from "../supabase/functions/_shared/data/seed.ts";

/**
 * Genera `supabase/migrations/*_seed.sql` a partir de `data/seed.ts`.
 *
 * Así el modo demo (memoria) y Postgres comparten una única fuente de verdad,
 * incluidas las salidas del motor UCT-3 calculadas con el código real.
 *
 *   npm run seed:sql
 */

const quote = (value: unknown): string => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const isoTimestamp = (iso: string): string => `'${iso}'::timestamptz`;

/** Días transcurridos desde hoy hasta la fecha del registro (para `now() - interval`). */
function daysAgoExpression(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000);
  return `now() - interval '${days.toFixed(3)} days'`;
}

const lines: string[] = [];

lines.push(`-- ---------------------------------------------------------------------------`);
lines.push(`-- BioRed · Datos semilla de Managua (generado por scripts/generate-seed-sql.ts)`);
lines.push(`-- No editar a mano: ejecuta \`npm run seed:sql\` para regenerarlo.`);
lines.push(`-- ---------------------------------------------------------------------------`);
lines.push("");
lines.push("-- Usuarios (vecinos, brigadas, operario UCT-3 y administración municipal)");
lines.push(
  "insert into public.users (id, name, role, district, avatar_url, eco_points, total_kg_delivered) values",
);
lines.push(
  SEED_USERS.map((user) =>
    `  (${quote(user.id)}, ${quote(user.name)}, ${quote(user.role)}::public.user_role, ${
      quote(user.district)
    }, ${quote(user.avatarUrl)}, ${user.ecoPoints}, ${user.totalKgDelivered})`
  ).join(",\n") + ";",
);
lines.push("");
lines.push("-- Los 4 Bio-Nodos estratégicos de Managua");
lines.push(
  "insert into public.bio_nodes (id, name, district, address, latitude, longitude, capacity_ton_day, current_load_percent, status, available_mulch_kg, available_compost_kg, available_bio_pots, blade_hours_used, coordinator, phone, operating_hours) values",
);
lines.push(
  SEED_NODES.map((node) =>
    `  (${quote(node.id)}, ${quote(node.name)}, ${quote(node.district)}, ${
      quote(node.address)
    }, ${node.latitude}, ${node.longitude}, ${node.capacityTonDay}, ${node.currentLoadPercent}, ${
      quote(node.status)
    }::public.node_status, ${node.availableMulchKg}, ${node.availableCompostKg}, ${node.availableBioPots}, ${node.bladeHoursUsed}, ${
      quote(node.coordinator)
    }, ${quote(node.phone)}, ${quote(node.operatingHours)})`
  ).join(",\n") + ";",
);
lines.push("");
lines.push('-- "Hoy en Viveros": insumos canjeables con Eco-Puntos');
lines.push(
  "insert into public.nursery_items (id, node_id, provider_name, provider_avatar, title, description, category, points_cost, branches_kg_required, stock, image_url) values",
);
lines.push(
  SEED_NURSERY_ITEMS.map((item) =>
    `  (${quote(item.id)}, ${quote(item.nodeId)}, ${quote(item.providerName)}, ${
      quote(item.providerAvatar)
    }, ${quote(item.title)}, ${quote(item.description)}, ${
      quote(item.category)
    }::public.nursery_category, ${item.pointsCost}, ${item.branchesKgRequired}, ${item.stock}, ${
      quote(item.imageUrl)
    })`
  ).join(",\n") + ";",
);
lines.push("");
lines.push("-- Feed comunitario y Retos Barriales");
lines.push(
  "insert into public.community_posts (id, user_id, node_id, author_name, author_role, author_avatar, location, content, image_url, kg_contributed, likes_count, comments_count, is_challenge, challenge_goal_kg, current_kg, end_date, participants_count, tag, verified_badge, created_at) values",
);
lines.push(
  SEED_POSTS.map((post) =>
    `  (${quote(post.id)}, ${quote(post.userId)}, ${quote(post.nodeId)}, ${
      quote(post.authorName)
    }, ${quote(post.authorRole)}, ${quote(post.authorAvatar)}, ${quote(post.location)}, ${
      quote(post.content)
    }, ${
      quote(post.imageUrl)
    }, ${post.kgContributed}, ${post.likesCount}, ${post.commentsCount}, ${post.isChallenge}, ${
      quote(post.challengeGoalKg)
    }, ${quote(post.currentKg)}, ${quote(post.endDate)}, ${quote(post.participantsCount)}, ${
      quote(post.tag)
    }, ${post.verifiedBadge}, ${daysAgoExpression(post.createdAt)})`
  ).join(",\n") + ";",
);
lines.push("");
lines.push('-- Vales QR de ejemplo (programa "Rama por Planta")');
lines.push(
  "insert into public.pruning_tickets (id, code, qr_code_hash, qr_payload, user_id, assigned_node_id, size_category, estimated_volume_m3, estimated_weight_kg, points_awarded, photo_url, status, created_at, verified_at, verified_by) values",
);
lines.push(
  SEED_TICKETS.map((ticket) =>
    `  (${quote(ticket.id)}, ${quote(ticket.code)}, ${quote(ticket.qrCodeHash)}, ${
      quote(ticket.qrPayload)
    }, ${quote(ticket.userId)}, ${quote(ticket.assignedNodeId)}, ${
      quote(ticket.sizeCategory)
    }::public.size_category, ${ticket.estimatedVolumeM3}, ${ticket.estimatedWeightKg}, ${ticket.pointsAwarded}, ${
      quote(ticket.photoUrl)
    }, ${quote(ticket.status)}::public.ticket_status, ${daysAgoExpression(ticket.createdAt)}, ${
      ticket.verifiedAt ? isoTimestamp(ticket.verifiedAt) : "null"
    }, ${quote(ticket.verifiedBy)})`
  ).join(",\n") + ";",
);
lines.push("");
lines.push("-- Recibos de canje");
lines.push(
  "insert into public.redemptions (id, user_id, item_id, item_title, points_spent, code, created_at) values",
);
lines.push(
  SEED_REDEMPTIONS.map((redemption) =>
    `  (${quote(redemption.id)}, ${quote(redemption.userId)}, ${quote(redemption.itemId)}, ${
      quote(redemption.itemTitle)
    }, ${redemption.pointsSpent}, ${quote(redemption.code)}, ${
      daysAgoExpression(redemption.createdAt)
    })`
  ).join(",\n") + ";",
);
lines.push("");
lines.push("-- Lotes procesados por la UCT-3 (salidas calculadas con el motor real)");
lines.push(
  "insert into public.bio_batches (id, node_id, tons_processed, moisture_percent, coarse_mulch_kg, fine_compost_kg, medium_fiber_kg, bio_pots, blade_hours, compost_ready_at, estimated_value_usd, created_at) values",
);
lines.push(
  SEED_BATCHES.map((batch) =>
    `  (${quote(batch.id)}, ${
      quote(batch.nodeId)
    }, ${batch.tonsProcessed}, ${batch.moisturePercent}, ${batch.coarseMulchKg}, ${batch.fineCompostKg}, ${batch.mediumFiberKg}, ${batch.bioPots}, ${batch.bladeHours}, ${
      isoTimestamp(batch.compostReadyAt)
    }, ${batch.estimatedValueUsd}, ${daysAgoExpression(batch.createdAt)})`
  ).join(",\n") + ";",
);
lines.push("");
lines.push("-- Nota: las horas de cuchillas se cargaron con su valor de máquina real.");
lines.push(
  "-- Para recalcularlas desde los lotes: select public.biored_recalculate_blade_hours();",
);
lines.push("");

const output = lines.join("\n");
const target = new URL("../supabase/migrations/20261016000003_seed.sql", import.meta.url);
await Deno.writeTextFile(target, output);
console.log(`✔ Seed SQL generado: ${target.pathname} (${output.split("\n").length} líneas)`);
