-- Travail du sol : une saison par année. À exécuter AVANT de mettre en ligne cette version du site.
-- Peut être relancé sans risque.
alter table travail_sol add column if not exists annee integer;
update travail_sol set annee = extract(year from coalesce(date_fait, now()))::int where annee is null;
