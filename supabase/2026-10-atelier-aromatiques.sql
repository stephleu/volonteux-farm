-- Mercuriale : nouvel atelier « Aromatiques », sorti du maraîchage.
-- À coller dans Supabase > SQL Editor, puis « Run ». Peut être relancé.

alter table mercuriale_produits drop constraint if exists mercuriale_produits_atelier_check;
alter table mercuriale_produits add constraint mercuriale_produits_atelier_check
  check (atelier in ('maraichage', 'aromatiques', 'arboriculture', 'epices'));

-- Herbes aromatiques (mots entiers) : à compléter ensuite dans la page Produits si besoin
update mercuriale_produits set atelier = 'aromatiques'
where atelier = 'maraichage'
  and nom ~* '\m(basilic|persil|aneth|coriandre|ciboulette|menthe|thym|romarin|sauge|estragon|origan|cerfeuil|sarriette|liv[èe]che|m[ée]lisse|verveine|marjolaine|laurier|shiso|oseille|hysope|aromatiques?)\M';

-- Les épiceries qui avaient le maraîchage gardent l'accès aux aromatiques ; nouvelles épiceries : tout
update mercuriale_epiceries set ateliers = array_append(ateliers, 'aromatiques')
where 'maraichage' = any(ateliers) and not ('aromatiques' = any(ateliers));
alter table mercuriale_epiceries alter column ateliers set default '{maraichage,aromatiques,arboriculture,epices}';
