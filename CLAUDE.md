# CLAUDE.md

Dies ist der Workspace fuer Bausite. Das Ziel ist der Aufbau einer hochperformanten digitalen Praesenz, Voice Agents und n8n Workflows. Der Tech-Stack ist Next.js, Vercel und Supabase. Handle stets proaktiv und erstelle sauberen, modernen Code.

## Projekt-Kontext

Bausite ist eine Plattform fuer Schweizer Stadtwerke (kommunale Versorger) mit Fokus auf:
- **Bausite Geo**: GIS-Plattform (swisstopo, PostGIS, Leitungskataster)
- **Bausite Brain**: KI-Agenten (LangGraph, Claude API, Ollama)
- **Bausite Voice**: Voice Agents fuer Kundenservice
- **Bausite Flow**: n8n Workflow-Automatisierung

## Tech-Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion, Lucide Icons
- **Backend**: Vercel (Hosting + Serverless Functions), Supabase (Auth + DB + Realtime)
- **KI**: Claude API (Anthropic), Ollama (lokal), LangGraph
- **GIS**: MapLibre GL JS, swisstopo WMTS, PostGIS
- **Automatisierung**: n8n (Self-hosted)

## Design

- Primaerfarbe: #632E62 (Bausite-Lila/Purple)
- Sprache: Deutsch (Schweizer Kontext)
- UI: Clean, modern, professionell

## Bestehende Dokumentation

Konzeptdokumente in `../netz/docs/`:
- GIS-Datenquellen, Systemvergleich, Geo-Konzept, Geo-Technik
- Brain-Architektur, MultiAgent, Produkt-Vision, Framework-Vergleich
- Funktionierender Brain-Prototyp in `../netz/docs/brain_prototype/`
- Funktionierender Geo-Prototyp in `../netz/docs/prototyp.html`

## Befehle

```bash
npm run dev     # Dev-Server starten
npm run build   # Production Build
npm run lint    # ESLint
```
