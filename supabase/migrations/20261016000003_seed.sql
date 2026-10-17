-- ---------------------------------------------------------------------------
-- BioRed · Datos semilla de Managua (generado por scripts/generate-seed-sql.ts)
-- No editar a mano: ejecuta `npm run seed:sql` para regenerarlo.
-- ---------------------------------------------------------------------------

-- Usuarios (vecinos, brigadas, operario UCT-3 y administración municipal)
insert into public.users (id, name, role, district, avatar_url, eco_points, total_kg_delivered) values
  ('user-jose', 'José Mendoza', 'CITIZEN'::public.user_role, 'Distrito I', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', 485, 1280),
  ('user-martha', 'Doña Martha Rivas', 'CITIZEN'::public.user_role, 'Distrito I', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80', 210, 96),
  ('user-marcos', 'Marcos Zelaya', 'BRIGADE'::public.user_role, 'Distrito II', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', 640, 742),
  ('user-operador-carmen', 'Carmen Ruiz', 'OPERATOR'::public.user_role, 'Distrito II', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80', 0, 0),
  ('user-alma', 'Alma Lagos', 'MUNICIPAL_ADMIN'::public.user_role, 'Distrito III', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80', 0, 0);

-- Los 4 Bio-Nodos estratégicos de Managua
insert into public.bio_nodes (id, name, district, address, latitude, longitude, capacity_ton_day, current_load_percent, status, available_mulch_kg, available_compost_kg, available_bio_pots, blade_hours_used, coordinator, phone, operating_hours) values
  ('node-luis-alfonso', 'Bio-Nodo Parque Luis Alfonso Velásquez', 'Distrito II', 'Av. Bolívar, Centro Histórico de Managua', 12.1445, -86.2735, 3.5, 45, 'available'::public.node_status, 920, 410, 64, 18.5, 'Cuadrilla Municipal Centro', '+505 8731-9014', 'Lun - Dom: 6:30 AM - 5:00 PM'),
  ('node-las-madres', 'Bio-Nodo Parque Las Madres', 'Distrito I', 'Costado Sur, Rotonda El Güegüense, Managua', 12.1328, -86.2764, 2.5, 78, 'busy'::public.node_status, 1240, 300, 48, 31.2, 'Brigada Verde Bolonia', '+505 8890-4122', 'Lun - Sáb: 7:00 AM - 4:30 PM'),
  ('node-plantel-noroeste', 'Bio-Nodo Plantel Noroeste Alcaldía', 'Distrito II', 'Km 6 Carretera Norte, entrada a San Sebastián', 12.152, -86.288, 5, 92, 'full'::public.node_status, 2100, 760, 132, 42.5, 'Gestión Ambiental ALMA', '+505 8920-5571', 'Lun - Vie: 6:00 AM - 3:30 PM'),
  ('node-japones', 'Bio-Nodo Parque Japonés / Distrito I', 'Distrito I', 'Los Robles, frente a Plaza Cuba, Managua', 12.122, -86.265, 2, 30, 'available'::public.node_status, 680, 210, 26, 9.4, 'Comité Ecológico Los Robles', '+505 8452-1190', 'Mar - Dom: 7:00 AM - 4:00 PM');

-- "Hoy en Viveros": insumos canjeables con Eco-Puntos
insert into public.nursery_items (id, node_id, provider_name, provider_avatar, title, description, category, points_cost, branches_kg_required, stock, image_url) values
  ('item-abono-5kg', 'node-las-madres', 'Brigada Verde Bolonia', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', 'Abono Rápido 5kg', 'Compost barrial orgánico madurado a 28 días con microorganismos eficientes de Managua.', 'COMPOST'::public.nursery_category, 40, 15, 48, 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500&auto=format&fit=crop&q=80'),
  ('item-madero-negro', 'node-japones', 'Comité Ecológico Los Robles', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80', 'Planta Madero Negro', 'Especie nativa fijadora de nitrógeno para sombra y regeneración de microclimas urbanos.', 'PLANT'::public.nursery_category, 50, 25, 22, 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=500&auto=format&fit=crop&q=80'),
  ('item-biomaceta', 'node-luis-alfonso', 'Cuadrilla Municipal Centro', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', 'Pack 10 Bio-Macetas', 'Fabricadas con fibra de poda triturada y aglutinante vegetal. Se plantan directo en tierra.', 'BIOPOT'::public.nursery_category, 25, 10, 65, 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&auto=format&fit=crop&q=80'),
  ('item-mulch-10kg', 'node-plantel-noroeste', 'Gestión Ambiental ALMA', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80', 'Mulch Térmico 10kg', 'Corteza y astillas para cobertura de suelo: reduce 6.5°C la evaporación y ahorra 50% de agua.', 'MULCH'::public.nursery_category, 30, 20, 90, 'https://images.unsplash.com/photo-1599685315640-9ceab2f58944?w=500&auto=format&fit=crop&q=80');

-- Feed comunitario y Retos Barriales
insert into public.community_posts (id, user_id, node_id, author_name, author_role, author_avatar, location, content, image_url, kg_contributed, likes_count, comments_count, is_challenge, challenge_goal_kg, current_kg, end_date, participants_count, tag, verified_badge, created_at) values
  ('post-1', 'user-martha', 'node-las-madres', 'Doña Martha Rivas', 'Vecina de Bolonia', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80', 'Distrito I, Managua', '¡Hola vecinos! Hoy completamos la poda preventiva del patio y llevamos 25 kg de ramas secas al Bio-Nodo del Parque Las Madres. El proceso de triturado fue súper rápido y ya canjeamos nuestro compost de 28 días 🌱.', 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=800&auto=format&fit=crop&q=80', 25, 64, 18, false, null, null, null, null, null, true, now() - interval '0.031 days'),
  ('post-2', 'user-marcos', 'node-luis-alfonso', 'Marcos Zelaya', 'Jardinero Urbano Independiente', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', 'Distrito II, San Antonio', 'Descargando carretilla completa en el Bio-Nodo Luis Alfonso. En vez de quemar o botar las ramas en cauces, aquí se transforman en mulch térmico. ¡Menos calor y más tierra sana para nuestra ciudad!', 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80', 85, 92, 11, false, null, null, null, null, null, true, now() - interval '0.083 days'),
  ('post-3', 'user-marcos', 'node-japones', 'Cuadrilla Verde Nica', 'Voluntariado Ambiental', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80', 'Los Robles, Managua', 'Jornada dominical en Los Robles. Entregamos 240 kg de biomasa triturada al nodo Parque Japonés. ¡Canjeamos 6 Bio-Macetas para reforestar el parque infantil!', 'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?w=800&auto=format&fit=crop&q=80', 240, 178, 34, false, null, null, null, null, null, true, now() - interval '0.208 days'),
  ('challenge-1', 'user-marcos', 'node-las-madres', 'Ing. Carlos Mendoza', 'Coordinador de Reto', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', 'Las Colinas, Managua', 'Reto Poda Verde Las Colinas', 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80', 940, 56, 12, true, 1500, 940, 'Domingo 5:00 PM', 38, 'Meta Biomasa Fin de Semana', true, now() - interval '1.083 days'),
  ('challenge-2', 'user-martha', 'node-japones', 'Valeria Solís', 'Coordinadora de Reto', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80', 'Villa Fontana Sur', 'Brigada Limpieza Villa Fontana', 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop&q=80', 1620, 88, 21, true, 2000, 1620, 'Sábado 2:00 PM', 52, 'Comunidad Activa', true, now() - interval '1.250 days');

-- Vales QR de ejemplo (programa "Rama por Planta")
insert into public.pruning_tickets (id, code, qr_code_hash, qr_payload, user_id, assigned_node_id, size_category, estimated_volume_m3, estimated_weight_kg, points_awarded, photo_url, status, created_at, verified_at, verified_by) values
  ('ticket-demo-pending', 'BIORED-MADRES-4821', 'a2f1d0e4b7c94f6b1f0a2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef', 'BIORED::VALE::BIORED-MADRES-4821::MADRES::0.8M3::35PTS', 'user-jose', 'node-las-madres', 'md'::public.size_category, 0.8, 96, 35, null, 'PENDING'::public.ticket_status, now() - interval '0.042 days', null, null),
  ('ticket-demo-verified', 'BIORED-LUIS-AL-7410', 'b1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f901', 'BIORED::VALE::BIORED-LUIS-AL-7410::LUIS-AL::2.5M3::100PTS', 'user-jose', 'node-luis-alfonso', 'lg'::public.size_category, 2.5, 300, 100, null, 'VERIFIED'::public.ticket_status, now() - interval '4.000 days', '2026-10-13T02:51:04.693Z'::timestamptz, 'user-operador-carmen');

-- Recibos de canje
insert into public.redemptions (id, user_id, item_id, item_title, points_spent, code, created_at) values
  ('redemption-demo-1', 'user-jose', 'item-biomaceta', 'Pack 10 Bio-Macetas', 25, 'CANJE-BIO-2QK7P', now() - interval '6.000 days');

-- Lotes procesados por la UCT-3 (salidas calculadas con el motor real)
insert into public.bio_batches (id, node_id, tons_processed, moisture_percent, coarse_mulch_kg, fine_compost_kg, medium_fiber_kg, bio_pots, blade_hours, compost_ready_at, estimated_value_usd, created_at) values
  ('batch-01', 'node-las-madres', 4.1, 62, 2542, 738, 820, 172, 1.43, '2026-11-13T02:51:04.693Z'::timestamptz, 357.75, now() - interval '1.000 days'),
  ('batch-02', 'node-luis-alfonso', 4, 45, 2240, 1040, 720, 151, 1.4, '2026-11-11T02:51:04.693Z'::timestamptz, 361.5, now() - interval '3.000 days'),
  ('batch-03', 'node-japones', 4.2, 28, 2066.4, 1520.4, 613.2, 129, 1.47, '2026-11-09T02:51:04.693Z'::timestamptz, 391.54, now() - interval '5.000 days'),
  ('batch-04', 'node-luis-alfonso', 3.2, 30, 1600, 1120, 480, 101, 1.12, '2026-11-05T02:51:04.693Z'::timestamptz, 297.3, now() - interval '9.000 days'),
  ('batch-05', 'node-plantel-noroeste', 3.8, 55, 2280, 760, 760, 160, 1.33, '2026-11-02T02:51:04.693Z'::timestamptz, 337.8, now() - interval '12.000 days'),
  ('batch-06', 'node-las-madres', 4.5, 22, 2106, 1791, 603, 127, 1.58, '2026-10-29T02:51:04.693Z'::timestamptz, 423.99, now() - interval '16.000 days'),
  ('batch-07', 'node-japones', 3.9, 35, 2028, 1248, 624, 131, 1.37, '2026-10-25T02:51:04.693Z'::timestamptz, 358.92, now() - interval '20.000 days'),
  ('batch-08', 'node-plantel-noroeste', 4.4, 40, 2376, 1276, 748, 157, 1.54, '2026-10-21T02:51:04.693Z'::timestamptz, 401.34, now() - interval '24.000 days'),
  ('batch-09', 'node-luis-alfonso', 3.6, 26, 1742.4, 1346.4, 511.2, 107, 1.26, '2026-10-17T02:51:04.693Z'::timestamptz, 336.28, now() - interval '28.000 days'),
  ('batch-10', 'node-las-madres', 4.1, 30, 2050, 1435, 615, 129, 1.43, '2026-10-12T02:51:04.693Z'::timestamptz, 380.55, now() - interval '33.000 days'),
  ('batch-11', 'node-japones', 3.5, 25, 1680, 1330, 490, 103, 1.22, '2026-10-07T02:51:04.693Z'::timestamptz, 327.9, now() - interval '38.000 days');

-- Nota: las horas de cuchillas se cargaron con su valor de máquina real.
-- Para recalcularlas desde los lotes: select public.biored_recalculate_blade_hours();
