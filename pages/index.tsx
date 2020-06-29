import Head from 'next/head'
import Intro from './intro.md'

export const Home = (): JSX.Element => (
  <div className="container">
    <Head>
      <title>SIV: Secure Internet Voting</title>
      <link rel="icon" href="/favicon.ico" />
    </Head>

    <main>
      <Intro />
    </main>

    <style jsx global>{`
      html,
      body {
        padding: 0;
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans,
          Droid Sans, Helvetica Neue, sans-serif;
        background-color: #fcfcfc;
        color: #222;
      }

      * {
        box-sizing: border-box;
      }

      .container {
        min-height: 100vh;
        padding: 0 0.5rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }

      main {
        padding: 5rem 0;
        max-width: 600px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }

      a {
        color: #0070f3;
        text-decoration: none;
      }

      a:hover,
      a:focus,
      a:active {
        text-decoration: underline;
      }

      h1,
      h2 {
        text-align: center;
      }

      h1 {
        margin: 0;
        line-height: 1.15;
        font-size: 2rem;
      }

      h2 {
        line-height: 1.5;
        font-size: 1.4rem;
      }

      h3,
      p {
        width: 100%;
      }
    `}</style>
  </div>
)

export default Home
