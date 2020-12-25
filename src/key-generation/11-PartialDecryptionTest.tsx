import { useEffect } from 'react'

import { partial_decrypt } from '../crypto/threshold-keygen'
import { big } from '../crypto/types'
import { EncryptionNote } from './EncryptionNote'
import { StateAndDispatch, getParameters } from './keygen-state'
import { PrivateBox } from './PrivateBox'

export const PartialDecryptionTest = ({ dispatch, state }: StateAndDispatch) => {
  const { parameters, partial_decryption: partial, private_keyshare, threshold_public_key } = state

  const plaintext = '2020'
  const randomizer = '108'

  useEffect(() => {
    // Don't start until we have the threshold key
    if (!threshold_public_key || !parameters || !private_keyshare) return

    const unlock = big(parameters.g).modPow(big(randomizer), big(parameters.p))

    const partial_decryption = partial_decrypt(unlock, big(private_keyshare), getParameters(state)).toString()

    dispatch({ partial_decryption })
  }, [threshold_public_key])

  if (!threshold_public_key || !parameters) {
    return <></>
  }

  const p = big(parameters.p)

  const encrypted = big(threshold_public_key).modPow(big(randomizer), p).multiply(big(plaintext)).mod(p)
  const unlock = big(parameters.g).modPow(big(randomizer), big(parameters.p))

  return (
    <>
      <h3>XI. Partial Decryption Test:</h3>
      <p>
        To confirm the new keyshares work, we can encrypt a message for the shared threshold public key and all work
        together to unlock it.
      </p>
      <p>
        We&apos;ll encrypt the message `{plaintext}` using `{randomizer}` as the randomizer.
      </p>
      <EncryptionNote />
      <ul>
        <li>
          encrypted = {plaintext} * ({threshold_public_key} ^ {randomizer}) % {parameters.p} ≡ {encrypted.toString()}
        </li>
        <li>
          unlock = ({parameters.g} ^ {randomizer}) % {parameters.p} ≡ {unlock.toString()}
        </li>
      </ul>
      <p>
        Now each trustee can contribute their partial decryption, using their secret keyshare:
        <br />
        <i>partial_decryption = unlock ^ trustees_keyshare % p</i>
      </p>
      <PrivateBox>
        <p>
          partial = {unlock.toString()} ^ {private_keyshare} % {parameters.p} ≡ {partial || '[pending...]'}
        </p>
      </PrivateBox>
    </>
  )
}
