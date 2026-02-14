import { ArrowLeft, Heart } from 'lucide-react';

interface AboutPageProps {
  onClose: () => void;
}

export default function AboutPage({ onClose }: AboutPageProps) {
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
          À propos
        </h2>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 24,
        maxWidth: 500,
        margin: '0 auto',
        width: '100%',
      }}>
        {/* App title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 36,
            fontWeight: 800,
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.1,
          }}>
            GluciMiam
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
            Version 1.0.0
          </p>
        </div>

        {/* Description */}
        <Section title="Description">
          <p>
            GluciMiam est une application progressive (PWA) de comptage des glucides
            destinée aux personnes diabétiques sous insulinothérapie fonctionnelle.
          </p>
          <p style={{ marginTop: 8 }}>
            Elle utilise l'intelligence artificielle (LLM avec vision) pour analyser
            des photos de plats et estimer automatiquement leur contenu en glucides,
            en utilisant le doigt de l'utilisateur comme étalon de mesure pour estimer
            les portions.
          </p>
        </Section>

        {/* How it works */}
        <Section title="Comment ça marche">
          <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>Prenez en photo votre plat avec votre index visible comme référence de taille</li>
            <li>L'IA analyse l'image, identifie les aliments et estime les portions</li>
            <li>Les glucides sont calculés à partir de la base de données alimentaire locale et des données nutritionnelles</li>
            <li>Vous pouvez corriger manuellement les valeurs et choisir un aliment depuis la base de données</li>
            <li>Le total des glucides est affiché pour faciliter le bolus d'insuline</li>
          </ol>
        </Section>

        {/* Technologies */}
        <Section title="Technologies">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['React 19', 'TypeScript', 'Vite', 'Zustand', 'Dexie (IndexedDB)', 'Framer Motion', 'PWA'].map((tech) => (
              <span key={tech} style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}>
                {tech}
              </span>
            ))}
          </div>
        </Section>

        {/* LLM Providers */}
        <Section title="Fournisseurs IA supportés">
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Claude (Anthropic) - Recommandé</li>
            <li>Gemini (Google) - Gratuit</li>
            <li>ChatGPT (OpenAI)</li>
            <li>Perplexity</li>
          </ul>
        </Section>

        {/* License */}
        <Section title="Licence">
          <p>
            Cette application est distribuée sous licence <strong>MIT</strong>.
          </p>
          <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            Copyright (c) 2025 GluciMiam
          </p>
          <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Permission is hereby granted, free of charge, to any person obtaining a copy
            of this software and associated documentation files, to deal in the Software
            without restriction, including without limitation the rights to use, copy,
            modify, merge, publish, distribute, sublicense, and/or sell copies of the
            Software, subject to the conditions of the MIT License.
          </p>
        </Section>

        {/* Credits */}
        <Section title="Crédits">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
            <span>Développé avec</span>
            <Heart size={14} color="var(--danger)" fill="var(--danger)" />
            <span>pour la communauté diabétique</span>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            Données nutritionnelles : base de données locale personnalisable,
            OpenFoodFacts, table ANSES (Agence nationale de sécurité sanitaire).
          </p>
        </Section>

        {/* Disclaimer */}
        <div style={{
          marginTop: 24,
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid var(--warning)',
          fontSize: 11,
          color: 'var(--warning)',
          lineHeight: 1.5,
        }}>
          <strong>Avertissement :</strong> GluciMiam est un outil d'aide au comptage des glucides.
          Les estimations fournies par l'IA sont indicatives et ne remplacent pas l'avis
          d'un professionnel de santé. Vérifiez toujours les valeurs avant d'ajuster votre
          traitement insulinique.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--accent-primary)',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {title}
      </h3>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
