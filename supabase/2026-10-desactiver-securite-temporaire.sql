-- TEMPORAIRE, le temps de finir le site : rouvre la base à la clé publique (anon),
-- pour que les scripts puissent tourner sans la clé service_role.
-- La page de connexion du site reste en place.
-- Pour refermer : relancer supabase/2026-10-securite.sql.
do $$
declare t text;
begin
  foreach t in array array[
    'familles', 'legumes', 'varietes', 'blocs', 'planches', 'series', 'cultures',
    'serie_fertilisations', 'serie_traitements', 'suivi_ferti', 'suivi_traitements',
    'travail_sol', 'rotations_planifiees', 'durees_culture', 'types_traitement',
    'mercuriale_produits', 'mercuriale_epiceries', 'mercuriale_commandes', 'mercuriale_lignes'
  ] loop
    execute format('alter table %I disable row level security', t);
  end loop;
end $$;
