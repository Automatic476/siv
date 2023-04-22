import { keyBy, orderBy } from 'lodash-es'
import TimeAgo from 'timeago-react'

import { mapValues } from '../utils'
import { useDecryptedVotes } from './use-decrypted-votes'
import { useElectionInfo } from './use-election-info'

export const Totals = ({ proofsPage }: { proofsPage?: boolean }): JSX.Element => {
  const { ballot_design, last_decrypted_at } = useElectionInfo()
  const votes = useDecryptedVotes()

  // Stop if we don't have enough data yet
  if (!ballot_design || !votes || !votes.length) return <></>

  const items_by_id = keyBy(ballot_design, 'id')
  const multi_vote_regex = /_\d+$/

  // Sum up votes
  const tallies: Record<string, Record<string, number>> = {}
  votes.forEach((vote) => {
    Object.keys(vote).forEach((key) => {
      // Skip 'tracking' key
      if (key === 'tracking') return

      let item = key

      // Is this item the multiple_votes_allowed format?
      const multi_suffix = key.match(multi_vote_regex)
      // We'll also check that it's not on the ballot schema, just to be safe
      if (multi_suffix && !items_by_id[key]) {
        // If so, we need to add all tallies to seed id, not the derived keys
        item = key.slice(0, -(multi_suffix.length + 1))
      }

      // Init item if new
      tallies[item] = tallies[item] || {}

      // Init selection if new
      tallies[item][vote[key]] = tallies[item][vote[key]] || 0

      // Increment by 1
      tallies[item][vote[key]]++
    })
  })
  const totalsCastPerItems: Record<string, number> = {}
  Object.keys(tallies).forEach((item) => {
    totalsCastPerItems[item] = 0
    Object.keys(tallies[item]).forEach((choice) => (totalsCastPerItems[item] += tallies[item][choice]))
  })

  // Sort each item's totals from highest to lowest, with ties sorted alphabetically
  const ordered = mapValues(tallies, (item_totals, item_id) =>
    orderBy(
      orderBy(Object.keys(item_totals as Record<string, number>)),
      (selection) => tallies[item_id][selection],
      'desc',
    ),
  ) as Record<string, string[]>

  return (
    <div className="totals" style={{ display: proofsPage ? 'inline-block' : undefined }}>
      <div className="title-line">
        <h3>Vote Totals:</h3>
        {last_decrypted_at && !proofsPage && (
          <span>
            Last updated: <TimeAgo datetime={last_decrypted_at} opts={{ minInterval: 60 }} />
          </span>
        )}
      </div>
      {ballot_design.map(({ id = 'vote', title }) => (
        <div key={id}>
          <h4>{title}</h4>
          <ul>
            {ordered[id].map((selection) => (
              <li key={selection}>
                {selection}: {tallies[id][selection]}{' '}
                <i style={{ fontSize: 12, marginLeft: 5, opacity: 0.5 }}>
                  ({((100 * tallies[id][selection]) / totalsCastPerItems[id]).toFixed(1)}%)
                </i>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <style jsx>{`
        .totals {
          background: #fff;
          border-radius: 8px;
          padding: 1rem;

          box-shadow: 0px 1px 2px hsl(0 0% 50% / 0.333), 0px 3px 4px hsl(0 0% 50% / 0.333),
            0px 4px 6px hsl(0 0% 50% / 0.333);
        }

        .title-line {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        h3 {
          margin-top: 0;
        }

        span {
          font-size: 11px;
          opacity: 0.5;
          text-align: right;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}
