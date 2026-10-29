-- Retire les séries 2026 (et avant) qui n'ont jamais été placées dans l'assolement (aucune culture).
-- Les séries 2027 non placées (poireaux, courges… qui manquaient de place) sont gardées.
-- À coller dans Supabase > SQL Editor.

-- 1) APERÇU : lancer d'abord cette partie seule pour voir ce qui sera retiré
select s.annee, l.nom as legume, s.nom as serie, s.semaine_plantation, s.longueur_metres
from series s left join legumes l on l.id = s.legume_id
where s.annee <= 2026
  and not exists (select 1 from cultures c where c.serie_id = s.id)
order by s.annee, s.semaine_plantation, l.nom;

-- 2) SUPPRESSION : une fois l'aperçu vérifié, sélectionner et lancer ce bloc
-- (sans table temporaire : l'éditeur de Supabase ne la garde pas d'une instruction à l'autre)
with a_retirer as (
  select s.id from series s
  where s.annee <= 2026 and not exists (select 1 from cultures c where c.serie_id = s.id)
),
traitements as (
  select t.id from serie_traitements t where t.serie_id in (select id from a_retirer)
),
suivi_t as (delete from suivi_traitements where traitement_id in (select id from traitements) returning 1),
serie_t as (delete from serie_traitements where id in (select id from traitements) returning 1),
suivi_f as (delete from ferti_suivi where serie_id in (select id from a_retirer) returning 1),
retirees as (delete from series where id in (select id from a_retirer) returning 1)
select (select count(*) from retirees) as series_retirees,
       (select count(*) from serie_t) as traitements_retires;
