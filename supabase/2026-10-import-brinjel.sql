-- Import Brinjel : changements de structure exécutés le 2026-10-26 dans Supabase > SQL Editor.
-- Peut être relancé sans risque.

-- Séries : récoltes, rangs et espacement propres à la série
-- (la date au champ va dans la colonne existante date_plantation)
alter table series add column if not exists premiere_recolte date;
alter table series add column if not exists derniere_recolte date;
alter table series add column if not exists rangs integer;
alter table series add column if not exists espacement_plants numeric;
alter table series add column if not exists sous_abri boolean not null default false;

-- Placements : première récolte (la dernière va dans date_fin_prevue)
alter table cultures add column if not exists premiere_recolte date;

-- Brinjel a des longueurs à virgule (12,5 m, 37,5 m)
alter table series alter column longueur_metres type numeric;
alter table cultures alter column longueur_metres type numeric;
alter table cultures alter column position_debut type numeric;
alter table planches alter column longueur type numeric;

-- Ajoutées par erreur en doublon de planches.longueur et series.date_plantation, inutilisées
alter table planches drop column if exists longueur_metres;
alter table series drop column if exists date_au_champ;
