-- Sécurité de l'espace épiceries : contre les essais de mots de passe en série.
-- Après 10 essais ratés sur un même identifiant en 15 minutes, cet identifiant est bloqué 15 minutes.
-- Remplace epicerie_connexion, epicerie_commandes et epicerie_commander (mêmes contrôles qu'avant :
-- ateliers autorisés, prix mercu). À coller dans Supabase > SQL Editor, puis « Run ». Peut être relancé.

-- Essais ratés (aucun accès depuis le site : RLS sans règle, seules les fonctions ci-dessous y écrivent)
create table if not exists mercuriale_tentatives (
  id bigserial primary key,
  identifiant text not null,
  le timestamptz not null default now()
);
create index if not exists mercuriale_tentatives_identifiant on mercuriale_tentatives (identifiant, le);
alter table mercuriale_tentatives enable row level security;

-- Vérifie l'accès d'une épicerie ; renvoie null (et note l'essai raté) si identifiant ou mot de passe faux
create or replace function epicerie_verifier(p_identifiant text, p_mot_de_passe text)
returns mercuriale_epiceries
language plpgsql security definer set search_path = public as $$
declare
  v_identifiant text := lower(trim(p_identifiant));
  v_epicerie mercuriale_epiceries;
begin
  if (select count(*) from mercuriale_tentatives where identifiant = v_identifiant and le > now() - interval '15 minutes') >= 10 then
    raise exception 'Trop de tentatives : réessayez dans 15 minutes';
  end if;
  select * into v_epicerie from mercuriale_epiceries e
  where lower(e.identifiant) = v_identifiant and e.mot_de_passe = p_mot_de_passe;
  if v_epicerie.id is null then
    insert into mercuriale_tentatives (identifiant) values (v_identifiant);
    delete from mercuriale_tentatives where le < now() - interval '1 day';
    return null;
  end if;
  return v_epicerie;
end $$;
-- Fonction interne : pas appelable directement depuis le site
revoke execute on function epicerie_verifier(text, text) from public, anon, authenticated;

-- Connexion : l'épicerie et ses ateliers autorisés, ou rien
create or replace function epicerie_connexion(p_identifiant text, p_mot_de_passe text)
returns table (id uuid, nom text, ateliers text[])
language plpgsql security definer set search_path = public as $$
declare
  v_epicerie mercuriale_epiceries := epicerie_verifier(p_identifiant, p_mot_de_passe);
begin
  if v_epicerie.id is not null then
    return query select v_epicerie.id, v_epicerie.nom, v_epicerie.ateliers;
  end if;
end $$;

-- Dernières commandes de l'épicerie (10 au plus)
create or replace function epicerie_commandes(p_identifiant text, p_mot_de_passe text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_epicerie mercuriale_epiceries := epicerie_verifier(p_identifiant, p_mot_de_passe);
begin
  if v_epicerie.id is null then return '[]'::jsonb; end if;
  return (
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
      where cmd.epicerie_id = v_epicerie.id
      order by cmd.date_commande desc
      limit 10
    ) c
  );
end $$;

-- Passer commande : renvoie null si l'accès est refusé (sans lever d'erreur, pour que l'essai raté
-- reste noté), prix mercu à défaut du prix HT, seulement les ateliers autorisés
create or replace function epicerie_commander(p_identifiant text, p_mot_de_passe text, p_lignes jsonb, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_epicerie mercuriale_epiceries := epicerie_verifier(p_identifiant, p_mot_de_passe);
  v_commande uuid;
begin
  if v_epicerie.id is null then return null; end if;

  insert into mercuriale_commandes (epicerie_id, statut, notes)
  values (v_epicerie.id, 'en_attente', nullif(trim(p_notes), ''))
  returning id into v_commande;

  insert into mercuriale_lignes (commande_id, produit_id, quantite_colis, prix_unitaire)
  select v_commande, p.id, (l->>'quantite_colis')::int, coalesce(p.prix_remise, p.prix_ht)
  from jsonb_array_elements(p_lignes) l
  join mercuriale_produits p on p.id = (l->>'produit_id')::uuid and p.disponible and p.atelier = any(v_epicerie.ateliers)
  where (l->>'quantite_colis')::int > 0;

  if not found then raise exception 'Commande vide'; end if;
  return v_commande;
end $$;

grant execute on function epicerie_connexion(text, text) to anon, authenticated;
grant execute on function epicerie_commandes(text, text) to anon, authenticated;
grant execute on function epicerie_commander(text, text, jsonb, text) to anon, authenticated;

-- Contrôle : tables du site SANS protection (RLS). Le résultat doit être vide.
select tablename as table_sans_protection
from pg_tables
where schemaname = 'public' and not rowsecurity;
