import { useState, useRef, useMemo } from 'react';
import { ArrowLeft, Search, X, ChevronRight, Camera, Settings, Users, Database, Download, AlertTriangle, Lightbulb, HelpCircle, Pencil, Scale } from 'lucide-react';

interface HelpPageProps {
  onClose: () => void;
}

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  keywords: string;
}

export default function HelpPage({ onClose }: HelpPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sections: HelpSection[] = useMemo(() => [
    {
      id: 'getting-started',
      title: 'Démarrage rapide',
      icon: <Camera size={16} />,
      keywords: 'commencer démarrer début première session photo',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p>Pour utiliser GluciMiam, suivez ces étapes :</p>
          <Step n={1} title="Créer un profil utilisateur">
            Depuis le menu latéral, cliquez sur <b>Nouvel utilisateur</b>. Renseignez votre nom, âge, et la longueur de votre index (mesurée en mm). Cette mesure sert d'étalon pour estimer la taille des aliments.
          </Step>
          <Step n={2} title="Configurer le LLM">
            Allez dans <b>Configuration LLM</b> et choisissez un fournisseur d'IA (Gemini est gratuit). Entrez votre clé API. Testez la connexion.
          </Step>
          <Step n={3} title="Importer votre base de données alimentaire">
            Allez dans <b>Importer BDD</b> et chargez votre fichier Excel (.xlsx) contenant vos aliments et leurs glucides pour 100g.
          </Step>
          <Step n={4} title="Commencer un repas">
            Sur l'écran d'accueil, appuyez sur <b>Nouvelle session</b>. Sélectionnez votre profil si vous en avez plusieurs, puis prenez en photo votre plat.
          </Step>
        </div>
      ),
    },
    {
      id: 'new-session',
      title: 'Nouvelle session repas',
      icon: <Camera size={16} />,
      keywords: 'session repas nouvelle commencer photo caméra profil utilisateur',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p>Une <b>session repas</b> regroupe toutes les photos et analyses d'un même repas.</p>
          <Tip>
            Si vous n'avez qu'un seul profil, il est sélectionné automatiquement. Sinon, choisissez votre profil dans la liste.
          </Tip>
          <p>Après la sélection du profil, la caméra s'ouvre. Vous pouvez :</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><b>Photo</b> : prendre une photo statique du plat</li>
            <li><b>Vidéo 5s</b> : filmer le plat sous différents angles (une image sera extraite)</li>
            <li><b>Galerie</b> : choisir une image existante de votre galerie</li>
          </ul>
          <Tip>
            Ajoutez un <b>contexte textuel</b> (ex: "2 biscuits nutella", "pâtes carbonara 200g") pour aider l'IA à identifier le plat correctement.
          </Tip>
          <p>Le bouton <b>+</b> en bas de la session permet d'ajouter d'autres photos au même repas. Le bouton <b>Fin de session repas</b> clôture la session.</p>
        </div>
      ),
    },
    {
      id: 'food-analysis',
      title: 'Analyse des aliments par IA',
      icon: <Search size={16} />,
      keywords: 'analyse IA LLM intelligence artificielle reconnaissance aliment photo glucides estimation',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p>L'analyse se fait en plusieurs étapes :</p>
          <Step n={1} title="Envoi au LLM">
            La photo est envoyée au fournisseur d'IA choisi (Claude, Gemini, ChatGPT) avec les informations de contexte.
          </Step>
          <Step n={2} title="Identification et estimation">
            L'IA identifie l'aliment, estime son poids en utilisant votre doigt comme référence, et calcule les glucides.
          </Step>
          <Step n={3} title="Vérification BDD locale">
            Si votre base de données alimentaire contient l'aliment identifié, ses glucides/100g sont utilisés en priorité à la place de l'estimation de l'IA.
          </Step>
          <Step n={4} title="Fallback OpenFoodFacts">
            Si l'aliment n'est pas dans votre BDD locale, une recherche est effectuée sur OpenFoodFacts pour vérifier les valeurs.
          </Step>
          <Tip>
            Cliquez sur <b>Détail LLM</b> sous chaque analyse pour voir le raisonnement complet de l'IA.
          </Tip>
        </div>
      ),
    },
    {
      id: 'edit-food',
      title: 'Corriger les glucides et le poids',
      icon: <Pencil size={16} />,
      keywords: 'corriger éditer modifier glucides poids grammes changer base données aliment',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p>Chaque carte d'aliment offre plusieurs options d'édition :</p>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Modifier les glucides</h4>
          <p>Cliquez sur l'icône crayon à côté de la valeur en grammes de glucides. Entrez la valeur correcte et validez.</p>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Modifier le poids</h4>
          <p>Cliquez sur l'icône crayon à côté du poids estimé. Si les glucides/100g sont connus, le total sera recalculé automatiquement.</p>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Choisir depuis la base de données</h4>
          <p>Cliquez sur l'icône loupe à côté du nom de l'aliment pour ouvrir le sélecteur de base de données. Utilisez la barre de recherche ou l'alphabet sur le côté pour trouver rapidement votre aliment. Les glucides seront recalculés avec la valeur de la BDD.</p>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Supprimer une entrée</h4>
          <p>Cliquez sur l'icône poubelle en haut à droite de la carte, puis confirmez la suppression.</p>
        </div>
      ),
    },
    {
      id: 'pump-tracking',
      title: 'Suivi pompe à insuline',
      icon: <Scale size={16} />,
      keywords: 'pompe insuline bolus glucides total restant entré',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p>Le header de la session affiche trois compteurs :</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><b>Total glucides</b> : somme de tous les glucides estimés/corrigés de la session</li>
            <li><b>Dans pompe</b> : glucides déjà renseignés dans votre pompe à insuline (éditable en cliquant dessus)</li>
            <li><b>Restant</b> : différence entre le total et ce qui est dans la pompe</li>
          </ul>
          <Tip>
            Le compteur "Restant" vous indique combien de glucides vous devez encore entrer dans votre pompe pour couvrir le repas.
          </Tip>
        </div>
      ),
    },
    {
      id: 'food-database',
      title: 'Base de données alimentaire',
      icon: <Database size={16} />,
      keywords: 'base données aliments excel xlsx importer import fichier glucides 100g',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p>La base de données alimentaire locale permet d'avoir des valeurs de glucides précises et personnalisées.</p>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Format du fichier Excel</h4>
          <p>Le fichier doit contenir deux colonnes :</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><b>Aliment</b> : nom de l'aliment</li>
            <li><b>Glucides % (en g/100g)</b> : teneur en glucides pour 100g</li>
          </ul>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Importer</h4>
          <p>Menu &gt; <b>Importer BDD</b> &gt; sélectionnez votre fichier .xlsx. Les aliments déjà présents ne seront pas dupliqués.</p>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Priorité des données</h4>
          <p>Lors de l'analyse, les valeurs sont utilisées dans cet ordre :</p>
          <ol style={{ paddingLeft: 20 }}>
            <li>Base de données locale (votre fichier Excel)</li>
            <li>OpenFoodFacts (recherche en ligne)</li>
            <li>Estimation de l'IA (en dernier recours)</li>
          </ol>
        </div>
      ),
    },
    {
      id: 'llm-config',
      title: 'Configuration du LLM',
      icon: <Settings size={16} />,
      keywords: 'configuration LLM IA clé API gemini claude chatgpt openai modèle fournisseur',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p>GluciMiam supporte plusieurs fournisseurs d'intelligence artificielle :</p>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Fournisseurs disponibles</h4>
          <ul style={{ paddingLeft: 20 }}>
            <li><b>Gemini (Google)</b> : gratuit, bonne qualité d'analyse</li>
            <li><b>Claude (Anthropic)</b> : meilleure qualité, payant</li>
            <li><b>ChatGPT (OpenAI)</b> : GPT-4o avec vision, payant</li>
            <li><b>Perplexity</b> : recherche augmentée (pas d'analyse d'image)</li>
          </ul>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Clés API</h4>
          <p>Chaque fournisseur conserve sa propre clé API. Quand vous changez de fournisseur, votre clé précédente est sauvegardée et sera restaurée si vous revenez à ce fournisseur.</p>
          <Tip>
            Utilisez le bouton <b>Tester la connexion</b> pour vérifier que votre clé API fonctionne avant de sauvegarder.
          </Tip>
        </div>
      ),
    },
    {
      id: 'user-profiles',
      title: 'Gestion des profils',
      icon: <Users size={16} />,
      keywords: 'profil utilisateur créer modifier supprimer index doigt sensibilité insuline ratio glucides',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p>Chaque profil utilisateur contient :</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><b>Nom et âge</b></li>
            <li><b>Longueur de l'index</b> (mm) : sert d'étalon de mesure sur les photos</li>
            <li><b>Sensibilité à l'insuline</b> : par période horaire (mg/dL par unité d'insuline)</li>
            <li><b>Ratio de glucides</b> : par période horaire (grammes par unité d'insuline)</li>
          </ul>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Créer / Modifier / Supprimer</h4>
          <p>Depuis le menu latéral :</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><b>Nouvel utilisateur</b> : créer un nouveau profil</li>
            <li><b>Modifier utilisateur</b> : éditer un profil existant (icône poubelle pour supprimer)</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'import-export',
      title: 'Import / Export des données',
      icon: <Download size={16} />,
      keywords: 'import export sauvegarder backup restaurer json données',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13 }}>Exporter</h4>
          <p>Menu &gt; <b>Exporter BDD</b> : télécharge un fichier JSON contenant toutes vos données (profils, sessions, aliments, configuration).</p>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13, marginTop: 4 }}>Importer</h4>
          <p>Menu &gt; <b>Importer BDD</b> : importez un fichier JSON exporté précédemment ou un fichier Excel de base de données alimentaire.</p>
          <Tip>
            Exportez régulièrement vos données pour créer des sauvegardes. Les données sont stockées localement dans votre navigateur et peuvent être perdues si vous videz le cache.
          </Tip>
        </div>
      ),
    },
    {
      id: 'faq',
      title: 'FAQ',
      icon: <HelpCircle size={16} />,
      keywords: 'question fréquente faq problème pourquoi comment',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FAQ q="Pourquoi l'estimation des glucides est-elle différente de la réalité ?">
            L'IA estime le poids visuellement, ce qui peut être imprécis. Importez votre base de données alimentaire pour que les glucides/100g soient exacts, et corrigez le poids manuellement si nécessaire.
          </FAQ>
          <FAQ q="L'analyse échoue systématiquement, que faire ?">
            Vérifiez votre connexion internet et votre clé API (Configuration LLM &gt; Tester la connexion). Essayez un autre fournisseur ou modèle.
          </FAQ>
          <FAQ q="Puis-je utiliser l'app sans connexion internet ?">
            La caméra et l'interface fonctionnent hors ligne grâce au mode PWA. Cependant, l'analyse par IA nécessite une connexion.
          </FAQ>
          <FAQ q="Comment mesurer la longueur de mon index ?">
            Mesurez du bout de l'index jusqu'à la première articulation avec une règle. Typiquement entre 65 et 85 mm.
          </FAQ>
          <FAQ q="Mes données sont-elles envoyées sur un serveur ?">
            Les données sont stockées localement sur votre appareil. Seules les photos sont envoyées au fournisseur d'IA pour l'analyse, puis supprimées de leurs serveurs.
          </FAQ>
          <FAQ q="Comment installer l'app sur mon téléphone ?">
            Ouvrez l'URL dans Chrome sur Android, puis appuyez sur le menu &gt; "Ajouter à l'écran d'accueil". L'app fonctionnera comme une application native.
          </FAQ>
        </div>
      ),
    },
    {
      id: 'troubleshooting',
      title: 'Dépannage',
      icon: <AlertTriangle size={16} />,
      keywords: 'problème erreur bug caméra LLM json incomplet timeout connexion',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Trouble title="La caméra ne s'ouvre pas">
            <ul style={{ paddingLeft: 20 }}>
              <li>Vérifiez que vous avez autorisé l'accès à la caméra dans les paramètres de votre navigateur</li>
              <li>Sur Android, utilisez Chrome (Firefox peut avoir des limitations)</li>
              <li>Essayez d'utiliser le bouton "Galerie" pour sélectionner une photo existante</li>
            </ul>
          </Trouble>
          <Trouble title="Erreur 'JSON incomplet' ou 'Timeout'">
            <ul style={{ paddingLeft: 20 }}>
              <li>Le LLM a mis trop de temps à répondre. Relancez l'analyse.</li>
              <li>Essayez un modèle plus rapide (ex: Gemini Flash au lieu de Pro)</li>
              <li>Vérifiez votre connexion internet</li>
            </ul>
          </Trouble>
          <Trouble title="L'app tourne en boucle / le spinner ne s'arrête pas">
            <ul style={{ paddingLeft: 20 }}>
              <li>Un timeout de 30 secondes est en place. Attendez qu'il se déclenche.</li>
              <li>Si le problème persiste, fermez l'app et rouvrez-la.</li>
            </ul>
          </Trouble>
          <Trouble title="Les glucides estimés sont très différents de la réalité">
            <ul style={{ paddingLeft: 20 }}>
              <li>Importez votre base de données alimentaire (.xlsx) pour des valeurs précises</li>
              <li>Ajoutez toujours un contexte textuel pour aider l'IA</li>
              <li>Corrigez le poids et les glucides manuellement</li>
              <li>Choisissez l'aliment directement depuis la BDD via l'icône loupe</li>
            </ul>
          </Trouble>
          <Trouble title="L'import Excel ne fonctionne pas">
            <ul style={{ paddingLeft: 20 }}>
              <li>Vérifiez que votre fichier est au format .xlsx</li>
              <li>Les colonnes doivent s'appeler "Aliment" et "Glucides % (en g/100g)"</li>
              <li>Les entrées d'une seule lettre (séparateurs alphabétiques) sont automatiquement ignorées</li>
            </ul>
          </Trouble>
        </div>
      ),
    },
    {
      id: 'best-practices',
      title: 'Bonnes pratiques',
      icon: <Lightbulb size={16} />,
      keywords: 'conseil astuce bonne pratique meilleur précis photo lumière angle',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h4 style={{ color: 'var(--accent-primary)', fontSize: 13 }}>Pour de meilleures estimations :</h4>
          <BestPractice title="Éclairage">
            Prenez vos photos avec un bon éclairage naturel. Évitez les ombres fortes et le contre-jour.
          </BestPractice>
          <BestPractice title="Position du doigt">
            Placez votre index à côté de l'aliment, à la même distance de l'objectif. Le doigt doit être bien visible et net.
          </BestPractice>
          <BestPractice title="Angle de vue">
            Photographiez le plat du dessus (vue plongeante) pour une meilleure estimation des volumes.
          </BestPractice>
          <BestPractice title="Contexte textuel">
            Ajoutez toujours un descriptif : "2 biscuits nutella", "150g de riz basmati cuit", "1 pomme moyenne". Plus vous êtes précis, meilleure sera l'analyse.
          </BestPractice>
          <BestPractice title="Base de données">
            Importez et enrichissez votre base de données alimentaire avec vos aliments courants. Les valeurs de la BDD locale sont toujours prioritaires.
          </BestPractice>
          <BestPractice title="Vérification systématique">
            Vérifiez et corrigez les estimations de l'IA, surtout pour les aliments riches en glucides. Utilisez le sélecteur de BDD pour les aliments connus.
          </BestPractice>
        </div>
      ),
    },
  ], []);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const lower = searchQuery.toLowerCase();
    return sections.filter(
      (s) => s.title.toLowerCase().includes(lower) || s.keywords.toLowerCase().includes(lower)
    );
  }, [sections, searchQuery]);

  const scrollToSection = (id: string) => {
    setExpandedSection(id);
    setTimeout(() => {
      sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          Aide
        </h2>
      </div>

      {/* Search bar (sticky) */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          border: '1px solid var(--border-color)',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans l'aide..."
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 14,
              flex: 1,
              fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Table of contents (only when not searching and nothing expanded) */}
        {!searchQuery && !expandedSection && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Sommaire
            </div>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>{s.icon}</span>
                <span style={{ flex: 1 }}>{s.title}</span>
                <ChevronRight size={14} color="var(--text-muted)" />
              </button>
            ))}
          </div>
        )}

        {/* Sections */}
        {filteredSections.map((s) => (
          <div
            key={s.id}
            ref={(el) => { sectionRefs.current[s.id] = el; }}
            style={{ marginBottom: 16 }}
          >
            <button
              onClick={() => setExpandedSection(expandedSection === s.id ? null : s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '12px 14px',
                background: expandedSection === s.id ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                border: `1px solid ${expandedSection === s.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                textAlign: 'left',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>{s.icon}</span>
              <span style={{ flex: 1 }}>{s.title}</span>
              <ChevronRight
                size={14}
                color="var(--text-muted)"
                style={{
                  transform: expandedSection === s.id ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            </button>
            {(expandedSection === s.id || searchQuery) && (
              <div style={{
                padding: '12px 16px',
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                borderLeft: '2px solid var(--accent-primary)',
                marginLeft: 20,
                marginTop: 4,
              }}>
                {s.content}
              </div>
            )}
          </div>
        ))}

        {filteredSections.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Aucun résultat pour "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components for help content
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-primary)',
        color: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 2,
      }}>
        {n}
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 'var(--radius-sm)',
      background: 'rgba(0,212,255,0.08)',
      border: '1px solid rgba(0,212,255,0.2)',
      fontSize: 12,
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
    }}>
      <Lightbulb size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, marginBottom: 4 }}>
        Q : {q}
      </div>
      <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--border-color)' }}>
        {children}
      </div>
    </div>
  );
}

function Trouble({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontWeight: 600, color: 'var(--warning)', fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <AlertTriangle size={13} /> {title}
      </div>
      <div style={{ fontSize: 12 }}>{children}</div>
    </div>
  );
}

function BestPractice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12 }}>{children}</div>
    </div>
  );
}
