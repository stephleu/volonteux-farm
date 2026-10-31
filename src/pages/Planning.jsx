import { useState } from 'react'
import { supabase, chargerTout } from '../lib/supabase'
import { semaineCourante as calculSemaineCourante, anneeCourante, ecartSemaines, anneeEtSemaine, lundiSemaine } from '../lib/dates'
import { AlertTriangle } from 'lucide-react'
import { semainesPrepa } from '../lib/travailSol'
import { EnTetePage, Onglets, SeparateurAnnee } from '../components/ui.jsx'
import { useChargement } from '../lib/useChargement'

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const ANNEE = anneeCourante()

// Regroupe des éléments par année puis par clé (semaine ou mois), dans l'ordre où ils arrivent
function parAnneePuis(liste, cle) {
  const annees = new Map()
  for (const x of liste) {
    const groupes = annees.get(x.reel.annee) || new Map()
    groupes.set(cle(x), [...(groupes.get(cle(x)) || []), x])
    annees.set(x.reel.annee, groupes)
  }
  return annees
}


export default function Planning() {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState('semaine')
  const [filtreFournisseur, setFiltreFournisseur] = useState('tous')
  const [filtreType, setFiltreType] = useState('tous')
  const [semaineCourante] = useState(calculSemaineCourante)
  const [voirTout, setVoirTout] = useState(false)

  // Toutes les plantations à venir, toutes années confondues, avec un séparateur par année
  async function fetchData() {
    // Séries déjà placées dans l'assolement (au moins une culture), depuis l'année dernière
    const { data } = await chargerTout(() => supabase
      .from('series')
      .select('*, legumes(nom, familles(couleur)), varietes(nom), cultures!inner(id)')
      .gte('annee', ANNEE - 1)
      .order('annee').order('semaine_plantation').order('id'))

    setSeries((data || []).filter(s => s.semaine_plantation).map(s => ({
      ...s,
      ecart: ecartSemaines(s.annee, s.semaine_plantation),   // semaines entre aujourd'hui et la plantation
      reel: anneeEtSemaine(s.annee, s.semaine_plantation),   // année et semaine affichées
    })).sort((a, b) => a.ecart - b.ecart))
    setLoading(false)
  }
  useChargement(fetchData)

  // Par défaut : à partir de la semaine en cours ; « Voir toute l'année » ajoute les semaines passées de l'année
  const seriesFiltrees = series.filter(s => {
    if (filtreFournisseur !== 'tous' && s.fournisseur !== filtreFournisseur) return false
    if (filtreType !== 'tous' && s.type !== filtreType) return false
    if (voirTout ? s.reel.annee < ANNEE : s.ecart < 0) return false
    return true
  })

  const parSemaine = parAnneePuis(seriesFiltrees, s => s.reel.semaine)
  const parMois = parAnneePuis(seriesFiltrees, s => lundiSemaine(s.reel.annee, s.reel.semaine).getUTCMonth())
  // « Sem. 3 (2027) » quand ce n'est pas l'année en cours
  const libelleSem = s => `Sem. ${s.reel.semaine}${s.reel.annee !== ANNEE ? ` (${s.reel.annee})` : ''}`

  const alertes = series.filter(s => {
    const debutPrepa = s.ecart - semainesPrepa(s.semaine_plantation)
    return debutPrepa <= 2 && debutPrepa >= -1
  })

  const commandesDesbos = seriesFiltrees.filter(s => s.fournisseur === 'Desbos')
  const commandesPepi = seriesFiltrees.filter(s => s.fournisseur === 'Pépinière interne')

  return (
    <div>
      <EnTetePage titre="Planning plantation" marge={16} sousTitre={<>{seriesFiltrees.length} séries{voirTout ? ` depuis le début de ${ANNEE}` : ' à venir'}</>}>
        <Onglets valeur={vue} onChange={setVue} options={[['semaine', 'Par semaine'], ['mois', 'Par mois'], ['fournisseur', 'Fournisseurs'], ['alertes', 'Alertes']]} />
      </EnTetePage>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={filtreFournisseur} onChange={e => setFiltreFournisseur(e.target.value)}
          style={{ fontSize: 12, padding: '5px 8px', border: '1px solid var(--trait)', borderRadius: 0 }}>
          <option value="tous">Tous fournisseurs</option>
          <option value="Desbos">Desbos</option>
          <option value="Pépinière interne">Pépinière interne</option>
          <option value="Semis direct">Semis direct</option>
        </select>
        <select value={filtreType} onChange={e => setFiltreType(e.target.value)}
          style={{ fontSize: 12, padding: '5px 8px', border: '1px solid var(--trait)', borderRadius: 0 }}>
          <option value="tous">Plants + Semis</option>
          <option value="plant">Plants seulement</option>
          <option value="semis">Semis seulement</option>
        </select>
        <button onClick={() => setVoirTout(!voirTout)}
          style={{ fontSize: 12, padding: '5px 12px', border: '1px solid var(--trait)', borderRadius: 0, cursor: 'pointer', background: voirTout ? 'var(--accent)' : 'var(--papier)', color: voirTout ? 'var(--papier)' : 'var(--encre)' }}>
          {voirTout ? `Masquer les semaines passées (avant sem. ${semaineCourante})` : "Voir toute l'année"}
        </button>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--encre-douce)' }}>Chargement...</p>}

      {vue === 'semaine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...parSemaine.entries()].map(([anneeSem, semaines]) => [
            <SeparateurAnnee key={`annee-${anneeSem}`} annee={anneeSem} />,
            ...[...semaines.entries()].map(([sem, seriesSem]) => {
            const delaiPrepa = semainesPrepa(sem)
            const semaineDebutPrepa = anneeEtSemaine(anneeSem, sem - delaiPrepa).semaine
            // Urgent : plantation à venir et préparation du sol à commencer
            const ecartSem = seriesSem[0].ecart
            const urgence = ecartSem >= 0 && ecartSem - delaiPrepa <= 1
            const dateStr = lundiSemaine(anneeSem, sem).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
            const totalPlants = seriesSem.filter(s => s.type === 'plant').reduce((acc, s) => acc + (s.nombre_plants || 0), 0)
            return (
              <div key={`${anneeSem}-${sem}`} style={{ background: 'var(--papier)', border: `1px solid ${urgence ? 'var(--jaune)' : 'var(--trait-leger)'}`, borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: urgence ? 'var(--jaune-pale)' : 'var(--fond)', borderBottom: '1px solid var(--trait)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {urgence && <AlertTriangle size={14} color="#9a6a00" />}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>Semaine {sem}</span>
                    <span style={{ fontSize: 12, color: 'var(--encre-douce)' }}>{dateStr}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {totalPlants > 0 && <span style={{ fontSize: 11, color: 'var(--encre-douce)' }}>{totalPlants} plants</span>}
                    <span style={{ fontSize: 11, color: 'var(--encre-pale)' }}>Prépa sol avant sem. {semaineDebutPrepa} ({delaiPrepa} sem.)</span>
                  </div>
                </div>
                <div style={{ padding: '8px 14px' }}>
                  {seriesSem.map((serie, i) => {
                    const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: i < seriesSem.length - 1 ? '1px solid var(--trait-leger)' : 'none' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--encre)', flex: 1 }}>
                          {serie.legumes?.nom}
                          {serie.varietes?.nom && <span style={{ color: 'var(--encre-douce)' }}> · {serie.varietes.nom}</span>}
                        </span>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 0, background: serie.type === 'plant' ? 'var(--jaune-pale)' : 'var(--bleu-pale)', color: serie.type === 'plant' ? 'var(--ocre)' : 'var(--bleu)' }}>
                          {serie.type === 'plant' ? 'Plant' : 'Semis'}
                        </span>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 0, background: serie.fournisseur === 'Desbos' ? 'var(--bleu-pale)' : serie.fournisseur === 'Pépinière interne' ? 'var(--vert-pale)' : 'var(--fond)', color: serie.fournisseur === 'Desbos' ? 'var(--bleu)' : serie.fournisseur === 'Pépinière interne' ? 'var(--vert-fonce)' : 'var(--encre-douce)' }}>
                          {serie.fournisseur}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--encre-douce)' }}>{serie.longueur_metres}m</span>
                        {serie.nombre_plants && <span style={{ fontSize: 12, color: 'var(--encre-douce)' }}>{serie.nombre_plants} plants</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
            }),
          ])}
          {parSemaine.size === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--encre-pale)', fontSize: 13 }}>
              Aucune plantation à venir
            </div>
          )}
        </div>
      )}

      {vue === 'mois' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...parMois.entries()].map(([anneeMois, mois]) => [
            <SeparateurAnnee key={`annee-${anneeMois}`} annee={anneeMois} />,
            ...[...mois.entries()].map(([indexMois, seriesMois]) => (
            <div key={`${anneeMois}-${indexMois}`} style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--fond)', borderBottom: '1px solid var(--trait)', fontSize: 13, fontWeight: 500, color: 'var(--encre)' }}>
                {MOIS[indexMois]} · {seriesMois.length} plantation{seriesMois.length > 1 ? 's' : ''}
              </div>
              <div style={{ padding: '8px 14px' }}>
                {seriesMois.map((serie, i) => {
                  const couleur = serie.legumes?.familles?.couleur || '#9dca9a'
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: i < seriesMois.length - 1 ? '1px solid var(--trait-leger)' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleur }} />
                      <span style={{ fontSize: 12, color: 'var(--encre-pale)', minWidth: 50 }}>Sem. {serie.reel.semaine}</span>
                      <span style={{ fontSize: 13, color: 'var(--encre)', flex: 1 }}>{serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}</span>
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 0, background: serie.type === 'plant' ? 'var(--jaune-pale)' : 'var(--bleu-pale)', color: serie.type === 'plant' ? 'var(--ocre)' : 'var(--bleu)' }}>
                        {serie.type === 'plant' ? 'Plant' : 'Semis'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--encre-douce)' }}>{serie.longueur_metres}m</span>
                    </div>
                  )
                })}
              </div>
            </div>
            )),
          ])}
        </div>
      )}

      {vue === 'fournisseur' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--bleu-pale)', borderBottom: '1px solid var(--bleu-clair)', fontSize: 13, fontWeight: 500, color: 'var(--bleu)' }}>
              Desbos · {commandesDesbos.length} séries
            </div>
            <div style={{ padding: '8px 14px' }}>
              {commandesDesbos.map((serie, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < commandesDesbos.length - 1 ? '1px solid var(--trait-leger)' : 'none', fontSize: 12 }}>
                  <span style={{ color: 'var(--encre-pale)', minWidth: 50 }}>{libelleSem(serie)}</span>
                  <span style={{ flex: 1, color: 'var(--encre)' }}>{serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}</span>
                  <span style={{ color: 'var(--encre-douce)' }}>{serie.longueur_metres}m</span>
                  {serie.nombre_plants && <span style={{ color: 'var(--bleu)', fontWeight: 500 }}>{serie.nombre_plants} plants</span>}
                </div>
              ))}
              <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid var(--trait)', fontSize: 12, fontWeight: 500, color: 'var(--bleu)' }}>
                Total : {commandesDesbos.reduce((acc, s) => acc + (s.nombre_plants || 0), 0)} plants
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--papier)', border: '1px solid var(--trait)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--vert-pale)', borderBottom: '1px solid var(--vert)', fontSize: 13, fontWeight: 500, color: 'var(--vert-fonce)' }}>
              Pépinière interne · {commandesPepi.length} séries
            </div>
            <div style={{ padding: '8px 14px' }}>
              {commandesPepi.map((serie, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < commandesPepi.length - 1 ? '1px solid var(--trait-leger)' : 'none', fontSize: 12 }}>
                  <span style={{ color: 'var(--encre-pale)', minWidth: 50 }}>{libelleSem(serie)}</span>
                  <span style={{ flex: 1, color: 'var(--encre)' }}>{serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}</span>
                  <span style={{ color: 'var(--encre-douce)' }}>{serie.longueur_metres}m</span>
                  {serie.nombre_plants && <span style={{ color: 'var(--vert-fonce)', fontWeight: 500 }}>{serie.nombre_plants} plants</span>}
                </div>
              ))}
              <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid var(--trait)', fontSize: 12, fontWeight: 500, color: 'var(--vert-fonce)' }}>
                Total : {commandesPepi.reduce((acc, s) => acc + (s.nombre_plants || 0), 0)} plants
              </div>
            </div>
          </div>
        </div>
      )}

      {vue === 'alertes' && (
        <div>
          {alertes.length === 0 ? (
            <div style={{ background: 'var(--vert-pale)', border: '1px solid var(--vert)', borderRadius: 0, padding: 20, fontSize: 13, color: 'var(--vert-fonce)' }}>
              ✓ Aucune alerte urgente cette semaine
            </div>
          ) : alertes.map((serie, i) => {
            const delaiPrepa = semainesPrepa(serie.semaine_plantation)
            const semaineDebutPrepa = anneeEtSemaine(serie.annee, serie.semaine_plantation - delaiPrepa).semaine
            return (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'var(--jaune-pale)', border: '1px solid var(--jaune)', borderRadius: 0, marginBottom: 8 }}>
                <AlertTriangle size={16} color="#9a6a00" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--encre)', marginBottom: 3 }}>
                    {serie.legumes?.nom}{serie.varietes?.nom ? ` · ${serie.varietes.nom}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--encre-douce)' }}>
                    Plantation semaine {serie.reel.semaine}{serie.reel.annee !== ANNEE ? ` (${serie.reel.annee})` : ''} · Début prépa sol avant semaine {semaineDebutPrepa} ({delaiPrepa} semaines minimum)
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}