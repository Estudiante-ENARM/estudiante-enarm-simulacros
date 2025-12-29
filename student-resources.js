/* ================================
   BIBLIOTECA (RESÚMENES/GPC) — UI 2.0
   Aislado para no afectar simulacros
   ================================ */

body.modal-open { overflow: hidden; }

/* En la biblioteca, colapsa el layout a 1 columna y desactiva el panel derecho */
#student-resources-view[data-ui="cards"] .resources-columns { grid-template-columns: 1fr; }
#student-resources-view[data-ui="cards"] #student-resources-detail { display: none; }

/* Controles */
#student-resources-view .resources-controls { gap: 10px; }

#student-resources-view .resources-controls input,
#student-resources-view .resources-controls select {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
  transition: box-shadow 160ms ease, border-color 160ms ease;
}

#student-resources-view .resources-controls input:focus,
#student-resources-view .resources-controls select:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 4px rgba(59,130,246,0.15);
}

/* Grid de cards */
#student-resources-view .resources-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 920px) {
  #student-resources-view .resources-grid { grid-template-columns: 1fr; }
}

.resource-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
}

.resource-card:hover {
  transform: translateY(-2px);
  border-color: #dbeafe;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.10);
}

.resource-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.resource-card__meta { min-width: 0; }

.resource-card__specialty {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
  margin-bottom: 8px;
  white-space: nowrap;
}

.resource-card__title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
  word-break: break-word;
}

.resource-card__open { flex: 0 0 auto; }

.resource-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.resource-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #0f172a;
}

.resource-badge--muted {
  background: #f8fafc;
  color: #64748b;
}

/* Modal */
.resources-modal.hidden { display: none; }

.resources-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.resources-modal__overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
}

.resources-modal__panel {
  position: absolute;
  right: 18px;
  left: 18px;
  top: 70px;
  max-width: 860px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}

.resources-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.resources-modal__headtext { min-width: 0; }

.resources-modal__badge {
  display: inline-flex;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.10);
  color: #0369a1;
  margin-bottom: 8px;
}

.resources-modal__title {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
  word-break: break-word;
}

.resources-modal__body {
  padding: 14px;
  max-height: calc(100vh - 160px);
  overflow: auto;
}

.resources-modal__section { margin-bottom: 14px; }

.resources-modal__section-title {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 10px;
}

.resources-modal__buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 620px) {
  .resources-modal__buttons { grid-template-columns: 1fr; }
  .resources-modal__panel { top: 56px; }
}

.resource-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  color: #0f172a;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
}

.resource-btn:hover {
  transform: translateY(-1px);
  border-color: #dbeafe;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.10);
}
