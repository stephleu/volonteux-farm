-- Tableau des fertilisations : une ligne peut aussi s'appliquer à certaines variétés.
-- Chou chinois et chou rave : une seule fumure de fond (1 t/ha), pas de passages fractionnés.
-- Les autres choux gardent la ligne par défaut (fond 0 + passages fractionnés).
-- À coller dans Supabase > SQL Editor, puis « Run ». Peut être relancé.

alter table ferti_lignes add column if not exists variete_ids uuid[] not null default '{}';

insert into ferti_lignes (legume_id, variante, variete_ids, fumure_fond_t_ha)
select l.id, 'chinois et rave', array_agg(v.id), 1
from legumes l join varietes v on v.legume_id = l.id
where l.nom ~* '^chou' and v.nom ~* '(chinois|rave)'
  and not exists (select 1 from ferti_lignes p where p.legume_id = l.id and p.variante = 'chinois et rave')
group by l.id;

-- Les autres choux : fumure fractionnée (ligne par défaut, sans fond)
update ferti_lignes set variante = 'autres choux', fumure_fond_t_ha = 0
where variante is null and legume_id in (select id from legumes where nom ~* '^chou');
