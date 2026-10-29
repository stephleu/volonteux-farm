-- Mercuriale : un accès (identifiant + mot de passe) par épicerie pour la page de commande.
-- Les mots de passe sont gérés par la ferme et lisibles dans la page Épiceries, pour pouvoir
-- les renvoyer (choix assumé : pas besoin de confidentialité forte).
-- La page publique ne lit jamais la table des épiceries : elle passe par les fonctions ci-dessous,
-- qui vérifient l'identifiant et le mot de passe à chaque appel.
-- ⚠ DÉJÀ APPLIQUÉ, NE PAS RELANCER : les fonctions ont été remplacées depuis par
-- 2026-10-epiceries-ateliers.sql (ateliers autorisés) et 2026-10-prix-mercu.sql (prix mercu).
-- Le relancer remettrait l'ancienne version, sans ces contrôles. Gardé pour l'historique.

alter table mercuriale_epiceries add column if not exists identifiant text;
alter table mercuriale_epiceries add column if not exists mot_de_passe text;
create unique index if not exists mercuriale_epiceries_identifiant on mercuriale_epiceries (lower(identifiant));

-- Connexion : renvoie l'épicerie si l'identifiant et le mot de passe correspondent
create or replace function epicerie_connexion(p_identifiant text, p_mot_de_passe text)
returns table (id uuid, nom text)
language sql security definer set search_path = public as $$
  select e.id, e.nom from mercuriale_epiceries e
  where lower(e.identifiant) = lower(trim(p_identifiant)) and e.mot_de_passe = p_mot_de_passe
$$;

-- Passer commande : tout ou rien, prix repris du catalogue (pas de ceux envoyés par la page)
create or replace function epicerie_commander(p_identifiant text, p_mot_de_passe text, p_lignes jsonb, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_epicerie uuid;
  v_commande uuid;
begin
  select e.id into v_epicerie from mercuriale_epiceries e
  where lower(e.identifiant) = lower(trim(p_identifiant)) and e.mot_de_passe = p_mot_de_passe;
  if v_epicerie is null then raise exception 'Identifiant ou mot de passe incorrect'; end if;

  insert into mercuriale_commandes (epicerie_id, statut, notes)
  values (v_epicerie, 'en_attente', nullif(trim(p_notes), ''))
  returning id into v_commande;

  insert into mercuriale_lignes (commande_id, produit_id, quantite_colis, prix_unitaire)
  select v_commande, p.id, (l->>'quantite_colis')::int, p.prix_ht
  from jsonb_array_elements(p_lignes) l
  join mercuriale_produits p on p.id = (l->>'produit_id')::uuid and p.disponible
  where (l->>'quantite_colis')::int > 0;

  if not found then raise exception 'Commande vide'; end if;
  return v_commande;
end $$;

-- Dernières commandes de l'épicerie connectée (10 au plus)
create or replace function epicerie_commandes(p_identifiant text, p_mot_de_passe text)
returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(c order by c.date_commande desc), '[]'::jsonb)
  from (
    select cmd.id, cmd.date_commande, cmd.statut, cmd.notes,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'nom', p.nom, 'variete', p.variete, 'quantite_colis', l.quantite_colis,
        'nombre_par_colis', p.nombre_par_colis, 'unite', p.unite, 'prix_unitaire', l.prix_unitaire
      )), '[]'::jsonb)
       from mercuriale_lignes l join mercuriale_produits p on p.id = l.produit_id
       where l.commande_id = cmd.id) as lignes
    from mercuriale_commandes cmd
    join mercuriale_epiceries e on e.id = cmd.epicerie_id
    where lower(e.identifiant) = lower(trim(p_identifiant)) and e.mot_de_passe = p_mot_de_passe
    order by cmd.date_commande desc
    limit 10
  ) c
$$;

grant execute on function epicerie_connexion(text, text) to anon, authenticated;
grant execute on function epicerie_commander(text, text, jsonb, text) to anon, authenticated;
grant execute on function epicerie_commandes(text, text) to anon, authenticated;

-- L'ancienne liste publique des épiceries n'est plus utile
drop view if exists epiceries_catalogue;
