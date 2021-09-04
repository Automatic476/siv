import router from 'next/router'

import { Milestone } from './Milestone'
import styles from './protocol.module.css'
import { useScrollContext } from './ScrollContext'
import { Step } from './Step'
import { stepHash } from './step-hash'
import { groupedSteps } from './steps'

export const Content = () => (
  <div
    id="protocol"
    style={{
      bottom: 0,
      left: 268,
      overflowY: 'scroll',
      position: 'absolute',
      right: 0,
      top: 0,
    }}
    onScroll={saveScrollPosition(useScrollContext())}
  >
    {/* Header */}
    <div style={{ backgroundColor: 'white', padding: '10px 30px' }}>
      <p style={{ fontSize: 21, fontWeight: 700, marginBottom: 0 }}>Secure Internet Voting (SIV) Protocol Overview</p>
      <p style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}>Fast, Private, Verifiable</p>
      <p className={styles.p}>Voting Method with mathematically provable privacy &amp; vote verifiability.</p>
    </div>

    {/* Main steps */}
    {groupedSteps.map(({ group, steps }) => (
      <div key={group}>
        {Milestone(group)}
        {steps.map(Step)}
      </div>
    ))}

    {/* Fin */}
    <div style={{ paddingBottom: 60, textAlign: 'center' }}>
      <img src={`./protocol/step-fin.png`} style={{ maxWidth: 600, width: '100%' }} />
    </div>

    <style jsx>{`
      /* Add padding when Topbar is visible */
      @media (max-width: 1030px) {
        #protocol {
          top: 45px !important;
          left: 0 !important;
        }
      }
    `}</style>
  </div>
)

function saveScrollPosition({ dispatch, state }: ReturnType<typeof useScrollContext>) {
  return ({ currentTarget }: { currentTarget: HTMLElement }) => {
    const scrollPos = currentTarget.scrollTop
    const { innerHeight, innerWidth } = window

    // Find currently scrolled to step
    let current = 'Voter Registration'
    for (const step in state) {
      const yOffset = state[step]

      // Did we scroll past the step?
      // For sidebar, count when it passes midpoint.
      // For topbar, when it crosses top.
      const adjustment = innerWidth < 1030 ? 0 : innerHeight / 2
      if (scrollPos + adjustment >= Number(yOffset)) {
        current = step
      }
    }

    if (current !== state.current) {
      dispatch({ current })
      router.replace(`#${stepHash[current]}`)
    }
  }
}
