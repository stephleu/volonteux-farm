-- Mercuriale : chaque produit appartient à un atelier de la ferme, pour ranger le catalogue.
-- maraichage = légumes · arboriculture = fruits et transformation de fruits · epices = Épices Volonteux
-- À coller dans Supabase > SQL Editor, puis « Run ». Peut être relancé.

alter table mercuriale_produits add column if not exists atelier text not null default 'maraichage';
alter table mercuriale_produits drop constraint if exists mercuriale_produits_atelier_check;
alter table mercuriale_produits add constraint mercuriale_produits_atelier_check
  check (atelier in ('maraichage', 'arboriculture', 'epices'));

-- Premier classement automatique d'après le nom (à corriger ensuite dans la page Produits)
update mercuriale_produits set atelier = 'epices'
where atelier = 'maraichage'
  and (nom ~* '(piment|sel |épice|epice|harissa|gochu|paprika|poivre|kimchi|chili)' or variete ~* '(fumé|séché|moulu|en poudre)');

update mercuriale_produits set atelier = 'arboriculture'
where atelier = 'maraichage'
  and nom !~* 'pomme de terre'
  and nom ~* '(pomme|poire|abricot|p[êe]che|nectarine|cerise|prune|reine.claude|mirabelle|coing|kiwi|figue|noix|amande|noisette|raisin|framboise|fraise|cassis|groseille|jus|confiture|compote|sirop|nectar|gel[ée]e|p[âa]te de fruit)';
