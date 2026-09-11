/**
 * components/GenerativeUICard/index.jsx
 *
 * Switches on `type` and renders the matching card component.
 * Spec §6: StatCard | TableCard | BadgeList
 *
 * Add more types here for {{GOAL_TOPIC}}-specific cards tomorrow.
 */
import React from 'react'
import StatCard from './StatCard'
import TableCard from './TableCard'
import BadgeList from './BadgeList'

export default function GenerativeUICard({ type, data }) {
  switch (type) {
    case 'stat':
      return <StatCard data={data} />
    case 'table':
      return <TableCard data={data} />
    case 'badge':
      return <BadgeList data={data} />
    default:
      // Unknown type — render raw JSON as fallback (useful for debugging tomorrow)
      return (
        <div className="glass-card p-3">
          <p className="text-xs text-gray-500 mb-1">Unknown card type: <code>{type}</code></p>
          <pre className="text-xs text-gray-300 overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )
  }
}
