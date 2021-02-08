import { TextField } from '@material-ui/core'
import router from 'next/router'
import { useState } from 'react'

import { OnClickButton } from '../landing-page/Button'

export const EnterAuthToken = () => {
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  return (
    <div className="container">
      <h1>To cast a vote...</h1>
      <p>Enter your Voter Authorization Token:</p>
      <div className="row">
        <TextField
          autoFocus
          InputLabelProps={{ style: { fontSize: 22 } }}
          InputProps={{ style: { fontSize: 22 } }}
          error={!!error}
          helperText={error}
          label="Auth token"
          style={{ flex: 1, fontSize: 20 }}
          variant="outlined"
          onChange={(event) => {
            setError('')

            try {
              testAuthToken(event.target.value)
            } catch (e) {
              setError(e)
            }

            setText(event.target.value)
          }}
        />
        <OnClickButton
          disabled={text.length !== 10 || !!error}
          style={{ margin: 0, marginLeft: 10, padding: '19px 15px' }}
          onClick={async () => {
            // Update auth in URL
            const url = new URL(window.location.toString())
            url.searchParams.set('auth', text.toLowerCase())
            router.push(url)
          }}
        >
          Submit
        </OnClickButton>
      </div>
      <p className="grey">
        <i>Example:</i> 22671df063
        <br />
        <br />
        Auth tokens are 10 characters long, made up of the numbers <i>0–9</i> and the letters <i>a–f</i>.
        <br />
        <br />
        Unique for each election.
      </p>
      <style jsx>{`
        .container {
          max-width: 350px;
          margin: 0 auto;
        }

        .row {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
        }

        .grey {
          opacity: 0.6;
        }
      `}</style>
    </div>
  )
}

function testAuthToken(s: string) {
  const validRegEx = /^(\d|[a-f])*$/i
  // Check for invalid characters
  if (!validRegEx.test(s)) {
    const invalids = s.split('').filter((char) => !validRegEx.test(char))
    throw `Invalid character: ${invalids}`
  }

  // Check for too many characters
  if (s.length > 10) throw `Too many characters (by ${s.length - 10})`
}