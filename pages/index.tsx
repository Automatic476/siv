import Head from 'next/head'

import CallToAction from '../src/call-to-action'
import CollapsibleIntro from '../src/collapsible-intro'
import Demo from '../src/demo'
import PageviewCounter from '../src/pageviews'

export const Home = (): JSX.Element => (
  <div className="container">
    <Head>
      <title>SIV: Secure Internet Voting</title>
      <link href="/favicon.ico" rel="icon" />
      <meta content="minimum-scale=1, initial-scale=1, width=device-width" name="viewport" />
    </Head>

    <main>
      <h1>SIV: Secure Internet Voting</h1>

      <h2>Fast — Private — Verifiable</h2>

      <PageviewCounter />

      <CollapsibleIntro />

      <CallToAction />

      <Demo />
    </main>
  </div>
)

export default Home
