import { SideBySide } from './SideBySide'

export const WhereAreWe = (): JSX.Element => (
  <div style={{ padding: '6.6vmax 17px' }}>
    <SideBySide
      graphic="voting.jpg"
      headline="Unusual Times"
      text="As states attempt re-opening, it’s becoming clear we face unprecedented challenges with safe and reliable voting."
    />
    <SideBySide
      flipped
      graphic="voting-line-ridic.jpg"
      headline="Early Warning Signs"
      text="Six hour waiting lines in Georgia. 600,000 voters in Kentucky forced to share a single polling location. Cancelled or postponed primaries in dozens of states."
    />
    <SideBySide
      graphic="vote-by-mail.jpg"
      headline="Search for Alternatives"
      text="Election officials and political advocates have rushed to provide safe alternatives. Especially Vote by Mail."
    />
  </div>
)