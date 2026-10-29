-- Fumure de fond aux granulés : apportée à la préparation de la planche (étape « Granulés » du travail du sol).
-- Dose en tonnes par hectare, réglable par légume dans Paramètres › Fiches légumes.
--   1 t/ha par défaut · tomate 2 t/ha
--   0 pour la carotte, le chou et le poireau : leurs granulés sont apportés en cours de culture
--     (passages de la page Fertilisation, ex. carotte +5 semaines l'été)
--   0 pour les courges : fumier seulement
-- À coller dans Supabase > SQL Editor, puis « Run ». Peut être relancé (ne touche pas une dose déjà réglée à la main).

alter table legumes add column if not exists fumure_fond_t_ha numeric not null default 1;

update legumes set fumure_fond_t_ha = 2 where nom ~* '^tomate' and fumure_fond_t_ha = 1;
update legumes set fumure_fond_t_ha = 0 where nom ~* '^(carotte|chou|poireau|courge)' and fumure_fond_t_ha = 1;
