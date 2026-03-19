"use client";

import { motion } from "framer-motion";
import {
  Map,
  Brain,
  Wrench,
  Phone,
  ChevronRight,
  Zap,
  Shield,
  BarChart3,
} from "lucide-react";

const PURPLE = "#632E62";

const products = [
  {
    icon: Map,
    title: "Bausite Geo",
    desc: "GIS-Plattform mit swisstopo, Leitungskataster und OEREB-Integration",
    color: "#2E86C1",
    status: "Prototyp",
  },
  {
    icon: Brain,
    title: "Bausite Brain",
    desc: "KI-Agenten fuer Kosten, Bewilligungen, Leitungen und Projektplanung",
    color: "#8E44AD",
    status: "Konzept",
  },
  {
    icon: Phone,
    title: "Bausite Voice",
    desc: "Voice Agents fuer Kundenservice und Stoerungsmeldungen",
    color: "#27AE60",
    status: "Geplant",
  },
  {
    icon: Wrench,
    title: "Bausite Flow",
    desc: "n8n Workflows fuer automatisierte Prozesse und Integrationen",
    color: "#E67E22",
    status: "Geplant",
  },
];

const features = [
  {
    icon: Zap,
    title: "Schweizer Geodaten",
    desc: "Kostenloser Zugang zu swisstopo, 26 Kantonsportalen und OEREB",
  },
  {
    icon: Shield,
    title: "Datenschutz",
    desc: "Schweizer Hosting, lokale LLMs mit Ollama, DSGVO-konform",
  },
  {
    icon: BarChart3,
    title: "ROI-getrieben",
    desc: "254% ROI fuer Stadtwerke - weniger Planungsfehler, schnellere Bewilligungen",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ background: PURPLE }}
            >
              B
            </div>
            <span className="text-xl font-bold" style={{ color: PURPLE }}>
              Bausite
            </span>
          </div>
          <nav className="hidden md:flex gap-6 text-sm text-gray-600">
            <a href="#produkte" className="hover:text-gray-900">
              Produkte
            </a>
            <a href="#features" className="hover:text-gray-900">
              Features
            </a>
            <a href="#kontakt" className="hover:text-gray-900">
              Kontakt
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{ color: PURPLE }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Digitale Infrastruktur
            <br />
            fuer Schweizer Stadtwerke
          </motion.h1>
          <motion.p
            className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            GIS-Plattform, KI-Agenten und Automatisierung - alles was
            kommunale Versorger fuer die digitale Transformation brauchen.
          </motion.p>
          <motion.div
            className="flex gap-4 justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <a
              href="#produkte"
              className="px-6 py-3 rounded-lg text-white font-medium flex items-center gap-2 hover:opacity-90 transition"
              style={{ background: PURPLE }}
            >
              Produkte entdecken <ChevronRight size={18} />
            </a>
            <a
              href="/brain"
              className="px-6 py-3 rounded-lg border-2 font-medium flex items-center gap-2 hover:bg-gray-50 transition"
              style={{ borderColor: PURPLE, color: PURPLE }}
            >
              <Brain size={18} /> Brain Demo
            </a>
          </motion.div>
        </div>
      </section>

      {/* Produkte */}
      <section id="produkte" className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl font-bold mb-12 text-center"
            style={{ color: PURPLE }}
          >
            Unsere Produkte
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {products.map((p, i) => (
              <motion.div
                key={p.title}
                className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: p.color }}
                  >
                    <p.icon size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">{p.title}</h3>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: p.color + "15",
                          color: p.color,
                        }}
                      >
                        {p.status}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{p.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-3xl font-bold mb-12 text-center"
            style={{ color: PURPLE }}
          >
            Warum Bausite?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                viewport={{ once: true }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-white"
                  style={{ background: PURPLE }}
                >
                  <f.icon size={24} />
                </div>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 px-6 text-white text-center text-sm"
        style={{ background: PURPLE }}
      >
        <p>&copy; 2026 Bausite - SWG Grenchen</p>
        <p className="opacity-60 mt-1">
          Digitale Infrastruktur fuer kommunale Versorger
        </p>
      </footer>
    </div>
  );
}
