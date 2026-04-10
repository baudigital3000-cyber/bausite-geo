"use client";

import { motion } from "framer-motion";
import {
  PenTool,
  Workflow,
  Globe,
  Users,
  Zap,
  FolderKanban,
  PieChart,
  Cpu,
} from "lucide-react";

const PURPLE = "#632E62";

const fokusthemen = [
  {
    icon: PenTool,
    label: "CAD Automation",
    description: "AutoCAD & LISP",
    color: "#2E86C1",
  },
  {
    icon: Workflow,
    label: "FME Workflows",
    description: "Datentransformation",
    color: "#E67E22",
  },
  {
    icon: Globe,
    label: "GIS Integration",
    description: "Geodaten & Netze",
    color: "#2E86C1",
  },
  {
    icon: Users,
    label: "Personalplanung",
    description: "Team & Kapazitaet",
    color: "#8E44AD",
  },
  {
    icon: Zap,
    label: "Netzberechnung",
    description: "DPGSim & Export",
    color: "#27AE60",
  },
  {
    icon: FolderKanban,
    label: "Projektsteuerung",
    description: "Gantt & Meilensteine",
    color: "#E67E22",
  },
  {
    icon: PieChart,
    label: "Kostenanalyse",
    description: "Soll/Ist Dashboards",
    color: "#C0392B",
  },
  {
    icon: Cpu,
    label: "Prozess-Digitalisierung",
    description: "End-to-End Workflows",
    color: "#8E44AD",
  },
];

export function FokusthemenGrid() {
  return (
    <section id="fokusthemen" className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="text-3xl font-bold mb-4 text-center"
          style={{ color: PURPLE }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Unsere Kompetenzfelder
        </motion.h2>
        <motion.p
          className="text-gray-600 text-center mb-12 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          viewport={{ once: true }}
        >
          Von CAD-Automation bis Echtzeit-Dashboards: Jedes Thema wird von
          Praktikern betreut, die den Netzbau-Alltag kennen.
        </motion.p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {fokusthemen.map((thema, i) => (
            <motion.div
              key={thema.label}
              className="group relative rounded-2xl p-6 text-center border border-gray-100 cursor-default transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{ backgroundColor: thema.color + "08" }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              viewport={{ once: true }}
              whileHover={{
                borderColor: thema.color + "40",
              }}
            >
              <div
                className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center bg-white/80 transition-transform duration-300 group-hover:scale-110"
                style={{
                  boxShadow: `0 2px 12px ${thema.color}15`,
                }}
              >
                <thema.icon
                  size={28}
                  strokeWidth={1.5}
                  style={{ color: thema.color }}
                />
              </div>
              <h4 className="text-sm font-bold text-gray-900 mb-1">
                {thema.label}
              </h4>
              <p className="text-[11px] text-gray-500 font-medium">
                {thema.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
