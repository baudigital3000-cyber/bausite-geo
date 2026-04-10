"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clock, Calendar } from "lucide-react";

const PURPLE = "#632E62";

const articles = [
  {
    tag: "Digitalisierung",
    title: "Warum 80% der Netzbauer noch auf Papier setzen",
    excerpt:
      "Die Digitalisierung im Tiefbau hinkt anderen Branchen hinterher. Wir zeigen, woran es liegt und wie der Einstieg gelingt.",
    date: "12. Maerz 2026",
    readTime: "5 Min.",
    color: "#2E86C1",
  },
  {
    tag: "GIS & CAD",
    title: "GIS-Daten im Netzbau: Von der Planung bis zur Dokumentation",
    excerpt:
      "Wie FME-Workflows den Datenaustausch zwischen CAD, GIS und Betriebsinformationssystemen automatisieren.",
    date: "5. Maerz 2026",
    readTime: "7 Min.",
    color: "#8E44AD",
  },
  {
    tag: "Praxis",
    title:
      "Von 45 auf 8 Minuten: Wie ein Wasserwerk die Baudokumentation digitalisierte",
    excerpt:
      "Ein Praxisbericht ueber die Einfuehrung digitaler Grabenbau-Dokumentation bei einem Schweizer Versorgungswerk.",
    date: "25. Februar 2026",
    readTime: "6 Min.",
    color: "#27AE60",
  },
];

export function BlogSection() {
  return (
    <section id="blog" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="text-3xl font-bold mb-4 text-center"
          style={{ color: PURPLE }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Wissen aus der Praxis
        </motion.h2>
        <motion.p
          className="text-gray-600 text-center mb-12 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          viewport={{ once: true }}
        >
          Erfahrungen, Methoden und Erkenntnisse aus ueber 14 Jahren
          Netzbau-Digitalisierung.
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {articles.map((article, i) => (
            <motion.article
              key={article.title}
              className="group bg-white border border-gray-200 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex flex-col"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              {/* Colored top accent line */}
              <div
                className="h-1 w-full"
                style={{
                  background: `linear-gradient(90deg, ${article.color}, ${article.color}99)`,
                }}
              />

              <div className="p-7 flex flex-col flex-grow">
                {/* Tag */}
                <span
                  className="inline-block w-fit text-[10px] font-semibold px-2.5 py-1 rounded-sm uppercase tracking-wider mb-5"
                  style={{
                    backgroundColor: article.color + "15",
                    color: article.color,
                  }}
                >
                  {article.tag}
                </span>

                {/* Title */}
                <h3
                  className="text-lg font-bold text-gray-900 leading-snug mb-3 transition-colors duration-300"
                  style={{
                    // CSS can't do group-hover inline, so we keep it simple
                  }}
                >
                  {article.title}
                </h3>

                {/* Excerpt */}
                <p className="text-sm text-gray-600 leading-relaxed flex-grow mb-6">
                  {article.excerpt}
                </p>

                {/* Meta + Read more */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-[11px] text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} />
                      {article.date}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} />
                      {article.readTime}
                    </span>
                  </div>
                  <span
                    className="text-xs font-semibold inline-flex items-center gap-1 transition-all duration-300 group-hover:gap-2"
                    style={{ color: PURPLE }}
                  >
                    Lesen
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* All articles link */}
        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          viewport={{ once: true }}
        >
          <span
            className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer transition-all duration-300 hover:gap-3"
            style={{ color: PURPLE }}
          >
            Alle Beitraege anzeigen
            <ArrowRight size={16} />
          </span>
        </motion.div>
      </div>
    </section>
  );
}
