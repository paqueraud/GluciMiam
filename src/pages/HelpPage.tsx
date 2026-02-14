import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { ArrowLeft, Search, X, ChevronRight, ChevronUp, ChevronDown, Camera, Settings, Users, Database, Download, AlertTriangle, Lightbulb, HelpCircle, Pencil, Scale } from 'lucide-react';

interface HelpPageProps {
  onClose: () => void;
}

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string;
  keywords: string;
}

const SECTIONS_DATA: { id: string; title: string; iconName: string; keywords: string; content: string }[] = [
  {
    id: 'getting-started',
    title: 'Démarrage rapide',
    iconName: 'camera',
    keywords: 'commencer démarrer début première session photo',
    content: `Pour utiliser GlucIA, suivez ces étapes :

1. Créer un profil utilisateur
Depuis le menu latéral, cliquez sur Nouvel utilisateur. Renseignez votre nom, âge, et la longueur de votre index (mesurée en mm). Cette mesure sert d'étalon pour estimer la taille des aliments.

2. Configurer le LLM
Allez dans Configuration LLM et choisissez un fournisseur d'IA (Gemini est gratuit). Entrez votre clé API. Testez la connexion.

3. Importer votre base de données alimentaire
Allez dans Importer BDD et chargez votre fichier Excel (.xlsx) contenant vos aliments et leurs glucides pour 100g. Note : une base de données de plus de 500 aliments est déjà intégrée dans l'application.

4. Commencer un repas
Sur l'écran d'accueil, appuyez sur Nouvelle session. Sélectionnez votre profil si vous en avez plusieurs, puis prenez en photo votre plat.`,
  },
  {
    id: 'new-session',
    title: 'Nouvelle session repas',
    iconName: 'camera',
    keywords: 'session repas nouvelle commencer photo caméra profil utilisateur',
    content: `Une session repas regroupe toutes les photos et analyses d'un même repas.

Si vous n'avez qu'un seul profil, il est sélectionné automatiquement. Sinon, choisissez votre profil dans la liste.

Après la sélection du profil, la caméra s'ouvre. Vous pouvez :
- Photo : prendre une photo statique du plat
- Vidéo 5s : filmer le plat sous différents angles (une image sera extraite)
- Galerie : choisir une image existante de votre galerie

Astuce : Ajoutez un contexte textuel (ex: "2 biscuits nutella", "pâtes carbonara 200g") pour aider l'IA à identifier le plat correctement.

Le bouton + en bas de la session permet d'ajouter d'autres photos au même repas. Le bouton Fin de session repas clôture la session.`,
  },
  {
    id: 'food-analysis',
    title: 'Analyse des aliments par IA',
    iconName: 'search',
    keywords: 'analyse IA LLM intelligence artificielle reconnaissance aliment photo glucides estimation',
    content: `L'analyse se fait en plusieurs étapes :

1. Envoi au LLM
La photo est envoyée au fournisseur d'IA choisi (Claude, Gemini, ChatGPT) avec les informations de contexte.

2. Identification et estimation
L'IA identifie l'aliment, estime son poids en utilisant votre doigt comme référence, et calcule les glucides.

3. Vérification BDD locale
Si votre base de données alimentaire contient l'aliment identifié, ses glucides/100g sont utilisés en priorité à la place de l'estimation de l'IA.

4. Fallback OpenFoodFacts
Si l'aliment n'est pas dans votre BDD locale, une recherche est effectuée sur OpenFoodFacts pour vérifier les valeurs.

Astuce : Cliquez sur Détail LLM sous chaque analyse pour voir le raisonnement complet de l'IA.`,
  },
  {
    id: 'edit-food',
    title: 'Corriger les glucides et le poids',
    iconName: 'pencil',
    keywords: 'corriger éditer modifier glucides poids grammes changer base données aliment',
    content: `Chaque carte d'aliment offre plusieurs options d'édition :

Modifier les glucides
Cliquez sur l'icône crayon à côté de la valeur en grammes de glucides. Entrez la valeur correcte et validez.

Modifier le poids
Cliquez sur l'icône crayon à côté du poids estimé. Si les glucides/100g sont connus, le total sera recalculé automatiquement.

Choisir depuis la base de données
Cliquez sur l'icône loupe à côté du nom de l'aliment pour ouvrir le sélecteur de base de données. Utilisez la barre de recherche ou l'alphabet sur le côté pour trouver rapidement votre aliment. Les glucides seront recalculés avec la valeur de la BDD.

Supprimer une entrée
Cliquez sur l'icône poubelle en haut à droite de la carte, puis confirmez la suppression.`,
  },
  {
    id: 'pump-tracking',
    title: 'Suivi pompe à insuline',
    iconName: 'scale',
    keywords: 'pompe insuline bolus glucides total restant entré',
    content: `Le header de la session affiche trois compteurs :

- Total glucides : somme de tous les glucides estimés/corrigés de la session
- Dans pompe : glucides déjà renseignés dans votre pompe à insuline (éditable en cliquant dessus)
- Restant : différence entre le total et ce qui est dans la pompe

Astuce : Le compteur "Restant" vous indique combien de glucides vous devez encore entrer dans votre pompe pour couvrir le repas.`,
  },
  {
    id: 'food-database',
    title: 'Base de données alimentaire',
    iconName: 'database',
    keywords: 'base données aliments excel xlsx importer import fichier glucides 100g',
    content: `La base de données alimentaire locale permet d'avoir des valeurs de glucides précises et personnalisées.

Une base de plus de 500 aliments courants est déjà intégrée dans l'application au premier lancement.

Format du fichier Excel
Le fichier doit contenir deux colonnes :
- Aliment : nom de l'aliment
- Glucides % (en g/100g) : teneur en glucides pour 100g

Importer
Menu > Importer BDD > sélectionnez votre fichier .xlsx. Les aliments déjà présents ne seront pas dupliqués.

Priorité des données
Lors de l'analyse, les valeurs sont utilisées dans cet ordre :
1. Base de données locale (votre fichier Excel)
2. OpenFoodFacts (recherche en ligne)
3. Estimation de l'IA (en dernier recours)`,
  },
  {
    id: 'llm-config',
    title: 'Configuration du LLM',
    iconName: 'settings',
    keywords: 'configuration LLM IA clé API gemini claude chatgpt openai modèle fournisseur',
    content: `GlucIA supporte plusieurs fournisseurs d'intelligence artificielle :

Fournisseurs disponibles
- Gemini (Google) : gratuit, bonne qualité d'analyse
- Claude (Anthropic) : meilleure qualité, payant
- ChatGPT (OpenAI) : GPT-4o avec vision, payant
- Perplexity : recherche augmentée (pas d'analyse d'image)

Clés API
Chaque fournisseur conserve sa propre clé API. Quand vous changez de fournisseur, votre clé précédente est sauvegardée et sera restaurée si vous revenez à ce fournisseur.

Astuce : Utilisez le bouton Tester la connexion pour vérifier que votre clé API fonctionne avant de sauvegarder.`,
  },
  {
    id: 'user-profiles',
    title: 'Gestion des profils',
    iconName: 'users',
    keywords: 'profil utilisateur créer modifier supprimer index doigt sensibilité insuline ratio glucides',
    content: `Chaque profil utilisateur contient :
- Nom et âge
- Longueur de l'index (mm) : sert d'étalon de mesure sur les photos
- Sensibilité à l'insuline : par période horaire (mg/dL par unité d'insuline)
- Ratio de glucides : par période horaire (grammes par unité d'insuline)

Créer / Modifier / Supprimer
Depuis le menu latéral :
- Nouvel utilisateur : créer un nouveau profil
- Modifier utilisateur : éditer un profil existant (icône poubelle pour supprimer)`,
  },
  {
    id: 'import-export',
    title: 'Import / Export des données',
    iconName: 'download',
    keywords: 'import export sauvegarder backup restaurer json données',
    content: `Exporter
Menu > Exporter BDD : télécharge un fichier JSON contenant toutes vos données (profils, sessions, aliments, configuration).

Importer
Menu > Importer BDD : importez un fichier JSON exporté précédemment ou un fichier Excel de base de données alimentaire.

Astuce : Exportez régulièrement vos données pour créer des sauvegardes. Les données sont stockées localement dans votre navigateur et peuvent être perdues si vous videz le cache.`,
  },
  {
    id: 'faq',
    title: 'FAQ',
    iconName: 'help',
    keywords: 'question fréquente faq problème pourquoi comment',
    content: `Q : Pourquoi l'estimation des glucides est-elle différente de la réalité ?
R : L'IA estime le poids visuellement, ce qui peut être imprécis. Importez votre base de données alimentaire pour que les glucides/100g soient exacts, et corrigez le poids manuellement si nécessaire.

Q : L'analyse échoue systématiquement, que faire ?
R : Vérifiez votre connexion internet et votre clé API (Configuration LLM > Tester la connexion). Essayez un autre fournisseur ou modèle.

Q : Puis-je utiliser l'app sans connexion internet ?
R : La caméra et l'interface fonctionnent hors ligne grâce au mode PWA. Cependant, l'analyse par IA nécessite une connexion.

Q : Comment mesurer la longueur de mon index ?
R : Mesurez du bout de l'index jusqu'à la première articulation avec une règle. Typiquement entre 65 et 85 mm.

Q : Mes données sont-elles envoyées sur un serveur ?
R : Les données sont stockées localement sur votre appareil. Seules les photos sont envoyées au fournisseur d'IA pour l'analyse, puis supprimées de leurs serveurs.

Q : Comment installer l'app sur mon téléphone ?
R : Ouvrez l'URL dans Chrome sur Android, puis appuyez sur le menu > "Ajouter à l'écran d'accueil". L'app fonctionnera comme une application native.`,
  },
  {
    id: 'troubleshooting',
    title: 'Dépannage',
    iconName: 'alert',
    keywords: 'problème erreur bug caméra LLM json incomplet timeout connexion',
    content: `La caméra ne s'ouvre pas
- Vérifiez que vous avez autorisé l'accès à la caméra dans les paramètres de votre navigateur
- Sur Android, utilisez Chrome (Firefox peut avoir des limitations)
- Essayez d'utiliser le bouton "Galerie" pour sélectionner une photo existante

Erreur 'JSON incomplet' ou 'Timeout'
- Le LLM a mis trop de temps à répondre. Relancez l'analyse.
- Essayez un modèle plus rapide (ex: Gemini Flash au lieu de Pro)
- Vérifiez votre connexion internet

L'app tourne en boucle / le spinner ne s'arrête pas
- Un timeout de 30 secondes est en place. Attendez qu'il se déclenche.
- Si le problème persiste, fermez l'app et rouvrez-la.

Les glucides estimés sont très différents de la réalité
- Importez votre base de données alimentaire (.xlsx) pour des valeurs précises
- Ajoutez toujours un contexte textuel pour aider l'IA
- Corrigez le poids et les glucides manuellement
- Choisissez l'aliment directement depuis la BDD via l'icône loupe

L'import Excel ne fonctionne pas
- Vérifiez que votre fichier est au format .xlsx
- Les colonnes doivent s'appeler "Aliment" et "Glucides % (en g/100g)"
- Les entrées d'une seule lettre (séparateurs alphabétiques) sont automatiquement ignorées`,
  },
  {
    id: 'best-practices',
    title: 'Bonnes pratiques',
    iconName: 'lightbulb',
    keywords: 'conseil astuce bonne pratique meilleur précis photo lumière angle',
    content: `Pour de meilleures estimations :

Éclairage
Prenez vos photos avec un bon éclairage naturel. Évitez les ombres fortes et le contre-jour.

Position du doigt
Placez votre index à côté de l'aliment, à la même distance de l'objectif. Le doigt doit être bien visible et net.

Angle de vue
Photographiez le plat du dessus (vue plongeante) pour une meilleure estimation des volumes.

Contexte textuel
Ajoutez toujours un descriptif : "2 biscuits nutella", "150g de riz basmati cuit", "1 pomme moyenne". Plus vous êtes précis, meilleure sera l'analyse.

Base de données
Importez et enrichissez votre base de données alimentaire avec vos aliments courants. Les valeurs de la BDD locale sont toujours prioritaires.

Vérification systématique
Vérifiez et corrigez les estimations de l'IA, surtout pour les aliments riches en glucides. Utilisez le sélecteur de BDD pour les aliments connus.`,
  },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  camera: <Camera size={16} />,
  search: <Search size={16} />,
  pencil: <Pencil size={16} />,
  scale: <Scale size={16} />,
  database: <Database size={16} />,
  settings: <Settings size={16} />,
  users: <Users size={16} />,
  download: <Download size={16} />,
  help: <HelpCircle size={16} />,
  alert: <AlertTriangle size={16} />,
  lightbulb: <Lightbulb size={16} />,
};

