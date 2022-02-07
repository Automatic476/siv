import { CURVE } from '@noble/ed25519'
import { useEffect } from 'react'

import { pick_private_coefficients } from '../../crypto/threshold-keygen'
import { PrivateBox } from '../PrivateBox'
import { StateAndDispatch } from '../trustee-state'

export const PrivateCoefficients = ({ dispatch, state }: StateAndDispatch) => {
  const trustees_w_recipient_keys = state.trustees?.filter((t) => t.recipient_key)

  useEffect(() => {
    // This effect will run once all parties have broadcast a recipient key
    if (!state.trustees || !state.parameters || trustees_w_recipient_keys?.length !== state.trustees.length) return

    // Don't run if we don't have our own local private keys (already joined from another device)
    if (!state.personal_key_pair) return

    // Don't run more than once
    if (state.private_coefficients) return

    // Generate your private polynomial
    const private_coefficients = pick_private_coefficients(state.parameters.t).map(String)

    dispatch({ private_coefficients })
  }, [state.trustees, trustees_w_recipient_keys?.length])

  if (!state.trustees || !state.parameters || trustees_w_recipient_keys?.length !== state.trustees.length) return <></>

  const coeffs = state.private_coefficients

  return (
    <>
      <h3>IV. Private Coefficients:</h3>
      <p>
        Each party picks their own private coefficients in ℤ<sub>l</sub>, f(x) = a<sub>0</sub> + a<sub>1</sub>x + ... +
        a<sub>t-1</sub>x<sup>t-1</sup> % l.
      </p>
      <PrivateBox>
        <p>Using Crypto.getRandomValues() on your device to generate your private polynomial...</p>
        <>
          {coeffs && (
            <p>
              f(x) ={' '}
              {coeffs.map((coeff, index) => (
                <span key={index}>
                  {coeff}
                  {index ? 'x' : ''}
                  {index > 1 && <sup>{index}</sup>}
                  {index !== coeffs.length - 1 && ' + '}
                </span>
              ))}{' '}
              % {CURVE.l}
            </p>
          )}
        </>
      </PrivateBox>
    </>
  )
}
