export default function SectionCard({
  title,
  description,
  badge,
  badgeTone = "green",
  primaryAction,
  secondaryAction,
  size = "col-4",
}) {
  const badgeClass = badgeTone === "red" ? "badge red" : "badge";

  return (
    <section className={`card ${size}`}>
      <div className="cardHeader">
        <div className="cardTitle">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>

        {badge ? <div className={badgeClass}>{badge}</div> : null}
      </div>

      <div className="cardBody">
        Clique para acessar esta seção. Vamos evoluir isso com dados reais da API do Protheus (KPIs, status e listas).
      </div>

      <div className="cardFooter">
        {primaryAction ? (
          <button className="btn btnPrimary" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </button>
        ) : null}

        {secondaryAction ? (
          <button className="btn btnDanger" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </button>
        ) : null}
      </div>
    </section>
  );
}