// Count occurrences of query in text
function countOccurrences(text: string, query: string): number {
  if (!query) return 0;
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  let count = 0;
  let pos = lower.indexOf(qLower);
  while (pos !== -1) {
    count++;
    pos = lower.indexOf(qLower, pos + 1);
  }
  return count;
}

// Render text with highlighted matches. counterRef is a mutable object { value: number } used
// to assign a sequential global index to each match across all HighlightedText calls.
function HighlightedText({ text, searchQuery, currentGlobalIndex, counter }: {
  text: string;
  searchQuery: string;
  currentGlobalIndex: number;
  counter: React.RefObject<number>;
}) {
  if (!searchQuery.trim()) return <>{text}</>;

  const lower = text.toLowerCase();
  const queryLower = searchQuery.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let pos = lower.indexOf(queryLower);

  while (pos !== -1) {
    if (pos > lastIndex) {
      parts.push(<span key={`t-${pos}`}>{text.slice(lastIndex, pos)}</span>);
    }

    const globalIdx = counter.current;
    counter.current++;
    const isCurrent = globalIdx === currentGlobalIndex;

    parts.push(
      <mark
        key={`m-${pos}`}
        data-match-global={globalIdx}
        style={{
          background: isCurrent ? 'rgba(255,220,50,0.45)' : 'rgba(255,220,50,0.18)',
          color: 'inherit',
          borderRadius: 3,
          padding: '1px 3px',
          fontWeight: isCurrent ? 700 : 'inherit',
          border: isCurrent ? '2px solid rgba(255,200,0,0.9)' : '1px solid rgba(255,220,50,0.3)',
          boxShadow: isCurrent
            ? '0 0 10px rgba(255,220,50,0.6), 0 0 20px rgba(255,200,0,0.3), 0 0 4px rgba(255,220,50,0.8)'
            : 'none',
          outline: isCurrent ? '2px solid rgba(255,220,50,0.4)' : 'none',
          outlineOffset: isCurrent ? '1px' : '0',
        }}
      >
        {text.slice(pos, pos + searchQuery.length)}
      </mark>
    );

    lastIndex = pos + searchQuery.length;
    pos = lower.indexOf(queryLower, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`t-end`}>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

export default function HelpPage({ onClose }: HelpPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentRef = useRef<HTMLDivElement | null>(null);

  const sections: HelpSection[] = useMemo(() =>
    SECTIONS_DATA.map((s) => ({
      ...s,
      icon: ICON_MAP[s.iconName] || <HelpCircle size={16} />,
    })),
  []);

  // Total match count and which sections have matches
  const { totalMatches, matchingSectionIds, sectionMatchInfo } = useMemo(() => {
    if (!searchQuery.trim()) return { totalMatches: 0, matchingSectionIds: new Set<string>(), sectionMatchInfo: [] as { id: string; countBefore: number }[] };
    const queryLower = searchQuery.toLowerCase();
    const ids = new Set<string>();
    let running = 0;
    const info: { id: string; countBefore: number }[] = [];

    for (const section of SECTIONS_DATA) {
      const fullText = section.title + '\n' + section.content;
      const count = countOccurrences(fullText, queryLower);
      if (count > 0) {
        ids.add(section.id);
        info.push({ id: section.id, countBefore: running });
        running += count;
      }
    }
    return { totalMatches: running, matchingSectionIds: ids, sectionMatchInfo: info };
  }, [searchQuery]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    return sections.filter((s) => matchingSectionIds.has(s.id));
  }, [sections, searchQuery, matchingSectionIds]);

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  // Find which section contains the current match and expand it, then scroll
  useEffect(() => {
    if (totalMatches === 0 || !searchQuery.trim()) return;

    // Find which section the current match is in
    let targetSectionId: string | null = null;
    for (let i = sectionMatchInfo.length - 1; i >= 0; i--) {
      if (currentMatchIndex >= sectionMatchInfo[i].countBefore) {
        targetSectionId = sectionMatchInfo[i].id;
        break;
      }
    }

    if (targetSectionId) {
      setExpandedSection(targetSectionId);
    }

    // Scroll to the highlighted element after React re-renders
    const timer = setTimeout(() => {
      const el = contentRef.current?.querySelector(`[data-match-global="${currentMatchIndex}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentMatchIndex, totalMatches, searchQuery, sectionMatchInfo]);

  const goNextMatch = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
  }, [totalMatches]);

  const goPrevMatch = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  }, [totalMatches]);

  const scrollToSection = (id: string) => {
    setExpandedSection(id);
    setTimeout(() => {
      sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Mutable counter reset at each render to assign sequential global indices to matches.
  const renderCounter = useRef(0);

  const renderContent = (text: string) => {
    const lines = text.split('\n');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} style={{ height: 8 }} />;

          const hl = (t: string) => (
            <HighlightedText text={t} searchQuery={searchQuery} currentGlobalIndex={currentMatchIndex} counter={renderCounter} />
          );

          // Detect numbered steps
          const stepMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
          if (stepMatch) {
            return (
              <div key={i} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-primary)',
                  color: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                }}>
                  {stepMatch[1]}
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{hl(stepMatch[2])}</div>
              </div>
            );
          }

          if (trimmed.startsWith('Q : ')) {
            return (
              <div key={i} style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, marginTop: 8 }}>
                {hl(trimmed)}
              </div>
            );
          }
          if (trimmed.startsWith('R : ')) {
            return (
              <div key={i} style={{ paddingLeft: 16, borderLeft: '2px solid var(--border-color)' }}>
                {hl(trimmed.slice(4))}
              </div>
            );
          }

          if (trimmed.startsWith('Astuce :') || trimmed.startsWith('Astuce :')) {
            return (
              <div key={i} style={{
                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
                fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4,
              }}>
                <Lightbulb size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1 }} />
                <span>{hl(trimmed.replace(/^Astuce\s*:\s*/, ''))}</span>
              </div>
            );
          }

          if (trimmed.startsWith('- ')) {
            return (
              <div key={i} style={{ paddingLeft: 16, display: 'flex', gap: 6 }}>
                <span style={{ color: 'var(--accent-primary)' }}>•</span>
                <span>{hl(trimmed.slice(2))}</span>
              </div>
            );
          }

          const nextLine = lines[i + 1]?.trim() || '';
          const isTitle = trimmed.length < 60 && !trimmed.endsWith('.') && !trimmed.endsWith(':') && !trimmed.startsWith('-') && nextLine && (nextLine.startsWith('-') || nextLine.length > 40);
          if (isTitle) {
            return (
              <div key={i} style={{ color: 'var(--accent-primary)', fontSize: 13, fontWeight: 600, marginTop: 8 }}>
                {hl(trimmed)}
              </div>
            );
          }

          return <div key={i}>{hl(trimmed)}</div>;
        })}
      </div>
    );
  };

  // Reset global counter before each render
  renderCounter.current = 0;

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
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
          Aide
        </h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
          <X size={20} />
        </button>
      </div>

      {/* Search bar */}
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
            <>
              {totalMatches > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 11,
                    color: 'var(--accent-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>
                    {currentMatchIndex + 1}/{totalMatches}
                  </span>
                  <button
                    onClick={goPrevMatch}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={goNextMatch}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              )}
              {totalMatches === 0 && searchQuery.trim() && (
                <span style={{ fontSize: 11, color: 'var(--danger)', whiteSpace: 'nowrap' }}>0 résultat</span>
              )}
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Table of contents */}
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
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 12px', background: 'none', border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                  color: 'var(--text-primary)', textAlign: 'left', fontSize: 13,
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
        {filteredSections.map((s) => {
          const isExpanded = expandedSection === s.id || !!searchQuery;
          return (
            <div
              key={s.id}
              ref={(el) => { sectionRefs.current[s.id] = el; }}
              style={{ marginBottom: 16 }}
            >
              <button
                onClick={() => setExpandedSection(expandedSection === s.id ? null : s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '12px 14px',
                  background: expandedSection === s.id ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                  border: `1px solid ${expandedSection === s.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  color: 'var(--text-primary)', textAlign: 'left', fontSize: 14, fontWeight: 600,
                }}
              >
                <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>{s.icon}</span>
                <span style={{ flex: 1 }}>
                  <HighlightedText text={s.title} searchQuery={searchQuery} currentGlobalIndex={currentMatchIndex} counter={renderCounter} />
                </span>
                <ChevronRight
                  size={14}
                  color="var(--text-muted)"
                  style={{
                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
              {isExpanded && (
                <div style={{
                  padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)',
                  lineHeight: 1.6, borderLeft: '2px solid var(--accent-primary)',
                  marginLeft: 20, marginTop: 4,
                }}>
                  {renderContent(s.content)}
                </div>
              )}
            </div>
          );
        })}

        {filteredSections.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Aucun résultat pour "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
