// Tableau générique : columns = [{ key, label, render? }], rows = []. Reste vide tant qu'il n'y a pas de données.
export default function Table({ title, columns, rows }) {
  return (
    <section>
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? row.device_id ?? i}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
