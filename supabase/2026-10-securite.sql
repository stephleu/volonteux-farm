-- Sécurité : seules les personnes connectées lisent et modifient les données.
-- La page publique /mercuriale/catalogue garde juste ce qu'il lui faut pour passer commande.
-- À coller dans Supabase > SQL Editor, puis « Run », APRÈS avoir mis en ligne la version du site
-- avec la page de connexion (sinon le site en ligne n'affiche plus rien). Peut être relancé.

-- 1. Toutes les tables : accès complet pour les utilisateurs connectés, rien pour les anonymes
do $$
declare t text;
begin
  foreach t in array array[
    'familles', 'legumes', 'varietes', 'blocs', 'planches', 'series', 'cultures',
    'serie_fertilisations', 'serie_traitements', 'suivi_ferti', 'suivi_traitements',
    'travail_sol', 'rotations_planifiees', 'durees_culture', 'types_traitement',
    'mercuriale_produits', 'mercuriale_epiceries', 'mercuriale_commandes', 'mercuriale_lignes'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "connectes" on %I', t);
    execute format('create policy "connectes" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- 2. Catalogue public : voir les produits disponibles…
drop policy if exists "catalogue lit les produits" on mercuriale_produits;
create policy "catalogue lit les produits" on mercuriale_produits
  for select to anon using (disponible = true);

-- … choisir son épicerie (nom seulement, sans adresse ni email)…
create or replace view epiceries_catalogue as select id, nom from mercuriale_epiceries;
grant select on epiceries_catalogue to anon, authenticated;

-- … et envoyer une commande (sans pouvoir relire, modifier ni supprimer les commandes)
drop policy if exists "catalogue cree une commande" on mercuriale_commandes;
create policy "catalogue cree une commande" on mercuriale_commandes
  for insert to anon with check (statut = 'en_attente');
drop policy if exists "catalogue cree les lignes" on mercuriale_lignes;
create policy "catalogue cree les lignes" on mercuriale_lignes
  for insert to anon with check (true);
