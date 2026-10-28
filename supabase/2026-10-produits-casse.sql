-- Produits de la mercuriale : « Première lettre en majuscule, le reste en minuscules »,
-- et fraise / poireaux remis en maraîchage (le tri automatique les avait mal rangés).
-- À coller dans Supabase > SQL Editor, puis « Run ». Peut être relancé.

update mercuriale_produits
set nom = upper(left(trim(nom), 1)) || lower(substr(trim(nom), 2)),
    variete = nullif(upper(left(trim(variete), 1)) || lower(substr(trim(variete), 2)), '');

update mercuriale_produits set atelier = 'maraichage'
where nom ~* '^(fraise|poireau)';
