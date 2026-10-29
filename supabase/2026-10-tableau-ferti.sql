-- Fertilisation : un tableau par légume remplace les passages saisis série par série.
-- Chaque ligne = un légume (et pour la carotte une variante choisie selon la semaine de plantation),
-- avec sa fumure de fond (t/ha, à la préparation) et ses passages en cours de culture.
-- Chaque série suit automatiquement la ligne de son légume.
-- (Noms ferti_lignes… : une ancienne table plans_ferti, inutilisée, existe déjà dans la base et n'est pas touchée.)
-- À coller dans Supabase > SQL Editor, puis « Run ». Peut être relancé.

create table if not exists ferti_lignes (
  id uuid primary key default gen_random_uuid(),
  legume_id uuid not null references legumes(id) on delete cascade,
  variante text,                              -- ex. « nouvelle », « primeur », « conservation »
  semaines int[] not null default '{}',       -- semaines de plantation qui prennent cette ligne ; vide = ligne par défaut
  fumure_fond_t_ha numeric not null default 1,
  created_at timestamptz default now()
);

create table if not exists ferti_lignes_passages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references ferti_lignes(id) on delete cascade,
  dose_kg_ha numeric not null default 0,
  semaines_apres_plantation int not null default 0,
  created_at timestamptz default now()
);

-- « Fait » d'un passage du tableau pour une série donnée
create table if not exists ferti_suivi (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid not null references series(id) on delete cascade,
  passage_id uuid not null references ferti_lignes_passages(id) on delete cascade,
  fait boolean not null default true,
  date_reelle date,
  unique (serie_id, passage_id)
);

-- Mêmes droits que le reste de la base : tout pour les personnes connectées
do $$
declare t text;
begin
  foreach t in array array['ferti_lignes', 'ferti_lignes_passages', 'ferti_suivi'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "connectes" on %I', t);
    execute format('create policy "connectes" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Une ligne par légume, reprenant la fumure de fond réglée jusqu'ici dans la fiche légume
insert into ferti_lignes (legume_id, fumure_fond_t_ha)
select l.id, coalesce(l.fumure_fond_t_ha, 1) from legumes l
where not exists (select 1 from ferti_lignes p where p.legume_id = l.id);

-- Carotte : 3 lignes. Nouvelle (sem. 2, 4, 8), primeur (sem. 14, 19, 23), conservation (toutes les autres)
update ferti_lignes set variante = 'conservation', fumure_fond_t_ha = 0
where variante is null and legume_id in (select id from legumes where nom ~* '^carotte');
insert into ferti_lignes (legume_id, variante, semaines, fumure_fond_t_ha)
select l.id, v.variante, v.semaines, 0
from legumes l, (values ('nouvelle', '{2,4,8}'::int[]), ('primeur', '{14,19,23}'::int[])) as v(variante, semaines)
where l.nom ~* '^carotte'
  and not exists (select 1 from ferti_lignes p where p.legume_id = l.id and p.variante = v.variante);

-- Chou et poireau : 3 passages de granulés en cours de culture (doses et semaines à régler dans le tableau)
insert into ferti_lignes_passages (plan_id, dose_kg_ha, semaines_apres_plantation)
select p.id, 0, n * 3
from ferti_lignes p join legumes l on l.id = p.legume_id, generate_series(1, 3) as n
where l.nom ~* '^(chou|poireau)'
  and not exists (select 1 from ferti_lignes_passages x where x.plan_id = p.id);

-- Les passages saisis série par série sont remplacés par le tableau
delete from suivi_ferti;
delete from serie_fertilisations;
