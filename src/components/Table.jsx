// Tableau générique : columns = [{ key, label, render?, className? }], rows = [].
// Sur mobile, chaque ligne s'affiche en carte : data-label donne l'intitulé de chaque cellule (styles.css).
export default function Table({ columns, rows, empty = 'Aucune donnée', rowKey = (row, i) => row.id ?? row.device_id ?? i }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.className}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={rowKey(row, i)}>
              {columns.map((c) => <td key={c.key} className={c.className} data-label={c.label || undefined}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
