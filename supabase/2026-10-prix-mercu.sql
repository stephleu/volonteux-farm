-- Mercuriale : les épiceries paient le « Prix mercu » (prix_remise), à défaut le prix HT.
-- Remplace epicerie_commander (garde le contrôle des ateliers autorisés).
-- Les commandes déjà passées gardent leur prix. À coller dans SQL Editor, puis « Run ». Peut être relancé.
create or replace function epicerie_commander(p_identifiant text, p_mot_de_passe text, p_lignes jsonb, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_epicerie uuid;
  v_ateliers text[];
  v_commande uuid;
begin
  select e.id, e.ateliers into v_epicerie, v_ateliers from mercuriale_epiceries e
  where lower(e.identifiant) = lower(trim(p_identifiant)) and e.mot_de_passe = p_mot_de_passe;
  if v_epicerie is null then raise exception 'Identifiant ou mot de passe incorrect'; end if;

  insert into mercuriale_commandes (epicerie_id, statut, notes)
  values (v_epicerie, 'en_attente', nullif(trim(p_notes), ''))
  returning id into v_commande;

  insert into mercuriale_lignes (commande_id, produit_id, quantite_colis, prix_unitaire)
  select v_commande, p.id, (l->>'quantite_colis')::int, coalesce(p.prix_remise, p.prix_ht)
  from jsonb_array_elements(p_lignes) l
  join mercuriale_produits p on p.id = (l->>'produit_id')::uuid and p.disponible and p.atelier = any(v_ateliers)
  where (l->>'quantite_colis')::int > 0;

  if not found then raise exception 'Commande vide'; end if;
  return v_commande;
end $$;
