import { Button, TextField } from '@material-ui/core'
import { firestore } from 'firebase/app'
import { useState } from 'react'

const email = 'contact@secureinternetvoting.org'

export const Footer = (): JSX.Element => {
  const [saved, setSaved] = useState(false)

  return (
    <div style={{ padding: '6.6vmax 17px' }}>
      <div>
        <h3>Democracy Knowledge & News</h3>
        <p>Sign up with your email address to receive occasional updates.</p>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <TextField
            id="newsletter-signup-field"
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 15 } }}
            label="Email Address"
            onChange={() => setSaved(false)}
            size="small"
            style={{ backgroundColor: '#fff8', flex: 1, marginRight: 10 }}
            variant="outlined"
          />
          <Button
            color="primary"
            disabled={saved}
            onClick={() => {
              const fields = {
                created_at: new Date().toString(),
                email: (document.getElementById('newsletter-signup-field') as HTMLInputElement).value,
              }

              // Store submission in Firestore
              firestore()
                .collection('news-signups')
                .doc(new Date().toISOString() + ' ' + String(Math.random()).slice(2, 7))
                .set(fields)
                .then(() => {
                  setSaved(true)

                  // Notify via Pushover
                  fetch('/api/pushover', {
                    body: JSON.stringify({
                      message: fields.email,
                      title: `SIV newsletter signup`,
                    }),
                    headers: {
                      Accept: 'application/json',
                      'Content-Type': 'application/json',
                    },
                    method: 'POST',
                  })
                })
            }}
            variant="outlined"
          >
            {saved ? 'Done!' : 'Sign Up'}
          </Button>
        </div>
      </div>

      <div>
        <h3>SIV</h3>
        <p>
          <a href="mailto:contact@secureinternetvoting.org?subject=Schedule%20a%20Consultation&body=Hi%2C%20%0A%0AI%20work%20for%20a%20government%20and%20would%20like%20to%20find%20a%20time%20to%20talk%20about%20adopting%20Secure%20Internet%20Voting.%20">
            For Governments
          </a>
        </p>
        <p>
          <a href="/">Study Protocol</a>
        </p>
        <p>
          <a href={`mailto:${email}`}>{email}</a>
        </p>
      </div>
    </div>
  )
}
