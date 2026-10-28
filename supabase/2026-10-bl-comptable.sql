-- Date du dernier envoi du bon de livraison au comptable. À coller dans SQL Editor, puis « Run ».
alter table mercuriale_commandes add column if not exists bl_envoye_le timestamptz;
