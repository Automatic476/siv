/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { useEffect } from 'react'

import { api } from '../api-helper'
import encrypt from '../crypto/encrypt'
import pickRandomInteger from '../crypto/pick-random-integer'
import { evaluate_private_polynomial } from '../crypto/threshold-keygen'
import { big, bigPubKey, toStrings } from '../crypto/types'
import { StateAndDispatch, getParameters } from './keygen-state'
import { PrivateBox } from './PrivateBox'
import { YouLabel } from './YouLabel'

export const PairwiseShares = ({ dispatch, state }: StateAndDispatch) => {
  const {
    encrypted_pairwise_shares: encrypteds,
    pairwise_randomizers: randomizers,
    pairwise_shares: shares,
    parameters,
    private_coefficients: coeffs,
    trustees,
  } = state
  const trustees_w_commitments = trustees?.filter((t) => t.commitments).length

  // Runs once, after all commitments have been broadcast
  useEffect(() => {
    // Need these before we begin
    if (!parameters || !trustees || !coeffs || trustees_w_commitments !== trustees.length) return

    // Don't run if we've already calculated these
    if (shares) return

    // Calculate pairwise shares
    const pairwise_shares = trustees.map((_, index) =>
      evaluate_private_polynomial(
        index,
        coeffs.map((c) => big(c)),
        getParameters(state),
      ).toString(),
    )

    dispatch({ pairwise_shares })

    // Encrypt the pairwise shares for the target recipients eyes only...

    // First we pick randomizers for each
    const pairwise_randomizers = trustees.map(() => pickRandomInteger(big(parameters.p)))

    // Then we encrypt
    const encrypted_pairwise_shares = trustees.map(({ recipient_key }, index) =>
      toStrings(
        encrypt(
          bigPubKey({ generator: parameters.g, modulo: parameters.p, recipient: recipient_key! }),
          pairwise_randomizers[index],
          big(pairwise_shares[index]),
        ),
      ),
    )

    dispatch({ encrypted_pairwise_shares, pairwise_randomizers: pairwise_randomizers.map((r) => r.toString()) })

    // Send encrypted_pairwise_shares to admin to broadcast
    api(`election/${state.election_id}/keygen/update`, {
      email: state.your_email,
      encrypted_pairwise_shares,
      trustee_auth: state.trustee_auth,
    })
  }, [coeffs, trustees_w_commitments])

  if (!trustees || !coeffs || trustees_w_commitments !== trustees.length) {
    return <></>
  }
  return (
    <>
      <h3>VI. Pairwise Shares:</h3>
      <p>Each trustee calculates private shares to send to others.</p>
      <PrivateBox>
        <p>Calculating pairwise shares...</p>
        <ol>
          {trustees.map(({ email, you }, trustee_index) => (
            <li key={email}>
              For {email}
              {you && <YouLabel />}
              <br />
              f({trustee_index + 1}) ={' '}
              {coeffs.map((coeff, term_index) => (
                <span key={term_index}>
                  {coeff}
                  {term_index ? `(${trustee_index + 1})` : ''}
                  {term_index > 1 && <sup>{term_index}</sup>}
                  {term_index !== coeffs.length - 1 && ' + '}
                </span>
              ))}{' '}
              % {parameters?.q} ≡ {state.pairwise_shares ? state.pairwise_shares[trustee_index] : '...'}
            </li>
          ))}
        </ol>
      </PrivateBox>
      <p>Encrypt the private shares so only the target recipient can read them.</p>
      <p>
        <code>
          encrypted = message * (recipient ^ randomizer) % modulo
          {'\n'}unlock = (generator ^ randomizer) % modulo
        </code>
      </p>
      <PrivateBox>
        <ol>
          {trustees.map(({ email, recipient_key, you }, index) => (
            <li key={email}>
              For {email}
              {you ? (
                <>
                  <YouLabel />, no need to encrypt to yourself.
                </>
              ) : (
                <>
                  , pub key = {recipient_key}, <br />
                  using randomizer {randomizers ? randomizers[index] : '...'}, so E(
                  {shares ? shares[index] : '...'}) = {encrypteds ? encrypteds[index] : '...'}
                </>
              )}
            </li>
          ))}
        </ol>
      </PrivateBox>
      <p>Send &amp; receive pairwise shares to all the other trustees.</p>
      <PrivateBox>
        <ol>
          <li>admin@secureinternetvoting.org sent you 16</li>
          <li>Your own share is 6</li>
          <li>other_trustee@yahoo.com sent you 21</li>
        </ol>
      </PrivateBox>
      <style jsx>{`
        li {
          margin-bottom: 15px;
        }

        code {
          font-size: 13px;
          margin-bottom: 20px;
          white-space: pre;
        }
      `}</style>
    </>
  )
}
